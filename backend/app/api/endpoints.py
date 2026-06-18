import json
import hmac
import hashlib
import datetime
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