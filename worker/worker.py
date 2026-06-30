import sys
import os
import json
import asyncio
import datetime
from typing import Dict, List, Optional
from pathlib import Path
import yfinance as yf    # type: ignore
from aiokafka import AIOKafkaProducer     # type: ignore

# Add the project root directory to the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config.settings import settings
from backend.app.database.session import SessionLocal
from backend.app.database import crud
from backend.app.schemas import schemas

KAFKA_BOOTSTRAP_SERVERS = settings.KAFKA_BOOTSTRAP_SERVERS

# Tickers are dynamically fetched from DB each cycle — no hardcoded list

KAFKA_TOPIC = "stock-ticks"

# In-memory buffer to aggregate ticks into 1-minute candles
aggregation_buffer: Dict[str, Dict[str, List]] = {}

async def get_latest_stock_data(ticker: str) -> Optional[dict]:
    """
    Fetch current stock price and cumulative volume using yfinance fast_info.
    """
    try:
        # Run synchronous yfinance operations in a thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        yf_ticker = yf.Ticker(ticker)
        
        # fast_info retrieves basic metrics quickly
        info = await loop.run_in_executor(None, lambda: yf_ticker.fast_info)
        
        price = info.last_price
        volume = info.last_volume
        
        if price is None or volume is None:
            return None
            
        return {
            "price": float(price),
            "volume": int(volume),
            "timestamp": datetime.datetime.now(datetime.timezone.utc)
        }
    except Exception as e:
        print(f"Error fetching data for {ticker}: {str(e)}")
        return None

async def aggregate_and_save_candle(db, ticker: str, timestamp: datetime.datetime):
    """
    Takes buffered ticks for a ticker, calculates OHLCV, and saves it to NeonDB.
    """
    data = aggregation_buffer[ticker]
    prices = data["prices"]
    volumes = data["volumes"]
    
    if not prices:
        return

    # Calculate candlestick values
    open_price = prices[0]
    high_price = max(prices)
    low_price = min(prices)
    close_price = prices[-1]
    
    # Volume for the minute is the difference between last and first cumulative volumes
    volume_diff = 0
    if len(volumes) > 1:
        volume_diff = max(0, volumes[-1] - volumes[0])
    else:
        volume_diff = volumes[0] if volumes else 0

    candle = schemas.StockHistoryBase(
        ticker=ticker,
        timestamp=timestamp.replace(second=0, microsecond=0),  # Round to the minute
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=volume_diff
    )

    try:
        await crud.insert_stock_candle(db, candle)
        print(f"Aggregated & Saved candle for {ticker} at {candle.timestamp}: O={open_price} C={close_price}")
    except Exception as e:
        print(f"Failed to save candle for {ticker}: {str(e)}")
        
    data["prices"].clear()
    data["volumes"].clear()

async def main():
    print(f"Starting Ingestion Worker...")
    print(f"Connecting to Redpanda at {KAFKA_BOOTSTRAP_SERVERS}...")
    
    # 1. Initialize Redpanda/Kafka Producer
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    await producer.start()
    print("Redpanda Producer connected.")

    last_minute = datetime.datetime.now(datetime.timezone.utc).minute

    try:
        while True:
            start_time = asyncio.get_event_loop().time()
            now = datetime.datetime.now(datetime.timezone.utc)
            
            # Check if a new minute has started
            minute_changed = now.minute != last_minute
            
            try:
                # Create a database session for candle aggregation
                async with SessionLocal() as db:
                    from sqlalchemy import select
                    from backend.app.database.models import Watchlist 
                    result= await db.execute(select(Watchlist.ticker).distinct())
                    dynamic_tickers= [row[0] for row in result.fetchall()]
                    
                    for t in dynamic_tickers:
                        if t not in aggregation_buffer:
                            aggregation_buffer[t]= {"prices": [], "volumes": []}
                    
                    for ticker in dynamic_tickers:
                        tick= await get_latest_stock_data(ticker)
                        
                        if tick:
                            aggregation_buffer[ticker]["prices"].append(tick["price"])
                            aggregation_buffer[ticker]["volumes"].append(tick["volume"])
                            
                            payload= {
                                "ticker": ticker,
                                "price": tick["price"],
                                "volume": tick["volume"],
                                "timestamp": tick["timestamp"].isoformat()
                            }
                            
                            await producer.send(KAFKA_TOPIC, payload)
                            print(f"Tick published: {ticker} = {tick['price']}")
                        if minute_changed:
                            await aggregate_and_save_candle(db, ticker, now)
                
                if minute_changed:
                    last_minute = now.minute
            except Exception as loop_err:
                print(f"Error in poll cycle (database/network drop): {str(loop_err)}")

            # Sleep for 5 seconds (must run outside the loop and minute check)
            elapsed_time = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0.1, 5.0 - elapsed_time)
            await asyncio.sleep(sleep_time)
            
    except asyncio.CancelledError:
        print("Worker stopped.")
    finally:
        await producer.stop()
        print("Redpanda connection closed.")

if __name__ == "__main__":
    asyncio.run(main())