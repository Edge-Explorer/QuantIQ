from prometheus_client import Counter, Histogram, Gauge
from backend.app.database.session import engine

# 1. AI & LLM Strategy Engine Metrics
llm_tokens_total = Counter(
    "quantiq_llm_tokens_total",
    "Total tokens consumed by the Gemini model",
    ["direction", "user_tier"]
)

agent_steps_total = Counter(
    "quantiq_agent_steps_total",
    "Number of reasoning steps taken by the ReAct agent",
    ["status"]
)

agent_latency_seconds = Histogram(
    "quantiq_agent_latency_seconds",
    "Time taken by the ReAct agent to generate strategic reports",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 15.0, 20.0, 30.0, 60.0]
)

agent_tool_calls_total = Counter(
    "quantiq_agent_tool_calls_total",
    "Number of tool calls executed by the ReAct agent",
    ["tool_name", "status"]
)

# 2. Market Data Pipeline Metrics
websocket_connections_active = Gauge(
    "quantiq_websocket_connections_active",
    "Active client WebSocket sessions streaming stock tick data"
)

ingestion_delay_seconds = Histogram(
    "quantiq_ingestion_delay_seconds",
    "Time delay between real-time data ingestion and client broadcast",
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
)

external_api_calls_total = Counter(
    "quantiq_external_api_calls_total",
    "Number of external third-party API calls made for market data",
    ["provider", "status"]
)

# 3. Application Core Metrics
payment_callbacks_total = Counter(
    "quantiq_payment_callbacks_total",
    "Number of Razorpay payment callback webhooks processed",
    ["package", "status"]
)

db_pool_connections_active = Gauge(
    "quantiq_db_pool_connections_active",
    "Number of active connections currently checked out in the database pool"
)
db_pool_connections_active.set_function(lambda: engine.pool.checkedout())
