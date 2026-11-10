"""Synthetic data generation pipeline for Gujarat pilgrimage crowd forecasting."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

from .config import AppConfig, FestivalDefinition, FestivalSensitivity, SiteConfig

SYNTHETIC_VERSION = "synthetic:v1"

SEASONAL_WEATHER_OPTIONS: Dict[str, List[Tuple[str, float]]] = {
    "summer": [
        ("Sunny", 0.45),
        ("Hot", 0.25),
        ("Humid", 0.15),
        ("Windy", 0.15),
    ],
    "monsoon": [
        ("Light Rain", 0.4),
        ("Showers", 0.25),
        ("Cloudy", 0.2),
        ("Thunderstorm", 0.15),
    ],
    "winter": [
        ("Pleasant", 0.4),
        ("Misty", 0.2),
        ("Cool", 0.25),
        ("Foggy", 0.15),
    ],
}


@dataclass
class SyntheticGenerationSettings:
    """Runtime toggles for the synthetic generator."""

    years: int = 3
    start_year: Optional[int] = None
    include_hourly: bool = False
    hourly_slot_minutes: int = 60
    global_tolerance: float = 0.1
    enable_weather: bool = True
    enable_outliers: bool = True
    record_booked_slots: bool = False
    festival_behaviour_scale: float = 1.0
    log_metadata: bool = True

    def resolve_start_year(self) -> int:
        if self.start_year is not None:
            return self.start_year
        current_year = datetime.utcnow().year
        return current_year - self.years


@dataclass
class GenerationMetadata:
    seed: int
    version: str = SYNTHETIC_VERSION
    data_sources: List[str] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)


def _month_name_to_number(name: str) -> int:
    dt = datetime.strptime(name[:3], "%b")
    return dt.month


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - date(year, month, 1)).days


_FALLBACK_FESTIVAL_WINDOWS: Dict[str, Tuple[Tuple[int, int], int]] = {
    "Navratri": ((10, 1), 9),
    "Diwali": ((11, 5), 5),
    "Janmashtami": ((8, 18), 2),
    "Maha Shivratri": ((3, 1), 1),
    "Bhadarvi Purnima": ((9, 15), 1),
    "Kartik Purnima": ((11, 25), 1),
    "Holi": ((3, 20), 2),
    "Makar Sankranti": ((1, 14), 1),
}


def _resolve_festival_dates(
    festival: FestivalDefinition,
    year: int,
    rng: np.random.Generator,
) -> List[date]:
    dates: List[date] = []
    if festival.default_dates:
        for iso in festival.default_dates:
            base = datetime.fromisoformat(iso)
            dates.append(date(year, base.month, base.day))
        return dates

    window = _FALLBACK_FESTIVAL_WINDOWS.get(festival.name)
    if not window:
        # Unknown festival: default to a single day in mid-year.
        dates.append(date(year, 7, 1))
        return dates

    (month, day), duration = window
    base_day_variation = rng.integers(-3, 4)
    start_day = max(1, day + int(base_day_variation))
    start_date = date(year, month, min(start_day, _days_in_month(year, month)))
    for offset in range(duration):
        event_date = start_date + timedelta(days=offset)
        if event_date.year == year:
            dates.append(event_date)
    return dates


def _create_festival_calendar(
    config: AppConfig,
    years: Iterable[int],
    rng: np.random.Generator,
) -> Dict[date, Dict[str, Dict[str, float]]]:
    """Map each date to site-specific festival metadata."""

    calendar: Dict[date, Dict[str, Dict[str, float]]] = {}
    for year in years:
        for festival in config.festival.festivals:
            festival_dates = _resolve_festival_dates(festival, year, rng)
            for event_date in festival_dates:
                if event_date not in calendar:
                    calendar[event_date] = {}
                for site_def in festival.sensitivities:
                    multiplier = _draw_festival_multiplier(site_def, festival, rng)
                    calendar[event_date][site_def.site] = {
                        "festival_name": festival.name,
                        "multiplier": multiplier,
                    }
    return calendar


def _draw_festival_multiplier(
    sensitivity: FestivalSensitivity,
    festival: FestivalDefinition,
    rng: np.random.Generator,
) -> float:
    low, high = festival.multiplier_range
    mean = sensitivity.multiplier_mean
    std = max(sensitivity.multiplier_std, 1e-3)
    # Convert mean/std into log-normal params.
    variance = std ** 2
    mu = np.log((mean ** 2) / np.sqrt(variance + mean ** 2))
    sigma = np.sqrt(np.log(variance / (mean ** 2) + 1))
    sample = rng.lognormal(mean=mu, sigma=sigma)
    return float(np.clip(sample, low, high))


def _monsoon_month(month: int) -> bool:
    return month in {6, 7, 8, 9}


def _summer_month(month: int) -> bool:
    return month in {3, 4, 5}


def _season_for_month(month: int) -> str:
    if _monsoon_month(month):
        return "monsoon"
    if _summer_month(month):
        return "summer"
    return "winter"


def _sample_weighted(options: List[Tuple[str, float]], rng: np.random.Generator) -> str:
    labels, weights = zip(*options)
    probs = np.array(weights, dtype=float)
    probs /= probs.sum()
    return str(rng.choice(labels, p=probs))


def _categorize_weather(day: date, temperature: float, precipitation: float, rng: np.random.Generator) -> str:
    if precipitation >= 30.0:
        return "Heavy Rain"
    if precipitation >= 5.0:
        return "Rain"
    if precipitation >= 1.0:
        return "Light Rain"

    season = _season_for_month(day.month)

    if temperature >= 38.0:
        return "Scorching"
    if temperature <= 15.0 and season != "summer":
        return "Chilly"

    options = SEASONAL_WEATHER_OPTIONS.get(season)
    if not options:
        return "Clear"
    return _sample_weighted(options, rng)


def _generate_weather(day: date, settings: SyntheticGenerationSettings, config: AppConfig, rng: np.random.Generator) -> Tuple[float, float, float]:
    if not settings.enable_weather:
        return 30.0, 0.0, 1.0

    season = _season_for_month(day.month)
    temp_range = config.weather.temperature_bounds_c.get(season, [22.0, 34.0])
    temperature = rng.uniform(temp_range[0], temp_range[1])

    precip_profile = config.weather.precipitation_ranges_mm
    if _monsoon_month(day.month):
        precip_bucket = "heavy" if rng.random() < 0.4 else "moderate"
    else:
        precip_bucket = "moderate" if rng.random() < 0.2 else "dry"
    precip_range = precip_profile.get(precip_bucket, [0.0, 1.0])
    precipitation = rng.uniform(precip_range[0], precip_range[1])

    modifier = 1.0
    if precipitation >= 15.0:
        mod_low, mod_high = config.weather.modifiers.get("heavy_rain", [0.3, 0.7])
        modifier *= rng.uniform(mod_low, mod_high)
    elif precipitation >= 3.0:
        mod_low, mod_high = config.weather.modifiers.get("light_rain", [0.8, 0.95])
        modifier *= rng.uniform(mod_low, mod_high)

    if temperature >= 38.0:
        heat_low, heat_high = config.weather.modifiers.get("extreme_heat", [0.8, 0.95])
        modifier *= rng.uniform(heat_low, heat_high)

    return float(temperature), float(precipitation), float(modifier)


def _prepare_month_multipliers(site_config: SiteConfig) -> Dict[int, float]:
    base_daily = site_config.anchors.annual_visitors / 365.0
    multipliers = {month: 1.0 for month in range(1, 13)}
    for monthly in site_config.anchors.monthly_anchors:
        month_idx = _month_name_to_number(monthly.month)
        days = _days_in_month(2024, month_idx)  # year agnostic approximation
        target_daily = monthly.visitors / days
        multiplier = target_daily / base_daily
        multipliers[month_idx] = multiplier
    return multipliers


def _apply_noise(
    mean_count: float,
    rng: np.random.Generator,
    noise_cfg,
) -> float:
    if mean_count <= 0:
        return 0.0

    if noise_cfg.distribution == "poisson":
        return float(rng.poisson(mean_count))

    # Negative binomial via Gamma-Poisson mixture to support non-integer dispersion.
    shape = noise_cfg.dispersion
    scale = mean_count / max(shape, 1e-6)
    lam = rng.gamma(shape=shape, scale=scale)
    return float(rng.poisson(lam))


def _inject_outlier(value: float, rng: np.random.Generator, noise_cfg) -> float:
    if value <= 0:
        return 0.0
    if rng.random() > noise_cfg.outlier_probability:
        return value
    low, high = noise_cfg.outlier_multiplier_range
    multiplier = rng.uniform(low, high)
    return float(value * multiplier)


def generate_synthetic_dataset(
    config: Optional[AppConfig] = None,
    settings: Optional[SyntheticGenerationSettings] = None,
    seed: int = 1234,
) -> Tuple[pd.DataFrame, GenerationMetadata]:
    """Generate a synthetic visitor dataset.

    Parameters
    ----------
    config:
        Optional application configuration. If omitted, defaults are used.
    settings:
        Runtime generation settings overriding defaults.
    seed:
        RNG seed for reproducibility.
    """

    configuration = config or AppConfig.default()
    generator_settings = settings or SyntheticGenerationSettings()
    start_year = generator_settings.resolve_start_year()
    years = [start_year + idx for idx in range(generator_settings.years)]

    rng = np.random.default_rng(seed)

    festival_calendar = _create_festival_calendar(configuration, years, rng)

    records: List[Dict[str, object]] = []

    for site_name, site_config in configuration.anchor.sites.items():
        monthly_multipliers = _prepare_month_multipliers(site_config)
        base_daily_mean = site_config.anchors.annual_visitors / 365.0
        weekend_low, weekend_high = site_config.weekend_multiplier_range

        for year in years:
            current_date = date(year, 1, 1)
            while current_date.year == year:
                month_multiplier = monthly_multipliers.get(current_date.month, 1.0)
                is_weekend = int(current_date.weekday() >= 5)
                weekend_factor = 1.0
                if is_weekend:
                    weekend_factor = rng.uniform(weekend_low, weekend_high)

                base_estimate = base_daily_mean * month_multiplier * weekend_factor

                festival_meta = festival_calendar.get(current_date, {}).get(site_name)
                festival_multiplier = 1.0
                festival_name = ""
                is_festival = 0
                if festival_meta:
                    festival_multiplier = festival_meta["multiplier"] * generator_settings.festival_behaviour_scale
                    festival_name = festival_meta["festival_name"]
                    is_festival = 1

                temperature, precipitation, weather_modifier = _generate_weather(
                    current_date, generator_settings, configuration, rng
                )

                expected_count = base_estimate * festival_multiplier
                if generator_settings.enable_weather:
                    expected_count *= weather_modifier

                noisy_count = _apply_noise(expected_count, rng, configuration.noise)
                if generator_settings.enable_outliers:
                    noisy_count = _inject_outlier(noisy_count, rng, configuration.noise)

                daily_total = max(int(round(noisy_count)), 0)

                weather_label = _categorize_weather(current_date, temperature, precipitation, rng)

                ticket_multiplier = rng.uniform(0.96, 1.08)
                tickets_total = int(round(daily_total * ticket_multiplier))
                tickets_total = max(tickets_total, daily_total)
                if is_festival:
                    tickets_total = int(round(tickets_total * rng.uniform(1.02, 1.12)))

                digital_ratio = rng.uniform(0.35, 0.6)
                if is_weekend:
                    digital_ratio += rng.uniform(0.05, 0.1)
                if is_festival:
                    digital_ratio += rng.uniform(0.1, 0.18)
                digital_ratio = float(np.clip(digital_ratio, 0.3, 0.92))
                tickets_digital = int(round(tickets_total * digital_ratio))
                tickets_offline = max(tickets_total - tickets_digital, 0)

                base_record = {
                    "site": site_name,
                    "date": current_date.isoformat(),
                    "day_of_week": current_date.weekday(),
                    "is_weekend": is_weekend,
                    "is_festival": is_festival,
                    "festival_name": festival_name,
                    "weather_temp_c": temperature,
                    "weather_precip_mm": precipitation,
                    "weather_forecast": weather_label,
                    "booked_slots": 0 if not generator_settings.record_booked_slots else rng.integers(0, 500),
                    "source": SYNTHETIC_VERSION,
                    "seed": seed,
                    "tickets_digital": tickets_digital,
                    "tickets_offline": tickets_offline,
                }

                if generator_settings.include_hourly:
                    hourly_records = _expand_hourly_records(
                        base_record,
                        daily_total,
                        site_config,
                        generator_settings,
                        rng,
                    )
                    records.extend(hourly_records)
                else:
                    base_record.update(
                        {
                            "time_slot": "ALL",
                            "visitor_count": daily_total,
                        }
                    )
                    records.append(base_record)

                current_date += timedelta(days=1)

    df = pd.DataFrame.from_records(records)

    df = _enforce_global_scaling(df, configuration, generator_settings.global_tolerance)

    metadata = GenerationMetadata(
        seed=seed,
        data_sources=[],
        assumptions=[
            "Festival dates generated via fallback synthetic calendar.",
            "Weather simulated with seasonal heuristics; no external API used.",
        ],
    )

    return df, metadata


def _expand_hourly_records(
    base_record: Dict[str, object],
    daily_total: int,
    site_config: SiteConfig,
    settings: SyntheticGenerationSettings,
    rng: np.random.Generator,
) -> List[Dict[str, object]]:
    shares = site_config.diurnal_pattern.slots
    hour_blocks = {
        "morning": list(range(5, 11)),
        "midday": list(range(11, 15)),
        "evening": list(range(15, 21)),
    }

    hourly_records: List[Dict[str, object]] = []
    remaining = daily_total

    for block, share in shares.items():
        hours = hour_blocks.get(block, [])
        if not hours:
            continue
        block_total = int(round(daily_total * share))
        block_weights = rng.dirichlet(alpha=[1.0] * len(hours))
        for hour_idx, weight in zip(hours, block_weights):
            count = int(round(block_total * weight))
            remaining -= count
            record = base_record.copy()
            record.update(
                {
                    "time_slot": f"{hour_idx:02d}:00",
                    "visitor_count": max(count, 0),
                }
            )
            hourly_records.append(record)

    # Distribute any leftover visitors randomly.
    while remaining > 0 and hourly_records:
        target = rng.integers(0, len(hourly_records))
        hourly_records[target]["visitor_count"] += 1
        remaining -= 1

    return hourly_records


def _enforce_global_scaling(df: pd.DataFrame, config: AppConfig, tolerance: float) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()
    if "time_slot" in df.columns and df["time_slot"].ne("ALL").any():
        daily = (
            df.groupby(["site", "date"], as_index=False)["visitor_count"].sum().rename(columns={"visitor_count": "daily_visitors"})
        )
        scaled_daily = _scale_daily_totals(daily, config, tolerance)
        df = df.merge(scaled_daily, on=["site", "date"], how="left", suffixes=("", "_scaled"))
        group_sum = df.groupby(["site", "date"])["visitor_count"].transform("sum").replace({0: 1})
        scale_factor = df["daily_visitors_scaled"] / group_sum
        df["visitor_count"] = (df["visitor_count"] * scale_factor).round().clip(lower=0).astype(int)
        df.drop(columns="daily_visitors_scaled", inplace=True)
        return df

    # Daily data only
    totals = df.groupby("site")["visitor_count"].sum()
    adjustments: Dict[str, float] = {}
    for site, total in totals.items():
        anchor = config.anchor.sites[site].anchors.annual_visitors * (df[df["site"] == site]["date"].nunique() / 365.0)
        if anchor <= 0:
            continue
        ratio = anchor / max(total, 1e-6)
        if abs(1 - ratio) > tolerance:
            adjustments[site] = ratio

    if not adjustments:
        return df

    df["visitor_count"] = df.apply(
        lambda row: int(round(row["visitor_count"] * adjustments.get(row["site"], 1.0))), axis=1
    )
    return df


def _scale_daily_totals(daily: pd.DataFrame, config: AppConfig, tolerance: float) -> pd.DataFrame:
    daily = daily.copy()
    daily["year"] = pd.to_datetime(daily["date"]).dt.year

    for site, site_df in daily.groupby("site"):
        anchor = config.anchor.sites[site].anchors.annual_visitors
        year_counts = site_df.groupby("year")["daily_visitors"].sum()
        for year, observed in year_counts.items():
            ratio = anchor / max(observed, 1e-6)
            if abs(1 - ratio) > tolerance:
                mask = (daily["site"] == site) & (daily["year"] == year)
                daily.loc[mask, "daily_visitors"] = (
                    daily.loc[mask, "daily_visitors"] * ratio
                )
    daily.drop(columns="year", inplace=True)
    return daily


def save_dataset(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)


__all__ = [
    "SyntheticGenerationSettings",
    "GenerationMetadata",
    "generate_synthetic_dataset",
    "save_dataset",
    "SYNTHETIC_VERSION",
]
