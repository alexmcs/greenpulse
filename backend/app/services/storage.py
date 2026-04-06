"""Supabase Storage helper — upload photos and PDFs, read photo bytes."""
import uuid
from fastapi import HTTPException, status

from app.core.database import get_db

PHOTOS_BUCKET = "verification-photos"
CERTS_BUCKET = "certificates"


def get_photo_bytes(photo_token: str) -> bytes:
    """
    Download photo bytes from Supabase Storage using the photo_token
    (which is expected to be a signed or public URL / storage path).
    Raises 400 if the file cannot be retrieved.
    """
    db = get_db()
    try:
        # photo_token is the storage path: "{user_id}/{uuid}.jpg"
        response = db.storage.from_(PHOTOS_BUCKET).download(photo_token)
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PHOTO_NOT_FOUND", "message": str(exc)},
        )


def upload_photo(image_bytes: bytes, user_id: str) -> str:
    """Upload photo to Supabase Storage and return storage path (used as photo_token)."""
    db = get_db()
    path = f"{user_id}/{uuid.uuid4()}.jpg"
    db.storage.from_(PHOTOS_BUCKET).upload(
        path,
        image_bytes,
        file_options={"content-type": "image/jpeg"},
    )
    return path  # return path, not public URL — photo is private


def get_photo_public_url(path: str) -> str:
    """Get public URL for a photo path (only for certificates, not raw access)."""
    db = get_db()
    return db.storage.from_(PHOTOS_BUCKET).get_public_url(path)


def upload_pdf(pdf_bytes: bytes, certificate_id: str) -> str:
    """Upload PDF certificate to Supabase Storage and return public URL."""
    db = get_db()
    file_name = f"{certificate_id}.pdf"
    db.storage.from_(CERTS_BUCKET).upload(
        file_name,
        pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )
    return db.storage.from_(CERTS_BUCKET).get_public_url(file_name)
