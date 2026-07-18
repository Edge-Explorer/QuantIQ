# Ingestion Worker

The Ingestion Worker is a standalone service responsible for real-time asset price tracking, data streaming, and database candle aggregation. It operates on a continuous async loop to fetch ticker ticks and publish them to a message broker.

---

## Technical Architecture

### 1. Multi-Threaded yfinance Ingestion
The Yahoo Finance (`yfinance`) library runs synchronous blocking network calls when querying tickers. To prevent blocking the main asyncio event loop, the worker runs all `fast_info` metrics retrievals inside a thread pool executor using `loop.run_in_executor(None, ...)` inside `get_latest_stock_data`.

```python
loop = asyncio.get_event_loop()
yf_ticker = yf.Ticker(ticker)
info = await loop.run_in_executor(None, lambda: yf_ticker.fast_info)
```

This ensures high concurrency and prevents websocket read latency on the frontend during polling cycles.

### 2. Exponential Rate-Limit Cooldown
To bypass strict IP rate-limiting blocks from third-party APIs:
- If a `429 Too Many Requests` or rate-limiting exception string is caught during execution, the worker sets a global cooldown timestamp (`COOLDOWN_UNTIL`).
- The rate-limiting cooldown backoff starts at 60 seconds.
- On consecutive rate-limit violations, the backoff doubles exponentially up to a maximum limit of 15 minutes (900 seconds).
- Once the cooldown timer expires, the backoff resets to 60 seconds on the first successful fetch.

### 3. Redpanda Event Streaming
All successfully fetched ticker events are formatted as JSON payloads containing the ticker name, latest price, cumulative volume, and UTC timestamp, then published to the Redpanda Cloud topic `stock-ticks`.
- The worker uses the asynchronous `aiokafka` client (`AIOKafkaProducer`).
- Payload serialization is handled using a native UTF-8 JSON encoder.

### 4. 1-Minute Candle Aggregation
In addition to streaming, the worker buffers price and volume data points in memory to calculate 1-minute OHLCV candles:
- **Open**: The first price point of the minute.
- **High**: The maximum price point recorded in the minute.
- **Low**: The minimum price point recorded in the minute.
- **Close**: The last price point of the minute.
- **Volume**: The difference between the maximum and minimum cumulative volumes recorded in that minute.

#### Closed-Market Skipping Rules:
To avoid bloat in the database (e.g. NeonDB storage limitations), the worker filters out flat, inactive closed-market candles (where open equals high, low, and close, and the volume difference is zero).
- Non-crypto tickers (stocks and indices) will not be committed to the database during closed hours.
- Crypto tickers (e.g. ending in `-USD` or `-BTC`) bypass this rule and are saved 24/7 since cryptocurrency markets never close.

---

## Service Operations

### Core Main Loop
The worker queries the database dynamically on each cycle to fetch active tickers from users' watchlists (`select(Watchlist.ticker).distinct()`). This guarantees that:
- The worker only polls tickers that users are actively monitoring.
- Adding a ticker to a watchlist dynamically begins polling it without requiring a worker restart.
- Polling calls are staggered with a 1.5-second sleep interval to spread load evenly.
