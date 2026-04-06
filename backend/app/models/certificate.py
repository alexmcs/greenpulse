"""Pydantic models for certificates."""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class CertificateResponse(BaseModel):
    id: UUID
    verification_id: UUID
    pdf_url: str
    qr_code_url: str
    qr_verification_url: str
    co2_methodology: str
    issued_at: datetime
