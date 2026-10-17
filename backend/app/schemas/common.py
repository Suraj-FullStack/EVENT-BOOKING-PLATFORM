"""Shared response shapes."""
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list | dict | None = None


class ErrorResponse(BaseModel):
    """Every non-2xx response from the API uses this envelope."""
    error: ErrorDetail


class MessageResponse(BaseModel):
    message: str
