"""
CO₂ calculator — IPCC Tier 1 methodology.

Coefficients are stored in the `species` table (seeded in database/seed.sql).
Formula:  co2_kg_year = species.co2_kg_per_year_avg
The certificate always states: "Методология: IPCC Tier 1, версия 1.0"
"""
import logging
from dataclasses import dataclass

from app.core.database import get_db

logger = logging.getLogger(__name__)

# Fallback coefficients when species is unknown (average broadleaf tree)
_FALLBACK_AVG = 22.0
_FALLBACK_MIN = 10.0
_FALLBACK_MAX = 48.0


@dataclass
class CO2Result:
    avg_kg_year: float
    min_kg_year: float
    max_kg_year: float
    methodology: str = "IPCC Tier 1"
    version: str = "1.0"

    @property
    def display_str(self) -> str:
        return f"{self.avg_kg_year:.1f} кг CO₂/год (IPCC Tier 1 v{self.version})"


def calculate_co2(species_id: int) -> CO2Result:
    """
    Fetch CO₂ coefficients from the species table.
    Falls back to average broadleaf values if species_id is 0 or not found.
    """
    if species_id == 0:
        logger.info("calculate_co2: unknown species, using fallback coefficients")
        return CO2Result(
            avg_kg_year=_FALLBACK_AVG,
            min_kg_year=_FALLBACK_MIN,
            max_kg_year=_FALLBACK_MAX,
        )

    db = get_db()
    response = (
        db.table("species")
        .select("co2_kg_per_year_avg, co2_kg_per_year_min, co2_kg_per_year_max")
        .eq("id", species_id)
        .single()
        .execute()
    )
    data = response.data
    if not data:
        logger.warning("calculate_co2: species_id=%d not found, using fallback", species_id)
        return CO2Result(
            avg_kg_year=_FALLBACK_AVG,
            min_kg_year=_FALLBACK_MIN,
            max_kg_year=_FALLBACK_MAX,
        )

    return CO2Result(
        avg_kg_year=float(data["co2_kg_per_year_avg"]),
        min_kg_year=float(data["co2_kg_per_year_min"]),
        max_kg_year=float(data["co2_kg_per_year_max"]),
    )
