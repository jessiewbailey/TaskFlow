from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@host:5432/database")
    
    # AI Worker
    ai_worker_url: str = os.getenv("AI_WORKER_URL", "http://taskflow-ai:8001")
    
    # Redis for job queue
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    # API Configuration
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "CHANGE-THIS-SECRET-KEY-IN-PRODUCTION")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # Observability
    jaeger_endpoint: Optional[str] = None
    prometheus_port: int = 9090
    
    # Performance
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    request_timeout: int = 120  # seconds
    
    class Config:
        env_file = ".env"

settings = Settings()