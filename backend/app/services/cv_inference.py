"""CV inference service — AWS Rekognition Custom Labels."""
import boto3
from dataclasses import dataclass
from app.core.config import get_settings


@dataclass
class CVResult:
    species_name: str
    species_id: int
    confidence: float  # 0.0–1.0
    candidates: list[dict]  # top-5 when confidence < 0.7


class CVInferenceService:

    def __init__(self):
        settings = get_settings()
        self._client = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self._project_arn = settings.AWS_REKOGNITION_PROJECT_ARN

    def analyze(self, image_bytes: bytes) -> CVResult:
        """Run photo through AWS Rekognition Custom Labels. Returns species + confidence."""
        response = self._client.detect_custom_labels(
            ProjectVersionArn=self._project_arn,
            Image={"Bytes": image_bytes},
            MaxResults=5,
            MinConfidence=10,
        )
        labels = response.get("CustomLabels", [])
        if not labels:
            return CVResult(
                species_name="Unknown",
                species_id=0,
                confidence=0.0,
                candidates=[],
            )

        top = labels[0]
        candidates = [
            {"name": l["Name"], "confidence": l["Confidence"] / 100}
            for l in labels
        ]

        return CVResult(
            species_name=top["Name"],
            species_id=0,  # TODO: map label → species table ID
            confidence=top["Confidence"] / 100,
            candidates=candidates,
        )
