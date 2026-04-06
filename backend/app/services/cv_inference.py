"""
CV inference service — AWS Rekognition Custom Labels with Google Vision API fallback.

Strategy:
  1. Try AWS Rekognition Custom Labels (primary, owner-trained model)
  2. On any Rekognition error → fallback to Google Vision API PLANT_DETECTION
  3. Map Rekognition/Vision label → species table row (via rekognition_label column)
  4. Return top-5 candidates; confidence is normalised to 0.0–1.0
"""
import logging
from dataclasses import dataclass, field

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class SpeciesCandidate:
    species_id: int
    name_latin: str
    name_common_ru: str
    confidence: float  # 0.0–1.0


@dataclass
class CVResult:
    species_name: str       # latin name of top candidate
    species_id: int         # FK to species table (0 = unknown)
    confidence: float       # 0.0–1.0
    source: str             # "rekognition" | "vision_fallback" | "unknown"
    candidates: list[SpeciesCandidate] = field(default_factory=list)


_UNKNOWN = CVResult(
    species_name="Unknown",
    species_id=0,
    confidence=0.0,
    source="unknown",
    candidates=[],
)


class CVInferenceService:

    def __init__(self):
        settings = get_settings()
        self._project_arn = settings.AWS_REKOGNITION_PROJECT_ARN
        self._rekognition = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self._settings = settings

    # ---------------------------------------------------------------- public

    def analyze(self, image_bytes: bytes) -> CVResult:
        """
        Run the full inference pipeline.
        Falls back to Google Vision if Rekognition fails.
        """
        try:
            return self._rekognition_analyze(image_bytes)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("Rekognition error, falling back to Vision API: %s", exc)
            return self._vision_fallback(image_bytes)

    # ---------------------------------------------------------------- Rekognition

    def _rekognition_analyze(self, image_bytes: bytes) -> CVResult:
        response = self._rekognition.detect_custom_labels(
            ProjectVersionArn=self._project_arn,
            Image={"Bytes": image_bytes},
            MaxResults=5,
            MinConfidence=10,
        )
        raw_labels = response.get("CustomLabels", [])
        if not raw_labels:
            return _UNKNOWN

        # Map labels to species table rows in one query
        label_names = [l["Name"] for l in raw_labels]
        species_map = self._fetch_species_by_labels(label_names)

        candidates: list[SpeciesCandidate] = []
        for lbl in raw_labels:
            sp = species_map.get(lbl["Name"])
            candidates.append(
                SpeciesCandidate(
                    species_id=sp["id"] if sp else 0,
                    name_latin=sp["name_latin"] if sp else lbl["Name"],
                    name_common_ru=sp["name_common_ru"] if sp else "",
                    confidence=round(lbl["Confidence"] / 100, 3),
                )
            )

        top = candidates[0]
        return CVResult(
            species_name=top.name_latin,
            species_id=top.species_id,
            confidence=top.confidence,
            source="rekognition",
            candidates=candidates,
        )

    # ---------------------------------------------------------------- Google Vision fallback

    def _vision_fallback(self, image_bytes: bytes) -> CVResult:
        """
        Use Google Vision API PLANT_DETECTION as fallback.
        Requires GOOGLE_APPLICATION_CREDENTIALS env var or ADC to be set.
        """
        try:
            from google.cloud import vision  # type: ignore

            client = vision.ImageAnnotatorClient()
            image = vision.Image(content=image_bytes)
            response = client.annotate_image(
                {
                    "image": image,
                    "features": [
                        {"type_": vision.Feature.Type.LABEL_DETECTION, "max_results": 5}
                    ],
                }
            )
            if response.error.message:
                logger.error("Vision API error: %s", response.error.message)
                return _UNKNOWN

            labels = response.label_annotations
            if not labels:
                return _UNKNOWN

            label_names = [l.description for l in labels]
            species_map = self._fetch_species_by_labels(label_names)

            candidates: list[SpeciesCandidate] = []
            for lbl in labels:
                sp = species_map.get(lbl.description)
                candidates.append(
                    SpeciesCandidate(
                        species_id=sp["id"] if sp else 0,
                        name_latin=sp["name_latin"] if sp else lbl.description,
                        name_common_ru=sp["name_common_ru"] if sp else "",
                        confidence=round(lbl.score, 3),
                    )
                )

            top = candidates[0]
            return CVResult(
                species_name=top.name_latin,
                species_id=top.species_id,
                confidence=top.confidence,
                source="vision_fallback",
                candidates=candidates,
            )
        except Exception as exc:
            logger.error("Vision fallback failed: %s", exc)
            return _UNKNOWN

    # ---------------------------------------------------------------- DB helpers

    def _fetch_species_by_labels(self, label_names: list[str]) -> dict[str, dict]:
        """
        Query species table for all matching rekognition_label values.
        Returns {label_name: species_row} mapping.
        """
        if not label_names:
            return {}
        db = get_db()
        response = (
            db.table("species")
            .select("id, name_latin, name_common_ru, rekognition_label")
            .in_("rekognition_label", label_names)
            .execute()
        )
        return {row["rekognition_label"]: row for row in (response.data or [])}
