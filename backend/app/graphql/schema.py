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
    volume: int

@strawberry.type
class StockTickType:
    ticker: str
    price: float
    volume: int
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
        print(f"Error fetching quote for watchlist ticker {ticker}: {e}")
        
    data = {"price": round(price, 2), "change_percent": round(change_percent, 2)}
    _watchlist_quote_cache[ticker] = {
        "data": data,
        "timestamp": now
    }
    return data

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
            
        # Determine credits based on ₹10 = 1 credit (₹100 = 10 credits package)
        credits_credited= (amount // 10)
        
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
    async def get_ai_insight(self, info: Info, ticker: str) -> GeminiInsightType:
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
        prompt = (
            f"Analyze stock ticker {ticker.upper()}. "
            "Retrieve its latest technical indicators and quantitative ML prediction using your tools. "
            "Check if the user has any active price alerts or watchlists set up for it. "
            "Perform a holistic qualitative and quantitative analysis of this stock."
        )
        insight_data = await gemini.run_agent_chat(db, user.id, prompt)
        
        # Refresh the user object to get the updated credit balance
        await db.refresh(user)
        
        return GeminiInsightType(
            ticker=ticker.upper(),
            bullish_probability=insight_data["bullish_probability"],
            reason=insight_data["reason"],
            credits_remaining=user.credits
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
        
        try:
            # 2. Stream ticks continuously from Redpanda topic
            async for message in consumer:
                tick_data = message.value
                
                # Filter ticks only matching the requested ticker symbol
                if tick_data["ticker"].upper() == ticker.upper():
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
            await consumer.stop()

# Build schema
schema = strawberry.Schema(query=Query, mutation=Mutation, subscription=Subscription)