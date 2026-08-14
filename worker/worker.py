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

# Global rate-limiting cooldown trackers
COOLDOWN_UNTIL = None
COOLDOWN_BACKOFF_SEC = 60

async def get_latest_stock_data_bulk(tickers: List[str]) -> Dict[str, dict]:
    """
    Fetch current stock price and cumulative volume for multiple tickers in a single bulk request.
    Respects global rate-limiting cooldown if Yahoo Finance blocks the IP.
    """
    global COOLDOWN_UNTIL, COOLDOWN_BACKOFF_SEC
    
    if not tickers:
        return {}
        
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    if COOLDOWN_UNTIL and now_utc < COOLDOWN_UNTIL:
        return {}

    try:
        import pandas as pd
        # Run synchronous yfinance operations in a thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        
        # Download 1d of 2m interval candles for all tickers in a single bulk request
        df = await loop.run_in_executor(
            None,
            lambda: yf.download(tickers=tickers, period="1d", interval="2m", group_by="ticker", progress=False)
        )
        
        if df.empty:
            return {}
            
        results = {}
        for ticker in tickers:
            ticker_upper = ticker.upper()
            
            # Check if columns are a MultiIndex (standard for group_by="ticker")
            if isinstance(df.columns, pd.MultiIndex):
                # Ensure the ticker level exists in the columns
                if ticker_upper not in df.columns.levels[0]:
                    continue
                ticker_data = df[ticker_upper]
            else:
                ticker_data = df
                
            if ticker_data.empty:
                continue
                
            # Find the last valid row (contains Close price)
            valid_rows = ticker_data.dropna(subset=["Close"])
            if valid_rows.empty:
                continue
                
            last_row = valid_rows.iloc[-1]
            price = last_row["Close"]
            volume = last_row["Volume"]
            
            if price is not None and volume is not None:
                results[ticker] = {
                    "price": float(price),
                    "volume": int(volume),
                    "timestamp": now_utc
                }
                
        # Reset backoff on success
        COOLDOWN_BACKOFF_SEC = 60
        COOLDOWN_UNTIL = None
        
        return results
    except Exception as e:
        err_str = str(e).lower()
        if "too many requests" in err_str or "rate limit" in err_str or "429" in err_str:
            COOLDOWN_UNTIL = now_utc + datetime.timedelta(seconds=COOLDOWN_BACKOFF_SEC)
            print(f"Worker rate limited. Entering yfinance cooldown for {COOLDOWN_BACKOFF_SEC}s. Error: {e}")
            COOLDOWN_BACKOFF_SEC = min(COOLDOWN_BACKOFF_SEC * 2, 900)  # Double backoff up to 15 mins
        else:
            print(f"Error fetching bulk data for tickers {tickers}: {str(e)}")
        return {}



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

    # Skip flat, inactive candles when the market is closed (no price change and zero volume)
    # This prevents the DB from filling with flat stale lines during closed hours.
    # Crypto tickers are exempted as they trade 24/7.
    is_crypto = ticker.endswith("-USD") or ticker.endswith("-BTC")
    if not is_crypto and open_price == close_price == high_price == low_price and volume_diff == 0:
        return

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
                    
                    # Fetch data in bulk for all watchlist tickers
                    bulk_ticks = await get_latest_stock_data_bulk(dynamic_tickers)
                    
                    for ticker in dynamic_tickers:
                        tick = bulk_ticks.get(ticker)
                        
                        if tick:
                            aggregation_buffer[ticker]["prices"].append(tick["price"])
                            aggregation_buffer[ticker]["volumes"].append(tick["volume"])
                            
                            payload = {
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

            # Sleep for 30 seconds (must run outside the loop and minute check)
            elapsed_time = asyncio.get_event_loop().time() - start_time
            sleep_time = max(1.0, 30.0 - elapsed_time)
            await asyncio.sleep(sleep_time)

            
    except asyncio.CancelledError:
        print("Worker stopped.")
    finally:
        await producer.stop()
        print("Redpanda connection closed.")

if __name__ == "__main__":
    asyncio.run(main())