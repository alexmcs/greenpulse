"""Antifrod service — EXIF check, GPS dedup, photo hash check."""
import hashlib
from dataclasses import dataclass, field
from typing import Optional
import piexif
from app.core.database import get_db


@dataclass
class AntifrodResult:
    passed: bool
    flags: list[str] = field(default_factory=list)
    block: bool = False  # True → return 403


class AntifrodService:

    def check_exif(self, image_bytes: bytes) -> AntifrodResult:
        """Check EXIF metadata for signs of manipulation."""
        flags: list[str] = []
        try:
            exif_data = piexif.load(image_bytes)
        except Exception:
            flags.append("EXIF_MISSING")
            return AntifrodResult(passed=False, flags=flags)

        # TODO: check EXIF_FUTURE_DATE, EXIF_SOFTWARE_EDITED, EXIF_NO_GPS
        return AntifrodResult(passed=True, flags=flags)

    def check_gps_dedup(
        self,
        lat: float,
        lng: float,
        user_id: str,
        radius_m: int = 10,
        window_hours: int = 24,
    ) -> AntifrodResult:
        """Check if same user already verified near this GPS point recently."""
        # TODO: query Supabase verifications table with PostGIS or haversine
        return AntifrodResult(passed=True, flags=[])

    def check_photo_hash(self, image_bytes: bytes, user_id: str) -> AntifrodResult:
        """Block if exact same photo hash already exists for this user."""
        photo_hash = hashlib.sha256(image_bytes).hexdigest()
        db = get_db()
        # TODO: query DB for existing hash
        return AntifrodResult(passed=True, flags=[], block=False)

    def run_all(self, image_bytes: bytes, lat: float, lng: float, user_id: str) -> AntifrodResult:
        """Run full antifrod pipeline. Returns combined result."""
        all_flags: list[str] = []
        block = False

        exif_result = self.check_exif(image_bytes)
        all_flags.extend(exif_result.flags)

        hash_result = self.check_photo_hash(image_bytes, user_id)
        all_flags.extend(hash_result.flags)
        if hash_result.block:
            block = True

        gps_result = self.check_gps_dedup(lat, lng, user_id)
        all_flags.extend(gps_result.flags)

        return AntifrodResult(passed=not block, flags=all_flags, block=block)
