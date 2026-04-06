"""Pydantic models for users."""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal


class UserProfile(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    plan: Literal["free", "premium", "corporate"] = "free"
    verification_count: int = 0
    created_at: datetime
