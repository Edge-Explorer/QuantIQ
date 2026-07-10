import os
import sys
import uuid
import asyncio
import datetime
from celery import Celery    # type: ignore
from pathlib import Path
from sqlalchemy import delete

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.config.settings import settings
from backend.app.database.session import SessionLocal
from backend.app.database import crud, models
from backend.app.services import gemini

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
    async with SessionLocal() as db:
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
    
    async with SessionLocal() as db:
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
    
    async with SessionLocal() as db:
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


# Configure Celery Beat Schedule
celery_app.conf.beat_schedule = {
    "process-triggered-alerts-every-2-min": {
        "task": "tasks.process_triggered_alerts",
        "schedule": 120.0,  # 120 seconds = 2 minutes
    }
}