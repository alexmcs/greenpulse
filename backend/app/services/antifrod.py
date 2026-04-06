"""
Antifrod service — EXIF verification, GPS deduplication, photo hash check.

Flags reference:
  EXIF_MISSING         — no EXIF at all (AI-generated image or screenshot)
  EXIF_FUTURE_DATE     — DateTimeOriginal is in the future
  EXIF_SOFTWARE_EDITED — Software tag contains known editor (Photoshop, GIMP…)
  EXIF_NO_GPS          — EXIF present but GPS block missing
  POSSIBLE_DUPLICATE   — same user, same GPS area (10m), last 24h → flag, don't block
  DUPLICATE_PHOTO      — identical SHA-256 hash → block (403)
"""
import hashlib
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

import piexif

from app.core.database import get_db

# Software strings that indicate post-processing editors
_EDITOR_KEYWORDS = (
    b"photoshop", b"gimp", b"lightroom", b"affinity", b"snapseed",
    b"pixelmator", b"acdsee", b"darktable", b"capture one",
)


@dataclass
class AntifrodResult:
    passed: bool
    flags: list[str] = field(default_factory=list)
    block: bool = False  # True → caller returns 403


class AntifrodService:

    # ------------------------------------------------------------------ EXIF

    def check_exif(self, image_bytes: bytes) -> AntifrodResult:
        """
        Extract EXIF and validate authenticity.
        Returns non-blocking flags — caller decides whether to reject.
        """
        flags: list[str] = []
        try:
            exif_data = piexif.load(image_bytes)
        except Exception:
            # No parseable EXIF → high-risk signal (AI-gen / screenshot)
            return AntifrodResult(passed=False, flags=["EXIF_MISSING"])

        ifd0 = exif_data.get("0th", {})
        exif_ifd = exif_data.get("Exif", {})
        gps_ifd = exif_data.get("GPS", {})

        # 1. Software field → edited image?
        software = ifd0.get(piexif.ImageIFD.Software, b"")
        if isinstance(software, bytes):
            software_lower = software.lower()
            if any(kw in software_lower for kw in _EDITOR_KEYWORDS):
                flags.append("EXIF_SOFTWARE_EDITED")

        # 2. DateTimeOriginal → future date?
        dt_original = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)
        if dt_original:
            try:
                dt_str = dt_original.decode() if isinstance(dt_original, bytes) else dt_original
                # EXIF format: "YYYY:MM:DD HH:MM:SS"
                photo_dt = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(
                    tzinfo=timezone.utc
                )
                if photo_dt > datetime.now(tz=timezone.utc):
                    flags.append("EXIF_FUTURE_DATE")
            except (ValueError, AttributeError):
                pass

        # 3. GPS block absent while EXIF present → suspicious
        if not gps_ifd:
            flags.append("EXIF_NO_GPS")

        return AntifrodResult(passed=True, flags=flags)

    # ------------------------------------------------------- GPS dedup (haversine)

    def check_gps_dedup(
        self,
        lat: float,
        lng: float,
        user_id: str,
        radius_m: int = 10,
        window_hours: int = 24,
    ) -> AntifrodResult:
        """
        Query DB for verifications by the same user within {radius_m}m
        over the last {window_hours} hours.

        Uses Haversine approximation via SQL arithmetic (no PostGIS needed).
        Supabase/Postgres supports the required math functions natively.
        """
        db = get_db()

        # Degree-per-meter approximation:
        # 1° lat ≈ 111 320 m  →  radius_deg_lat = radius_m / 111320
        # 1° lng ≈ 111 320 * cos(lat)  →  radius_deg_lng = radius_m / (111320 * cos(lat))
        lat_rad = math.radians(lat)
        delta_lat = radius_m / 111_320
        delta_lng = radius_m / (111_320 * math.cos(lat_rad)) if math.cos(lat_rad) != 0 else delta_lat

        # Bounding-box pre-filter (fast), then exact haversine in Python
        lat_min = round(lat - delta_lat, 4)
        lat_max = round(lat + delta_lat, 4)
        lng_min = round(lng - delta_lng, 4)
        lng_max = round(lng + delta_lng, 4)

        response = (
            db.table("verifications")
            .select("lat, lng, created_at")
            .eq("user_id", user_id)
            .eq("antifrod_status", "passed")
            .gte("lat", lat_min)
            .lte("lat", lat_max)
            .gte("lng", lng_min)
            .lte("lng", lng_max)
            .gte("created_at", _iso_hours_ago(window_hours))
            .execute()
        )

        for row in response.data or []:
            if _haversine_m(lat, lng, float(row["lat"]), float(row["lng"])) <= radius_m:
                return AntifrodResult(passed=True, flags=["POSSIBLE_DUPLICATE"])

        return AntifrodResult(passed=True, flags=[])

    # ------------------------------------------------------- Photo hash

    def check_photo_hash(self, image_bytes: bytes, user_id: str) -> AntifrodResult:
        """
        SHA-256 of the raw photo bytes.
        If the same hash already exists for this user → DUPLICATE_PHOTO → block.
        """
        photo_hash = hashlib.sha256(image_bytes).hexdigest()
        db = get_db()
        response = (
            db.table("verifications")
            .select("id")
            .eq("photo_hash", photo_hash)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if response.data:
            return AntifrodResult(passed=False, flags=["DUPLICATE_PHOTO"], block=True)
        return AntifrodResult(passed=True, flags=[], block=False)

    # ------------------------------------------------------- Combined pipeline

    def run_all(
        self,
        image_bytes: bytes,
        lat: float,
        lng: float,
        user_id: str,
    ) -> tuple[AntifrodResult, str]:
        """
        Run the full antifrod pipeline.
        Returns (result, photo_hash) so the caller can store the hash.
        """
        photo_hash = hashlib.sha256(image_bytes).hexdigest()
        all_flags: list[str] = []
        block = False

        exif = self.check_exif(image_bytes)
        all_flags.extend(exif.flags)

        hash_check = self.check_photo_hash(image_bytes, user_id)
        all_flags.extend(hash_check.flags)
        if hash_check.block:
            block = True

        if not block:
            gps = self.check_gps_dedup(lat, lng, user_id)
            all_flags.extend(gps.flags)

        return AntifrodResult(passed=not block, flags=all_flags, block=block), photo_hash


# ------------------------------------------------------------------ helpers

def _iso_hours_ago(hours: int) -> str:
    from datetime import timedelta
    ts = datetime.now(tz=timezone.utc) - timedelta(hours=hours)
    return ts.isoformat()


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two WGS-84 coordinates."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
