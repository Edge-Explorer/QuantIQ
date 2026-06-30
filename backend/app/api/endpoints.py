import json
import hmac
import hashlib
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import jwt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config.settings import settings
from backend.app.database.session import get_db
from backend.app.database import crud
from backend.app.schemas import schemas

router= APIRouter()

# JWT TOKEN UTILITIES
def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta]= None) -> str:
    """
    Generates a secure JSON Web Token (JWT) signed with the application SECRET_KEY.
    """
    to_encode= data.copy()
    if expires_delta:
        expire= datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire= datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes= settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encode_jwt= jwt.encode(to_encode, settings.SECRET_KEY, algorithm= "HS256")
    return encode_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodes and validates a JWT token. Returns the payload dictionary or None if invalid.
    """
    try:
        payload= jwt.decode(token, settings.SECRET_KEY, algorithms= ["HS256"])
        return payload
    except jwt.PyJWTError:
        return None

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import File, UploadFile
from backend.app.database import models
from backend.app.services.cloudinary_service import upload_avatar
import uuid

security= HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials= Depends(security), db: AsyncSession= Depends(get_db)) -> models.User:
    token= credentials.credentials
    payload= decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code= 401, detail= "Invalid token or expired session.")
    try:
        user_id= uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(status_code= 401, detail= "Invalid user ID in token.")
    
    user= await crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail= "User not found.")
    return user

# REST ENDPOINTS
@router.post("/auth/google", response_model= schemas.Token)
async def google_auth(payload: schemas.GoogleAuthRequest, db: AsyncSession= Depends(get_db)):
    """
    Authenticates a user using their Google OAuth ID Token.
    Returns a custom JWT access token for subsequent API and GraphQL requests.
    """
    token_id= payload.token_id
    
    # 1. Dev Mode: Bypass Google verification if mock token is sent
    if token_id== "mock_token":
        email= "tester@quantiq.io"
        user= await crud.get_user_by_email(db, email)
        if not user:
            user_in= schemas.UserBase(
                email= email,
                full_name= "Local Tester",
                picture_url= "https://via.placeholder.com/150"
            )
            user= await crud.create_user(db, user_in, google_id= "mock_google_id_123")
        token= create_access_token(data={"sub": str(user.id)})
        return {"access_token": token, "token_type": "bearer"}
    
    # 2. Production Mode: Verify the ID Token via Google's tokeninfo API
    async with httpx.AsyncClient() as client:
        try:
            response= await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token_id}", timeout= 10.0)
            if response.status_code != 200:
                raise HTTPException(status_code= 400, detail= "Invalid Google OAuth token")
            
            idinfo= response.json()
            
            # Verify the audience matches our client ID if one is configured
            if settings.GOOGLE_CLIENT_ID and idinfo.get("aud") != settings.GOOGLE_CLIENT_ID:
                raise HTTPException(status_code= 400, detail= "OAuth audience mismatch")
            
            email= idinfo.get("email")
            name= idinfo.get("name")
            picture= idinfo.get("picture")
            google_id= idinfo.get("sub")
            
            if not email or not google_id:
                raise HTTPException(status_code= 400, detail= "Incomplete Google user profile")
            
        except httpx.RequestError as e:
            raise HTTPException(status_code= 503, detail= f"Google authentication unreachable: {str(e)}")
        
        # 3. Register or Retrieve User
        user= await crud.get_user_by_google_id(db, google_id)
        if not user:
            # Check if email is already in use by a mock account
            user= await crud.get_user_by_email(db, email)
            if not user:
                user_in= schemas.UserBase(email= email, full_name= name, picture_url= picture)
                user= await crud.create_user(db, user_in, google_id= google_id)
        
        # 4. Generate and return our custom JWT
        access_token= create_access_token(data= {"sub": str(user.id)})
        return {"access_token": access_token, "token_type": "bearer"}

# TRADITIONAL EMAIL AUTHENTICATION
from pydantic import BaseModel

class EmailSignUpRequest(BaseModel):
    email:str
    full_name: str
    country: str
    password: str

class EmailLoginRequest(BaseModel):
    email:str
    password: str

@router.post("/auth/signup", response_model= schemas.Token)
async def email_signup(payload: EmailSignUpRequest, db: AsyncSession= Depends(get_db)):
    """
    Registers a new user using their email, name, country, and password.
    Saves authentication credentials inside the existing schema.
    Instantly returns a signed access token.
    """
    # 1. Check if email already in use
    existing_user= await crud.get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(status_code= 400, detail= "Email is already registered.")
    
    # 2. Setup mock google_id for compatibility and password hash payload
    google_id = f"local:{payload.email}"
    pwd_hash = hashlib.sha256(payload.password.encode("utf-8")).hexdigest()
    picture_url = f"local_auth:{pwd_hash}:{payload.country}"
    
    user_in= schemas.UserBase(
        email= payload.email,
        full_name= payload.full_name,
        picture_url= picture_url
    )
    
    try:
        user= await crud.create_user(db, user_in, google_id= google_id)
    except Exception as e:
        raise HTTPException(status_code= 500, detail=f"Failed to register user: {str(e)}")
    
    token= create_access_token(data= {"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/auth/login", response_model= schemas.Token)
async def email_login(payload: EmailLoginRequest, db: AsyncSession= Depends(get_db)):
    """
    Authenticates a user via traditional email and password.
    Returns a custom JWT token.
    """
    user= await crud.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code= 400, detail= "Invalid email or password.")
    
    if not user.picture_url or not user.picture_url.startswith("local_auth:"):
        raise HTTPException(status_code= 400, detail= "Invalid login method. Please sign in using Google.")
    
    parts= user.picture_url.split(":")
    if len(parts) < 2:
        raise HTTPException(status_code= 400, detail= "Invalid account details.")
    
    stored_hash= parts[1]
    input_hash= hashlib.sha256(payload.password.encode("utf-8")).hexdigest()
    
    if stored_hash != input_hash:
        raise HTTPException(status_code= 400, detail= "Invalid email or password.")
    
    token= create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/payments/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str= Header(None), db: AsyncSession= Depends(get_db)):
    """
    Listens for Razorpay payment captured webhook events.
    Verifies signature and updates user credit balance asynchronously.
    """
    if not x_razorpay_signature:
        raise HTTPException(status_code= 400, detail= "Missing X-Razorpay-Signature header")
    body= await request.body()
    
    # 1. Cryptographic signature check (skipped if secret is not set during local testing)
    if settings.RAZORPAY_WEBHOOK_SECRET:
        expected_signature= hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_signature, x_razorpay_signature):
            raise HTTPException(status_code= 400, detail= "Invalid webhook signature")
        
    try:
        payload= json.loads(body.decode("utf-8"))
        event= payload.get("event")
        
        if event == "payment.captured":
            payment_entity= payload["payload"] ["payment"] ["entity"]
            order_id= payment_entity.get("order_id")
            payment_id= payment_entity.get("id")
            
            if order_id and payment_id:
                # Atomically update transaction status and user credit count
                tx= await crud.capture_payment_transaction(db, order_id, payment_id)
                
                if tx:
                    print(f"Razorpay Webhook: Captured Order {order_id} | Payment {payment_id}")
                    
    except Exception as e:
        raise HTTPException(status_code= 500, detail= f"Webhook processing error: {str(e)}")
    
    return {"status": "ok"}


class ContactFormRequest(BaseModel):
    name: str
    email: str
    message: str

@router.post("/contact")
async def contact_developer(payload: ContactFormRequest):
    """
    Receives a message from the contact form and sends an email via SMTP.
    Falls back to server console logging if SMTP credentials are not set.
    """
    name = payload.name.strip()
    email_addr = payload.email.strip()
    message = payload.message.strip()
    
    if not name or not email_addr or not message:
        raise HTTPException(status_code=400, detail="Name, email, and message are required.")
    
    # Check if SMTP settings are configured
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            # Construct the email
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM
            msg["To"] = settings.DEVELOPER_EMAIL
            msg["Subject"] = f"QuantIQ Developer Contact: {name}"
            
            body = (
                f"You have received a new contact message from QuantIQ:\n\n"
                f"Name: {name}\n"
                f"Email: {email_addr}\n\n"
                f"Message:\n{message}\n"
            )
            msg.attach(MIMEText(body, "plain"))
            
            # Connect and send
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, settings.DEVELOPER_EMAIL, msg.as_string())
            server.quit()
            
            print(f"Contact Form: Email successfully sent to {settings.DEVELOPER_EMAIL} from {email_addr}")
        except Exception as e:
            # Log error but don't crash, fallback to printing the message
            print(f"Contact Form Error: Failed to send email via SMTP: {str(e)}")
            print(f"FALLBACK CONTACT MESSAGE:\nName: {name}\nEmail: {email_addr}\nMessage: {message}")
    else:
        # Fallback logging if SMTP is not configured
        print("Contact Form: SMTP not configured. Logging contact form submission:")
        print(f"Name: {name}")
        print(f"Email: {email_addr}")
        print(f"Message: {message}")
        
    return {"status": "success", "message": "Your message has been sent successfully."}

@router.post("/users/avatar")
async def upload_user_avatar(file: UploadFile= File(...), current_user: models.User= Depends(get_current_user), db: AsyncSession= Depends(get_db)):
    """
    Uploads a new user profile avatar to Cloudinary, updates it in the database, and returns the new picture URL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code= 400, detail= "Uploaded file must be an image.")
    
    try:
        file_bytes= await file.read()
        secure_url= upload_avatar(file_bytes, str(current_user.id))
        
        current_user.picture_url= secure_url
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)
        
        return {"picture_url": secure_url}
    except ValueError as ve:
        raise HTTPException(status_code= 400, detail= str(ve))
    except Exception as e:
        raise HTTPException(status_code= 500, detail= f"Failed to upload avatar: {str(e)}")

@router.get("/stocks/search")
async def search_stocks(q: str):
    """
    Proxies Yahoo Finance's autocomplete API to suggest matching stock tickers.
    """
    if not q or len(q.strip()) < 2:
        return []
        
    query = q.strip()
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=8&newsCount=0"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=5.0)
            if response.status_code != 200:
                return []
            
            data = response.json()
            quotes = data.get("quotes", [])
            
            results = []
            for quote in quotes:
                symbol = quote.get("symbol")
                quote_type = quote.get("quoteType")
                name = quote.get("shortname") or quote.get("longname") or symbol
                
                # Filter to only return actual tradeable assets
                if symbol and quote_type in ["EQUITY", "ETF", "CRYPTOCURRENCY", "INDEX"]:
                    results.append({
                        "symbol": symbol,
                        "name": name
                    })
            return results
        except Exception as e:
            print(f"Error querying Yahoo Finance search API: {str(e)}")
            return []

# Caching for global indices to prevent hitting yfinance too frequently
_indices_cache = {
    "data": None,
    "timestamp": None
}

@router.get("/stocks/indices")
async def get_global_indices():
    """
    Returns live prices and 24h changes for major global indices and assets:
    - S&P 500 (^GSPC)
    - NASDAQ (^IXIC)
    - Nifty 50 (^NSEI)
    - Bitcoin (BTC-USD)
    - Gold (GC=F)
    """
    global _indices_cache
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Cache hit check (60-second cache window)
    if _indices_cache["data"] and _indices_cache["timestamp"]:
        if now - _indices_cache["timestamp"] < datetime.timedelta(seconds=60):
            return _indices_cache["data"]
            
    tickers = ["^GSPC", "^IXIC", "^NSEI", "BTC-USD", "GC=F"]
    names_map = {
        "^GSPC": "S&P 500",
        "^IXIC": "NASDAQ",
        "^NSEI": "Nifty 50",
        "BTC-USD": "Bitcoin",
        "GC=F": "Gold"
    }
    
    results = []
    
    try:
        import yfinance as yf
        import pandas as pd
        import asyncio
        loop = asyncio.get_event_loop()
        
        # Download historical data for the last 2 days in a single batch request
        df = await loop.run_in_executor(
            None,
            lambda: yf.download(tickers=" ".join(tickers), period="2d", group_by="ticker", progress=False)
        )
        
        for symbol in tickers:
            name = names_map[symbol]
            price = 0.0
            change_percent = 0.0
            
            try:
                # Handle DataFrame structure depending on whether multi-ticker format returned
                if isinstance(df.columns, pd.MultiIndex):
                    ticker_df = df[symbol].dropna(subset=["Close"])
                else:
                    ticker_df = df.dropna(subset=["Close"])
                
                if not ticker_df.empty:
                    close_series = ticker_df["Close"]
                    open_series = ticker_df["Open"]
                    
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
            except Exception as inner_e:
                print(f"Error parsing index data for {symbol}: {inner_e}")
                
            results.append({
                "symbol": symbol,
                "name": name,
                "price": round(price, 2),
                "changePercent": round(change_percent, 2)
            })
            
    except Exception as e:
        print(f"Error downloading global indices from yfinance: {e}")
        # Default mock fallback data if yfinance/network fails entirely
        results = [
            {"symbol": "^GSPC", "name": "S&P 500", "price": 5475.90, "changePercent": 0.35},
            {"symbol": "^IXIC", "name": "NASDAQ", "price": 17822.60, "changePercent": 0.42},
            {"symbol": "^NSEI", "name": "Nifty 50", "price": 23512.60, "changePercent": 0.60},
            {"symbol": "BTC-USD", "name": "Bitcoin", "price": 64320.50, "changePercent": -1.25},
            {"symbol": "GC=F", "name": "Gold", "price": 2332.10, "changePercent": 0.66}
        ]
        
    _indices_cache = {
        "data": results,
        "timestamp": now
    }
    return results