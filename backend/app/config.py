"""
Application configuration, loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database — defaults to a local SQLite file, override with a Postgres URL in production
    database_url: str = "sqlite:///./mytube.db"

    # Auth
    secret_key: str = "change-this-secret-key-before-deploying"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # YouTube Data API v3 — https://console.cloud.google.com/apis/credentials
    youtube_api_key: str = ""

    # CORS — comma-separated list of allowed origins, "*" for local dev
    cors_origins: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
