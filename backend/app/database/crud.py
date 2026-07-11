import uuid
import datetime
from typing import List, Optional
from sqlalchemy import select, update, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from backend.app.database import models
from backend.app.schemas import schemas

# ==========================================
# USER OPERATIONS
# ==========================================

async def get_user(db: AsyncSession, user_id: uuid.UUID) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()

async def get_user_by_google_id(db: AsyncSession, google_id: str) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.google_id == google_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user_in: schemas.UserBase, google_id: str) -> models.User:
    db_user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        picture_url=user_in.picture_url,
        google_id=google_id,
        credits=5,  # Starting free credits
        last_credit_refresh=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def refresh_user_credits(db: AsyncSession, user: models.User) -> models.User:
    """
    Checks and applies user refreshes:
    - For Free tier: resets credits to 5 every 7 days.
    - For Pro tier: resets monthly_messages_used to 0 every 30 days.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    updated = False
    
    if user.subscription_tier == "free":
        time_elapsed = now - user.last_credit_refresh
        if time_elapsed >= datetime.timedelta(days=7):
            user.credits = 5
            user.last_credit_refresh = now
            updated = True
            
    if user.subscription_tier == "pro":
        billing_elapsed = now - user.last_billing_date
        if billing_elapsed >= datetime.timedelta(days=30):
            user.monthly_messages_used = 0
            user.last_billing_date = now
            updated = True
            
    if updated:
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

async def deduct_user_credit(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """
    Deducts 1 credit from the user's account.
    Returns True if deduction succeeded, False if user has 0 credits.
    """
    user = await get_user(db, user_id)
    if not user:
        return False
    
    if user.email == "karanshelar8775@gmail.com":
        return True
    
    if user.credits <= 0:
        return False
    
    user.credits -= 1
    db.add(user)
    await db.commit()
    return True


# ==========================================
# WATCHLIST OPERATIONS
# ==========================================

async def get_user_watchlist(db: AsyncSession, user_id: uuid.UUID) -> List[models.Watchlist]:
    result = await db.execute(
        select(models.Watchlist)
        .where(models.Watchlist.user_id == user_id)
        .order_by(models.Watchlist.created_at.desc() if hasattr(models.Watchlist, 'order_index') else None)
    )
    # Simple order fallback if order_index doesn't apply
    result = await db.execute(
        select(models.Watchlist)
        .where(models.Watchlist.user_id == user_id)
        .order_by(models.Watchlist.created_at.desc())
    )
    return list(result.scalars().all())

async def add_to_watchlist(db: AsyncSession, user_id: uuid.UUID, ticker: str) -> models.Watchlist:
    # Check if already exists to prevent duplicate entries
    existing = await db.execute(
        select(models.Watchlist).where(
            and_(models.Watchlist.user_id == user_id, models.Watchlist.ticker == ticker)
        )
    )
    if existing.scalars().first():
        return existing.scalars().first()

    db_watchlist = models.Watchlist(user_id=user_id, ticker=ticker.upper())
    db.add(db_watchlist)
    await db.commit()
    await db.refresh(db_watchlist)
    return db_watchlist

async def remove_from_watchlist(db: AsyncSession, user_id: uuid.UUID, ticker: str) -> bool:
    result = await db.execute(
        delete(models.Watchlist).where(
            and_(models.Watchlist.user_id == user_id, models.Watchlist.ticker == ticker.upper())
        )
    )
    await db.commit()
    return result.rowcount > 0


# ==========================================
# ALERT OPERATIONS
# ==========================================

async def get_user_alerts(db: AsyncSession, user_id: uuid.UUID) -> List[models.Alert]:
    result = await db.execute(
        select(models.Alert)
        .where(models.Alert.user_id == user_id)
        .order_by(models.Alert.created_at.desc())
    )
    return list(result.scalars().all())

async def get_active_alerts(db: AsyncSession) -> List[models.Alert]:
    result = await db.execute(
        select(models.Alert).where(models.Alert.is_active == True)
    )
    return list(result.scalars().all())

async def create_alert(db: AsyncSession, user_id: uuid.UUID, alert_in: schemas.AlertCreate) -> models.Alert:
    db_alert = models.Alert(
        user_id=user_id,
        ticker=alert_in.ticker.upper(),
        target_price=alert_in.target_price,
        condition=alert_in.condition.lower(),
        is_active=True
    )
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert

async def deactivate_alert(db: AsyncSession, alert_id: uuid.UUID) -> bool:
    result = await db.execute(
        update(models.Alert)
        .where(models.Alert.id == alert_id)
        .values(is_active=False)
    )
    await db.commit()
    return result.rowcount > 0

async def trigger_alert(db: AsyncSession, alert_id: uuid.UUID) -> bool:
    result = await db.execute(
        update(models.Alert)
        .where(models.Alert.id == alert_id)
        .values(is_triggered=True, last_notified_at=func.now())
    )
    await db.commit()
    return result.rowcount > 0

async def update_alert_notification_time(db: AsyncSession, alert_id: uuid.UUID) -> bool:
    result = await db.execute(
        update(models.Alert)
        .where(models.Alert.id == alert_id)
        .values(last_notified_at=func.now())
    )
    await db.commit()
    return result.rowcount > 0


# ==========================================
# STOCK HISTORY OPERATIONS
# ==========================================

async def get_stock_history(db: AsyncSession, ticker: str, limit: int = 100) -> List[models.StockHistory]:
    result = await db.execute(
        select(models.StockHistory)
        .where(models.StockHistory.ticker == ticker.upper())
        .order_by(models.StockHistory.timestamp.desc())
        .limit(limit)
    )
    history = list(result.scalars().all())
    
    # If database has under 100 records for this ticker, dynamically backfill from yfinance
    if len(history) < 100:
        import yfinance as yf
        import asyncio
        
        try:
            # yfinance allows fetching 1m interval historical data up to 30 days. We fetch last 5 days.
            yf_ticker = yf.Ticker(ticker.upper())
            df = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf_ticker.history(period="5d", interval="1m")
            )
            
            if not df.empty:
                df = df.reset_index()
                
                # Identify timestamp column
                time_col = None
                for col in ['Date', 'Datetime', 'index', 'timestamp']:
                    if col in df.columns:
                        time_col = col
                        break
                        
                if time_col:
                    candles_to_insert = []
                    for _, row in df.iterrows():
                        ts = row[time_col]
                        if hasattr(ts, 'to_pydatetime'):
                            ts_dt = ts.to_pydatetime()
                        elif isinstance(ts, str):
                            ts_dt = datetime.datetime.fromisoformat(ts)
                        else:
                            ts_dt = ts
                            
                        if ts_dt.tzinfo is not None:
                            ts_dt = ts_dt.replace(tzinfo=None)
                            
                        candles_to_insert.append({
                            "ticker": ticker.upper(),
                            "timestamp": ts_dt,
                            "open": float(row["Open"]),
                            "high": float(row["High"]),
                            "low": float(row["Low"]),
                            "close": float(row["Close"]),
                            "volume": int(row["Volume"]) if "Volume" in row else 0
                        })
                    
                    if candles_to_insert:
                        # Perform batch insert ignoring duplicates
                        stmt = pg_insert(models.StockHistory).values(candles_to_insert)
                        await db.execute(stmt.on_conflict_do_nothing(index_elements=["ticker", "timestamp"]))
                        await db.commit()
                        
                        # Re-query the database with the fully backfilled candles
                        result = await db.execute(
                            select(models.StockHistory)
                            .where(models.StockHistory.ticker == ticker.upper())
                            .order_by(models.StockHistory.timestamp.desc())
                            .limit(limit)
                        )
                        history = list(result.scalars().all())
        except Exception as e:
            print(f"MLOps Dynamic Backfill: Failed to populate history for {ticker}: {e}")
            
    # Return in chronological order (oldest to newest) for indicators
    history.reverse()
    return history

async def insert_stock_candle(db: AsyncSession, candle: schemas.StockHistoryBase) -> None:
    """
    Inserts a single candle record. If it already exists, do nothing.
    """
    stmt = pg_insert(models.StockHistory).values(
        ticker=candle.ticker.upper(),
        timestamp=candle.timestamp,
        open=candle.open,
        high=candle.high,
        low=candle.low,
        close=candle.close,
        volume=candle.volume
    )
    # PostgreSQL specific upsert: do nothing on conflict
    stmt = stmt.on_conflict_do_nothing(index_elements=["ticker", "timestamp"])
    await db.execute(stmt)
    await db.commit()

    # Check and trigger alerts for this ticker
    alert_stmt = (
        select(models.Alert)
        .where(models.Alert.ticker == candle.ticker.upper())
        .where(models.Alert.is_active == True)
        .where(models.Alert.is_triggered == False)
    )
    alert_result = await db.execute(alert_stmt)
    active_alerts = list(alert_result.scalars().all())

    from backend.app.services.email_service import send_price_alert_email
    for alert in active_alerts:
        triggered = False
        if alert.condition == "above" and candle.close >= alert.target_price:
            triggered = True
        elif alert.condition == "below" and candle.close <= alert.target_price:
            triggered = True

        if triggered:
            alert.is_triggered = True
            alert.last_notified_at = func.now()
            db.add(alert)
            await db.commit()

            # Retrieve user to get their email address
            user = await get_user(db, alert.user_id)
            if user:
                send_price_alert_email(
                    to_email=user.email,
                    ticker=alert.ticker,
                    condition=alert.condition,
                    target_price=alert.target_price,
                    current_price=candle.close
                )


# ==========================================
# PAYMENT TRANSACTION OPERATIONS
# ==========================================

async def create_payment_transaction(
    db: AsyncSession, user_id: uuid.UUID, order_id: str, amount: int, credits_credited: int
) -> models.PaymentTransaction:
    db_tx = models.PaymentTransaction(
        user_id=user_id,
        razorpay_order_id=order_id,
        amount=amount,
        status="created",
        credits_credited=credits_credited
    )
    db.add(db_tx)
    await db.commit()
    await db.refresh(db_tx)
    return db_tx

async def capture_payment_transaction(
    db: AsyncSession, order_id: str, payment_id: str
) -> Optional[models.PaymentTransaction]:
    """
    Captures a pending transaction, updates status, and credits the user.
    Uses a transaction block to ensure atomic operations.
    """
    # 1. Fetch transaction
    result = await db.execute(
        select(models.PaymentTransaction).where(models.PaymentTransaction.razorpay_order_id == order_id)
    )
    tx = result.scalars().first()
    
    if not tx or tx.status == "captured":
        return tx
        
    # 2. Update transaction
    tx.razorpay_payment_id = payment_id
    tx.status = "captured"
    db.add(tx)
    
    # 3. Credit the user and update subscription tier
    user = await get_user(db, tx.user_id)
    if user:
        user.credits += tx.credits_credited
        
        # Determine plan from transaction amount in Rupees
        amt_rupees = tx.amount // 100
        if amt_rupees == 500:
            user.subscription_tier = "analyst"
            user.messages_remaining += 10
        elif amt_rupees == 1500:
            user.subscription_tier = "trader"
            user.messages_remaining += 25
        elif amt_rupees in (10000, 15000):
            user.subscription_tier = "pro"
            user.monthly_messages_used = 0
            user.last_billing_date = datetime.datetime.now(datetime.timezone.utc)
            
        db.add(user)
        
    await db.commit()
    await db.refresh(tx)
    return tx

async def create_saved_strategy(
    db: AsyncSession, user_id: uuid.UUID, ticker: str, bullish_probability: int, reason: str
) -> models.SavedStrategy:
    db_strategy = models.SavedStrategy(
        user_id=user_id,
        ticker=ticker.upper(),
        bullish_probability=bullish_probability,
        reason=reason
    )
    db.add(db_strategy)
    await db.commit()
    await db.refresh(db_strategy)
    return db_strategy

async def get_user_saved_strategies(db: AsyncSession, user_id: uuid.UUID) -> List[models.SavedStrategy]:
    result = await db.execute(
        select(models.SavedStrategy)
        .where(models.SavedStrategy.user_id == user_id)
        .order_by(models.SavedStrategy.created_at.desc())
    )
    return list(result.scalars().all())


# ==========================================
# MLOPS PREDICTION LOG OPERATIONS
# ==========================================

async def create_prediction_log(
    db: AsyncSession,
    user_id: uuid.UUID,
    ticker: str,
    model_version: str,
    confidence: float,
    predicted_action: str,
    entry_price: float,
    target_price: Optional[float] = None,
    stop_loss: Optional[float] = None
) -> models.PredictionLog:
    db_log = models.PredictionLog(
        user_id=user_id,
        ticker=ticker.upper(),
        model_version=model_version,
        confidence=confidence,
        predicted_action=predicted_action,
        entry_price=entry_price,
        target_price=target_price,
        stop_loss=stop_loss,
        status="pending"
    )
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)
    return db_log

async def get_pending_predictions(db: AsyncSession) -> List[models.PredictionLog]:
    result = await db.execute(
        select(models.PredictionLog)
        .where(models.PredictionLog.status == "pending")
        .order_by(models.PredictionLog.timestamp.asc())
    )
    return list(result.scalars().all())

async def get_all_prediction_logs(db: AsyncSession, limit: int = 1000) -> List[models.PredictionLog]:
    result = await db.execute(
        select(models.PredictionLog)
        .order_by(models.PredictionLog.timestamp.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


# ==========================================
# MLOPS STRATEGY LOG OPERATIONS
# ==========================================

async def create_strategy_log(
    db: AsyncSession,
    user_id: uuid.UUID,
    ticker: str,
    model_version: str,
    bullish_probability: int,
    ai_entry: float,
    ai_target: float,
    ai_stop_loss: float,
    user_entry: float,
    user_target: float,
    user_stop_loss: float
) -> models.StrategyLog:
    db_strategy = models.StrategyLog(
        user_id=user_id,
        ticker=ticker.upper(),
        model_version=model_version,
        bullish_probability=bullish_probability,
        ai_entry=ai_entry,
        ai_target=ai_target,
        ai_stop_loss=ai_stop_loss,
        user_entry=user_entry,
        user_target=user_target,
        user_stop_loss=user_stop_loss,
        status="pending"
    )
    db.add(db_strategy)
    await db.commit()
    await db.refresh(db_strategy)
    return db_strategy

async def get_pending_strategy_logs(db: AsyncSession) -> List[models.StrategyLog]:
    result = await db.execute(
        select(models.StrategyLog)
        .where(models.StrategyLog.status == "pending")
        .order_by(models.StrategyLog.timestamp.asc())
    )
    return list(result.scalars().all())

async def get_all_strategy_logs(db: AsyncSession, limit: int = 1000) -> List[models.StrategyLog]:
    result = await db.execute(
        select(models.StrategyLog)
        .order_by(models.StrategyLog.timestamp.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_recently_analyzed_tickers(db: AsyncSession, user_id: uuid.UUID, limit: int = 5) -> List[str]:
    """
    Retrieves the unique tickers that the specified user has analyzed recently.
    """
    from sqlalchemy import func
    result = await db.execute(
        select(models.PredictionLog.ticker, func.max(models.PredictionLog.timestamp).label("latest"))
        .where(models.PredictionLog.user_id == user_id)
        .group_by(models.PredictionLog.ticker)
        .order_by(func.max(models.PredictionLog.timestamp).desc())
        .limit(limit)
    )
    return [row.ticker for row in result]


async def get_trending_tickers(db: AsyncSession, limit: int = 5) -> List[dict]:
    """
    Retrieves the globally trending tickers based on analysis query count in the last 7 days.
    """
    from sqlalchemy import func
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)
    result = await db.execute(
        select(models.PredictionLog.ticker, func.count(models.PredictionLog.id).label("count"))
        .where(models.PredictionLog.timestamp >= cutoff)
        .group_by(models.PredictionLog.ticker)
        .order_by(func.count(models.PredictionLog.id).desc())
        .limit(limit)
    )
    return [{"ticker": row.ticker, "count": row.count} for row in result]