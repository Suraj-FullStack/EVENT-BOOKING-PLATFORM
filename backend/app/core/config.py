"""
Application settings.

Everything that differs between local dev and production lives here and is
read from environment variables (or a local `.env` file). Nothing in this
file should ever contain a real secret.
"""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General -----------------------------------------------------------
    app_name: str = "EventBook API"
    environment: str = "development"  # "development" | "production"
    debug: bool = False

    # --- Database ----------------------------------------------------------
    # Supabase gives you a postgres:// URL; we normalise it to the psycopg
    # driver below so SQLAlchemy picks the right dialect.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/eventbook"

    # --- Auth --------------------------------------------------------------
    jwt_secret_key: str = "dev-only-secret-change-me-before-deploying-anywhere"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h; the cookie is HttpOnly

    # Cookie settings. In production the cookie must be Secure + SameSite=None
    # because the frontend (Vercel) and API (Render/Railway/...) live on
    # different origins.
    auth_cookie_name: str = "eventbook_access"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # "lax" locally, "none" in production

    # --- CORS --------------------------------------------------------------
    # Comma-separated list of allowed browser origins.
    frontend_origin: str = "http://localhost:3000"

    # --- Seed accounts (development defaults, override in prod) -----------
    seed_admin_email: str = "admin@eventbook.dev"
    seed_admin_password: str = "Admin12345!"
    seed_admin_name: str = "EventBook Admin"
    seed_user_email: str = "user@eventbook.dev"
    seed_user_password: str = "User12345!"
    seed_user_name: str = "Jane Attendee"

    @field_validator("database_url")
    @classmethod
    def _normalise_db_url(cls, value: str) -> str:
        # Accept the plain URL Supabase hands out and force the psycopg3 driver.
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://"):]
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
