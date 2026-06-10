# QuantIQ

A real-time stock market intelligence dashboard built entirely on free-tier cloud infrastructure. QuantIQ ingests live stock data, streams it over WebSockets, applies technical analysis indicators, and generates AI-powered market summaries using the Gemini 2.5 Flash API.

---

## Overview

QuantIQ is designed as a production-grade, multi-service application. It demonstrates a complete data pipeline from raw market data ingestion to live dashboard delivery, with an AI layer for structured market analysis. The entire stack is hosted across free-tier services with no cost involved.

The application is split into three independent, deployable services:

- **Backend**: A FastAPI application that exposes REST endpoints, manages WebSocket connections, and integrates the Gemini AI service.
- **Worker**: A standalone ingestion worker that continuously fetches stock data from Yahoo Finance and publishes it into Redis Pub/Sub.
- **Frontend**: A React dashboard that consumes the WebSocket stream and renders real-time candlestick charts, indicators, and AI summaries.

---

## Architecture

```
                  [ Hugging Face Spaces (Docker) ]
                  +-------------------------------+
                  |  Worker  (yfinance polling)   |
                  |  Backend (FastAPI + WS)       |
                  +---------------+---------------+
                                  |
              +-------------------+--------------------+
              |                                        |
  +-----------+-----------+              +-------------+-------+
  |    Upstash Redis       |              |     NeonDB           |
  |  (Pub/Sub + Alerts)   |              |  (PostgreSQL)         |
  +-----------------------+              +---------------------+
                                                    |
                                         +-----------+---------+
                                         |   Vercel (Frontend)  |
                                         |   Next.js Dashboard   |
                                         +---------------------+
```

**Data Flow:**

1. The Worker polls Yahoo Finance via `yfinance` every 5 seconds for a defined list of stock tickers.
2. Each price tick is published to an Upstash Redis Pub/Sub channel in real-time.
3. The Worker also aggregates ticks into 1-minute OHLCV candlestick rows and batch-writes them to NeonDB via Alembic-managed schema tables.
4. The FastAPI Backend subscribes to the Redis channel and forwards live ticks to all connected WebSocket clients.
5. If a user has set a price alert, the Worker checks the threshold against the latest tick and triggers the alert via Redis Sorted Sets.
6. On demand, the Backend sends stock context data to Gemini 2.5 Flash for AI-generated summaries and structured technical predictions.
7. The Frontend connects over WebSocket and renders the live data stream in charts.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Language | Python 3.12 | Backend and Worker |
| Web Framework | FastAPI | REST API and WebSocket gateway |
| ASGI Server | Uvicorn | Async server for FastAPI |
| Database ORM | SQLAlchemy (async) | Async database access layer |
| Migrations | Alembic | Database schema versioning and migration |
| Data Validation | Pydantic v2 | Request/response schema validation |
| Settings | Pydantic Settings | Environment variable management |
| Database | NeonDB (PostgreSQL) | Persistent storage for users, watchlists, stock history |
| Cache / Pub-Sub | Upstash Redis | Real-time tick streaming and alert queues |
| Market Data | yfinance | Free Yahoo Finance API wrapper (no key required) |
| Technical Analysis | pandas-ta | RSI, MACD, and other indicator calculations |
| AI Layer | Google Gemini 2.5 Flash | Market summaries and structured predictions |
| Observability | Prometheus + Grafana | API metrics and WebSocket monitoring |
| Containerization | Docker | Packaging backend and worker for deployment |
| Backend Hosting | Hugging Face Spaces | Free persistent Docker container runtime |
| Frontend Hosting | Vercel | Free Next.js deployment |
| Package Manager | uv | Fast Python dependency resolution |

---

## Project Structure

```
QuantIQ/
|
|-- backend/                    # FastAPI backend service
|   |-- Dockerfile
|   +-- app/
|       |-- main.py             # Application entrypoint
|       |-- api/
|       |   |-- __init__.py
|       |   |-- endpoints.py    # REST routes (auth, watchlist, summaries)
|       |   +-- websockets.py   # WebSocket connection handler
|       |-- config/
|       |   |-- __init__.py
|       |   +-- settings.py     # Pydantic settings loaded from .env
|       |-- database/
|       |   |-- __init__.py
|       |   |-- session.py      # SQLAlchemy async engine and session factory
|       |   |-- models.py       # SQLAlchemy ORM models
|       |   +-- crud.py         # Database query functions
|       |-- schemas/
|       |   |-- __init__.py
|       |   +-- schemas.py      # Pydantic request/response models
|       +-- services/
|           |-- __init__.py
|           +-- gemini.py       # Gemini AI integration service
|
|-- worker/                     # Standalone ingestion worker service
|   |-- Dockerfile
|   +-- worker.py               # yfinance polling, Redis publish, DB batch writes
|
|-- pyproject.toml              # uv project configuration and dependencies
|-- docker-compose.yml          # Local development multi-service orchestration
|-- .env                        # Local environment variables (not committed to git)
|-- .gitignore
+-- README.md
```

---

## Database Design

Database schema is managed entirely through **Alembic** migrations. We do not use `Base.metadata.create_all()` in production. Every schema change is tracked as a versioned migration file.

**Core Tables:**

- `users` — Stores user accounts and authentication details.
- `watchlists` — Stores the list of stock tickers each user is tracking.
- `stock_history` — Stores 1-minute OHLCV candlestick rows aggregated by the ingestion worker.
- `alerts` — Stores user-defined price alert thresholds per ticker.

---

## Environment Variables

Create a `.env` file in the project root. This file is excluded from version control via `.gitignore`.

```env
# Google Gemini API Key (free tier at aistudio.google.com)
GEMINI_API_KEY=your_gemini_api_key_here

# Database URL
# Local development: uses a local PostgreSQL instance
# Production: replace with your NeonDB connection string
DATABASE_URL=postgresql://user:password@localhost:5432/quantiq

# Redis URL
# Local development: uses a local Redis instance
# Production: replace with your Upstash Redis URL
REDIS_URL=redis://localhost:6379/0

# Application Secret Key (used for JWT token signing)
SECRET_KEY=your_secret_key_here
```

> Note: The application automatically handles the `postgresql://` to `postgresql+asyncpg://` driver conversion for async compatibility. You do not need to modify the URL format manually.

---

## Local Development Setup

### Prerequisites

- Python 3.12+
- `uv` package manager (`pip install uv`)
- Docker Desktop (for running local Postgres and Redis)

### Steps

**1. Clone the repository:**
```bash
git clone https://github.com/Edge-Explorer/QuantIQ.git
cd QuantIQ
```

**2. Install dependencies:**
```bash
uv sync
```

**3. Start local services (Postgres and Redis):**
```bash
docker-compose up -d
```

**4. Create and configure your `.env` file** as described in the Environment Variables section above.

**5. Run database migrations:**
```bash
uv run alembic upgrade head
```

**6. Start the backend:**
```bash
uv run uvicorn backend.app.main:app --reload
```

**7. Start the ingestion worker:**
```bash
uv run python worker/worker.py
```

---

## Deployment

The backend and worker are containerized using Docker and deployed to **Hugging Face Spaces** as persistent containers, ensuring WebSocket connections remain alive indefinitely. The frontend is deployed to **Vercel**.

Deployment steps and environment configuration for production services (NeonDB, Upstash Redis) will be documented as part of Phase 5.

---

## Observability

The backend exposes a `/metrics` endpoint instrumented via `prometheus-fastapi-instrumentator`. During development, Prometheus and Grafana run locally. In production, Grafana Cloud free tier is used to monitor:

- Active WebSocket connection count
- API request latency (p50, p95, p99)
- Worker tick ingestion rate
- Redis Pub/Sub message throughput

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.