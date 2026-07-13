import os
import sys
import uuid
import asyncio
import datetime
from celery import Celery    # type: ignore
from celery.schedules import crontab  # type: ignore
from pathlib import Path
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# ML Training & Hugging Face Hub Imports
import numpy as np
import pandas as pd
import pandas_ta as ta  # noqa: F401
import yfinance as yf
from sklearn.ensemble import RandomForestClassifier  # type: ignore
from sklearn.model_selection import train_test_split  # type: ignore
from skl2onnx import to_onnx  # type: ignore
from skl2onnx.common.data_types import FloatTensorType  # type: ignore
import onnxruntime as ort
from huggingface_hub import HfApi  # type: ignore

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.config.settings import settings
from backend.app.database.session import SessionLocal
from backend.app.database import crud, models
from backend.app.services import gemini


def _make_celery_session() -> AsyncSession:
    """
    Creates a fresh AsyncSession backed by a NullPool engine.
    NullPool is mandatory for Celery fork workers: each asyncio.run() call
    creates a new event loop and closes it when done. A standard connection pool
    would try to reuse asyncpg connections that were created on the old (now closed)
    event loop, causing 'RuntimeError: Event loop is closed'. NullPool ensures
    every task gets a brand-new connection that lives and dies within a single
    asyncio.run() call.
    """
    engine = create_async_engine(
        settings.database_url_async,
        poolclass=NullPool,
    )
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return factory()

celery_app= Celery(
    "quantiq_tasks",
    broker= settings.REDIS_URL,
    backend= settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer= "json",
    accept_content= ["json"],
    result_serializer= "json",
    timezone= "UTC",
    enable_utc= True
)

# ASYNC HELPER FUNCTIONS
async def _async_generate_watchlist_report(user_uuid: uuid.UUID) -> str:
    """
    Asynchronously queries the user's watchlist, pulls history,
    and calls Gemini to compile a unified portfolio report.
    """
    async with _make_celery_session() as db:
        user= await crud.get_user(db, user_uuid)
        if not user:
            return "User not found."
        
        watchlist= await crud.get_user_watchlist(db, user_uuid)
        if not watchlist:
            return f"No watchlist items found for user {user.email}."
        
        report_sections= []
        for item in watchlist:
            # Fetch last 30 candles for analysis
            history= await crud.get_stock_history(db, item.ticker, limit= 30)
            if not history:
                continue
            
            latest= history[-1]
            report_sections.append(
                f"Ticker: {item.ticker}\n"
                f"Latest Price: {latest.close}\n"
                f"Open: {latest.open} | High: {latest.high} | Low: {latest.low}\n"
                f"Volume: {latest.volume}\n"
            )
        
        if not report_sections:
            return f"No stock history available for user {user.email}'s watchlist."
        
        context= "\n---\n".join(report_sections)
        prompt = (
            f"You are a professional financial analyst. Here is the latest market data for the user's watchlist:\n\n"
            f"{context}\n\n"
            f"Compile a clean, professional, daily market summary. Highlight any notable volatility or trends."
        )
        report_text= await gemini.generate_text(prompt)
        return report_text

async def _async_cleanup_old_history(days_to_keep: int) -> str:
    """
    Asynchronously deletes historical stock history rows older than the specified days
    to preserve NeonDB disk space.
    """
    cutoff= datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days= days_to_keep)
    
    async with _make_celery_session() as db:
        stmt= delete(models.StockHistory).where(models.StockHistory.timestamp < cutoff)
        result= await db.execute(stmt)
        await db.commit()
        return f"Cleaned up {result.rowcount} historical stock rows older than {days_to_keep} days."

# CELERY TASK WRAPPERS (Synchronous entrypoints)
@celery_app.task(name="tasks.generate_watchlist_report")
def generate_watchlist_report(user_id: str) -> str:
    """
    Celery task that spawns an event loop to run the async report builder.
    """
    user_uuid= uuid.UUID(user_id)
    return asyncio.run(_async_generate_watchlist_report(user_uuid))

@celery_app.task(name= "tasks.cleanup_old_history")
def cleanup_old_history(days_to_keep: int= 7) -> str:
    """
    Celery task that clears old stock history to save NeonDB storage space.
    """
    return asyncio.run(_async_cleanup_old_history(days_to_keep))

# Periodic triggered alerts processor
async def _async_process_triggered_alerts() -> str:
    """
    Checks all active alerts that have been triggered and emails reminders
    every 2 minutes until deactivated.
    """
    from sqlalchemy import select
    from backend.app.services.email_service import send_price_alert_email
    
    async with _make_celery_session() as db:
        stmt = (
            select(models.Alert)
            .where(models.Alert.is_active == True)
            .where(models.Alert.is_triggered == True)
        )
        result = await db.execute(stmt)
        triggered_alerts = list(result.scalars().all())
        
        sent_count = 0
        now = datetime.datetime.now(datetime.timezone.utc)
        
        for alert in triggered_alerts:
            # Check throttle: notify if last_notified_at is null or older than 2 minutes
            should_notify = False
            if not alert.last_notified_at:
                should_notify = True
            else:
                delta = now - alert.last_notified_at
                if delta >= datetime.timedelta(minutes=2):
                    should_notify = True
            
            if should_notify:
                user = await crud.get_user(db, alert.user_id)
                if not user:
                    continue
                
                # Fetch latest price
                history = await crud.get_stock_history(db, alert.ticker, limit=1)
                current_price = history[0].close if history else alert.target_price
                
                success = send_price_alert_email(
                    to_email=user.email,
                    ticker=alert.ticker,
                    condition=alert.condition,
                    target_price=alert.target_price,
                    current_price=current_price
                )
                
                if success:
                    await crud.update_alert_notification_time(db, alert.id)
                    sent_count += 1
        
        return f"Processed triggered alerts. Sent {sent_count} email notifications."

@celery_app.task(name="tasks.process_triggered_alerts")
def process_triggered_alerts() -> str:
    """
    Celery task run periodically (every 2 minutes) to process triggered alerts.
    """
    return asyncio.run(_async_process_triggered_alerts())


@celery_app.task(name="tasks.send_verification_email")
def send_verification_email_task(email: str, code: str) -> bool:
    """
    Celery task to send a registration verification OTP email.
    """
    from backend.app.services.email_service import send_verification_email
    return send_verification_email(email, code)


async def _async_update_prediction_outcomes() -> str:
    """
    Finds pending predictions that are at least 5 minutes old,
    fetches their current price via yfinance, calculates PnL and outcome,
    and updates their status to completed.
    """
    import yfinance as yf
    from sqlalchemy import select
    
    async with _make_celery_session() as db:
        # Fetch pending prediction logs
        stmt = select(models.PredictionLog).where(models.PredictionLog.status == "pending")
        result = await db.execute(stmt)
        pending = list(result.scalars().all())
        
        if not pending:
            return "No pending predictions to update."
            
        now = datetime.datetime.now(datetime.timezone.utc)
        updated_count = 0
        
        for pred in pending:
            # Check if prediction is at least 5 minutes old to allow testing
            elapsed = now - pred.timestamp
            if elapsed < datetime.timedelta(minutes=5):
                continue
                
            try:
                # Fetch current price via shared Redis-cached yfinance helper
                yf_df = await asyncio.get_event_loop().run_in_executor(
                    None, gemini._fetch_yf_daily_cached, pred.ticker.upper()
                )
                if yf_df is None or yf_df.empty or "close" not in yf_df.columns:
                    print(f"MLOps: Could not retrieve price for {pred.ticker}")
                    continue

                current_price = float(yf_df["close"].iloc[-1])
                
                # Calculate PnL and outcome
                pnl = 0.0
                outcome = "neutral"
                
                # Guard: skip predictions with zero entry price (logged before
                # history was available) to avoid ZeroDivisionError
                if not pred.entry_price or pred.entry_price == 0.0:
                    print(f"MLOps: Skipping prediction {pred.id} for {pred.ticker} — entry_price is 0")
                    pred.status = "failed"
                    pred.outcome = "failed"
                    pred.pnl = 0.0
                    db.add(pred)
                    updated_count += 1
                    continue

                if pred.predicted_action == "BUY":
                    pnl = ((current_price - pred.entry_price) / pred.entry_price) * 100.0
                    outcome = "success" if current_price > pred.entry_price else "failed"
                elif pred.predicted_action == "SELL":
                    # For short/sell, positive PnL when price drops
                    pnl = ((pred.entry_price - current_price) / pred.entry_price) * 100.0
                    outcome = "success" if current_price < pred.entry_price else "failed"
                else:
                    pnl = 0.0
                    outcome = "neutral"
                    
                # Update record
                pred.actual_price_1h = current_price
                pred.actual_price_24h = current_price # fallback duplicate for simple stats
                pred.status = "completed"
                pred.outcome = outcome
                pred.pnl = pnl
                
                db.add(pred)
                updated_count += 1
            except Exception as yf_err:
                print(f"MLOps: Error updating prediction {pred.id} for {pred.ticker}: {yf_err}")
                
        if updated_count > 0:
            await db.commit()
            
        return f"MLOps: Successfully updated {updated_count} pending predictions."


async def _async_update_strategy_outcomes() -> str:
    """
    Finds pending strategy logs that are at least 5 minutes old,
    fetches their current price via yfinance, calculates outcomes for both
    AI recommended levels and User customized levels, and updates their status to completed.
    """
    import yfinance as yf
    from sqlalchemy import select
    
    async with _make_celery_session() as db:
        # Fetch pending strategy logs
        stmt = select(models.StrategyLog).where(models.StrategyLog.status == "pending")
        result = await db.execute(stmt)
        pending = list(result.scalars().all())
        
        if not pending:
            return "No pending strategies to update."
            
        now = datetime.datetime.now(datetime.timezone.utc)
        updated_count = 0
        
        for strat in pending:
            # Check if prediction is at least 5 minutes old to allow testing
            elapsed = now - strat.timestamp
            if elapsed < datetime.timedelta(minutes=5):
                continue
                
            try:
                # Fetch current price via shared Redis-cached yfinance helper
                yf_df = await asyncio.get_event_loop().run_in_executor(
                    None, gemini._fetch_yf_daily_cached, strat.ticker.upper()
                )
                if yf_df is None or yf_df.empty or "close" not in yf_df.columns:
                    print(f"MLOps: Could not retrieve price for {strat.ticker}")
                    continue

                current_price = float(yf_df["close"].iloc[-1])
                
                # Determine action based on probability score
                predicted_action = "BUY" if strat.bullish_probability >= 55 else "SELL" if strat.bullish_probability <= 45 else "HOLD"
                
                # 1. Evaluate AI Outcome
                ai_outcome = "neutral"
                if predicted_action == "BUY":
                    if current_price >= strat.ai_target:
                        ai_outcome = "success"
                    elif current_price <= strat.ai_stop_loss:
                        ai_outcome = "failed"
                    else:
                        ai_outcome = "success" if current_price > strat.ai_entry else "failed"
                elif predicted_action == "SELL":
                    if current_price <= strat.ai_target:
                        ai_outcome = "success"
                    elif current_price >= strat.ai_stop_loss:
                        ai_outcome = "failed"
                    else:
                        ai_outcome = "success" if current_price < strat.ai_entry else "failed"
                else:
                    ai_outcome = "neutral"
                    
                # 2. Evaluate User Outcome
                user_outcome = "neutral"
                if predicted_action == "BUY":
                    if current_price >= strat.user_target:
                        user_outcome = "success"
                    elif current_price <= strat.user_stop_loss:
                        user_outcome = "failed"
                    else:
                        user_outcome = "success" if current_price > strat.user_entry else "failed"
                elif predicted_action == "SELL":
                    if current_price <= strat.user_target:
                        user_outcome = "success"
                    elif current_price >= strat.user_stop_loss:
                        user_outcome = "failed"
                    else:
                        user_outcome = "success" if current_price < strat.user_entry else "failed"
                else:
                    user_outcome = "neutral"
                    
                # Update record
                strat.actual_exit_price = current_price
                strat.status = "completed"
                strat.ai_outcome = ai_outcome
                strat.user_outcome = user_outcome
                
                db.add(strat)
                updated_count += 1
            except Exception as yf_err:
                print(f"MLOps: Error updating strategy {strat.id} for {strat.ticker}: {yf_err}")
                
        if updated_count > 0:
            await db.commit()
            
        return f"MLOps: Successfully updated {updated_count} pending strategy logs."


@celery_app.task(name="tasks.update_prediction_outcomes")
def update_prediction_outcomes() -> str:
    """
    Celery task run periodically (every 2 minutes) to update prediction and strategy outcomes.
    """
    pred_summary = asyncio.run(_async_update_prediction_outcomes())
    strat_summary = asyncio.run(_async_update_strategy_outcomes())
    return f"{pred_summary} | {strat_summary}"


# ==========================================
# MLOPS RETRAINING TASK & ROUTER ENGINE
# ==========================================

async def _prepare_training_data_for_tickers(tickers: list) -> pd.DataFrame:
    """
    Fetches 2 years of daily stock candles via yfinance and computes features.
    """
    all_data = []
    for ticker in tickers:
        try:
            print(f"MLOps Retraining: Fetching daily data for {ticker}...")
            yf_ticker = yf.Ticker(ticker)
            df = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf_ticker.history(period="2y", interval="1d")
            )
            if df.empty or len(df) < 30:
                continue
                
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            df = df.copy()
            df.ta.rsi(close="Close", length=14, append=True)
            df.ta.macd(close="Close", fast=12, slow=26, signal=9, append=True)
            df.ta.ema(close="Close", length=20, append=True)
            df["EMA_20_ratio"] = (df["Close"] - df["EMA_20"]) / df["EMA_20"]
            df["target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)
            
            feature_cols = ["RSI_14", "MACD_12_26_9", "MACDs_12_26_9", "EMA_20_ratio"]
            df = df.dropna(subset=feature_cols + ["target"])
            all_data.append(df[feature_cols + ["target"]])
        except Exception as e:
            print(f"MLOps Retraining: Failed preparing data for {ticker}: {e}")
            
    if not all_data:
        return pd.DataFrame()
    return pd.concat(all_data, ignore_index=True)


def _evaluate_champion_model(model_path: str, X_test, y_test) -> float:
    """
    Evaluates the accuracy of the current champion model on the test split.
    """
    if not os.path.exists(model_path):
        return 0.0
    try:
        sess = ort.InferenceSession(model_path)
        input_name = sess.get_inputs()[0].name
        correct = 0
        for i in range(len(X_test)):
            sample = np.array([X_test[i]], dtype=np.float32)
            label, prob = sess.run(None, {input_name: sample})
            pred_label = int(label[0])
            if pred_label == y_test[i]:
                correct += 1
        return float(correct) / len(X_test)
    except Exception as e:
        print(f"MLOps Retraining: Failed to evaluate champion model at {model_path}: {e}")
        return 0.0


async def _async_retrain_models() -> str:
    """
    Gathers tickers, classifies by asset class, fetches training data,
    compares Champion vs Challenger model accuracy, and uploads to Hugging Face Hub.
    """
    from sqlalchemy import select
    
    print("MLOps Retraining: Querying DB for watchlisted/logged tickers...")
    async with _make_celery_session() as db:
        stmt_pred = select(models.PredictionLog.ticker).distinct()
        pred_res = await db.execute(stmt_pred)
        tickers = {row[0] for row in pred_res if row[0]}
        
        stmt_watch = select(models.Watchlist.ticker).distinct()
        watch_res = await db.execute(stmt_watch)
        tickers.update({row[0] for row in watch_res if row[0]})
        
    print(f"MLOps Retraining: Discovered tickers in system: {tickers}")
    
    # Categorize and populate default tickers to guarantee adequate training samples
    categories = {
        "crypto": {"BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOGE-USD"},
        "index": {"^GSPC", "^IXIC", "^NSEI", "SPY", "QQQ"},
        "tech": {"AAPL", "TSLA", "MSFT", "GOOGL", "RELIANCE.NS", "TCS.NS", "ADANIPOWER.NS"}
    }
    
    for t in tickers:
        t_upper = t.upper()
        if t_upper.endswith("-USD") or t_upper.endswith("-BTC"):
            categories["crypto"].add(t_upper)
        elif t_upper.startswith("^") or t_upper in ("SPY", "QQQ", "IWM", "DIA"):
            categories["index"].add(t_upper)
        else:
            categories["tech"].add(t_upper)
            
    summary_results = []
    
    for cat, ticker_list in categories.items():
        print(f"MLOps Retraining: Preparing '{cat}' dataset...")
        data = await _prepare_training_data_for_tickers(list(ticker_list))
        if data.empty:
            summary_results.append(f"{cat}: Skipped (No training data)")
            continue
            
        feature_cols = ["RSI_14", "MACD_12_26_9", "MACDs_12_26_9", "EMA_20_ratio"]
        X = data[feature_cols].values.astype(np.float32)
        y = data["target"].values.astype(np.int64)
        
        print(f"MLOps Retraining: Gathered {len(X)} total samples for '{cat}'")
        if len(X) < 100:
            summary_results.append(f"{cat}: Skipped (Insufficient samples: {len(X)})")
            continue
            
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # 1. Evaluate Active Champion Model
        filename = f"model_{cat}.onnx"
        champion_path = filename if os.path.exists(filename) else "model.onnx"
        champion_acc = _evaluate_champion_model(champion_path, X_test, y_test)
        print(f"MLOps Retraining: Active Champion model accuracy for '{cat}': {champion_acc:.4f}")
        
        # 2. Train New Challenger Model
        challenger = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
        challenger.fit(X_train, y_train)
        challenger_acc = challenger.score(X_test, y_test)
        print(f"MLOps Retraining: New Challenger model accuracy for '{cat}': {challenger_acc:.4f}")
        
        # 3. Champion-Challenger Validation Check
        # Challenger must beat Champion and be at least 50% accurate (better than coin toss)
        if challenger_acc >= champion_acc and challenger_acc >= 0.50:
            # Challenger wins: export to ONNX format
            initial_type = [('float_input', FloatTensorType([None, 4]))]
            onx = to_onnx(challenger, initial_types=initial_type, target_opset=15)
            
            with open(filename, "wb") as f:
                f.write(onx.SerializeToString())
            print(f"MLOps Retraining: Saved new Challenger model to {filename}")
            
            # Persist to Hugging Face Hub (survives container restarts)
            token = os.getenv("HF_TOKEN")
            repo_id = os.getenv("HF_MODEL_REPO", "Karan6124/quantiq-model")
            if token:
                try:
                    print(f"MLOps Retraining: Uploading {filename} to HF Hub repo '{repo_id}'...")
                    api = HfApi()
                    api.upload_file(
                        path_or_fileobj=filename,
                        path_in_repo=filename,
                        repo_id=repo_id,
                        token=token
                    )
                    summary_results.append(f"{cat}: Promoted (Challenger: {challenger_acc:.4f} >= Champion: {champion_acc:.4f})")
                except Exception as upload_err:
                    summary_results.append(f"{cat}: Promoted Local Only (Upload failed: {upload_err})")
            else:
                summary_results.append(f"{cat}: Promoted Local Only (HF_TOKEN missing)")
        else:
            summary_results.append(f"{cat}: Kept Champion (Challenger: {challenger_acc:.4f} < Champion: {champion_acc:.4f})")
            
    return " | ".join(summary_results)


@celery_app.task(name="tasks.retrain_models")
def retrain_models() -> str:
    """
    Celery task run weekly (or manually) to retrain specialized models
    on historical performance & yfinance datasets.
    """
    return asyncio.run(_async_retrain_models())


# Configure Celery Beat Schedule
celery_app.conf.beat_schedule = {
    "process-triggered-alerts-every-2-min": {
        "task": "tasks.process_triggered_alerts",
        "schedule": 120.0,  # 120 seconds = 2 minutes
    },
    "update-prediction-outcomes-every-2-min": {
        "task": "tasks.update_prediction_outcomes",
        "schedule": 120.0,  # 120 seconds = 2 minutes
    },
    "retrain-models-weekly": {
        "task": "tasks.retrain_models",
        "schedule": crontab(minute=0, hour=0, day_of_week=0),  # Sunday midnight
    }
}