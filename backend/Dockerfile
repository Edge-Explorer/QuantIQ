FROM python:3.12-slim

# Install system dependencies, Redis, supervisor, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    redis-server \
    supervisor \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Redpanda
RUN curl -1sLf 'https://dl.redpanda.com/nzc4ZYQK3WRGd9sy/redpanda/cfg/setup/bash.deb.sh' | bash \
    && apt-get install -y --no-install-recommends redpanda \
    && rm -rf /var/lib/apt/lists/*

# Install uv for rapid Python packaging
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /workspace

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen

# Copy the rest of the application code
COPY backend ./backend
COPY worker ./worker
COPY model.onnx ./model.onnx

# Copy supervisord configuration
COPY backend/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports for API, Redpanda, and Redis
EXPOSE 7860 9092 6379

# Run supervisord to start all services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]