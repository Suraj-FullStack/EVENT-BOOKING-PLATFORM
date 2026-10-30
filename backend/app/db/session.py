"""
SQLAlchemy engine + session factory.

`get_db` is the FastAPI dependency that hands a session to each request and
makes sure it's closed afterwards. Commits are done explicitly by the
service layer so transaction boundaries are obvious.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # Supabase's pooler drops idle connections; this re-checks them
    pool_size=5,
    max_overflow=5,
    # Supabase's transaction pooler (port 6543, PgBouncer) can't track
    # server-side prepared statements, so turn them off. Costs almost nothing
    # and means either pooler URL just works.
    connect_args={"prepare_threshold": None},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
