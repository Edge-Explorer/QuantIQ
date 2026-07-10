import uuid
import datetime
from typing import Optional, List 
from pydantic import BaseModel, Field, ConfigDict

# AUTHENTICATION & USER SCHEMAS
class GoogleAuthRequest(BaseModel):
    token_id: str= Field(description= "Google OAuth ID Token received on the frontend")
    
class Token(BaseModel):
    access_token: str
    token_type: str= "bearer"

class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    verification_required: bool = False
    email: Optional[str] = None
    
class TokenPayload(BaseModel):
    sub: Optional[str]= None

class EmailVerifyRequest(BaseModel):
    email: str = Field(description="User's email address")
    code: str = Field(description="6-digit verification OTP code")

class ResendCodeRequest(BaseModel):
    email: str = Field(description="User's email address")

class UserBase(BaseModel):
    email: str
    full_name: Optional[str]= None
    picture_url: Optional[str]= None

class UserResponse(UserBase):
    id: uuid.UUID
    google_id: str
    credits: int
    last_credit_refresh: datetime.datetime
    created_at: datetime.datetime
    subscription_tier: str
    messages_remaining: int
    monthly_messages_used: int
    last_billing_date: datetime.datetime
    
    model_config= ConfigDict(from_attributes= True)

# WATCHLIST SCHEMAS
class WatchlistBase(BaseModel):
    ticker: str= Field(..., description= "Stock symbol, e.g., AAPL or TCS.NS")

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistResponse(WatchlistBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime.datetime
    
    model_config= ConfigDict(from_attributes= True)

# ALERT SCHEMAS
class AlertBase(BaseModel):
    ticker: str= Field(..., description= "Stock symbol to monitor")
    target_price: float= Field(..., gt=0, description= "Price target that triggers the alert")
    condition: str= Field(..., description= "Trigger condition: 'above' or 'below'")

class AlertCreate(AlertBase):
    pass 

class AlertUpdate(BaseModel):
    target_price: Optional[float]= Field(None, gt=0)
    condition: Optional[str]= None
    is_active: Optional[bool]= None

class AlertResponse(AlertBase):
    id: uuid.UUID
    user_id: uuid.UUID
    is_active: bool
    created_at: datetime.datetime
    
    model_config= ConfigDict(from_attributes= True)
    
# STOCK HISTORY SCHEMAS
class StockHistoryBase(BaseModel):
    ticker: str
    timestamp: datetime.datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    
class StockHistoryResponse(StockHistoryBase):
    model_config= ConfigDict(from_attributes= True)
    
# AI INSIGHTS & CHAT SCHEMAS
class GeminiInsightResponse(BaseModel):
    ticker: str
    bullish_probability: int= Field(..., ge=0, le= 100)
    reason: str
    credits_remaining: int
    
# PAYMENT & RAZORPAY SCHEMAS
class PaymentOrderCreate(BaseModel):
    amount: int= Field(..., gt=0, description= "Amount in Rupees, e.g., 100 or 200")
    
class PaymentOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str= "INR"

class PaymentCaptureRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    
class PaymentTransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: Optional[str]= None
    amount: int
    status: str
    credits_credited: int
    created_at: datetime.datetime
    
    model_config= ConfigDict(from_attributes= True)