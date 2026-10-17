from fastapi import APIRouter

from app.api.routes import admin, auth, bookings, events

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(bookings.router)
api_router.include_router(admin.router)
