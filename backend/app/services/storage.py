"""Supabase Storage helper — upload photos and PDFs."""
import uuid
from app.core.database import get_db


PHOTOS_BUCKET = "verification-photos"
CERTS_BUCKET = "certificates"


def upload_photo(image_bytes: bytes, user_id: str) -> str:
    """Upload photo to Supabase Storage and return public URL."""
    db = get_db()
    file_name = f"{user_id}/{uuid.uuid4()}.jpg"
    db.storage.from_(PHOTOS_BUCKET).upload(
        file_name,
        image_bytes,
        file_options={"content-type": "image/jpeg"},
    )
    url = db.storage.from_(PHOTOS_BUCKET).get_public_url(file_name)
    return url


def upload_pdf(pdf_bytes: bytes, certificate_id: str) -> str:
    """Upload PDF certificate to Supabase Storage and return public URL."""
    db = get_db()
    file_name = f"{certificate_id}.pdf"
    db.storage.from_(CERTS_BUCKET).upload(
        file_name,
        pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )
    url = db.storage.from_(CERTS_BUCKET).get_public_url(file_name)
    return url
