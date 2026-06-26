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