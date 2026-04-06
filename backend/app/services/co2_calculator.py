"""CO₂ calculator — IPCC Tier 1 methodology."""
from dataclasses import dataclass
from app.core.database import get_db


@dataclass
class CO2Result:
    avg_kg_year: float
    min_kg_year: float
    max_kg_year: float
    methodology: str = "IPCC Tier 1"
    version: str = "1.0"


def calculate_co2(species_id: int) -> CO2Result:
    """
    Fetch CO₂ coefficients from species table and return calculation result.
    Methodology: IPCC Tier 1, version 1.0
    """
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
        # Fallback: average broadleaf tree C02 estimate
        return CO2Result(avg_kg_year=22.0, min_kg_year=10.0, max_kg_year=48.0)

    return CO2Result(
        avg_kg_year=float(data["co2_kg_per_year_avg"]),
        min_kg_year=float(data["co2_kg_per_year_min"]),
        max_kg_year=float(data["co2_kg_per_year_max"]),
    )
