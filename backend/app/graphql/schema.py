import uuid
import datetime
import json
import asyncio
import os
from typing import List, Optional, AsyncGenerator

import strawberry      # type: ignore
from strawberry.types import Info      # type: ignore
from aiokafka import AIOKafkaConsumer  # type: ignore

from backend.app.database import crud, models
from backend.app.schemas import schemas
from backend.app.config.settings import settings
from backend.app.services import gemini
from backend.app.config.metrics import websocket_connections_active, external_api_calls_total, ingestion_delay_seconds
KAFKA_BOOTSTRAP_SERVERS = settings.KAFKA_BOOTSTRAP_SERVERS
KAFKA_TOPIC = "stock-ticks"

# ==========================================
# GRAPHQL TYPE DEFINITIONS
# ==========================================

@strawberry.type
class UserType:
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    picture_url: Optional[str]
    credits: int
    last_credit_refresh: datetime.datetime
    created_at: datetime.datetime
    subscription_tier: str
    messages_remaining: int
    monthly_messages_used: int
    last_billing_date: datetime.datetime

@strawberry.type
class WatchlistType:
    id: uuid.UUID
    user_id: uuid.UUID
    ticker: str
    created_at: datetime.datetime
    price: Optional[float] = None
    change_percent: Optional[float] = None

@strawberry.type
class AlertType:
    id: uuid.UUID
    user_id: uuid.UUID
    ticker: str
    target_price: float
    condition: str
    is_active: bool
    created_at: datetime.datetime

@strawberry.type
class StockHistoryType:
    id: int
    ticker: str
    timestamp: datetime.datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

@strawberry.type
class StockTickType:
    ticker: str
    price: float
    volume: float
    timestamp: str

@strawberry.type
class PaymentOrderType:
    order_id: str
    amount: int
    currency: str

@strawberry.type
class GeminiInsightType:
    ticker: str
    bullish_probability: int
    reason: str
    credits_remaining: int

@strawberry.type
class LockInStrategyResultType:
    success: bool
    message: str

@strawberry.type
class SavedStrategyType:
    id: uuid.UUID
    ticker: str
    bullish_probability: int
    reason: str
    created_at: datetime.datetime

@strawberry.type
class TrendingTickerType:
    ticker: str
    count: int

@strawberry.type
class AuthTokenType:
    access_token: str
    token_type: str = "bearer"


# ==========================================
# HELPER FUNCTIONS (Context Auth Check)
# ==========================================

def get_authenticated_user(info: Info) -> models.User:
    """
    Retrieves the user from the GraphQL context.
    Raises an authentication error if the JWT is missing or invalid.
    """
    user = info.context.get("user")
    if not user:
        raise Exception("Authentication required. Please log in.")
    return user


# In-memory cache for watchlist ticker quotes to optimize performance and prevent rate limiting
_watchlist_quote_cache = {}

async def get_cached_ticker_quote(ticker: str) -> dict:
    global _watchlist_quote_cache
    now = datetime.datetime.now(datetime.timezone.utc)
    
    if ticker in _watchlist_quote_cache:
        cached = _watchlist_quote_cache[ticker]
        if now - cached["timestamp"] < datetime.timedelta(seconds=60):
            return cached["data"]
            
    # Fetch quote from yfinance
    price = 0.0
    change_percent = 0.0
    try:
        import yfinance as yf
        import asyncio
        loop = asyncio.get_event_loop()
        yf_ticker = yf.Ticker(ticker)
        df = await loop.run_in_executor(
            None,
            lambda: yf_ticker.history(period="2d")
        )
        external_api_calls_total.labels(provider="yfinance", status="success").inc()
        if not df.empty and "Close" in df.columns:
            close_series = df["Close"].dropna()
            open_series = df["Open"].dropna()
            
            if len(close_series) >= 2:
                curr = float(close_series.iloc[-1])
                prev = float(close_series.iloc[-2])
                price = curr
                change_percent = ((curr - prev) / prev) * 100
            elif len(close_series) == 1:
                curr = float(close_series.iloc[-1])
                op = float(open_series.iloc[-1]) if not open_series.empty else curr
                price = curr
                change_percent = ((curr - op) / op) * 100 if op != 0 else 0.0
    except Exception as e:
        external_api_calls_total.labels(provider="yfinance", status="failed").inc()
        print(f"Error fetching quote for watchlist ticker {ticker}: {e}")
        
    data = {"price": round(price, 2), "change_percent": round(change_percent, 2)}
    _watchlist_quote_cache[ticker] = {
        "data": data,
        "timestamp": now
    }
    return data


# ==========================================
# GRAPHQL QUERIES (Read Operations)
# ==========================================

@strawberry.type
class Query:
    @strawberry.field
    async def me(self, info: Info) -> UserType:
        """Fetch the authenticated user's profile and refresh credits if applicable."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        # Check and apply credit refresh cycle
        updated_user = await crud.refresh_user_credits(db, user)
        return updated_user

    @strawberry.field
    async def watchlist(self, info: Info) -> List[WatchlistType]:
        """Fetch the authenticated user's watchlist, enriched with live prices and 24h changes."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        items = await crud.get_user_watchlist(db, user.id)
        
        if not items:
            return []
            
        # Fetch live quotes for all watchlist items in parallel
        tasks = [get_cached_ticker_quote(item.ticker) for item in items]
        quotes = await asyncio.gather(*tasks)
        
        watchlist_items = []
        for item, quote in zip(items, quotes):
            watchlist_items.append(
                WatchlistType(
                    id=item.id,
                    user_id=item.user_id,
                    ticker=item.ticker,
                    created_at=item.created_at,
                    price=quote["price"],
                    change_percent=quote["change_percent"]
                )
            )
        return watchlist_items

    @strawberry.field
    async def alerts(self, info: Info) -> List[AlertType]:
        """Fetch the authenticated user's active/inactive price alerts."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.get_user_alerts(db, user.id)

    @strawberry.field
    async def saved_strategies(self, info: Info) -> List[SavedStrategyType]:
        """Fetch the authenticated user's saved strategy reports history."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        strategies = await crud.get_user_saved_strategies(db, user.id)
        return [
            SavedStrategyType(
                id=s.id,
                ticker=s.ticker,
                bullish_probability=s.bullish_probability,
                reason=s.reason,
                created_at=s.created_at
            ) for s in strategies
        ]

    @strawberry.field
    async def stock_history(self, info: Info, ticker: str, range: str = "1d") -> List[StockHistoryType]:
        """Fetch historical aggregated candles for a ticker based on range (1d, 5d, 1m, 6m, ytd, 1y, 5y, max)."""
        db = info.context["db"]
        
        range_mapping = {
            "1d":   {"period": "1d",   "interval": "2m"},
            "5d":   {"period": "5d",   "interval": "15m"},
            "1m":   {"period": "1mo",  "interval": "1d"},
            "6m":   {"period": "6mo",  "interval": "1d"},
            "ytd":  {"period": "ytd",  "interval": "1d"},
            "1y":   {"period": "1y",   "interval": "1d"},
            "5y":   {"period": "5y",   "interval": "1wk"},
            "max":  {"period": "max",  "interval": "1mo"}
        }
        
        selected_range = range.lower()
        if selected_range not in range_mapping:
            selected_range = "1d"
            
        config = range_mapping[selected_range]
        
        # If it's 1d, let's try local DB first
        if selected_range == "1d":
            try:
                local_data = await crud.get_stock_history(db, ticker, limit=100)
                if len(local_data) > 10:
                    return [
                        StockHistoryType(
                            id=h.id,
                            ticker=h.ticker,
                            timestamp=h.timestamp,
                            open=h.open,
                            high=h.high,
                            low=h.low,
                            close=h.close,
                            volume=h.volume
                        ) for h in local_data
                    ]
            except Exception as db_err:
                print(f"Error querying local DB for ticker history: {db_err}")

        # Otherwise, dynamically fetch from Yahoo Finance in a thread pool
        try:
            import yfinance as yf
            loop = asyncio.get_event_loop()
            yf_ticker = yf.Ticker(ticker)
            
            df = await loop.run_in_executor(
                None, 
                lambda: yf_ticker.history(period=config["period"], interval=config["interval"])
            )
            external_api_calls_total.labels(provider="yfinance", status="success").inc()
            
            history_list = []
            if not df.empty:
                df = df.reset_index()
                
                time_col = None
                for col in ['Date', 'Datetime', 'index', 'timestamp']:
                    if col in df.columns:
                        time_col = col
                        break
                
                if time_col:
                    # Limit to last 350 points to ensure smooth chart performance
                    df = df.tail(350)
                    for i, row in df.iterrows():
                        ts = row[time_col]
                        if hasattr(ts, 'to_pydatetime'):
                            ts_dt = ts.to_pydatetime()
                        elif isinstance(ts, str):
                            ts_dt = datetime.datetime.fromisoformat(ts)
                        else:
                            ts_dt = ts
                            
                        if ts_dt.tzinfo is not None:
                            ts_dt = ts_dt.replace(tzinfo=None)
                            
                        history_list.append(
                            StockHistoryType(
                                id=i,
                                ticker=ticker.upper(),
                                timestamp=ts_dt,
                                open=float(row["Open"]),
                                high=float(row["High"]),
                                low=float(row["Low"]),
                                close=float(row["Close"]),
                                volume=int(row["Volume"]) if "Volume" in row else 0
                            )
                        )
            return history_list
        except Exception as e:
            external_api_calls_total.labels(provider="yfinance", status="failed").inc()
            print(f"Error fetching yfinance history for {ticker}: {str(e)}")
            # Failover fallback
            local_data = await crud.get_stock_history(db, ticker, limit=100)
            return [
                StockHistoryType(
                    id=h.id,
                    ticker=h.ticker,
                    timestamp=h.timestamp,
                    open=h.open,
                    high=h.high,
                    low=h.low,
                    close=h.close,
                    volume=h.volume
                ) for h in local_data
            ]

    @strawberry.field
    async def recently_analyzed(self, info: Info, limit: Optional[int] = 5) -> List[str]:
        """Fetch the unique tickers the authenticated user has recently analyzed."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.get_recently_analyzed_tickers(db, user_id=user.id, limit=limit or 5)

    @strawberry.field
    async def trending_tickers(self, info: Info, limit: Optional[int] = 5) -> List[TrendingTickerType]:
        """Fetch the globally trending tickers based on analysis query count in the last 7 days."""
        db = info.context["db"]
        results = await crud.get_trending_tickers(db, limit=limit or 5)
        return [TrendingTickerType(ticker=r["ticker"], count=r["count"]) for r in results]



# ==========================================
# GRAPHQL MUTATIONS (Write Operations)
# ==========================================

@strawberry.type
class Mutation:
    @strawberry.mutation
    async def login_google(self, info: Info, token_id: str) -> AuthTokenType:
        """
        Authenticates a user with a Google OAuth token and returns a JWT access token.
        Placeholder logic to be connected to gemini_service/auth verification.
        """
        db = info.context["db"]
        
        # NOTE: Temporary mock verification. We will hook this to the google-auth verification in Phase 4.
        # It creates a default user for testing local dashboard before live client OAuth is set up.
        mock_email = "tester@quantiq.io"
        user = await crud.get_user_by_email(db, mock_email)
        
        if not user:
            user_in = schemas.UserBase(
                email=mock_email,
                full_name="QuantIQ Tester",
                picture_url="https://via.placeholder.com/150"
            )
            user = await crud.create_user(db, user_in, google_id="mock_google_id_123")
            
        # Create token (we will write the JWT creator in endpoints/auth utilities)
        # For now, returning a mock token payload
        access_token = f"mock_jwt_token_for_user_{user.id}"
        return AuthTokenType(access_token=access_token)

    @strawberry.mutation
    async def add_watchlist(self, info: Info, ticker: str) -> WatchlistType:
        """Add a stock ticker to the user's watchlist."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.add_to_watchlist(db, user.id, ticker)

    @strawberry.mutation
    async def remove_watchlist(self, info: Info, ticker: str) -> bool:
        """Remove a stock ticker from the user's watchlist."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.remove_from_watchlist(db, user.id, ticker)

    @strawberry.mutation
    async def create_alert(self, info: Info, ticker: str, target_price: float, condition: str) -> AlertType:
        """Create a new price alert."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        alert_in = schemas.AlertCreate(ticker=ticker, target_price=target_price, condition=condition)
        return await crud.create_alert(db, user.id, alert_in)

    @strawberry.mutation
    async def deactivate_alert(self, info: Info, alert_id: uuid.UUID) -> bool:
        """Deactivate/delete a price alert."""
        get_authenticated_user(info)  # Verify auth
        db = info.context["db"]
        return await crud.deactivate_alert(db, alert_id)

    @strawberry.mutation
    async def create_payment_order(self, info: Info, amount: int) -> PaymentOrderType:
        """
        Creates a Razorpay order via the Razorpay API (or falls back to mock order if keys are missing)
        and logs the transaction in the database as pending.
        """
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        order_id= None
        
        # Check if Razorpay keys are configured
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                import razorpay
                client= razorpay.Client(auth= (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                
                order_payload= {
                    "amount": amount * 100, 
                    "currency": "INR",
                    "receipt": f"rcpt_{user.id.hex[:10]}_{uuid.uuid4().hex[:6]}"
                }
                
                loop= asyncio.get_event_loop()
                order= await loop.run_in_executor(
                    None,
                    lambda: client.order.create(data= order_payload)
                )
                order_id= order["id"]
            except Exception as e:
                print(f"Error creating Razorpay order via API, falling back to mock: {str(e)}")
        
        # Fall back to mock order generation if API call failed or keys are missing
        if not order_id:
            order_id= f"order_rp_{uuid.uuid4().hex[:12]}"
            
        # Determine credits dynamically based on chosen package amount
        if amount == 500:
            credits_credited = 10
        elif amount == 1500:
            credits_credited = 50
        elif amount in (10000, 15000):
            credits_credited = 100
        else:
            credits_credited = amount // 50
        
        
        # Log the pending transaction in Postgres
        await crud.create_payment_transaction(
            db= db,
            user_id= user.id,
            order_id= order_id,
            amount= amount * 100,
            credits_credited= credits_credited
        )
        return PaymentOrderType(order_id= order_id, amount= amount * 100, currency= "INR")
    
    @strawberry.mutation
    async def get_ai_insight(
        self, 
        info: Info, 
        ticker: str, 
        trading_style: Optional[str] = None, 
        risk_tolerance: Optional[str] = None
    ) -> GeminiInsightType:
        """
        Deducts 1 credit, executes the local ONNX ML prediction, and calls
        the Gemini ReAct agent loop to return market insights.
        """
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        # 1. Deduct credit
        success = await crud.deduct_user_credit(db, user.id)
        if not success:
            raise Exception("Insufficient credits. Please recharge via Razorpay.")
            
        # 2. Call the Gemini ReAct agent loop
        style_label = (trading_style or "swing_trading").replace("_", " ")
        risk_label = risk_tolerance or "moderate"
        prompt = (
            f"Analyze stock ticker {ticker.upper()}. "
            f"The user's trading style is {style_label} and their risk profile is {risk_label}. "
            "Tailor your analysis, support/resistance levels, entry/exit targets, and strategy report to match this style and risk profile. "
            "Retrieve its latest technical indicators and quantitative ML prediction using your tools. "
            "Check if the user has any active price alerts or watchlists set up for it. "
            "Perform a holistic qualitative and quantitative analysis of this stock."
        )
        insight_data = await gemini.run_agent_chat(db, user.id, prompt)
        
        # 3. Auto-save the generated strategy in the database
        try:
            await crud.create_saved_strategy(
                db=db,
                user_id=user.id,
                ticker=ticker.upper(),
                bullish_probability=insight_data["bullish_probability"],
                reason=insight_data["reason"]
            )
        except Exception as save_err:
            print(f"Error auto-saving strategy to database: {save_err}")
            
        # Refresh the user object to get the updated credit balance
        await db.refresh(user)
        
        return GeminiInsightType(
            ticker=ticker.upper(),
            bullish_probability=insight_data["bullish_probability"],
            reason=insight_data["reason"],
            credits_remaining=user.credits
        )

    @strawberry.mutation
    async def lock_in_strategy(
        self,
        info: Info,
        ticker: str,
        entry: float,
        target: float,
        stop_loss: float
    ) -> LockInStrategyResultType:
        """
        Logs the AI's suggested target levels and the user's custom levels
        for a ticker, tracking their outcome side-by-side.
        """
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        # 1. Fetch latest price history to get close price and run ONNX model
        from backend.app.services.gemini import get_onnx_prediction, onnx_session
        
        try:
            # Run the real ONNX prediction helper
            probability_score = await get_onnx_prediction(db, ticker)
            
            # Fetch latest candle to determine entry price
            history = await crud.get_stock_history(db, ticker.upper(), limit=1)
            if not history:
                return LockInStrategyResultType(success=False, message=f"No stock history available for {ticker}.")
            
            close_price = float(history[0].close)
            
            # Compute AI recommended levels (using same logic: +2% target, -1% stop loss for BUY)
            predicted_action = "BUY" if probability_score >= 55 else "SELL" if probability_score <= 45 else "HOLD"
            
            if predicted_action == "BUY":
                ai_entry = close_price
                ai_target = close_price * 1.02
                ai_stop_loss = close_price * 0.99
            elif predicted_action == "SELL":
                ai_entry = close_price
                ai_target = close_price * 0.98
                ai_stop_loss = close_price * 1.01
            else:
                ai_entry = close_price
                ai_target = close_price
                ai_stop_loss = close_price
                
            # Log to DB
            is_mock = (onnx_session is None)
            model_ver = "mock_v1.0" if is_mock else "v1.0"
            
            await crud.create_strategy_log(
                db=db,
                user_id=user.id,
                ticker=ticker.upper(),
                model_version=model_ver,
                bullish_probability=probability_score,
                ai_entry=ai_entry,
                ai_target=ai_target,
                ai_stop_loss=ai_stop_loss,
                user_entry=entry,
                user_target=target,
                user_stop_loss=stop_loss
            )
            
            return LockInStrategyResultType(
                success=True,
                message=f"Successfully locked in strategy for {ticker.upper()}!"
            )
        except Exception as err:
            return LockInStrategyResultType(
                success=False,
                message=f"Failed to lock in strategy: {str(err)}"
            )


# ==========================================
# GRAPHQL SUBSCRIPTIONS (WebSocket Streams)
# ==========================================

@strawberry.type
class Subscription:
    @strawberry.subscription
    async def stream_stock_ticks(self, info: Info, ticker: str) -> AsyncGenerator[StockTickType, None]:
        """
        Subscribes to the Redpanda broker and streams live price ticks
        for a specific stock ticker directly over WebSockets.
        """
        # 1. Initialize Kafka Consumer pointing to Redpanda
        consumer = AIOKafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            group_id=f"quantiq-gql-{uuid.uuid4()}"  # Unique consumer group per WebSocket client
        )
        
        await consumer.start()
        print(f"GraphQL WebSocket Subscription: Client connected to stream {ticker} ticks.")
        websocket_connections_active.inc()
        
        try:
            # 2. Stream ticks continuously from Redpanda topic
            async for message in consumer:
                tick_data = message.value
                
                # Filter ticks only matching the requested ticker symbol
                if tick_data["ticker"].upper() == ticker.upper():
                    try:
                        tick_timestamp = datetime.datetime.fromisoformat(tick_data["timestamp"])
                        now = datetime.datetime.now(datetime.timezone.utc)
                        delay = (now - tick_timestamp).total_seconds()
                        ingestion_delay_seconds.observe(delay)
                    except Exception as delay_err:
                        print(f"Failed to record ingestion delay: {delay_err}")
                        
                    yield StockTickType(
                        ticker=tick_data["ticker"],
                        price=tick_data["price"],
                        volume=tick_data["volume"],
                        timestamp=tick_data["timestamp"]
                    )
        except asyncio.CancelledError:
            print(f"GraphQL WebSocket Subscription: Client disconnected from {ticker} stream.")
        finally:
            # 3. Clean up broker consumer session
            websocket_connections_active.dec()
            await consumer.stop()

# Build schema
schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)