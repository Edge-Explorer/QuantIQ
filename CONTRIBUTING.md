# Contributing to QuantIQ

Thank you for your interest in contributing to QuantIQ! We welcome developers of all backgrounds to help us build a premium quantitative research terminal.

This document details the project architecture, developer setup, code guidelines, and deployment workflows.

---

## 📂 Project Structure Map

*   `backend/` — FastAPI core server. Exposes GraphQL/REST APIs and WebSocket channels.
*   `frontend/` — React / TypeScript client built with Vite and Tailwind CSS.
*   `worker/` — Tick ingestion service. Periodically polls Yahoo Finance and dispatches ticks to Redpanda Cloud.
*   `alembic/` — Database migrations for watchlists, strategy records, and user targets.
*   `assets/` — UI mockups, database schemas, and documentation images.
*   `train.py` — Offline model training script that generates indicator features and exports `model.onnx`.
*   `deploy_hf.ps1` — Automated deployment pipeline script for Hugging Face Spaces.

---

## 🛠️ Local Development Setup

### 1. Ingest Ingestion & Backend Setup
Prerequisites: Make sure you have [uv](https://astral.sh/uv) and [Docker Desktop](https://www.docker.com/) installed.

```bash
# Sync python virtual environment and lock file
uv sync

# Spin up local PostgreSQL (NeonDB replica) and Redis containers
docker-compose up -d

# Execute database migrations
uv run alembic upgrade head

# Start the local FastAPI server
uv run uvicorn backend.app.main:app --reload
```

### 2. Start Background Services
```bash
# Start the ingestion worker (fetches stock ticks every 5 seconds)
uv run python worker/worker.py

# Start Celery worker with beat enabled (logs ML predictions and outcomes)
uv run celery -A backend.app.services.celery_app worker --beat --loglevel=info
```

### 3. Frontend Dashboard Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deployment Workflow (Hugging Face Spaces & GitHub)

Hugging Face Spaces hosting requires a custom metadata block (YAML frontmatter) at the very top of `README.md`. To keep the GitHub repository clean while pushing updates to Hugging Face, **you must use the automated deployment script:**

### Hugging Face Deployment Procedure:
1. Ensure your changes are committed on your local branch.
2. In PowerShell, execute the deployment script from the project root:
   ```powershell
   .\deploy_hf.ps1
   ```
3. **What this script does automatically:**
   * Prepends the YAML frontmatter configuration block to `README.md`.
   * Commits the change (`chore: add HF Space config for deployment`).
   * Pushes the commit to the Hugging Face space repository (`git push hf main`).
   * Automatically restores the clean `README.md` file back to its default state.
   * Commits the cleanup (`chore: restore clean README for GitHub`).
4. Finally, push your clean branch changes directly to GitHub:
   ```bash
   git push origin main
   ```

---

## 🧼 Code Quality & Style Guidelines

To keep the pipeline green, verify the following standards locally before opening a pull request:

### 🐍 Python (Backend / Worker)
*   **Linter & Formatter**: We use `ruff`. Run the check locally:
    ```bash
    uv run ruff check .
    ```

### ⚛️ TypeScript & React (Frontend)
*   **Formatters**: Ensure typescript compiling (`tsc`) and Vite bundling compile cleanly:
    ```bash
    cd frontend
    npm run build
    ```

---

## 🎯 Open Development Goals

Check out our active GitHub Issues page or pick one of these tasks to start:
1. **[Backend] Model Metadata Endpoint**: Expose `GET /api/v1/ml/metadata` to parse and return properties from the loaded `model.onnx`.
2. **[Frontend] RSI Reference Boundaries**: Use the Lightweight Charts API to draw Overbought (70) and Oversold (30) reference price lines.
3. **[Backend] Discord/Slack webhook price alerts**: Build a dispatcher service sending real-time stock crossings directly to webhook endpoints.
