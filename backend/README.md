# Backend Service Layer

The Backend is a high-performance FastAPI service designed to orchestrate the machine learning model pipeline, execute the Gemini ReAct agent loop, manage GraphQL subscriptions, handle HTTP endpoints, and process background Celery tasks.

---

## Architecture & Service Directory

### 1. ONNX Model Hub & Dynamic Hot-Reloading
Upon service startup (`startup_event` in `backend/app/main.py`), the backend automatically connects to Hugging Face Hub via `hf_hub_download` to pull specialized machine learning models:
- `model_tech.onnx` (for technology stocks)
- `model_crypto.onnx` (for cryptocurrency assets)
- `model_index.onnx` (for broad market indices)

If downloading fails, the server falls back to a general `model.onnx` file stored locally.

#### Hot-Reloading Engine:
To support model retraining without system downtime, the function `get_onnx_session_for_type` monitors the model files. When a retraining task saves a new model file, the system detects the changed modification time (`os.path.getmtime`), terminates the old session, and hot-reloads the new `ort.InferenceSession` in-memory.

---

### 2. Gemini ReAct Agent Loop
The core analytical capabilities of QuantIQ are powered by the Gemini GenAI SDK (`gemini-2.5-flash`), running a reasoning-action loop.

#### Synchronous Tool closures:
The Gemini automatic function calling API executes tools synchronously. However, the database operations inside our FastAPI application are asynchronous. To solve this, the agent loop uses `asyncio.run_coroutine_threadsafe` and closures to safely schedule async queries back onto the main event loop from inside the synchronous tool calls.

#### Tool Ecosystem:
- `get_user_watchlist`: Retrieves the active ticker watchlist for the logged-in user.
- `get_stock_history_and_indicators`: Extracts recent price candles and calculates technical indicator values.
- `create_alert_threshold`: Allows the model to programmatically set alert boundaries.
- `trigger_model_prediction`: Evaluates the specialized ONNX model predictions.

---

### 3. Mathematical Indicator Formulas

The backend computes technical indicators over a 60-day historical window. The exact formulas are detailed below:

#### Volatility Target and Stop-Loss Levels (ATR-14)
To calculate risk-managed boundaries:
1. Compute the True Range (TR) for each candle:
   $$\text{TR} = \max(\text{High} - \text{Low}, |\text{High} - \text{Close}_{\text{prev}}|, |\text{Low} - \text{Close}_{\text{prev}}|)$$
2. Compute the 14-period Average True Range (ATR) using Wilder's Smoothing:
   $$\text{ATR}_t = \frac{\text{ATR}_{t-1} \times 13 + \text{TR}_t}{14}$$
3. Set the target and stop-loss boundaries based on the signal action (with a default multiplier of 1.5):
   - **BUY**: 
     $$\text{Stop Loss} = \text{Close} - (1.5 \times \text{ATR})$$
     $$\text{Target Price} = \text{Close} + (3.0 \times \text{ATR})$$
   - **SELL**:
     $$\text{Stop Loss} = \text{Close} + (1.5 \times \text{ATR})$$
     $$\text{Target Price} = \text{Close} - (3.0 \times \text{ATR})$$

If the asset history has fewer than 14 days, the system falls back to asset-class default percentages:
- **Crypto**: Target = 8%, Stop = 4%
- **Indices**: Target = 1.5%, Stop = 0.75%
- **Stocks (Tech/General)**: Target = 4%, Stop = 2%

#### Relative Strength Index (RSI-14)
Computes momentum boundaries using upward and downward price changes over 14 candles:
$$\text{RS} = \frac{\text{EMA}(\text{Gain}, 14)}{\text{EMA}(\text{Loss}, 14)}$$
$$\text{RSI} = 100 - \left(\frac{100}{1 + \text{RS}}\right)$$

#### MACD (Moving Average Convergence Divergence)
Measures trend-following momentum:
$$\text{MACD Line} = \text{EMA}(\text{Close}, 12) - \text{EMA}(\text{Close}, 26)$$
$$\text{Signal Line} = \text{EMA}(\text{MACD Line}, 9)$$
$$\text{Histogram} = \text{MACD Line} - \text{Signal Line}$$

---

### 4. Celery Tasks & Redis Logical Separation
Redis serves as both our Celery task broker and backend database cache. To prevent packet collisions and memory corruption, the databases are logically isolated:
- **Broker Channel**: Celery occupies Redis Logical Database 0 (`redis://localhost:6379/0`).
- **Cache Channel**: Technical indicators caching, yfinance hourly caching, and ATR calculations occupy Redis Logical Database 1 (`redis://localhost:6379/1`).

---

### 5. Strawberry GraphQL Integration
The client connects to a Strawberry-powered GraphQL router mounted at `/graphql`.
- **JWT Authorization Parser**: On each request, the custom `get_graphql_context` dependency extracts the HTTP `Authorization: Bearer <token>` header, decodes the JWT signature, extracts the user ID UUID, and fetches the user ORM object to inject it directly into the execution context.
- **Database Context**: Attaches the active `AsyncSession` to the GraphQL context, ensuring database queries run within safe transaction boundaries.

---

### 6. Prometheus Metrics Instrumentation
The backend uses `prometheus-fastapi-instrumentator` to export operational metrics.
- Enpoints metrics are published on the `/metrics` path.
- The route is protected using HTTP Basic Authentication (`admin` / `admin`).
- Tracks API latency, HTTP response codes, active WebSocket counts, Gemini token expenditures, and agent reasoning steps.
