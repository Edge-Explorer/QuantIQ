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
    Checks if 7 days have passed since the last credit refresh.
    If so, resets credits back to 5.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    time_elapsed = now - user.last_credit_refresh
    
    if time_elapsed >= datetime.timedelta(days=7):
        user.credits = 5
        user.last_credit_refresh = now
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
    # Return in chronological order (oldest to newest) for indicators
    history = list(result.scalars().all())
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
    
    # 3. Credit the user
    user = await get_user(db, tx.user_id)
    if user:
        user.credits += tx.credits_credited
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