# Contributing to QuantIQ

Thank you for your interest in contributing to QuantIQ! We welcome developers of all skill levels to help us improve the platform. 

This document outlines our development setup and lists several active **Open Issues** that are ready for implementation.

---

## 🛠️ Local Development Setup

### 1. Ingest Ingestion & Backend Setup
Make sure you have [uv](https://astral.sh/uv) installed:
```bash
# Sync all dependencies
uv sync

# Start PostgreSQL and Redis containers
docker-compose up -d

# Run migrations
uv run alembic upgrade head

# Launch local servers
uv run uvicorn backend.app.main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🎯 Open Development Issues (Help Wanted)

Here are the active development goals. If you'd like to work on one, feel free to open a Pull Request!

### 1. [Backend] Expose ONNX Model Metadata Endpoint (`/api/v1/ml/metadata`)
*   **Goal**: Create a new API route to let the UI fetch metadata properties directly from the loaded `model.onnx`.
*   **Context**: The backend currently initializes the ONNX inference session in `backend/app/services/ml.py`. ONNX models can store custom metadata properties (such as training date, feature names, and accuracy score).
*   **Requirements**:
    *   Expose a `GET /api/v1/ml/metadata` endpoint in FastAPI.
    *   Read the metadata properties from `onnxruntime.InferenceSession.get_modelmeta().custom_metadata_map`.
    *   Return a JSON payload with key metrics (e.g. `trained_date`, `features_list`, `accuracy`).
*   **Difficulty**: Medium (Python, ONNX Runtime).

---

### 2. [Frontend] Implement RSI Overbought/Oversold indicators on TradingView Charts
*   **Goal**: Draw visual indicator bounds directly on the candle chart.
*   **Context**: The chart component is rendered using `lightweight-charts` inside the frontend. 
*   **Requirements**:
    *   When the RSI calculation is toggled, draw horizontal grid lines or background bands at value `70` (Overbought - Red) and `30` (Oversold - Green).
    *   Use the `createPriceLine` API of Lightweight Charts to draw these reference marks dynamically.
*   **Difficulty**: Medium-Easy (TypeScript, Lightweight Charts).

---

### 3. [Backend] Discord & Slack Webhook Alert Dispatcher
*   **Goal**: Expand the notification options beyond Gmail SMTP to support chat integrations.
*   **Context**: Users currently receive price alerts via email in `backend/app/services/alerts.py`.
*   **Requirements**:
    *   Create a webhook notification service inside `backend/app/services/notifications.py`.
    *   Use `httpx` to send a formatted markdown message payload containing ticker price alert info to a user's Slack or Discord webhook channel.
    *   Add an optional `webhook_url` column to the watchlists database schema.
*   **Difficulty**: Medium (Python, HTTP Requests, SQL Alchemy).

---

## 🚀 How to Submit a Pull Request
1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Verify formatting and compile safety:
   * **Backend**: Run `ruff check .`
   * **Frontend**: Run `npm run build`
4. Commit your changes and open a Pull Request against our `main` branch.
