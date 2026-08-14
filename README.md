
<div align="center">
  <img src="assets/banner.png" alt="QuantIQ — AI Stock Intelligence" width="750" />
  <br /><br />
  <p>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.12-blue?style=flat-square" alt="Python" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.110+-green?style=flat-square" alt="FastAPI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square" alt="TypeScript" /></a>
    <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini-2.5 Flash-orange?style=flat-square" alt="Gemini" /></a>
    <a href="https://huggingface.co/"><img src="https://img.shields.io/badge/Hugging Face-Spaces-yellow?style=flat-square" alt="Hugging Face" /></a>
    <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Frontend-black?style=flat-square" alt="Vercel" /></a>
    <a href="https://neon.tech/"><img src="https://img.shields.io/badge/NeonDB-Serverless-00e599?style=flat-square" alt="NeonDB" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT License" /></a>
  </p>
</div>

---

## What is QuantIQ?

QuantIQ is an AI-powered decision intelligence platform for retail investors. Instead of forcing users to switch between charts, news sites, screeners, and general-purpose LLMs, QuantIQ brings live market data, historical trends, technical indicators, machine learning predictions, and AI-assisted reasoning into a single experience. The goal is not to predict the market with certainty, but to reduce research time and provide transparent, data-backed insights that help users make more informed trading and investment decisions.

The platform operates on two distinct but coordinated intelligence layers:

- **The AI Analyst** runs a locally-hosted ONNX model to compute a bullish probability score and then passes that score — along with live indicators and watchlist data — to a multi-step Gemini ReAct agent that produces a fully grounded, structured market report.
- **The AI Advisor** is an interactive chat interface anchored to the same ONNX model score. It allows users to ask follow-up questions, customize their entry and exit levels, and receive context-aware guidance without losing the thread of the conversation.

Both components share the same underlying machine learning pipeline. When a new model version is trained, both tools update together automatically.

> **Infrastructure note:** The entire platform runs on free-tier services. The only variable cost is the Gemini API, which amounts to a few rupees per analysis call.

---

## Application Showcase

### 1. Landing & Navigation
The public entry point features a sleek, dark-themed responsive landing page outlining the platform's capabilities.
<div align="center">
  <img src="assets/Heropage.png" alt="QuantIQ Landing Page" width="700" />
</div>

### 2. User Authentication
Stateless session management via JWT tokens, supporting traditional email signups and Google OAuth credential linking.
<div align="center">
  <img src="assets/Signuppage.png" alt="QuantIQ Sign Up" width="340" />
  &nbsp;&nbsp;
  <img src="assets/Loginpage.png" alt="QuantIQ Login" width="340" />
</div>

### 3. The Interactive Trading Terminal
A real-time trading board with fluid, GPU-accelerated TradingView candlestick charts, interactive indicators (SMA, EMA, RSI), and a sidebar tape for watchlists and alert status.
<div align="center">
  <img src="assets/Terminalpage.png" alt="Trading Terminal" width="700" />
</div>

### 4. Coordinated AI Analyst Reports
Generate detailed, tool-grounded financial analysis reports dynamically utilizing the ReAct agent architecture.
<div align="center">
  <img src="assets/Quantaianalystpage.png" alt="AI Analyst Report" width="700" />
</div>

### 5. Strategy Advisor & Contextual Chat
Interact with your quantitative strategy co-pilot. Customize entry/exit targets on the chart, ask technical questions, and get real-time memory-anchored answers.
<div align="center">
  <img src="assets/Quantaichatpage.png" alt="AI Strategy Advisor Chat" width="700" />
</div>

### 6. Live Observability Dashboard
Comprehensive system monitoring. Live Grafana dashboard scraping FastAPI, Celery latency, Redpanda delay, and memory footprint in real time.
<div align="center">
  <img src="assets/Monitoringpage.png" alt="Grafana Production Monitoring" width="700" />
</div>

### 7. NeonDB Serverless Schema
Interactive entity mapping and tables tracking watchlist coordinates, strategy backtesting predictions, and user checkouts.
<div align="center">
  <img src="assets/QuantIQ_Neondb_tables.png" alt="NeonDB Database Schema Tables" width="700" />
</div>

---

## Core Features

- **Live Market Data Pipeline** — Ingests real-time stock price ticks from Yahoo Finance every 5 seconds via a Kafka-compatible Redpanda message broker.
- **On-Device ONNX ML Inference** — A RandomForest model trained on two years of OHLCV data is exported to ONNX and runs locally inside the FastAPI process. Inference latency is under 5ms with zero cloud cost.
- **ReAct AI Analyst Agent** — A multi-step reasoning agent powered by Google Gemini 2.5 Flash that calls typed Python tool functions to fetch watchlist data, compute technical indicators, and run the ONNX model before synthesizing a structured analysis report.
- **Context-Aware AI Advisor Chat** — A conversational interface that loads live chart context, active indicators, and user-drawn price markers into its system prompt on each turn. It references prior conversation turns to avoid contradicting its own previous recommendations.
- **MLOps Feedback Loop** — Every prediction made by the Analyst is logged to PostgreSQL. A Celery background task runs every two minutes, fetches current prices via Yahoo Finance, and automatically labels each prediction as a success or failure with a calculated PnL percentage.
- **User vs. AI Strategy Tracker** — When a user locks in custom entry, target, and stop-loss levels via the Advisor, those levels are stored alongside the AI's recommended levels. The Celery worker evaluates both configurations independently, enabling a direct performance comparison over time.
- **User Intent Analytics** — Analysis queries are logged per user. Two GraphQL queries — `recentlyAnalyzed` and `trendingTickers` — surface a personalized recently viewed list and a platform-wide trending stocks widget derived entirely from real user behavior.
- **Live Model Diagnostics** — A REST endpoint at `/api/v1/auth/model-metrics` exposes real-time win rates, average PnL, per-model-version breakdowns, and User vs. AI strategy performance comparisons.
- **Price Alerts and Watchlists** — Users can set price alert thresholds evaluated on every incoming tick. Notifications are dispatched via Gmail SMTP when a threshold is crossed.
- **Production Observability** — Custom Prometheus collectors expose token usage, agent latency, WebSocket connection counts, pipeline delay, and payment events, scraped every minute by Grafana Cloud.
- **Subscription and Payments** — A tiered credit system enforced server-side and backed by Razorpay with HMAC webhook verification.

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
                         |   - Price alert evaluation        |
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
                         |   - Advisor Chat endpoint        |
                         |   - Razorpay webhook handler     |
                         |   - /metrics (Prometheus)        |
                         +----------------------------------+
                         |  Celery + Redis                  |
                         |   - Prediction outcome labeling  |
                         |   - Strategy outcome comparison  |
                         +----------------------------------+
                                       |
                  +--------------------+-------------------+
                  |                                        |
         NeonDB (PostgreSQL)                    Grafana Cloud
         - users, watchlists                   scrapes /metrics
         - stock_history, alerts               via Prometheus
         - prediction_logs
         - strategy_logs
                  |
         Vercel (Frontend)
         - React 19 + Vite + TypeScript
         - GraphQL WebSocket subscription
         - Lightweight Charts candlestick
         - Real-time ticker tape
         - AI Analyst + Advisor Chat
```

**Data Flow:**

1. `worker.py` polls Yahoo Finance every 5 seconds. The ticker list is fetched dynamically from NeonDB each cycle.
2. Each tick is published as a JSON message to Redpanda Cloud via `AIOKafkaProducer`.
3. The worker accumulates ticks in-memory and flushes 1-minute OHLCV candles to NeonDB.
4. The FastAPI backend subscribes to the topic via `AIOKafkaConsumer`. Each connected browser gets its own consumer group.
5. When the AI Analyst is triggered, the Gemini ReAct agent runs a multi-step tool loop, calls the ONNX inference helper, and logs the prediction to `prediction_logs`.
6. When the Advisor Chat is used, it calls the same ONNX helper and loads live chart context, user markers, and conversation history into the system prompt. Locked-in strategies are persisted to `strategy_logs`.
7. The Celery beat worker fires every 2 minutes, fetches current prices, and updates outcomes for both `prediction_logs` and `strategy_logs`.
8. All metrics are exposed at `/metrics` and scraped every minute by Grafana Cloud.

---

## Technology Stack

| Layer | Technology | Why |
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
| Task Queue | Celery + Redis | Periodic MLOps labeling background tasks |
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
| Backend Hosting | Hugging Face Spaces | Free persistent Docker runtime |
| Frontend Hosting | Vercel | Free zero-config React/Vite deployment |

---

## Why Redpanda Instead of a Simple Timer

The initial implementation used `asyncio.sleep` loops and Redis Pub/Sub. The migration to Redpanda was driven by three specific requirements:

1. **Message retention** — Redis Pub/Sub is fire-and-forget. Redpanda retains messages on disk; consumers can replay from any offset after a restart.
2. **Consumer isolation** — Each browser client gets its own consumer group with an independent offset, so two users watching different tickers never interfere with each other's stream.
3. **Real scalability path** — Swapping Redpanda Cloud free tier for a paid Kafka cluster requires changing only the connection string.

---

## Why ONNX for ML Inference

Rather than calling a hosted inference API on every request, the model is trained once locally with `train.py`, exported to ONNX, and loaded into the FastAPI process on startup.

- **Inference latency:** under 5ms on CPU versus 200-800ms for a remote API call.
- **Cost:** zero per-request cost regardless of volume.
- **Reliability:** works even if external services are unavailable.

**Model details:**
- Algorithm: RandomForestClassifier (50 estimators, max depth 6)
- Features: RSI-14, MACD (12/26/9), MACD signal line, EMA-20 ratio
- Target: Binary — 1 if next-day close > current close, 0 otherwise
- Training data: 2 years of daily OHLCV for AAPL, TSLA, TCS.NS, RELIANCE.NS
- Export: ONNX opset 15, FloatTensorType, dynamic batch size

---

## The AI Analyst — ReAct Agent

The agent runs a multi-step loop until it has sufficient context, then produces a structured JSON response: `{"bullish_probability": int, "reason": "..."}`.

**Agent Tools:**

| Tool | What it does |
|---|---|
| `get_user_watchlist` | Fetches the user's tracked tickers from NeonDB |
| `get_stock_history_and_indicators` | Pulls OHLCV history and computes RSI, MACD, EMA via pandas-ta |
| `get_ml_prediction` | Runs ONNX inference and returns the bullish probability score |
| `get_user_alerts` | Retrieves the user's active price alert thresholds |
| `create_price_alert` | Creates a new price alert for a given ticker |

---

## The AI Advisor — Contextual Chat

On every message, the system prompt is dynamically constructed with the live ticker price, active indicators, user-drawn price markers, the real-time ONNX probability score, and the last 30 turns of conversation history. This allows the Advisor to cross-reference its own prior recommendations when evaluating the user's current chart markers, rather than treating each message as an independent request.

---

## MLOps Feedback Loop

Every Analyst prediction is logged to `prediction_logs`. A Celery periodic task runs every two minutes, fetches the current price, calculates outcome and PnL, and marks the record as completed.

The strategy tracker extends this to user-defined levels. When a user locks in a strategy through the Advisor, both the AI recommended levels and the user's custom levels are stored in `strategy_logs`. The worker evaluates both configurations independently on each cycle, enabling a direct AI vs. user performance comparison over time.

---

## Observability

All metrics are exposed at `/metrics` and scraped by Grafana Cloud every minute.

**HTTP Layer** (auto via `prometheus-fastapi-instrumentator`):
- Request rate by endpoint and status code
- p50 / p95 / p99 response latency histograms

**AI Strategy Engine** (custom collectors):
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
- `quantiq_db_pool_connections_active` — SQLAlchemy connection pool utilisation

---

## Subscription Model

| Plan | Price | AI Credits | Refresh |
|---|---|---|---|
| Free | Rs.0 | 3 (lifetime) | No |
| Analyst | Rs.500 | 10 (one-time) | No |
| Trader | Rs.1,500 | 50 (one-time) | No |
| Pro | Rs.10,000 | 100/month | Monthly |

Payments go through Razorpay with HMAC webhook verification before any tier or credit update happens server-side. New users see a 3-day discount offer evaluated from the account creation timestamp.

---

## Project Structure

```
QuantIQ/
|
|-- backend/                        # FastAPI backend service
|   +-- app/
|       |-- main.py                 # App entrypoint, ONNX loader, Prometheus init
|       |-- api/
|       |   +-- endpoints.py        # REST routes: auth, watchlist, alerts, payments, metrics
|       |-- config/
|       |   |-- settings.py         # Pydantic Settings: all env vars
|       |   +-- metrics.py          # Custom Prometheus collector definitions
|       |-- database/
|       |   |-- session.py          # SQLAlchemy async engine + session factory
|       |   |-- models.py           # ORM models: User, Watchlist, StockHistory,
|       |   |                       #   Alert, PredictionLog, StrategyLog
|       |   +-- crud.py             # Database query functions
|       |-- graphql/
|       |   +-- schema.py           # Strawberry GraphQL: queries, mutations, subscriptions
|       |-- schemas/
|       |   +-- schemas.py          # Pydantic request/response models
|       +-- services/
|           |-- gemini.py           # Gemini ReAct agent, ONNX inference helper
|           +-- celery_app.py       # Celery worker: prediction + strategy outcome labeling
|
|-- worker/
|   +-- worker.py                   # yfinance polling, AIOKafkaProducer, OHLCV aggregation
|
|-- frontend/                       # React 19 + Vite + TypeScript
|   +-- src/
|       |-- pages/                  # LandingPage, Dashboard, UpgradePage
|       |-- components/             # StockChart, AIAnalyst, AdvisorChat,
|       |                           #   WatchlistSidebar, PriceAlerts
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

# 8. Start the Celery worker (for MLOps background tasks)
uv run celery -A backend.app.services.celery_app worker --beat --loglevel=info

# 9. Start the frontend
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
| Backend + Worker | Hugging Face Spaces (Docker) | Free |
| Frontend | Vercel | Free |
| Database | NeonDB | Free tier |
| Message Broker | Redpanda Cloud | Free tier |
| Monitoring | Grafana Cloud | Free tier |
| AI Analysis | Google Gemini API | Pay-per-use (very small) |

To deploy backend updates to Hugging Face Spaces, **do not push manually**. Run the automated deployment script from the project root:
```powershell
.\deploy_hf.ps1
```
This script prepends required YAML frontmatter config, commits and pushes to the HF remote space, and automatically restores the clean `README.md` file for GitHub. After running the script, push your clean branch updates to GitHub: `git push origin main`.

## CI/CD Pipeline

The project uses GitHub Actions for automated code quality and build verification on every push and pull request to the `main` branch:
- **Frontend CI**: Automatically installs dependencies, checks TypeScript compiler types, and verifies production bundles run correctly (`npm run build`).
- **Backend CI**: Dynamically configures a Python environment using the fast `uv` package manager, validates code quality/formatting using the `ruff` linter, and checks that entry points compile cleanly.

## Contributing

Interested in adding features or helping us scale? Check out our [Contribution Guidelines](CONTRIBUTING.md) for local setup instructions and a list of active **Open Issues** (like Discord webhooks and ONNX model metadata APIs).

---

## License

MIT — do whatever you want with it. See [LICENSE](LICENSE).
