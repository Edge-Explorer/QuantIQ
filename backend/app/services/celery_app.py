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