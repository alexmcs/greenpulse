"""
POST /api/v1/verify — Main tree-planting verification endpoint.

Full UC-1 flow:
  1. Retrieve photo bytes from Supabase Storage via photo_token
  2. Antifrod pipeline (EXIF + hash + GPS dedup)
  3. AWS Rekognition CV inference (with Google Vision fallback)
  4. If confidence < 0.70 → return LOW_CONFIDENCE + top-5 candidates (HTTP 200)
  5. CO₂ calculation (IPCC Tier 1)
  6. Persist verification row
  7. Generate PDF certificate + QR code
  8. Upload PDF to Supabase Storage
  9. Persist certificate row
  10. Return certificate_id + species + co2 + qr_url

Error codes:
  403 GALLERY_PHOTO_DETECTED   — DUPLICATE_PHOTO hash detected
  202 POSSIBLE_DUPLICATE       — same GPS area / 24h (flagged, not blocked)
  200 LOW_CONFIDENCE           — confidence < 70%, species_candidates[] returned
"""
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.verification import VerifyRequest, VerifyResponse, SpeciesCandidate
from app.services.antifrod import AntifrodService
from app.services.certificate import generate_certificate_pdf
from app.services.co2_calculator import calculate_co2
from app.services.cv_inference import CVInferenceService
from app.services.storage import upload_pdf, get_photo_bytes

logger = logging.getLogger(__name__)

router = APIRouter()
_antifrod = AntifrodService()
_cv = CVInferenceService()

_LOW_CONFIDENCE_THRESHOLD = 0.70


@router.post("/verify", response_model=VerifyResponse)
async def verify_planting(
    request: VerifyRequest,
    current_user=Depends(get_current_user),
):
    db = get_db()
    user_id = str(current_user.id)

    # ── Step 1: Fetch photo bytes from Supabase Storage ──────────────────────
    image_bytes = get_photo_bytes(request.photo_token)

    # ── Step 2: Antifrod pipeline ──────────────────────────────────────────────
    antifrod_result, photo_hash = _antifrod.run_all(
        image_bytes=image_bytes,
        lat=request.gps.lat,
        lng=request.gps.lng,
        user_id=user_id,
    )

    if antifrod_result.block:
        # DUPLICATE_PHOTO → reject with 403
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "GALLERY_PHOTO_DETECTED", "flags": antifrod_result.flags},
        )

    # ── Step 3: CV inference ──────────────────────────────────────────────────
    cv_result = _cv.analyze(image_bytes)

    # ── Step 4: Low confidence path ───────────────────────────────────────────
    if cv_result.confidence < _LOW_CONFIDENCE_THRESHOLD:
        return VerifyResponse(
            certificate_id=None,
            species=cv_result.species_name,
            co2_kg_year=0.0,
            qr_url=None,
            confidence=cv_result.confidence,
            antifrod_flags=antifrod_result.flags,
            species_candidates=[
                SpeciesCandidate(
                    species_id=c.species_id,
                    name_latin=c.name_latin,
                    name_common_ru=c.name_common_ru,
                    confidence=c.confidence,
                )
                for c in cv_result.candidates[:5]
            ],
        )

    # ── Step 5: CO₂ calculation ───────────────────────────────────────────────
    co2 = calculate_co2(cv_result.species_id)

    # ── Step 6: Persist verification ──────────────────────────────────────────
    # GPS stored rounded to 4 decimal places (~11m precision — GDPR)
    lat_stored = round(request.gps.lat, 4)
    lng_stored = round(request.gps.lng, 4)

    now = datetime.now(tz=timezone.utc)
    verification_id = str(uuid4())

    db.table("verifications").insert({
        "id": verification_id,
        "user_id": user_id,
        "photo_url": request.photo_token,  # already a Storage URL
        "photo_hash": photo_hash,
        "lat": lat_stored,
        "lng": lng_stored,
        "gps_accuracy_m": request.gps.accuracy,
        "species_id": cv_result.species_id if cv_result.species_id else None,
        "species_name": cv_result.species_name,
        "species_confidence": cv_result.confidence,
        "species_source": "ai",
        "co2_kg_year": co2.avg_kg_year,
        "co2_kg_year_min": co2.min_kg_year,
        "co2_kg_year_max": co2.max_kg_year,
        "antifrod_status": "flagged" if antifrod_result.flags else "passed",
        "antifrod_flags": antifrod_result.flags,
        "payment_status": "pending",
        "event_id": str(request.event_id) if request.event_id else None,
        "created_at": now.isoformat(),
    }).execute()

    # ── Step 7–8: Generate certificate PDF + upload ────────────────────────────
    # Fetch user display_name for certificate
    user_row = (
        db.table("users")
        .select("display_name")
        .eq("id", user_id)
        .single()
        .execute()
    )
    display_name = (user_row.data or {}).get("display_name", "")

    # Fetch species common name
    species_ru = ""
    if cv_result.species_id:
        sp_row = (
            db.table("species")
            .select("name_common_ru")
            .eq("id", cv_result.species_id)
            .single()
            .execute()
        )
        species_ru = (sp_row.data or {}).get("name_common_ru", "")

    certificate_id = uuid4()
    pdf_bytes, qr_url = generate_certificate_pdf(
        certificate_id=certificate_id,
        display_name=display_name,
        species_latin=cv_result.species_name,
        species_common_ru=species_ru,
        lat=lat_stored,
        lng=lng_stored,
        issued_at=now,
        co2_kg_year=co2.avg_kg_year,
        co2_min=co2.min_kg_year,
        co2_max=co2.max_kg_year,
    )

    pdf_url = upload_pdf(pdf_bytes, str(certificate_id))

    # ── Step 9: Persist certificate ───────────────────────────────────────────
    qr_png_url = f"{pdf_url}#qr"  # QR is embedded in PDF; separate URL for API consumers
    db.table("certificates").insert({
        "id": str(certificate_id),
        "verification_id": verification_id,
        "user_id": user_id,
        "pdf_url": pdf_url,
        "qr_code_url": qr_png_url,
        "qr_verification_url": qr_url,
        "co2_methodology": "IPCC Tier 1",
        "co2_methodology_version": "1.0",
        "issued_at": now.isoformat(),
    }).execute()

    # Update verification with certificate FK + mark payment pending
    db.table("verifications").update({"certificate_id": str(certificate_id)}).eq(
        "id", verification_id
    ).execute()

    # ── Step 10: Return ───────────────────────────────────────────────────────
    logger.info(
        "Verification complete: user=%s species=%s conf=%.2f cert=%s",
        user_id, cv_result.species_name, cv_result.confidence, certificate_id,
    )

    # Flag POSSIBLE_DUPLICATE as 202 with body (non-blocking)
    response_body = VerifyResponse(
        certificate_id=certificate_id,
        species=cv_result.species_name,
        co2_kg_year=co2.avg_kg_year,
        qr_url=qr_url,
        confidence=cv_result.confidence,
        antifrod_flags=antifrod_result.flags,
    )

    if "POSSIBLE_DUPLICATE" in antifrod_result.flags:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=202,
            content=response_body.model_dump(mode="json"),
        )

    return response_body


@router.get("/verify/{verification_id}/status")
async def get_verification_status(
    verification_id: str,
    current_user=Depends(get_current_user),
):
    db = get_db()
    response = (
        db.table("verifications")
        .select("id, antifrod_status, antifrod_flags, payment_status, species_name, co2_kg_year, certificate_id, created_at")
        .eq("id", verification_id)
        .eq("user_id", str(current_user.id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Verification not found")
    return response.data
