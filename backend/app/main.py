import os
import uuid
from typing import Optional
from fastapi import FastAPI, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.fastapi import GraphQLRouter
from huggingface_hub import hf_hub_download

from prometheus_fastapi_instrumentator import Instrumentator

from backend.app.config.settings import settings
from backend.app.database.session import get_db
from backend.app.database import crud
from backend.app.graphql.schema import schema
from backend.app.api.endpoints import router as api_router, decode_access_token
from backend.app.services.gemini import init_onnx_session

app= FastAPI(
    title= settings.PROJECT_NAME,
    description= "Real-time event-driven stock intelligence dashboard backend.",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins= ["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials= True,
    allow_methods= ["*"],
    allow_headers= ["*"],
)

from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import HTTPException, status, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import secrets

security = HTTPBasic()

def authenticate_metrics(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, "admin")
    correct_password = secrets.compare_digest(credentials.password, "admin")
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Instrument FastAPI
Instrumentator().instrument(app)

@app.get("/metrics")
async def metrics(username: str = Depends(authenticate_metrics)):
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.on_event("startup")
async def startup_event():
    repo_id = os.getenv("HF_MODEL_REPO", "Karan6124/quantiq-model")
    model_types = ["tech", "crypto", "index"]
    
    print(f"Starting application: checking for ONNX models...")
    for m_type in model_types:
        filename = f"model_{m_type}.onnx"
        try:
            local_path = filename
            if os.path.exists(local_path):
                print(f"Using local model found at {local_path} for '{m_type}'")
                init_onnx_session(local_path, m_type)
            else:
                print(f"Downloading model '{filename}' from Hugging Face Hub: {repo_id}...")
                model_path = hf_hub_download(repo_id=repo_id, filename=filename)
                init_onnx_session(model_path, m_type)
        except Exception as e:
            print(f"Could not load specialized model '{filename}' from HF Hub: {e}")
            # Try to fall back to general model.onnx
            fallback_filename = "model.onnx"
            try:
                if os.path.exists(fallback_filename):
                    print(f"Falling back to local {fallback_filename} for '{m_type}'")
                    init_onnx_session(fallback_filename, m_type)
                else:
                    print(f"Downloading fallback model.onnx from HF Hub for '{m_type}'...")
                    model_path = hf_hub_download(repo_id=repo_id, filename=fallback_filename)
                    init_onnx_session(model_path, m_type)
            except Exception as fb_err:
                print(f"Error loading fallback model for '{m_type}': {fb_err}")
        
# Custom GraphQL Context Getter to inject AsyncSession and User from JWT
async def get_graphql_context(db: AsyncSession= Depends(get_db), authorization: Optional[str]= Header(None)):
    context= {"db": db, "user": None}
    
    if authorization and authorization.startswith("Bearer "):
        token= authorization.split(" ")[1]
        payload= decode_access_token(token)
        if payload and "sub" in payload:
            try:
                user_id= uuid.UUID(payload["sub"])
                user= await crud.get_user(db, user_id)
                if user:
                    context["user"]= user
            except ValueError:
                pass
            
    return context

# Create and mount Strawberry GraphQL Router
graphql_router= GraphQLRouter(
    schema,
    context_getter= get_graphql_context
)

app.include_router(api_router, prefix= settings.API_V1_STR)
app.include_router(graphql_router, prefix= "/graphql")

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "graphql_endpoint": "/graphql",
        "api_v1_endpoint": settings.API_V1_STR
    }