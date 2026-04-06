"""Pydantic models for verification request/response."""
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class GPSCoords(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    accuracy: int = Field(..., gt=0, description="GPS accuracy in meters")


class VerifyRequest(BaseModel):
    photo_token: str
    gps: GPSCoords
    device_id: str
    event_id: Optional[UUID] = None


class SpeciesCandidate(BaseModel):
    species_id: int
    name_latin: str
    name_common_ru: str
    confidence: float


class VerifyResponse(BaseModel):
    model_config = {"arbitrary_types_allowed": True}

    certificate_id: Optional[UUID] = None
    species: str
    co2_kg_year: float
    qr_url: Optional[str] = None
    confidence: float
    antifrod_flags: list[str] = []
    species_candidates: Optional[list[SpeciesCandidate]] = None  # when confidence < 0.70
