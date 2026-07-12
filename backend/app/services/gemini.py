import os
import json
import uuid
import datetime
import asyncio
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import numpy as np
import onnxruntime as ort

from backend.app.config.settings import settings
from backend.app.database import crud, models
from backend.app.schemas import schemas
from backend.app.config.metrics import (
    llm_tokens_total,
    agent_steps_total,
    agent_latency_seconds,
    agent_tool_calls_total
)

# Global variable to hold the ONNX inference session
onnx_session= None

def init_onnx_session(model_path: str):
    """
    Initializes the global ONNX runtime inference session.
    """
    global onnx_session
    try:
        onnx_session= ort.InferenceSession(model_path)
        print(f"ONNX Model successfully loaded from {model_path}")
    except Exception as e:
        print(f"Error loading ONNX session from {model_path}: {str(e)}")

# Initialize Google GenAI Client
client = None
if settings.GEMINI_API_KEY:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

async def generate_text(prompt: str) -> str:
    """
    Generates text using the Gemini model. Runs the synchronous SDK call 
    in an executor to avoid blocking the asyncio event loop. Used by Celery.
    """
    if not settings.GEMINI_API_KEY or client is None:
        print("Warning: GEMINI_API_KEY not set. Returning a fallback mock response.")
        return f"[Mock Analysis for prompt: {prompt[:60]}...]"

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, 
            lambda: client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
        )
        return response.text
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        return f"[Error generating content: {str(e)}]"

def extract_json_payload(text: str) -> dict:
    """
    Extracts and parses a JSON payload from text.
    Handles raw JSON, markdown-wrapped JSON, and loose curly-braced substrings.
    """
    import re
    cleaned = text.strip()
    
    # 1. Try direct loading
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
        
    # 2. Try markdown json block: ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
            
    # 3. Try finding the first '{' and the last '}'
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            return json.loads(cleaned[start_idx:end_idx+1].strip())
        except json.JSONDecodeError:
            pass
            
    raise ValueError(f"Could not extract JSON from: {text}")


def compute_atr_levels(
    history: list,
    close_price: float,
    action: str,
    atr_multiplier: float = 1.5
) -> tuple:
    """
    Computes ATR-14 volatility-adjusted target and stop-loss price levels.

    Uses a 1.5× ATR stop and 2:1 risk-reward target by default. Falls back
    to fixed ±1%/±2% percentages when fewer than 14 candles are available.

    Args:
        history: List of StockHistory ORM objects (oldest → newest).
        close_price: The current closing price (entry price).
        action: "BUY", "SELL", or "HOLD".
        atr_multiplier: Multiplier applied to ATR for stop distance.

    Returns:
        (target_price, stop_loss) tuple of floats, or (None, None) for HOLD.
    """
    if action == "HOLD":
        return None, None

    if len(history) >= 14:
        try:
            import pandas as pd
            import pandas_ta as _pta  # noqa: F401 — side-effect registers .ta accessor

            df = pd.DataFrame([{
                "high":  float(h.high),
                "low":   float(h.low),
                "close": float(h.close),
            } for h in history])

            df.ta.atr(length=14, append=True)

            # pandas-ta names the ATR column "ATRr_14" regardless of percent flag
            atr_col = next((c for c in df.columns if c.startswith("ATRr_")), None)
            if atr_col:
                atr = float(df[atr_col].iloc[-1])
                if atr > 0:
                    if action == "BUY":
                        stop_loss    = close_price - (atr_multiplier * atr)
                        target_price = close_price + (2.0 * atr_multiplier * atr)  # 2:1 R:R
                    else:  # SELL
                        stop_loss    = close_price + (atr_multiplier * atr)
                        target_price = close_price - (2.0 * atr_multiplier * atr)
                    return round(target_price, 4), round(stop_loss, 4)
        except Exception as atr_err:
            print(f"[ATR] Computation failed, using fixed %: {atr_err}")

    # Fallback: fixed percentage when not enough candle data
    if action == "BUY":
        return round(close_price * 1.02, 4), round(close_price * 0.99, 4)
    return round(close_price * 0.98, 4), round(close_price * 1.01, 4)

async def get_onnx_prediction(db: AsyncSession, ticker: str) -> int:
    """
    Computes the ONNX model prediction for a given ticker.
    Returns a probability score between 0 and 100.
    """
    import pandas as pd
    import pandas_ta as ta
    
    try:
        history = await crud.get_stock_history(db, ticker.upper(), limit=100)
        if not history or len(history) < 26 or onnx_session is None:
            # Fallback mockup calculation if not enough data or session is missing
            if history:
                df = pd.DataFrame([{"close": h.close} for h in history])
                if len(df) >= 14:
                    df.ta.rsi(close="close", length=14, append=True)
                    rsi = df.iloc[-1].get("RSI_14", 50.0)
                else:
                    rsi = 50.0
            else:
                rsi = 50.0
            return int(min(max(rsi * 1.1, 10.0), 90.0))
            
        df = pd.DataFrame([{
            "open": h.open,
            "high": h.high,
            "low": h.low,
            "close": h.close,
            "volume": h.volume
        } for h in history])
        
        df.ta.rsi(close="close", length=14, append=True)
        df.ta.macd(close="close", fast=12, slow=26, signal=9, append=True)
        df.ta.ema(close="close", length=20, append=True)
        df["EMA_20_ratio"] = (df["close"] - df["EMA_20"]) / df["EMA_20"]
        
        latest = df.iloc[-1]
        rsi_val = float(latest.get("RSI_14", 50.0))
        macd_val = float(latest.get("MACD_12_26_9", 0.0))
        macds_val = float(latest.get("MACDs_12_26_9", 0.0))
        ema_ratio_val = float(latest.get("EMA_20_ratio", 0.0))
        
        input_data = np.array([[rsi_val, macd_val, macds_val, ema_ratio_val]], dtype=np.float32)
        input_name = onnx_session.get_inputs()[0].name
        label, prob = onnx_session.run(None, {input_name: input_data})
        
        if isinstance(prob, list) and len(prob) > 0:
            p_dict = prob[0]
            if isinstance(p_dict, dict):
                p_val = p_dict.get(1, 0.5)
            else:
                p_val = prob[0][0][1]
        else:
            p_val = prob[0][1]
            
        p_val_clipped = min(max(float(p_val), 0.0), 1.0)
        return int(p_val_clipped * 100)
    except Exception as e:
        print(f"Error computing ONNX prediction helper: {e}")
        return 50

async def run_agent_chat(db: AsyncSession, user_id: uuid.UUID, prompt: str) -> dict:
    """
    Runs the Gemini ReAct agent loop using native automatic function calling.
    Exposes local technical analysis tools and alert creation to the model.
    Runs async CRUD queries thread-safely back on the main event loop.
    Returns a dictionary: {"bullish_probability": int, "reason": str}
    """
    if not settings.GEMINI_API_KEY:
        # Development fallback if API key is not set
        return {
            "bullish_probability": 50,
            "reason": "Gemini API key is not set. Running in offline mockup mode."
        }

    # Fetch user subscription tier for metrics labeling
    user = await crud.get_user(db, user_id)
    user_tier = user.subscription_tier if user else "free"

    main_loop = asyncio.get_running_loop()

    # 1. Define tools inside the function to capture db and user_id via closure
    def get_user_watchlist() -> list[str]:
        """
        Retrieves the tickers on the user's active watchlist.
        """
        try:
            coro = crud.get_user_watchlist(db, user_id)
            future = asyncio.run_coroutine_threadsafe(coro, main_loop)
            watchlist = future.result()
            agent_tool_calls_total.labels(tool_name="get_user_watchlist", status="success").inc()
            return [w.ticker for w in watchlist]
        except Exception as e:
            agent_tool_calls_total.labels(tool_name="get_user_watchlist", status="failed").inc()
            raise e

    def get_stock_history_and_indicators(ticker: str) -> str:
        """
        Retrieves the previous 100 historical stock candles for a ticker and
        calculates technical indicators (RSI, MACD, EMAs) using pandas-ta.
        """
        import pandas as pd
        import pandas_ta as ta

        try:
            coro = crud.get_stock_history(db, ticker.upper(), limit=100)
            future = asyncio.run_coroutine_threadsafe(coro, main_loop)
            history = future.result()

            if not history:
                agent_tool_calls_total.labels(tool_name="get_stock_history_and_indicators", status="success").inc()
                return json.dumps({"error": f"No stock history found for ticker {ticker}."})

            # Convert to DataFrame
            df = pd.DataFrame([{
                "open": h.open,
                "high": h.high,
                "low": h.low,
                "close": h.close,
                "volume": h.volume,
                "timestamp": h.timestamp.isoformat()
            } for h in history])

            if len(df) < 26:
                # Not enough candles to compute MACD
                latest = df.iloc[-1].to_dict()
                latest["note"] = "Not enough candles to compute full technical indicators (minimum 26 required)."
                agent_tool_calls_total.labels(tool_name="get_stock_history_and_indicators", status="success").inc()
                return json.dumps(latest)

            # Compute indicators
            df.ta.rsi(close="close", length=14, append=True)
            df.ta.macd(close="close", fast=12, slow=26, signal=9, append=True)
            df.ta.ema(close="close", length=20, append=True)
            df.ta.ema(close="close", length=20, append=True)

            latest = df.iloc[-1].to_dict()
            agent_tool_calls_total.labels(tool_name="get_stock_history_and_indicators", status="success").inc()
            return json.dumps(latest)
        except Exception as e:
            agent_tool_calls_total.labels(tool_name="get_stock_history_and_indicators", status="failed").inc()
            raise e

    def get_ml_prediction(ticker: str) -> str:
        """
        Feeds technical indicators into the ONNX machine learning model
        to predict the upward price probability (0 to 100 percent).
        """
        try:
            coro = get_onnx_prediction(db, ticker)
            future = asyncio.run_coroutine_threadsafe(coro, main_loop)
            bullish_prob = future.result()
            
            # Log prediction to database (MLOps loop)
            try:
                # Fetch 20 candles so ATR-14 has enough lookback depth
                history_coro = crud.get_stock_history(db, ticker.upper(), limit=20)
                history_future = asyncio.run_coroutine_threadsafe(history_coro, main_loop)
                history = history_future.result()
                # History is returned oldest→newest; [-1] is the most recent candle
                close_price = float(history[-1].close) if history else 0.0

                predicted_action = "BUY" if bullish_prob >= 55 else "SELL" if bullish_prob <= 45 else "HOLD"
                # ATR-adjusted levels replace the old hardcoded ±1%/±2% math
                target_price, stop_loss = compute_atr_levels(history, close_price, predicted_action)
                
                is_mock = (onnx_session is None)
                model_ver = "mock_v1.0" if is_mock else "v1.0"
                
                log_coro = crud.create_prediction_log(
                    db=db,
                    user_id=user_id,
                    ticker=ticker.upper(),
                    model_version=model_ver,
                    confidence=float(bullish_prob) / 100.0,
                    predicted_action=predicted_action,
                    entry_price=close_price,
                    target_price=target_price,
                    stop_loss=stop_loss
                )
                log_future = asyncio.run_coroutine_threadsafe(log_coro, main_loop)
                log_future.result()
            except Exception as log_err:
                print(f"MLOps: Failed to log prediction to database: {log_err}")

            agent_tool_calls_total.labels(tool_name="get_ml_prediction", status="success").inc()
            
            is_mock = (onnx_session is None)
            status_str = "dev_mock_mode" if is_mock else "onnx_inference"
            
            return json.dumps({
                "ticker": ticker.upper(),
                "bullish_probability": bullish_prob,
                "status": status_str
            })
        except Exception as e:
            agent_tool_calls_total.labels(tool_name="get_ml_prediction", status="failed").inc()
            raise e

    def get_user_alerts() -> list[dict]:
        """
        Retrieves all active and inactive price alerts configured by the user.
        """
        try:
            coro = crud.get_user_alerts(db, user_id)
            future = asyncio.run_coroutine_threadsafe(coro, main_loop)
            alerts = future.result()
            agent_tool_calls_total.labels(tool_name="get_user_alerts", status="success").inc()
            return [{
                "id": str(a.id),
                "ticker": a.ticker,
                "target_price": a.target_price,
                "condition": a.condition,
                "is_active": a.is_active
            } for a in alerts]
        except Exception as e:
            agent_tool_calls_total.labels(tool_name="get_user_alerts", status="failed").inc()
            raise e

    def create_price_alert(ticker: str, target_price: float, condition: str) -> str:
        """
        Creates a new price alert for a stock.
        - ticker: Stock symbol (e.g. AAPL)
        - target_price: Trigger price (e.g. 175.50)
        - condition: 'above' or 'below'
        """
        try:
            alert_in = schemas.AlertCreate(
                ticker=ticker.upper(),
                target_price=target_price,
                condition=condition.lower()
            )
            coro = crud.create_alert(db, user_id, alert_in)
            future = asyncio.run_coroutine_threadsafe(coro, main_loop)
            alert = future.result()
            agent_tool_calls_total.labels(tool_name="create_price_alert", status="success").inc()
            return f"Successfully created alert: {alert.ticker} {alert.condition} {alert.target_price} (ID: {alert.id})"
        except Exception as e:
            agent_tool_calls_total.labels(tool_name="create_price_alert", status="failed").inc()
            raise e

    # 2. Map tools and build the GenerativeModel config
    tools = [
        get_user_watchlist,
        get_stock_history_and_indicators,
        get_ml_prediction,
        get_user_alerts,
        create_price_alert
    ]

    # If API key is not configured or client is none, return offline mock
    if not settings.GEMINI_API_KEY or client is None:
        return {
            "bullish_probability": 50,
            "reason": "Gemini API key is not set. Running in offline mockup mode."
        }

    # 3. Create the chat session using the new chats service
    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            tools=tools,
            system_instruction=(
                "You are the QuantIQ AI Analyst. "
                "Examine the requested stock and gather all necessary details using your tools. "
                "You must refer to your machine learning predictions tool as the 'QuantIQ ML Signal Engine' "
                "and your technical indicators tool as 'QuantIQ Technical Indicators' in your reasoning. "
                "You must return your response in JSON format matching this schema: "
                '{"bullish_probability": int, "reason": "string"}. '
                "Ensure 'bullish_probability' is between 0 and 100 representing the upward price probability. "
                "The 'reason' should be a detailed, structured, and comprehensive quantitative analysis. "
                "Explain the technical metrics, crossover directions, and the ML Signal Engine predictions clearly. "
                "Highlight key indicators, specific values, and signal strengths using bold markdown formatting "
                "to make the analysis clear and professional.\n"
                "CRITICAL: If the bullish probability score is below 50% (e.g. 45%), you must explain it as a bearish bias or neutral-to-bearish outlook. "
                "Clearly state that a lower bullish probability (like 45%) means a dominant bearish probability (like 55%). "
                "Never let the word 'bullish' stand alone in the explanation of a bearish score, as it confuses readers who see a Bearish Bias label."
            )
        )
    )
    
    start_time = asyncio.get_event_loop().time()
    try:
        response = await main_loop.run_in_executor(
            None,
            lambda: chat.send_message(prompt)
        )
        duration = asyncio.get_event_loop().time() - start_time
        
        # Track agent latency
        agent_latency_seconds.observe(duration)
        
        # Track token usage if available in the response
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            try:
                llm_tokens_total.labels(direction="input", user_tier=user_tier).inc(response.usage_metadata.prompt_token_count)
                llm_tokens_total.labels(direction="output", user_tier=user_tier).inc(response.usage_metadata.candidates_token_count)
            except Exception as token_err:
                print(f"Failed to record token usage metrics: {token_err}")

        # Track reasoning steps/turns in this agent session
        try:
            steps = 0
            for msg in chat.get_history():
                for part in msg.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        steps += 1
            agent_steps_total.labels(status="success").inc(steps)
        except Exception as step_err:
            print(f"Failed to record agent steps metrics: {step_err}")

        data = extract_json_payload(response.text)
        return {
            "bullish_probability": data.get("bullish_probability", 50),
            "reason": data.get("reason", "No analysis summary could be generated.")
        }
    except Exception as e:
        duration = asyncio.get_event_loop().time() - start_time
        agent_latency_seconds.observe(duration)
        agent_steps_total.labels(status="failed").inc(1)
        print(f"Error in Gemini ReAct Agent: {str(e)}")
        return {
            "bullish_probability": 50,
            "reason": f"Agent error occurred: {str(e)}"
        }