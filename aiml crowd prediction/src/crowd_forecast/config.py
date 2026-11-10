"""Centralized configuration models for the crowd forecasting stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from pydantic import BaseModel, Field, field_validator


class MonthlyAnchor(BaseModel):
    """Monthly anchor values (visitors) for calibration."""

    month: str = Field(..., description="Month name in Title case, e.g., 'May'.")
    visitors: float = Field(..., gt=0)

    @field_validator("month")
    def _validate_month(cls, value: str) -> str:  # noqa: D401
        month_title = value.title()
        return month_title


class PeakAnchor(BaseModel):
    """Anchor for special peak windows such as festival bursts."""

    label: str
    duration_days: int = Field(..., gt=0)
    visitors: float = Field(..., gt=0)


class SiteAnchor(BaseModel):
    """Anchor collections for a single pilgrimage site."""

    annual_visitors: float = Field(..., gt=0)
    monthly_anchors: List[MonthlyAnchor] = Field(default_factory=list)
    peak_anchors: List[PeakAnchor] = Field(default_factory=list)


class FestivalSensitivity(BaseModel):
    """Per-site sensitivity coefficients for a festival."""

    site: str
    multiplier_mean: float = Field(..., gt=0)
    multiplier_std: float = Field(..., ge=0)


class FestivalDefinition(BaseModel):
    """Festival configuration entry."""

    name: str
    default_dates: List[str] = Field(
        default_factory=list,
        description="ISO date strings used when live calendar fetch is unavailable.",
    )
    sensitivities: List[FestivalSensitivity] = Field(default_factory=list)
    multiplier_range: List[float] = Field(default_factory=lambda: [0.6, 4.0])

    @field_validator("multiplier_range")
    def _validate_range(cls, value: List[float]) -> List[float]:
        if len(value) != 2:
            raise ValueError("multiplier_range must contain [min, max]")
        if value[0] <= 0 or value[1] <= 0 or value[0] >= value[1]:
            raise ValueError("multiplier_range must be positive with min < max")
        return value


class WeatherConfig(BaseModel):
    """Weather generation and impact configuration."""

    use_real_weather: bool = False
    temperature_bounds_c: Dict[str, List[float]] = Field(
        default_factory=lambda: {
            "winter": [12.0, 28.0],
            "summer": [28.0, 42.0],
            "monsoon": [24.0, 34.0],
        }
    )
    precipitation_ranges_mm: Dict[str, List[float]] = Field(
        default_factory=lambda: {
            "dry": [0.0, 1.0],
            "moderate": [1.0, 15.0],
            "heavy": [15.0, 60.0],
        }
    )
    modifiers: Dict[str, List[float]] = Field(
        default_factory=lambda: {
            "light_rain": [0.8, 0.9],
            "heavy_rain": [0.3, 0.7],
            "extreme_heat": [0.8, 0.95],
        }
    )


class NoiseConfig(BaseModel):
    """Noise and outlier parameters for synthetic generation."""

    distribution: str = Field("negative_binomial", pattern=r"^(poisson|negative_binomial)$")
    dispersion: float = Field(1.2, gt=0)
    outlier_probability: float = Field(0.01, ge=0, le=0.2)
    outlier_multiplier_range: List[float] = Field(default_factory=lambda: [1.5, 4.0])


class DiurnalPattern(BaseModel):
    """Per-site diurnal visitor share."""

    slots: Dict[str, float] = Field(
        default_factory=lambda: {
            "morning": 0.4,
            "midday": 0.2,
            "evening": 0.4,
        }
    )

    @field_validator("slots")
    def _validate_slots(cls, value: Dict[str, float]) -> Dict[str, float]:
        total = sum(value.values())
        if not abs(total - 1.0) <= 1e-6:
            raise ValueError("Diurnal pattern shares must sum to 1.0")
        return value


class SiteConfig(BaseModel):
    """Aggregate configuration for a site."""

    name: str
    anchors: SiteAnchor
    diurnal_pattern: DiurnalPattern = DiurnalPattern()
    weekend_multiplier_range: List[float] = Field(default_factory=lambda: [1.1, 1.4])


@dataclass
class AnchorConfig:
    """Convenience dataclass for anchor defaults."""

    sites: Dict[str, SiteConfig]


@dataclass
class FestivalConfig:
    festivals: List[FestivalDefinition]


@dataclass
class AppConfig:
    """Root configuration entry point for the application."""

    anchor: AnchorConfig = field(default_factory=lambda: AnchorConfig(sites=DEFAULT_SITE_CONFIGS))
    festival: FestivalConfig = field(default_factory=lambda: FestivalConfig(festivals=DEFAULT_FESTIVALS))
    weather: WeatherConfig = field(default_factory=WeatherConfig)
    noise: NoiseConfig = field(default_factory=NoiseConfig)

    @classmethod
    def from_yaml(cls, path: Path) -> "AppConfig":
        with path.open("r", encoding="utf-8") as handle:
            payload = yaml.safe_load(handle)

        anchor_sites = {
            name: SiteConfig(**config) for name, config in payload.get("anchor", {}).get("sites", {}).items()
        }

        festival_entries = [FestivalDefinition(**item) for item in payload.get("festival", {}).get("festivals", [])]

        weather_payload = payload.get("weather", {})
        noise_payload = payload.get("noise", {})

        return cls(
            anchor=AnchorConfig(sites=anchor_sites or DEFAULT_SITE_CONFIGS),
            festival=FestivalConfig(festivals=festival_entries or DEFAULT_FESTIVALS),
            weather=WeatherConfig(**weather_payload) if weather_payload else WeatherConfig(),
            noise=NoiseConfig(**noise_payload) if noise_payload else NoiseConfig(),
        )

    @classmethod
    def default(cls) -> "AppConfig":
        return cls()


# --- Default configuration payloads -------------------------------------------------------

DEFAULT_SITE_CONFIGS: Dict[str, SiteConfig] = {
    "Ambaji": SiteConfig(
        name="Ambaji",
        anchors=SiteAnchor(
            annual_visitors=1.65e7,
            monthly_anchors=[MonthlyAnchor(month="May", visitors=9.27e5)],
            peak_anchors=[PeakAnchor(label="Diwali_15_day", duration_days=15, visitors=1.208e6)],
        ),
    ),
    "Somnath": SiteConfig(
        name="Somnath",
        anchors=SiteAnchor(
            annual_visitors=9.793e6,
            monthly_anchors=[MonthlyAnchor(month="May", visitors=9.25e5)],
            peak_anchors=[PeakAnchor(label="Diwali_15_day", duration_days=15, visitors=8.66e5)],
        ),
    ),
    "Dwarka": SiteConfig(
        name="Dwarka",
        anchors=SiteAnchor(
            annual_visitors=8.354e6,
            monthly_anchors=[MonthlyAnchor(month="May", visitors=1.103e6)],
            peak_anchors=[PeakAnchor(label="Diwali_15_day", duration_days=15, visitors=1.343e6)],
        ),
    ),
    "Pavagadh": SiteConfig(
        name="Pavagadh",
        anchors=SiteAnchor(
            annual_visitors=7.666e6,
            monthly_anchors=[MonthlyAnchor(month="May", visitors=5.33e5)],
            peak_anchors=[PeakAnchor(label="Diwali_15_day", duration_days=15, visitors=8.92e5)],
        ),
    ),
}

DEFAULT_FESTIVALS: List[FestivalDefinition] = [
    FestivalDefinition(
        name="Navratri",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Ambaji", multiplier_mean=2.5, multiplier_std=0.6),
            FestivalSensitivity(site="Dwarka", multiplier_mean=1.8, multiplier_std=0.5),
            FestivalSensitivity(site="Somnath", multiplier_mean=1.4, multiplier_std=0.4),
            FestivalSensitivity(site="Pavagadh", multiplier_mean=2.0, multiplier_std=0.5),
        ],
    ),
    FestivalDefinition(
        name="Diwali",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Ambaji", multiplier_mean=2.2, multiplier_std=0.5),
            FestivalSensitivity(site="Dwarka", multiplier_mean=2.1, multiplier_std=0.5),
            FestivalSensitivity(site="Somnath", multiplier_mean=1.9, multiplier_std=0.4),
            FestivalSensitivity(site="Pavagadh", multiplier_mean=1.7, multiplier_std=0.4),
        ],
    ),
    FestivalDefinition(
        name="Janmashtami",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Dwarka", multiplier_mean=3.0, multiplier_std=0.7),
            FestivalSensitivity(site="Somnath", multiplier_mean=1.6, multiplier_std=0.4),
        ],
    ),
    FestivalDefinition(
        name="Maha Shivratri",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Somnath", multiplier_mean=2.8, multiplier_std=0.6),
            FestivalSensitivity(site="Ambaji", multiplier_mean=1.6, multiplier_std=0.3),
        ],
    ),
    FestivalDefinition(
        name="Bhadarvi Purnima",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Ambaji", multiplier_mean=3.2, multiplier_std=0.7),
        ],
    ),
    FestivalDefinition(
        name="Kartik Purnima",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Dwarka", multiplier_mean=2.2, multiplier_std=0.5),
            FestivalSensitivity(site="Somnath", multiplier_mean=1.5, multiplier_std=0.3),
        ],
    ),
    FestivalDefinition(
        name="Holi",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Dwarka", multiplier_mean=1.3, multiplier_std=0.3),
            FestivalSensitivity(site="Somnath", multiplier_mean=1.4, multiplier_std=0.3),
        ],
        multiplier_range=[0.6, 2.5],
    ),
    FestivalDefinition(
        name="Makar Sankranti",
        default_dates=[],
        sensitivities=[
            FestivalSensitivity(site="Pavagadh", multiplier_mean=1.8, multiplier_std=0.4),
            FestivalSensitivity(site="Ambaji", multiplier_mean=1.5, multiplier_std=0.3),
        ],
    ),
]
