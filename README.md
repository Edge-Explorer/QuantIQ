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

## What is QuantIQ

QuantIQ is a production-grade, event-driven stock market intelligence platform built entirely on free-tier cloud infrastructure. It bridges live market data, machine learning inference, and generative AI into a single cohesive dashboard — giving retail traders access to the same level of tooling that institutional desks rely on.

The platform continuously ingests real-time stock price ticks, applies a locally-running machine learning model to forecast directional movement probability, generates structured quantitative reports through a multi-step ReAct reasoning agent powered by Google Gemini 2.5 Flash, and streams everything live to the browser over a GraphQL WebSocket subscription.

QuantIQ is not a prototype. Every component — the ingestion pipeline, the AI agent, the subscription system, the payment gateway, and the observability stack — is designed for production deployment with monitoring, fault tolerance, and cost efficiency as primary constraints.

---

## Why We Built This

Institutional-grade market intelligence tooling has historically been locked behind expensive Bloomberg terminals and proprietary trading platforms. The goal of QuantIQ was to prove that the same level of depth and real-time responsiveness is achievable using only free-tier services, open-source infrastructure, and modern language model APIs.

The design prioritizes:

- **Zero infrastructure cost** at launch — every third-party service used (NeonDB, Redpanda Cloud, Hugging Face Spaces, Grafana Cloud, Vercel) has a free tier that covers production workloads at this scale.
- **Localized ML inference** — we avoided calling a cloud inference API for every prediction. Instead, we train a scikit-learn model offline and export it to ONNX format. The backend loads the ONNX model on startup and runs sub-millisecond inference locally with no external dependency.
- **Event-driven architecture** — rather than polling the frontend on a timer, every price update is an event that propagates from the ingestion worker through Redpanda (Kafka-compatible) to the backend and then over a live WebSocket to the browser. This design scales horizontally without changing the core logic.
- **Tiered monetization** — free access degrades gracefully rather than blocking the product entirely. This enables genuine user acquisition with a natural upgrade path.

---

## Architecture

```
                           [ Hugging Face Spaces (Docker) ]
                           +----------------------------------+
                           |  worker/worker.py                |
                           |   - yfinance tick polling         |
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

1. `worker.py` polls Yahoo Finance via `yfinance` every 5 seconds for every ticker across all user watchlists (fetched dynamically from NeonDB each cycle — no hardcoded list).
2. Each tick is published as a JSON message to a Redpanda Cloud topic (`stock-ticks`) using `AIOKafkaProducer`.
3. Simultaneously, the worker accumulates ticks in an in-memory buffer and periodically flushes 1-minute OHLCV candlestick rows to NeonDB for historical chart rendering.
4. The FastAPI backend subscribes to the Redpanda topic using `AIOKafkaConsumer` inside a Strawberry GraphQL subscription resolver. Each connected browser client has its own dedicated consumer group, ensuring independent per-client message delivery.
5. Price alerts are evaluated inside the worker on each tick. When a threshold is breached, a notification is dispatched.
6. When a user requests an AI analysis, the Gemini ReAct agent runs a multi-step reasoning loop — calling tools to fetch the watchlist, retrieve historical OHLCV data, compute technical indicators, and run ONNX model inference — before producing a structured JSON report with a bullish probability score and a detailed markdown rationale.
7. All backend HTTP metrics, agent latency, token consumption, WebSocket connection counts, and payment webhook events are exposed at `/metrics` and scraped by Grafana Cloud via Prometheus.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Language | Python 3.12 | Native async/await support, rich data ecosystem |
| Package Manager | uv | Significantly faster than pip/pip-tools; lockfile-based reproducibility |
| Web Framework | FastAPI | Best-in-class async Python web framework with automatic OpenAPI docs |
| ASGI Server | Uvicorn (standard) | Production-grade ASGI server with WebSocket support |
| GraphQL Server | Strawberry GraphQL | Code-first GraphQL using Python type annotations |
| Database ORM | SQLAlchemy 2.x (async) | Fully async query execution via asyncpg driver |
| Database Driver | asyncpg | Native async PostgreSQL protocol driver |
| Schema Migrations | Alembic | Versioned, reversible database migrations — no `create_all()` in production |
| Data Validation | Pydantic v2 | Request/response schema validation with 10-20x faster validation than v1 |
| Config Management | Pydantic Settings | Structured environment variable parsing with type coercion |
| Database | NeonDB (PostgreSQL) | Serverless Postgres with free tier and connection pooling |
| Message Broker | Redpanda Cloud (Kafka-compatible) | Zero-overhead Kafka replacement; Kafka-compatible protocol |
| Market Data | yfinance | Free Yahoo Finance API wrapper; no API key required |
| Technical Analysis | pandas-ta | RSI, MACD, Bollinger Bands, EMA computation on Pandas DataFrames |
| ML Framework | scikit-learn | Trained RandomForestClassifier for directional prediction |
| ML Runtime | ONNX Runtime | Cross-platform, hardware-optimized inference engine for local model serving |
| ML Export | skl2onnx | Converts trained scikit-learn estimators to the portable ONNX format |
| AI Layer | Google Gemini 2.5 Flash | Multi-step ReAct reasoning agent with tool use for structured market analysis |
| AI SDK | google-genai 2.10+ | Official Google GenAI Python SDK (replaces deprecated google-generativeai) |
| Payments | Razorpay | Subscription payment gateway with webhook-based order confirmation |
| HTTP Client | httpx | Async HTTP client for outbound third-party API calls |
| Media Storage | Cloudinary | User profile image upload and URL serving |
| Auth | JWT (PyJWT) + Google OAuth | Stateless bearer token authentication with Google login support |
| Email | smtplib (MIME) | Transactional email delivery for account verification |
| Observability | prometheus-fastapi-instrumentator | Auto-instrumented HTTP metrics and custom Prometheus collectors |
| Dashboarding | Grafana Cloud (free tier) | Prometheus-sourced dashboards for real-time production monitoring |
| Containerization | Docker | Reproducible build environments for backend and worker services |
| Frontend Language | TypeScript 5.x | End-to-end type safety across all component interfaces |
| Frontend Framework | React 19 | Component tree rendering with React 19 concurrent features |
| Build Tool | Vite | Sub-second HMR and rolldown-based production bundle |
| Styling | Tailwind CSS v4 | Utility-first CSS with the new Vite plugin for zero-configuration setup |
| Charting | Lightweight Charts (TradingView) | Professional, GPU-accelerated candlestick and line chart rendering |
| Backend Hosting | Hugging Face Spaces | Free persistent Docker runtime that keeps WebSocket connections alive |
| Frontend Hosting | Vercel | Zero-configuration React/Vite deployment with global CDN |

---

## Why Redpanda Instead of Redis Pub/Sub

The original architecture used Upstash Redis Pub/Sub for tick distribution. We migrated to Redpanda Cloud for three reasons:

1. **Message retention**: Redis Pub/Sub is fire-and-forget. If the backend restarts while a tick is in flight, the message is lost. Redpanda retains messages on disk and allows consumers to replay from any offset.
2. **Consumer isolation**: With Redis Pub/Sub, all subscribers receive every message. With Kafka-compatible consumer groups, each browser client gets an independent offset position, enabling per-client filtering at the broker level.
3. **Scale path**: The migration from Redpanda Cloud free tier to a paid Kafka cluster requires changing only connection strings — the entire application logic remains identical.

---

## Why ONNX for Local ML Inference

We deliberately avoided calling a cloud ML inference API (such as a hosted HuggingFace endpoint) on every user request for two reasons:

1. **Latency**: A round-trip to an external inference API adds 200–800ms to every AI report generation. ONNX Runtime inference on CPU runs in under 5ms.
2. **Cost**: External inference APIs are billed per call. Running inference locally on the FastAPI server incurs zero marginal cost regardless of request volume.

The model is trained with `train.py`, exported to `model.onnx` using `skl2onnx`, and hosted on Hugging Face Hub under the repository `Karan6124/quantiq-model`. On startup, the FastAPI backend checks for a local `model.onnx` file and falls back to downloading it from Hugging Face Hub if not present.

**Model Architecture:**

- **Algorithm**: RandomForestClassifier (50 estimators, max depth 6)
- **Features**: RSI-14, MACD line (12/26/9), MACD signal, EMA-20 ratio
- **Target**: Binary — 1 if next-day close is higher than current close, 0 otherwise
- **Training data**: 2 years of daily OHLCV data across AAPL, TSLA, TCS.NS, RELIANCE.NS
- **Export format**: ONNX opset 15, FloatTensorType input, dynamic batch size

---

## Why a ReAct Agent Instead of a Simple Prompt

A naive implementation would pass raw market data directly to Gemini in a single prompt. We chose a ReAct (Reasoning + Acting) agent pattern for two reasons:

1. **Grounded context**: The agent actively decides what information it needs and fetches it through typed tool functions. It does not hallucinate data — every number in its report comes from a live database query or a real indicator computation.
2. **Extensibility**: Adding a new tool (for example: sentiment analysis from news, earnings date lookup) requires writing a single typed Python function. The agent automatically discovers and uses it.

**Agent Tools:**

- `get_user_watchlist` — fetches the authenticated user's tracked tickers from NeonDB
- `get_stock_history_and_indicators` — retrieves OHLCV history and computes RSI, MACD, Bollinger Bands, EMA using pandas-ta
- `get_ml_prediction` — runs ONNX model inference and returns the bullish probability score
- `get_user_alerts` — retrieves the user's active price alert thresholds
- `create_price_alert` — creates a new price alert for a given ticker and threshold

---

## Observability

All production metrics are exposed at `/metrics` and scraped by Grafana Cloud via Prometheus. We instrument at three levels:

**HTTP Layer (automatic via prometheus-fastapi-instrumentator):**
- Request rate by endpoint and HTTP status code
- p50 / p95 / p99 response latency histograms
- 5xx error spike detection

**AI Strategy Engine (custom collectors in `metrics.py`):**
- `quantiq_llm_tokens_total` — input and output token counts labeled by user subscription tier
- `quantiq_agent_steps_total` — number of ReAct reasoning turns per session, labeled by success/failure
- `quantiq_agent_latency_seconds` — histogram of end-to-end agent report generation time
- `quantiq_agent_tool_calls_total` — individual tool invocation counts labeled by tool name and status

**Market Data Pipeline (custom collectors):**
- `quantiq_websocket_connections_active` — gauge of active GraphQL WebSocket subscriptions
- `quantiq_ingestion_delay_seconds` — histogram of latency from tick generation by worker to broadcast at the browser, measured in real-time on every tick received by the subscription resolver
- `quantiq_external_api_calls_total` — count of yfinance API requests labeled by success/failure

**Application Core (custom collectors):**
- `quantiq_payment_callbacks_total` — Razorpay webhook events labeled by package and status
- `quantiq_db_pool_connections_active` — real-time gauge of SQLAlchemy connection pool utilization, bound via `set_function` to avoid polling lag

---

## Subscription Model

QuantIQ implements a tiered access system enforced at the database level, not in-memory.

| Plan | Price | AI Analysis Credits | Monthly Refresh |
|---|---|---|---|
| Free | No charge | 3 lifetime | No |
| Analyst | Rs. 500 | 10 one-time | No |
| Trader | Rs. 1,500 | 50 one-time | No |
| Pro | Rs. 10,000 (Rs. 15,000 after 3 days) | 100 per month | Yes |

New users see a time-limited Pro discount offer with a live countdown timer based on account creation date. This is evaluated on the client side from the `created_at` field returned by the user profile endpoint.

Payments are processed via Razorpay and confirmed server-side through a webhook handler at `/payments/webhook`. The handler verifies the Razorpay HMAC signature before updating the user's subscription tier and credit balance in NeonDB.

---

## Frontend Architecture

The frontend is a React 19 single-page application built with Vite and TypeScript.

**Pages:**
- `LandingPage.tsx` — Public marketing page with animated hero section, live market movers panel, financial news feed, capabilities showcase, tech stack detail section, and a full authentication modal (Google OAuth + email/password).
- `Dashboard.tsx` — Authenticated shell that orchestrates the sidebar, charting area, and AI components.
- `UpgradePage.tsx` — Subscription upgrade interface with pricing cards and Razorpay Checkout integration.

**Key Components:**
- `StockChart.tsx` — Full-featured trading terminal integrating TradingView Lightweight Charts for candlestick rendering, overlay indicators (RSI, MACD, Bollinger Bands, EMA), and interactive GraphQL subscription for live tick streaming.
- `AIAnalyst.tsx` — The AI report panel. Sends requests to the `/analyst/chat` endpoint and renders the structured JSON response (bullish probability gauge and markdown analysis) in a formatted, expandable card.
- `TrendingHub.tsx` — Financial news and trending tickers feed with real-time refresh.
- `ChartChatbot.tsx` — Context-aware conversational AI assistant embedded within the charting panel.
- `WatchlistSidebar.tsx` — Manages the user's tracked tickers with add/remove controls.
- `PriceAlerts.tsx` — Price alert creation and management interface.
- `RechargeModal.tsx` — Subscription upgrade flow with a countdown discount timer.
- `LogoLoop.tsx` — Infinite horizontal marquee component with seamless CSS animation (4 repeated sets, translating by -25% to eliminate gap artifacts on all screen widths).

---

## Project Structure

```
QuantIQ/
|
|-- backend/                        # FastAPI backend service
|   |-- Dockerfile
|   +-- app/
|       |-- main.py                 # Application entrypoint, ONNX startup loader, Prometheus init
|       |-- api/
|       |   |-- endpoints.py        # REST routes: auth, watchlist, alerts, market data, payments
|       |-- config/
|       |   |-- settings.py         # Pydantic Settings: all env vars
|       |   +-- metrics.py          # Custom Prometheus collector definitions
|       |-- database/
|       |   |-- session.py          # SQLAlchemy async engine and session factory
|       |   |-- models.py           # ORM models: User, Watchlist, StockHistory, Alert
|       |   +-- crud.py             # Database query functions
|       |-- graphql/
|       |   +-- schema.py           # Strawberry GraphQL schema, queries, mutations, subscriptions
|       |-- schemas/
|       |   +-- schemas.py          # Pydantic request and response models
|       +-- services/
|           +-- gemini.py           # Gemini ReAct agent, tool definitions, ONNX inference, generate_text
|
|-- worker/
|   |-- Dockerfile
|   +-- worker.py                   # yfinance polling loop, AIOKafkaProducer, 1-min OHLCV aggregation
|
|-- frontend/                       # React 19 + Vite + TypeScript frontend
|   +-- src/
|       |-- pages/                  # LandingPage, Dashboard, UpgradePage
|       |-- components/             # StockChart, AIAnalyst, TrendingHub, Navbar, WatchlistSidebar, etc.
|       +-- App.tsx                 # Router, auth state, Google OAuth integration
|
|-- alembic/                        # Alembic migration scripts
|-- train.py                        # Offline ML model training and ONNX export
|-- model.onnx                      # Trained ONNX model (also hosted on Hugging Face Hub)
|-- pyproject.toml                  # uv project configuration and Python dependencies
|-- docker-compose.yml              # Local development orchestration
+-- README.md
```

---

## Database Design

Schema changes are managed exclusively through Alembic migrations. `Base.metadata.create_all()` is never called in production.

**Core Tables:**

- `users` — User accounts. Fields: `id`, `email`, `full_name`, `hashed_password`, `picture_url`, `subscription_tier`, `messages_remaining`, `monthly_messages_used`, `last_billing_date`, `created_at`.
- `watchlists` — Per-user ticker tracking. Fields: `id`, `user_id`, `ticker`, `added_at`.
- `stock_history` — 1-minute OHLCV candlestick rows aggregated by the worker. Fields: `id`, `ticker`, `open`, `high`, `low`, `close`, `volume`, `timestamp`.
- `alerts` — User-defined price alert thresholds. Fields: `id`, `user_id`, `ticker`, `condition`, `target_price`, `is_active`, `created_at`.

---

## Environment Variables

Create a `.env` file in the project root. This file is excluded from version control.

```env
# Google Gemini API Key — obtain from aistudio.google.com (free tier)
GEMINI_API_KEY=your_gemini_api_key_here

# Database — NeonDB connection string (or local PostgreSQL for development)
# The application auto-converts postgresql:// to postgresql+asyncpg:// internally
DATABASE_URL=postgresql://user:password@host/dbname

# Redpanda / Kafka bootstrap server address
KAFKA_BOOTSTRAP_SERVERS=your_redpanda_bootstrap_server:9092

# Application secret key for JWT token signing
SECRET_KEY=your_secret_key_here

# Razorpay API credentials — obtain from dashboard.razorpay.com
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Cloudinary credentials for user profile image uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SMTP credentials for transactional email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Hugging Face model repository (defaults to Karan6124/quantiq-model)
HF_MODEL_REPO=Karan6124/quantiq-model
```

---

## Local Development Setup

**Prerequisites:**

- Python 3.12 or higher
- Node.js 18 or higher
- `uv` package manager — install with `pip install uv`
- Docker Desktop — for running local PostgreSQL

**Steps:**

```bash
# 1. Clone the repository
git clone https://github.com/Edge-Explorer/QuantIQ.git
cd QuantIQ

# 2. Install Python dependencies
uv sync

# 3. Start local PostgreSQL via Docker
docker-compose up -d

# 4. Configure environment variables
# Copy the template above into a .env file and fill in your values

# 5. Run database migrations
uv run alembic upgrade head

# 6. Start the backend
uv run uvicorn backend.app.main:app --reload

# 7. Start the ingestion worker
uv run python worker/worker.py

# 8. Install and start the frontend
cd frontend
npm install
npm run dev
```

---

## Training the ML Model

To retrain the directional prediction model from scratch:

```bash
uv run python train.py
```

This fetches 2 years of daily OHLCV data for AAPL, TSLA, TCS.NS, and RELIANCE.NS, computes RSI, MACD, and EMA features, trains a RandomForestClassifier (50 estimators, max depth 6), exports the model to `model.onnx` via skl2onnx, and verifies the ONNX runtime with a test inference call.

The exported `model.onnx` file should be committed or uploaded to your Hugging Face Hub repository so the backend can download it on cold starts.

---

## Deployment

**Backend and Worker** are containerized with Docker and deployed to Hugging Face Spaces as persistent Docker containers. Hugging Face Spaces is chosen specifically because it keeps the container process alive indefinitely — a requirement for maintaining long-lived Kafka consumer connections and WebSocket sessions.

**Frontend** is deployed to Vercel with zero configuration. Vercel auto-detects the Vite build configuration and provides a global CDN edge network.

**Observability** uses Grafana Cloud free tier. After deployment, configure a Prometheus data source in Grafana Cloud pointing to the `/metrics` endpoint of the backend. All custom metric panels (agent latency, token usage, WebSocket connections) can then be built in the Grafana dashboard UI.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
