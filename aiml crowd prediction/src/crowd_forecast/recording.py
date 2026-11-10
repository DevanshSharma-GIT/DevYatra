"""Utilities for recording enriched camera observations to CSV."""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import pandas as pd
import requests
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .capture import BatchOutput, DetectionSnapshot

LOGGER = logging.getLogger(__name__)

WeatherPayload = Dict[str, Any]
LocationPayload = Dict[str, Any]


@dataclass
class OpenMeteoWeatherProvider:
    """Fetch current weather using the Open-Meteo API."""

    timeout: float = 10.0

    _BASE_URL: str = "https://api.open-meteo.com/v1/forecast"

    def get_weather(self, latitude: float, longitude: float) -> Optional[WeatherPayload]:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current_weather": "true",
            "timezone": "UTC",
        }
        response = requests.get(self._BASE_URL, params=params, timeout=self.timeout)
        response.raise_for_status()
        payload = response.json()
        current = payload.get("current_weather") or {}
        if not current:
            return None

        observed_time = current.get("time")
        observed_iso = None
        if observed_time:
            try:
                if observed_time.endswith("Z"):
                    observed_iso = observed_time
                else:
                    observed_dt = dt.datetime.fromisoformat(observed_time)
                    if observed_dt.tzinfo is None:
                        observed_dt = observed_dt.replace(tzinfo=dt.UTC)
                    observed_iso = observed_dt.astimezone(dt.UTC).isoformat()
            except ValueError:
                observed_iso = observed_time

        return {
            "temperature_c": current.get("temperature"),
            "windspeed_ms": current.get("windspeed"),
            "winddirection_deg": current.get("winddirection"),
            "weather_code": current.get("weathercode"),
            "weather_observed_at": observed_iso,
        }


@dataclass
class GeoIpLocationProvider:
    """Resolve coarse latitude/longitude using the host's public IP address."""

    timeout: float = 5.0
    endpoint: str = "https://ipapi.co/json/"

    def get_location(self) -> Optional[LocationPayload]:
        response = requests.get(self.endpoint, timeout=self.timeout)
        response.raise_for_status()
        payload = response.json() or {}

        lat_value = payload.get("latitude") or payload.get("lat")
        lon_value = payload.get("longitude") or payload.get("lon")
        if lat_value is None or lon_value is None:
            return None

        try:
            latitude = float(lat_value)
            longitude = float(lon_value)
        except (TypeError, ValueError):
            return None

        return {
            "latitude": latitude,
            "longitude": longitude,
            "city": payload.get("city"),
            "region": payload.get("region") or payload.get("region_name"),
            "country": payload.get("country_name") or payload.get("country"),
            "timezone": payload.get("timezone"),
            "source": payload.get("ip") or "ipapi",
        }


class ObservationRecorder:
    """Append per-camera observation rows enriched with weather and time metadata."""

    def __init__(
        self,
        output_path: Path | str,
        weather_provider: Optional[OpenMeteoWeatherProvider] = None,
        cache_minutes: float = 5,
        location_provider: Optional[GeoIpLocationProvider] = None,
    ) -> None:
        self.output_path = Path(output_path)
        self.weather_provider = weather_provider
        self.cache_ttl = dt.timedelta(minutes=cache_minutes)
        self.location_provider = location_provider
        self._weather_cache: Dict[Tuple[float, float], Tuple[dt.datetime, WeatherPayload]] = {}
        self._location_cache: Optional[Tuple[dt.datetime, LocationPayload]] = None

    def record_batch(self, batch: BatchOutput) -> None:
        snapshots = batch.snapshots or []
        if not snapshots:
            return

        rows = []
        for snapshot in snapshots:
            row = self._build_row(batch.key, snapshot)
            if row:
                rows.append(row)

        if not rows:
            return

        df = pd.DataFrame(rows)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        if self.output_path.exists():
            try:
                existing_columns = pd.read_csv(self.output_path, nrows=0).columns.tolist()
            except Exception as exc:  # pragma: no cover - corrupted header edge case
                LOGGER.warning("Failed reading header from %s (%s); rewriting file", self.output_path, exc)
                existing_columns = []

            if existing_columns != df.columns.tolist():
                LOGGER.info(
                    "Observation schema changed from %s to %s; rewriting %s",
                    existing_columns,
                    df.columns.tolist(),
                    self.output_path,
                )
                try:
                    prior = pd.read_csv(self.output_path)
                except Exception as exc:  # pragma: no cover - corrupted file edge case
                    LOGGER.warning("Failed loading existing observations (%s); starting fresh", exc)
                    prior = pd.DataFrame(columns=df.columns)
                combined = pd.concat([prior, df], ignore_index=True)
                combined = combined.reindex(columns=df.columns)
                combined.to_csv(self.output_path, index=False)
                return

            df.to_csv(self.output_path, mode="a", header=False, index=False)
        else:
            df.to_csv(self.output_path, index=False)

    def _build_row(self, batch_key: str, snapshot: DetectionSnapshot) -> Optional[Dict[str, Any]]:
        record = snapshot.to_record()
        camera = snapshot.camera
        ts_utc = snapshot.timestamp
        if ts_utc.tzinfo is None:
            ts_utc = ts_utc.replace(tzinfo=dt.UTC)

        local_iso = None
        if camera.timezone:
            try:
                zone = ZoneInfo(camera.timezone)
                local_iso = ts_utc.astimezone(zone).isoformat()
            except ZoneInfoNotFoundError:
                LOGGER.warning("Unknown timezone '%s' for camera %s", camera.timezone, camera.camera_id)

        lat = camera.latitude
        lon = camera.longitude
        location_source = "camera_config" if lat is not None and lon is not None else None
        location_details: Dict[str, Any] = {}

        if (lat is None or lon is None) and self.location_provider:
            location_details = self._get_location()
            lat = lat if lat is not None else location_details.get("latitude")
            lon = lon if lon is not None else location_details.get("longitude")
            if lat is not None and lon is not None and location_details:
                location_source = "geoip"
        elif self.location_provider:
            # still expose metadata from provider once to enrich rows even when config supplies coords
            location_details = self._get_location() or {}

        weather_data: Dict[str, Any] = {}
        if self.weather_provider and lat is not None and lon is not None:
            weather_data = self._get_weather(lat, lon)

        local_hour, time_period, is_daytime = self._derive_time_features(ts_utc, camera.timezone)

        base_row = {
            "batch_key": batch_key,
            "camera_id": record.get("camera_id"),
            "site": record.get("site"),
            "stream_id": record.get("stream_id"),
            "ts_captured_utc": record.get("ts"),
            "ts_captured_local": local_iso,
            "timezone": camera.timezone,
            "latitude": lat,
            "longitude": lon,
            "location_source": location_source,
            "location_city": location_details.get("city") if location_details else None,
            "location_region": location_details.get("region") if location_details else None,
            "location_country": location_details.get("country") if location_details else None,
            "detection_count": record.get("detection_count"),
            "detection_confidence": record.get("detection_confidence"),
            "frame_samples": record.get("frame_samples"),
            "event_count": record.get("event_count"),
            "local_hour": local_hour,
            "time_of_day_period": time_period,
            "is_daytime": is_daytime,
            "recorded_at": dt.datetime.now(dt.UTC).isoformat(),
        }

        weather_enrichment = {
            "weather_temperature_c": weather_data.get("temperature_c") if weather_data else None,
            "weather_windspeed_ms": weather_data.get("windspeed_ms") if weather_data else None,
            "weather_winddirection_deg": weather_data.get("winddirection_deg") if weather_data else None,
            "weather_code": weather_data.get("weather_code") if weather_data else None,
            "weather_observed_at": weather_data.get("weather_observed_at") if weather_data else None,
        }

        base_row.update(weather_enrichment)
        return base_row

    def _get_weather(self, latitude: float, longitude: float) -> Dict[str, Any]:
        cache_key = (round(latitude, 4), round(longitude, 4))
        now = dt.datetime.now(dt.UTC)
        cached = self._weather_cache.get(cache_key)
        if cached and now - cached[0] < self.cache_ttl:
            return cached[1]

        try:
            payload = self.weather_provider.get_weather(latitude, longitude) if self.weather_provider else None
        except Exception as exc:  # pragma: no cover - network errors are unpredictable
            LOGGER.warning("Weather fetch failed for lat=%s lon=%s: %s", latitude, longitude, exc)
            return {}

        if payload:
            self._weather_cache[cache_key] = (now, payload)
            return payload

        return {}

    def _get_location(self) -> Optional[LocationPayload]:
        if not self.location_provider:
            return None

        now = dt.datetime.now(dt.UTC)
        if self._location_cache and now - self._location_cache[0] < dt.timedelta(hours=1):
            return self._location_cache[1]

        try:
            payload = self.location_provider.get_location()
        except Exception as exc:  # pragma: no cover - depends on network availability
            LOGGER.warning("Location lookup failed: %s", exc)
            return None

        if payload:
            # ensure timezone information is consistent when provided by provider
            self._location_cache = (now, payload)
        return payload

    def _derive_time_features(self, timestamp: dt.datetime, timezone_name: Optional[str]) -> Tuple[Optional[int], Optional[str], Optional[bool]]:
        local_dt = timestamp
        if timezone_name:
            try:
                zone = ZoneInfo(timezone_name)
                local_dt = timestamp.astimezone(zone)
            except ZoneInfoNotFoundError:
                LOGGER.warning("Unknown timezone '%s' while deriving time features", timezone_name)
        elif self.location_provider and self._location_cache:
            tz_name = self._location_cache[1].get("timezone")
            if tz_name:
                try:
                    zone = ZoneInfo(tz_name)
                    local_dt = timestamp.astimezone(zone)
                except ZoneInfoNotFoundError:
                    LOGGER.warning("Unknown timezone '%s' supplied by location provider", tz_name)

        hour = local_dt.hour if local_dt.tzinfo else None
        period = None
        is_day = None
        if hour is not None:
            if 6 <= hour < 18:
                period = "day"
                is_day = True
            else:
                period = "night"
                is_day = False
        return hour, period, is_day