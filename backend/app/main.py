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

# Instrument FastAPI and expose Prometheus metrics endpoint at /metrics
Instrumentator().instrument(app).expose(app)

@app.on_event("startup")
async def startup_event():
    repo_id= os.getenv("HF_MODEL_REPO", "Karan6124/quantiq-model")
    filename= "model.onnx"
    
    print(f"Starting application: checking for ONNX model...")
    try:
        local_path= "model.onnx"
        if os.path.exists(local_path):
            print(f"Using local model found at {local_path}")
            model_path= local_path
        else:
            print(f"Downloading model from Hugging Face Hub: {repo_id}...")
            # hf_hub_download downloads the file and returns its local path
            model_path= hf_hub_download(repo_id= repo_id, filename= filename)
            print(f"Model download and cached at {model_path}")
        
        # Load model session
        init_onnx_session(model_path)
    except Exception as e:
        print(f"Error loading ONNX model during startup: {str(e)}")
        print("Backend running in dev mock fallback mode.")
        
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