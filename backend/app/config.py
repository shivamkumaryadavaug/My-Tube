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

    # CORS — comma-separated list of allowed origins. Defaults to the real
    # production origins rather than "*": a wildcard here means *any* site
    # can call the authenticated API from a browser. Override via the
    # CORS_ORIGINS environment variable for local dev (e.g. "*" or
    # "http://localhost:5500") — this default only governs deployments that
    # don't set that variable explicitly.
    cors_origins: str = "https://www.shivamkumaryadav.me,https://shivamkumaryadav.me,https://my-tube-rho-seven.vercel.app"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
