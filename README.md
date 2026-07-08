
<div align="center">
  <img src="assets/banner.png" alt="QuantIQ — AI Stock Intelligence" width="750" />
  <br /><br />
  <p>
    <img src="https://img.shields.io/badge/Python-3.12-blue?style=flat-square" alt="Python" />
    <img src="https://img.shields.io/badge/FastAPI-0.110+-green?style=flat-square" alt="FastAPI" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Gemini-2.5 Flash-orange?style=flat-square" alt="Gemini" />
    <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT License" />
  </p>
</div>

---

## What is QuantIQ?

QuantIQ is a **personal learning project** I built to deeply understand how real-world full-stack systems come together — from live data pipelines and machine learning inference to generative AI agents, WebSocket streaming, and production observability.

It is a stock market intelligence dashboard that:
- **Ingests live stock price ticks** from Yahoo Finance every 5 seconds.
- **Runs a locally-trained ML model** (exported to ONNX) to forecast directional movement probability — entirely on-device, no cloud inference API.
- **Generates structured AI analysis reports** using a multi-step ReAct reasoning agent powered by Google Gemini 2.5 Flash.
- **Streams everything to the browser in real time** over a GraphQL WebSocket subscription.
- **Monitors production health** via a custom Prometheus metrics endpoint scraped by Grafana Cloud.

> **Built by a fresher for learning.** Everything runs on free-tier infrastructure — the only paid component is the Gemini API key, which costs a few rupees per analysis call. The goal was to see how far you can get with zero infrastructure spend while still touching every part of a real system.

---

## What I Learned Building This

This project forced me to go hands-on with concepts I had only read about:

- **Event-driven architecture with Kafka** — moved from Redis Pub/Sub to Redpanda (Kafka-compatible) to understand message retention, consumer groups, and offset management.
- **ONNX and local ML inference** — trained a scikit-learn RandomForest model offline and exported it to ONNX. The backend loads and runs it in under 5ms per request with no external API call.
- **Agentic AI with ReAct** — instead of a single prompt, built a multi-step agent that decides what tools to call, fetches live data, and then generates a grounded report. No hallucinated numbers.
- **Async Python at scale** — deep-dived into `asyncio`, `asyncpg`, `AIOKafkaConsumer`, and Strawberry GraphQL subscriptions running concurrently under Uvicorn.
- **Production observability** — wrote custom Prometheus collectors for token usage, agent latency, WebSocket connections, and pipeline delay. Imported a live Grafana dashboard to visualise everything.
- **Payments and webhooks** — integrated Razorpay with HMAC webhook verification, tiered subscription logic, and a time-limited discount system.
- **Docker and process supervision** — containerised the entire backend (FastAPI + Celery + Redis + Redpanda + ingestion worker) under a single Supervisor config for Hugging Face Spaces deployment.

---

## Architecture

```
                         [ Hugging Face Spaces (Docker) ]
                         +----------------------------------+
                         |  worker/worker.py                |
                         |   - yfinance tick polling (5s)   |
                         |   - AIOKafkaProducer publish      |
                         |   - 1-min OHLCV aggregation       |
                         |   - NeonDB batch write            |
                         +----------------------------------+
                                       |
                          Redpanda Cloud (Kafka-compatible)
                          topic: stock-ticks
                                       |
                         +----------------------------------+
                         |  backend/app/main.py             |
                         |   - FastAPI + Uvicorn (ASGI)     |
                         |   - Strawberry GraphQL           |
                         |   - AIOKafkaConsumer subscriber  |
                         |   - ONNX model inference         |
                         |   - Gemini ReAct Agent           |
                         |   - Razorpay webhook handler     |
                         |   - /metrics (Prometheus)        |
                         +----------------------------------+
                                       |
                  +--------------------+-------------------+
                  |                                        |
         NeonDB (PostgreSQL)                    Grafana Cloud
         - users, watchlists,                  scrapes /metrics
         - stock_history, alerts               via Prometheus
                  |
         Vercel (Frontend)
         - React 19 + Vite + TypeScript
         - GraphQL WebSocket subscription
         - Lightweight Charts candlestick
         - Real-time ticker tape
```

**Data Flow:**

1. `worker.py` polls Yahoo Finance via `yfinance` every 5 seconds. The ticker list is fetched dynamically from NeonDB each cycle — no hardcoded symbols.
2. Each tick is published as a JSON message to Redpanda Cloud (`stock-ticks` topic) via `AIOKafkaProducer`.
3. The worker also accumulates ticks in-memory and flushes 1-minute OHLCV candles to NeonDB for historical chart rendering.
4. The FastAPI backend subscribes to the Redpanda topic via `AIOKafkaConsumer` inside a Strawberry GraphQL subscription. Each connected browser gets its own consumer group — independent per-client delivery.
5. Price alerts are evaluated by the worker on each tick and dispatched when thresholds are breached.
6. When a user triggers an AI report, the Gemini ReAct agent runs a multi-step loop — calling tools to fetch watchlists, compute technical indicators, and run ONNX inference — before producing a structured bullish probability score with a full markdown rationale.
7. All metrics (HTTP stats, agent latency, token counts, WebSocket connections, payment events) are exposed at `/metrics` and scraped every minute by Grafana Cloud.

---

## Technology Stack

| Layer | Technology | Why I Used It |
|---|---|---|
| Language | Python 3.12 | Native async/await, rich ecosystem |
| Package Manager | uv | Faster than pip, lockfile-based reproducibility |
| Web Framework | FastAPI | Best-in-class async Python framework |
| ASGI Server | Uvicorn | Production-grade, WebSocket support |
| GraphQL | Strawberry GraphQL | Code-first, Python type annotations |
| ORM | SQLAlchemy 2.x (async) | Fully async queries via asyncpg |
| Database Driver | asyncpg | Native async PostgreSQL protocol |
| Migrations | Alembic | Versioned, reversible DB migrations |
| Validation | Pydantic v2 | Fast request/response schema validation |
| Database | NeonDB (PostgreSQL) | Free-tier serverless Postgres |
| Message Broker | Redpanda Cloud | Free-tier Kafka-compatible broker |
| Market Data | yfinance | Free Yahoo Finance wrapper, no API key |
| Technical Analysis | pandas-ta | RSI, MACD, EMA on Pandas DataFrames |
| ML Training | scikit-learn | RandomForestClassifier for direction prediction |
| ML Runtime | ONNX Runtime | Sub-millisecond local inference, zero cloud cost |
| ML Export | skl2onnx | Converts sklearn models to portable ONNX format |
| AI Layer | Google Gemini 2.5 Flash | ReAct reasoning agent with native tool use |
| AI SDK | google-genai | Official Google GenAI Python SDK |
| Payments | Razorpay | Free-tier payment gateway with webhooks |
| HTTP Client | httpx | Async HTTP for outbound API calls |
| Media Storage | Cloudinary | Free-tier profile image upload and serving |
| Auth | JWT (PyJWT) + Google OAuth | Stateless bearer tokens + Google login |
| Email | smtplib (MIME) | Transactional email via Gmail SMTP |
| Observability | prometheus-fastapi-instrumentator | Auto-instrumented HTTP metrics |
| Dashboarding | Grafana Cloud (free tier) | Live production monitoring dashboard |
| Containerization | Docker | Reproducible builds for backend + worker |
| Frontend Language | TypeScript 5.x | End-to-end type safety |
| Frontend Framework | React 19 | Component rendering with concurrent features |
| Build Tool | Vite | Fast dev server and production bundler |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Charting | Lightweight Charts (TradingView) | GPU-accelerated candlestick rendering |
| Backend Hosting | Hugging Face Spaces | **Free** persistent Docker runtime |
| Frontend Hosting | Vercel | **Free** zero-config React/Vite deployment |

---

## Why Redpanda Instead of a Simple Timer

I initially used `asyncio.sleep` loops and Redis Pub/Sub. I migrated to Redpanda (Kafka-compatible) to learn what a real message broker gives you:

1. **Message retention** — Redis Pub/Sub is fire-and-forget. Redpanda retains messages on disk; consumers can replay from any offset after a restart.
2. **Consumer isolation** — Each browser client gets its own consumer group with an independent offset, so two users watching different tickers never interfere.
3. **Real scalability path** — Swapping Redpanda Cloud free tier for a paid Kafka cluster means changing only the connection string. The app logic stays identical.

---

## Why ONNX for ML Inference

Rather than calling a hosted inference API on every request (slow + paid), I train the model once locally with `train.py`, export it to ONNX, and load it into the FastAPI process on startup.

- **Inference latency**: under 5ms on CPU vs 200–800ms for a remote API call.
- **Cost**: zero per-request cost regardless of volume.
- **No dependency**: works even if external services are down.

**Model details:**
- Algorithm: RandomForestClassifier (50 estimators, max depth 6)
- Features: RSI-14, MACD (12/26/9), MACD signal line, EMA-20 ratio
- Target: Binary — 1 if next-day close > current close, 0 otherwise
- Training data: 2 years of daily OHLCV for AAPL, TSLA, TCS.NS, RELIANCE.NS
- Export: ONNX opset 15, FloatTensorType, dynamic batch size

---

## The AI Agent (ReAct Pattern)

Instead of stuffing raw data into a single prompt, the agent decides what it needs and fetches it through typed Python tool functions. This was the most interesting part to build.

**Agent Tools:**

| Tool | What it does |
|---|---|
| `get_user_watchlist` | Fetches the user's tracked tickers from NeonDB |
| `get_stock_history_and_indicators` | Pulls OHLCV history and computes RSI, MACD, EMA via pandas-ta |
| `get_ml_prediction` | Runs ONNX inference and returns the bullish probability score |
| `get_user_alerts` | Retrieves the user's active price alert thresholds |
| `create_price_alert` | Creates a new price alert for a given ticker |

The agent runs a multi-step loop until it has enough context, then produces a structured JSON response: `{"bullish_probability": int, "reason": "..."}`.

---

## Observability

All metrics are exposed at `/metrics` and scraped by Grafana Cloud every minute.

**HTTP Layer** (auto via `prometheus-fastapi-instrumentator`):
- Request rate by endpoint and status code
- p50 / p95 / p99 response latency histograms

**AI Strategy Engine** (custom collectors in `metrics.py`):
- `quantiq_llm_tokens_total` — input/output token counts by user tier
- `quantiq_agent_steps_total` — ReAct reasoning turns per session
- `quantiq_agent_latency_seconds` — end-to-end agent report generation time
- `quantiq_agent_tool_calls_total` — tool invocations by name and status

**Market Data Pipeline** (custom collectors):
- `quantiq_websocket_connections_active` — live GraphQL WebSocket session count
- `quantiq_ingestion_delay_seconds` — latency from tick generation to browser broadcast
- `quantiq_external_api_calls_total` — yfinance API call count by success/failure

**Application Core** (custom collectors):
- `quantiq_payment_callbacks_total` — Razorpay webhook events by package and status
- `quantiq_db_pool_connections_active` — SQLAlchemy connection pool utilisation (live, via `set_function`)

---

## Subscription Model

| Plan | Price | AI Credits | Refresh |
|---|---|---|---|
| Free | ₹0 | 3 (lifetime) | No |
| Analyst | ₹500 | 10 (one-time) | No |
| Trader | ₹1,500 | 50 (one-time) | No |
| Pro | ₹10,000 | 100/month | Monthly |

New users see a 3-day discount offer (evaluated client-side from `created_at`). Payments go through Razorpay with HMAC webhook verification before any tier or credit update happens server-side.

---

## Project Structure

```
QuantIQ/
|
|-- backend/                        # FastAPI backend service
|   +-- app/
|       |-- main.py                 # App entrypoint, ONNX loader, Prometheus init
|       |-- api/
|       |   +-- endpoints.py        # REST routes: auth, watchlist, alerts, payments
|       |-- config/
|       |   |-- settings.py         # Pydantic Settings: all env vars
|       |   +-- metrics.py          # Custom Prometheus collector definitions
|       |-- database/
|       |   |-- session.py          # SQLAlchemy async engine + session factory
|       |   |-- models.py           # ORM models: User, Watchlist, StockHistory, Alert
|       |   +-- crud.py             # Database query functions
|       |-- graphql/
|       |   +-- schema.py           # Strawberry GraphQL: queries, mutations, subscriptions
|       |-- schemas/
|       |   +-- schemas.py          # Pydantic request/response models
|       +-- services/
|           +-- gemini.py           # Gemini ReAct agent, tool definitions, ONNX inference
|
|-- worker/
|   +-- worker.py                   # yfinance polling, AIOKafkaProducer, OHLCV aggregation
|
|-- frontend/                       # React 19 + Vite + TypeScript
|   +-- src/
|       |-- pages/                  # LandingPage, Dashboard, UpgradePage
|       |-- components/             # StockChart, AIAnalyst, WatchlistSidebar, PriceAlerts...
|       +-- App.tsx                 # Router, auth state, Google OAuth
|
|-- alembic/                        # Alembic migration scripts
|-- train.py                        # Offline ML training + ONNX export
|-- model.onnx                      # Trained ONNX model
|-- pyproject.toml                  # uv project config + Python dependencies
|-- supervisord.conf                # Process supervisor for HF Spaces Docker container
+-- README.md
```

---

## Environment Variables

```env
# Google Gemini API Key — aistudio.google.com (free quota available)
GEMINI_API_KEY=your_gemini_api_key_here

# Database — NeonDB free tier PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/dbname

# Redpanda Cloud bootstrap server (free tier)
KAFKA_BOOTSTRAP_SERVERS=your_redpanda_bootstrap_server:9092

# JWT secret key for token signing
SECRET_KEY=your_secret_key_here

# Razorpay credentials — dashboard.razorpay.com
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Cloudinary — free tier for profile image uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gmail SMTP for transactional email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Hugging Face model repository
HF_MODEL_REPO=Karan6124/quantiq-model
```

---

## Local Development

**Prerequisites:** Python 3.12+, Node.js 18+, `uv` (`pip install uv`), Docker Desktop

```bash
# 1. Clone the repo
git clone https://github.com/Edge-Explorer/QuantIQ.git
cd QuantIQ

# 2. Install Python dependencies
uv sync

# 3. Start local PostgreSQL
docker-compose up -d

# 4. Add your .env file (copy the template above)

# 5. Run database migrations
uv run alembic upgrade head

# 6. Start the backend
uv run uvicorn backend.app.main:app --reload

# 7. Start the ingestion worker
uv run python worker/worker.py

# 8. Start the frontend
cd frontend && npm install && npm run dev
```

---

## Training the ML Model

```bash
uv run python train.py
```

This fetches 2 years of daily OHLCV data, computes RSI/MACD/EMA features, trains a RandomForestClassifier, exports to `model.onnx` via skl2onnx, and verifies the output with a test inference call. Upload the resulting `model.onnx` to your Hugging Face Hub repo so the backend can download it on cold starts.

---

## Deployment

| Component | Platform | Cost |
|---|---|---|
| Backend + Worker | Hugging Face Spaces (Docker) | **Free** |
| Frontend | Vercel | **Free** |
| Database | NeonDB | **Free tier** |
| Message Broker | Redpanda Cloud | **Free tier** |
| Monitoring | Grafana Cloud | **Free tier** |
| AI Analysis | Google Gemini API | Pay-per-use (very small) |

---

## License

MIT — do whatever you want with it. See [LICENSE](LICENSE).
