"""POST /api/v1/verify — Main verification endpoint."""
import base64
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.verification import VerifyRequest, VerifyResponse
from app.core.security import get_current_user
from app.services.antifrod import AntifrodService
from app.services.cv_inference import CVInferenceService
from app.services.co2_calculator import calculate_co2
from app.services.certificate import generate_certificate_pdf, generate_qr_code
from app.services.storage import upload_photo, upload_pdf
from app.core.database import get_db
from app.core.config import get_settings

router = APIRouter()
antifrod_service = AntifrodService()
cv_service = CVInferenceService()


@router.post("/verify", response_model=VerifyResponse)
async def verify_planting(
    request: VerifyRequest,
    current_user=Depends(get_current_user),
):
    db = get_db()
    settings = get_settings()

    # 1. Fetch photo from Supabase Storage via photo_token
    # TODO: retrieve image_bytes from storage using photo_token

    # 2. Run antifrod
    # antifrod_result = antifrod_service.run_all(image_bytes, request.gps.lat, request.gps.lng, str(current_user.id))
    # if antifrod_result.block:
    #     if "DUPLICATE_PHOTO" in antifrod_result.flags:
    #         raise HTTPException(status_code=403, detail={"code": "GALLERY_PHOTO_DETECTED"})

    # 3. CV inference
    # cv_result = cv_service.analyze(image_bytes)
    # if cv_result.confidence < 0.7:
    #     return VerifyResponse(confidence=cv_result.confidence, species=cv_result.species_name,
    #                           co2_kg_year=0, species_candidates=cv_result.candidates[:5], antifrod_flags=[])

    # 4. CO2 calculation
    # co2_result = calculate_co2(cv_result.species_id)

    # 5. Generate certificate
    # pdf_bytes = generate_certificate_pdf(...)
    # pdf_url = upload_pdf(pdf_bytes, certificate_id)

    # TODO: implement full flow — stub for structure validation
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.get("/verify/{verification_id}/status")
async def get_verification_status(
    verification_id: str,
    current_user=Depends(get_current_user),
):
    db = get_db()
    response = (
        db.table("verifications")
        .select("*")
        .eq("id", verification_id)
        .eq("user_id", str(current_user.id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Verification not found")
    return response.data
