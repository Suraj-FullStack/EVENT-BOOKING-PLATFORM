"""
EventBook API entry point.

Run locally with:  uvicorn app.main:app --reload
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AppError

settings = get_settings()
logger = logging.getLogger("eventbook")
logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="REST API for the EventBook mini event booking app.",
    docs_url="/docs",
    redoc_url=None,
)

# CORS - origins come from the FRONTEND_ORIGIN env var. `allow_credentials`
# is required so the browser sends the HttpOnly auth cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


# ---------------------------------------------------------------------------
# CSRF guard for cookie auth
# ---------------------------------------------------------------------------
# Cookies are sent automatically by browsers, so a malicious site could try to
# POST to us with the victim's cookie. Two layers stop that:
#   1. CORS above refuses cross-origin preflights from unknown origins, and
#   2. this middleware requires the custom `X-Requested-With` header on every
#      state-changing request when a cookie is used. Browsers only send custom
#      headers after a successful preflight, so a forged form post can't.
# Bearer-token clients (curl, tests) are unaffected.
@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        uses_cookie = settings.auth_cookie_name in request.cookies
        has_bearer = request.headers.get("Authorization", "").lower().startswith("bearer ")
        if uses_cookie and not has_bearer and request.headers.get("X-Requested-With") != "XMLHttpRequest":
            return _error(status.HTTP_403_FORBIDDEN, "csrf_rejected", "Missing CSRF header")
    return await call_next(request)


# ---------------------------------------------------------------------------
# Consistent error envelope: {"error": {"code", "message", "details"}}
# ---------------------------------------------------------------------------
def _error(status_code: int, code: str, message: str, details=None) -> JSONResponse:
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return _error(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    # Trim pydantic's output to what the UI actually needs.
    details = [
        {"field": ".".join(str(p) for p in e.get("loc", []) if p not in ("body", "query", "path")),
         "message": e.get("msg", "Invalid value")}
        for e in exc.errors()
    ]
    return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "validation_error", "Request validation failed", details)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException):
    code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(
        exc.status_code, "http_error"
    )
    return _error(exc.status_code, code, str(exc.detail) if exc.detail else "Request failed")


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    # Log the real exception server-side, never send it to the client.
    logger.exception("Unhandled error: %s", type(exc).__name__)
    return _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", "Something went wrong on our side")


@app.get("/", tags=["health"], include_in_schema=False)
def root():
    return {"name": settings.app_name, "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(api_router)
