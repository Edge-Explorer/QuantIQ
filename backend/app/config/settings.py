from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

class Settings(BaseSettings):
    PROJECT_NAME: str= "QuantIQ"
    API_V1_STR: str= "/api/v1"
    
    # Required environment variables (must be present in your .env file)
    DATABASE_URL: str
    REDIS_URL: str
    GEMINI_API_KEY: str
    
    # Optional Razorpay Credentials (defaults to empty string if not set)
    RAZORPAY_KEY_ID: str = Field(default="")
    RAZORPAY_KEY_SECRET: str = Field(default="")
    RAZORPAY_WEBHOOK_SECRET: str = Field(default="")
    
    # Optional Cloudinary Credentials (defaults to empty string if not set)
    CLOUDINARY_CLOUD_NAME: str = Field(default="")
    CLOUDINARY_API_KEY: str = Field(default="")
    CLOUDINARY_API_SECRET: str = Field(default="")
    
    # Google OAuth Credentials (defaults to empty string if not set)
    GOOGLE_CLIENT_ID: str = Field(default="")
    GOOGLE_CLIENT_SECRET: str = Field(default="")
    
    # Auth configuration
    SECRET_KEY: str = Field(default="supersecretkeychangeinproduction")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 
    
    # SMTP Configuration
    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    RESEND_API_KEY: str = Field(default="")
    SMTP_FROM: str = Field(default="noreply@quantiq.io")
    DEVELOPER_EMAIL: str = Field(default="karanshelar8775@gmail.com")
    
    KAFKA_BOOTSTRAP_SERVERS: str= Field(default= "localhost:9092")
    
    @property
    def database_url_async(self) -> str:
        """
        Ensures the database URL uses the asyncpg driver dialect.
        Converts 'postgresql://' to 'postgresql+asyncpg://'
        and cleans up query parameters for asyncpg.
        """
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        parsed_url = urlparse(url)
        query_params = dict(parse_qsl(parsed_url.query))
        
        if "sslmode" in query_params:
            query_params["ssl"] = query_params.pop("sslmode")
        
        query_params.pop("channel_binding", None)
        reconstructed_query = urlencode(query_params)
        parsed_url = parsed_url._replace(query=reconstructed_query)
        return urlunparse(parsed_url)
    
    model_config= SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings= Settings()