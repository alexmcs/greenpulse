"""Certificates endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.core.database import get_db

router = APIRouter()


@router.get("/certificates/")
async def list_certificates(current_user=Depends(get_current_user)):
    db = get_db()
    response = (
        db.table("certificates")
        .select("*")
        .eq("user_id", str(current_user.id))
        .order("issued_at", desc=True)
        .execute()
    )
    return response.data


@router.get("/certificates/{certificate_id}")
async def get_certificate(
    certificate_id: str,
    current_user=Depends(get_current_user),
):
    db = get_db()
    response = (
        db.table("certificates")
        .select("*")
        .eq("id", certificate_id)
        .eq("user_id", str(current_user.id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return response.data


@router.get("/public/verify/{qr_token}")
async def public_verify_qr(qr_token: str):
    """Public endpoint — verifies QR code from certificate. No auth required."""
    db = get_db()
    response = (
        db.table("certificates")
        .select("*, verifications(*)")
        .eq("id", qr_token)
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return response.data
