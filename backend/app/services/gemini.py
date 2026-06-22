import os
import json
import uuid
import datetime
import asyncio
import google.generativeai as genai  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import numpy as np
import onnxruntime as ort

from backend.app.config.settings import settings
from backend.app.database import crud, models
from backend.app.schemas import schemas

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

# Configure Google Generative AI API client
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

async def generate_text(prompt: str) -> str:
    """
    Generates text using the Gemini model. Runs the synchronous SDK call 
    in an executor to avoid blocking the asyncio event loop. Used by Celery.
    """
    if not settings.GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY not set. Returning a fallback mock response.")
        return f"[Mock Analysis for prompt: {prompt[:60]}...]"

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, 
            lambda: model.generate_content(prompt)
        )
        return response.text
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        return f"[Error generating content: {str(e)}]"

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

    main_loop = asyncio.get_running_loop()

    # 1. Define tools inside the function to capture db and user_id via closure
    def get_user_watchlist() -> list[str]:
        """
        Retrieves the tickers on the user's active watchlist.
        """
        coro = crud.get_user_watchlist(db, user_id)
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        watchlist = future.result()
        return [w.ticker for w in watchlist]

    def get_stock_history_and_indicators(ticker: str) -> str:
        """
        Retrieves the previous 100 historical stock candles for a ticker and
        calculates technical indicators (RSI, MACD, EMAs) using pandas-ta.
        """
        import pandas as pd
        import pandas_ta as ta

        coro = crud.get_stock_history(db, ticker.upper(), limit=100)
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        history = future.result()

        if not history:
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
            return json.dumps(latest)

        # Compute indicators
        df.ta.rsi(close="close", length=14, append=True)
        df.ta.macd(close="close", fast=12, slow=26, signal=9, append=True)
        df.ta.ema(close="close", length=20, append=True)

        latest = df.iloc[-1].to_dict()
        return json.dumps(latest)

    def get_ml_prediction(ticker: str) -> str:
        """
        Feeds technical indicators into the ONNX machine learning model
        to predict the upward price probability (0 to 100 percent).
        """
        import pandas as pd
        import pandas_ta as ta

        coro = crud.get_stock_history(db, ticker.upper(), limit=100)
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        history = future.result()

        if not history:
            return json.dumps({"ticker": ticker, "error": "No history available"})

        df = pd.DataFrame([{
            "open": h.open,
            "high": h.high,
            "low": h.low,
            "close": h.close,
            "volume": h.volume
        } for h in history])

        if len(df) >= 26 and onnx_session is not None:
            try:
                df.ta.rsi(close= "close", length= 14, append= True)
                df.ta.macd(close= "close", fast= 12, slow= 26, signal= 9, append= True)
                df.ta.ema(close= "close", length= 20, append= True)
                df["EMA_20_ratio"]= (df["close"] - df["EMA_20"]) / df["EMA_20"]
                
                latest= df.iloc[-1]
                rsi_val= float(latest.get("RSI_14", 50.0))
                macd_val= float(latest.get("MACD_12_26_9", 0.0))
                macds_val= float(latest.get("MACDs_12_26_9", 0.0))
                ema_ratio_val= float(latest.get("EMA_20_ratio", 0.0))
                
                input_data= np.array([[rsi_val, macd_val, macds_val, ema_ratio_val]], dtype= np.float32)
                input_name= onnx_session.get_inputs()[0].name
                label, prob= onnx_session.run(None, {input_name: input_data})
                
                if isinstance(prob, list) and len(prob) > 0:
                    p_dict= prob[0]
                    if isinstance(p_dict, dict):
                        p_val= p_dict.get(1, 0.5)
                    else:
                        p_val= prob[0][0][1]
                else:
                    p_val= prob[0][1]
                
                p_val_clipped= min(max(float(p_val), 0.0), 1.0)
                bullish_prob= int(p_val_clipped * 100)
                
                return json.dumps({
                    "ticker": ticker.upper(),
                    "bullish_probability": bullish_prob,
                    "status": "onnx_inference"
                })
            except Exception as e:
                print(f"Error running ONNX model inference: {str(e)}")
                
        if len(df)>= 14:
            df.ta.rsi(close= "close", length= 14, append= True)
            rsi= df.iloc[-1].get("RSI_14", 50.0)
        else:
            rsi= 50.0
        mock_prob= int(min(max(rsi*1.1, 10.0), 90.0))
        return json.dumps({
            "ticker": ticker.upper(),
            "bullish_probability": mock_prob,
            "status": "dev_mock_mode"
        })

    def get_user_alerts() -> list[dict]:
        """
        Retrieves all active and inactive price alerts configured by the user.
        """
        coro = crud.get_user_alerts(db, user_id)
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        alerts = future.result()
        return [{
            "id": str(a.id),
            "ticker": a.ticker,
            "target_price": a.target_price,
            "condition": a.condition,
            "is_active": a.is_active
        } for a in alerts]

    def create_price_alert(ticker: str, target_price: float, condition: str) -> str:
        """
        Creates a new price alert for a stock.
        - ticker: Stock symbol (e.g. AAPL)
        - target_price: Trigger price (e.g. 175.50)
        - condition: 'above' or 'below'
        """
        alert_in = schemas.AlertCreate(
            ticker=ticker.upper(),
            target_price=target_price,
            condition=condition.lower()
        )
        coro = crud.create_alert(db, user_id, alert_in)
        future = asyncio.run_coroutine_threadsafe(coro, main_loop)
        alert = future.result()
        return f"Successfully created alert: {alert.ticker} {alert.condition} {alert.target_price} (ID: {alert.id})"

    # 2. Map tools and build the GenerativeModel
    tools = [
        get_user_watchlist,
        get_stock_history_and_indicators,
        get_ml_prediction,
        get_user_alerts,
        create_price_alert
    ]

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        tools=tools,
        system_instruction=(
            "You are a professional financial analyst for QuantIQ. "
            "Examine the requested stock and gather all necessary details using your tools. "
            "You must return your response in JSON format matching this schema: "
            '{"bullish_probability": int, "reason": "string"}. '
            "Ensure 'bullish_probability' is between 0 and 100 representing the upward price probability. "
            "The 'reason' should be a concise summary (2-3 sentences) explaining your analysis, "
            "incorporating indicators and ML prediction tool outputs."
        )
    )

    # 3. Execute automatic function calling chat session in thread pool
    chat = model.start_chat(enable_automatic_function_calling=True)
    generation_config = {"response_mime_type": "application/json"}
    
    try:
        response = await main_loop.run_in_executor(
            None,
            lambda: chat.send_message(prompt, generation_config=generation_config)
        )
        data = json.loads(response.text)
        return {
            "bullish_probability": data.get("bullish_probability", 50),
            "reason": data.get("reason", "No analysis summary could be generated.")
        }
    except Exception as e:
        print(f"Error in Gemini ReAct Agent: {str(e)}")
        return {
            "bullish_probability": 50,
            "reason": f"Agent error occurred: {str(e)}"
        }