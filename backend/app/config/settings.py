from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

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
    
    # Auth configuration
    SECRET_KEY: str = Field(default="supersecretkeychangeinproduction")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 
    
    @property
    def database_url_async(self) -> str:
        """
        Ensures the database URL uses the asyncpg driver dialect.
        Converts 'postgresql://' to 'postgresql+asyncpg://'
        """
        url= self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    
    model_config= SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings= Settings()