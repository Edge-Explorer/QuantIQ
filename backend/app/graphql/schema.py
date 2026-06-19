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

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
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

    @strawberry.field
    async def watchlist(self, info: Info) -> List[WatchlistType]:
        """Fetch the authenticated user's watchlist."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.get_user_watchlist(db, user.id)

    @strawberry.field
    async def alerts(self, info: Info) -> List[AlertType]:
        """Fetch the authenticated user's active/inactive price alerts."""
        user = get_authenticated_user(info)
        db = info.context["db"]
        return await crud.get_user_alerts(db, user.id)

    @strawberry.field
    async def stock_history(self, info: Info, ticker: str, limit: int = 100) -> List[StockHistoryType]:
        """Fetch historical 1-minute aggregated candles for a ticker."""
        # Open query: no login required to look at historical charts
        db = info.context["db"]
        return await crud.get_stock_history(db, ticker, limit)


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
        Creates a Razorpay order in test mode and logs it as a pending transaction.
        """
        user = get_authenticated_user(info)
        db = info.context["db"]
        
        # NOTE: Temporary mock order creation. When we write endpoints.py,
        # we will link this to the Razorpay Client SDK integration.
        mock_order_id = f"order_rp_{uuid.uuid4().hex[:12]}"
        
        # Determine credits based on ₹100 = 10 credits package
        credits_credited = (amount // 10)
        
        await crud.create_payment_transaction(
            db=db,
            user_id=user.id,
            order_id=mock_order_id,
            amount=amount * 100,  # in paisa
            credits_credited=credits_credited
        )
        return PaymentOrderType(order_id=mock_order_id, amount=amount * 100, currency="INR")
    
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