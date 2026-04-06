# GreenPulse API Reference

Base URL: `https://api.greenpulse.app/api/v1`

Auth: `Authorization: Bearer <supabase_jwt>`

---

## POST /verify

Verify a tree planting. Main endpoint.

**Request:**
```json
{
  "photo_token": "string",
  "gps": { "lat": 52.2297, "lng": 21.0122, "accuracy": 5 },
  "device_id": "string",
  "event_id": "uuid (optional)"
}
```

**Response 200:**
```json
{
  "certificate_id": "uuid",
  "species": "Quercus robur",
  "co2_kg_year": 48.0,
  "qr_url": "https://greenpulse.app/verify/uuid",
  "confidence": 0.92,
  "antifrod_flags": []
}
```

**Response 200 (low confidence):**
```json
{
  "confidence": 0.45,
  "species": "Unknown",
  "co2_kg_year": 0,
  "antifrod_flags": [],
  "species_candidates": [
    { "species_id": 1, "name_latin": "Quercus robur", "name_common_ru": "Дуб", "confidence": 0.45 }
  ]
}
```

**Errors:**
- `403 GALLERY_PHOTO_DETECTED` — gallery photo detected (EXIF missing + AI-gen signals)
- `202 POSSIBLE_DUPLICATE` — duplicate GPS/24h (flagged, not blocked)

---

## GET /certificates/

Returns list of user's certificates.

## GET /certificates/{id}

Returns single certificate.

## GET /public/verify/{qr_token}

Public QR verification (no auth).

## DELETE /users/me

GDPR right to deletion. Soft-deletes user + wipes PII.

## GET /health

Returns `{ "status": "ok" }`.
