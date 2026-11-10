from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

from crowd_forecast.capture import CameraConfig, DetectionSnapshot
from crowd_forecast.recording import ObservationRecorder


class StubWeatherProvider:
    def __init__(self) -> None:
        self.calls = []

    def get_weather(self, latitude: float, longitude: float):
        self.calls.append((latitude, longitude))
        return {
            "temperature_c": 31.2,
            "windspeed_ms": 4.5,
            "winddirection_deg": 120,
            "weather_code": 2,
            "weather_observed_at": dt.datetime(2025, 9, 29, 10, 0, tzinfo=dt.UTC).isoformat(),
        }


class StubLocationProvider:
    def __init__(self, latitude: float = 24.0, longitude: float = 72.0) -> None:
        self.latitude = latitude
        self.longitude = longitude
        self.calls = 0

    def get_location(self):
        self.calls += 1
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "city": "Test City",
            "region": "Test Region",
            "country": "Test Country",
            "timezone": "Asia/Kolkata",
            "source": "stub",
        }


def test_observation_recorder_appends_rows(tmp_path: Path):
    camera = CameraConfig(
        camera_id="cam-1",
        site="Ambaji",
        source="sim:1",
        stream_id="ambaji-stream",
        latitude=24.33,
        longitude=72.78,
        timezone="Asia/Kolkata",
    )

    snapshot = DetectionSnapshot(
        camera=camera,
        timestamp=dt.datetime(2025, 9, 29, 5, 30, tzinfo=dt.UTC),
        counts=[10, 12, 9],
        confidences=[0.7, 0.8, 0.75],
        events=[{"camera_id": "cam-1"}] * 3,
    )

    weather = StubWeatherProvider()
    output_path = tmp_path / "observations.csv"
    recorder = ObservationRecorder(output_path=output_path, weather_provider=weather, cache_minutes=10)

    class Batch:
        key = "camera_20250929_053000"
        snapshots = [snapshot]

    recorder.record_batch(Batch())

    assert output_path.exists()
    df = pd.read_csv(output_path)
    assert df.shape[0] == 1
    row = df.iloc[0]
    assert row["camera_id"] == "cam-1"
    assert row["detection_count"] == 10
    assert row["weather_temperature_c"] == 31.2
    assert row["location_source"] == "camera_config"
    assert row["time_of_day_period"] in {"day", "night"}
    assert weather.calls == [(24.33, 72.78)]


def test_observation_recorder_falls_back_to_location_provider(tmp_path: Path):
    camera = CameraConfig(
        camera_id="cam-2",
        site="Dwarka",
        source="sim:2",
        stream_id="dwarka-stream",
        latitude=None,
        longitude=None,
        timezone=None,
    )

    snapshot = DetectionSnapshot(
        camera=camera,
        timestamp=dt.datetime(2025, 9, 29, 6, 0, tzinfo=dt.UTC),
        counts=[5, 7],
        confidences=[0.6, 0.65],
        events=[],
    )

    weather = StubWeatherProvider()
    location = StubLocationProvider(latitude=24.5, longitude=72.2)
    output_path = tmp_path / "observations.csv"
    recorder = ObservationRecorder(
        output_path=output_path,
        weather_provider=weather,
        cache_minutes=1,
        location_provider=location,
    )

    class Batch:
        key = "camera_20250929_060000"
        snapshots = [snapshot]

    recorder.record_batch(Batch())
    df = pd.read_csv(output_path)
    row = df.iloc[0]
    assert row["latitude"] == location.latitude
    assert row["longitude"] == location.longitude
    assert row["location_city"] == "Test City"
    assert row["location_source"] == "geoip"
    assert location.calls == 1
    assert weather.calls == [(location.latitude, location.longitude)]


def test_location_lookup_cached_for_additional_batches(tmp_path: Path):
    camera = CameraConfig(
        camera_id="cam-3",
        site="Test",
        source="sim:3",
        stream_id="test-stream",
        latitude=None,
        longitude=None,
        timezone=None,
    )

    snapshot = DetectionSnapshot(
        camera=camera,
        timestamp=dt.datetime(2025, 9, 29, 6, 30, tzinfo=dt.UTC),
        counts=[8],
        confidences=[0.7],
        events=[],
    )

    weather = StubWeatherProvider()
    location = StubLocationProvider()
    output_path = tmp_path / "observations.csv"
    recorder = ObservationRecorder(
        output_path=output_path,
        weather_provider=weather,
        cache_minutes=1,
        location_provider=location,
    )

    class Batch:
        key = "camera_batch"
        snapshots = [snapshot]

    for _ in range(3):
        recorder.record_batch(Batch())

    assert location.calls == 1
    assert weather.calls == [(location.latitude, location.longitude)]


def test_observation_recorder_rewrites_header_when_schema_changes(tmp_path: Path):
    output_path = tmp_path / "observations.csv"
    old_columns = [
        "batch_key",
        "camera_id",
        "site",
        "stream_id",
        "ts_captured_utc",
        "ts_captured_local",
        "timezone",
        "latitude",
        "longitude",
        "detection_count",
        "detection_confidence",
        "frame_samples",
        "event_count",
        "recorded_at",
        "weather_temperature_c",
        "weather_windspeed_ms",
        "weather_winddirection_deg",
        "weather_code",
        "weather_observed_at",
    ]
    pd.DataFrame(
        [
            [
                "legacy_batch",
                "cam-legacy",
                "Legacy",
                "legacy-stream",
                "2025-09-29T05:00:00+00:00",
                "2025-09-29T10:30:00+05:30",
                "Asia/Kolkata",
                24.3,
                72.7,
                11,
                0.8,
                10,
                12,
                "2025-09-29T05:00:02+00:00",
                30.0,
                5.0,
                120,
                2,
                "2025-09-29T05:00:00+00:00",
            ]
        ],
        columns=old_columns,
    ).to_csv(output_path, index=False)

    camera = CameraConfig(
        camera_id="cam-new",
        site="Ambaji",
        source="sim:1",
        stream_id="ambaji-stream",
        latitude=24.33,
        longitude=72.78,
        timezone="Asia/Kolkata",
    )
    snapshot = DetectionSnapshot(
        camera=camera,
        timestamp=dt.datetime(2025, 9, 29, 6, 0, tzinfo=dt.UTC),
        counts=[7, 8],
        confidences=[0.75, 0.8],
        events=[{"camera_id": "cam-new"}],
    )

    weather = StubWeatherProvider()
    recorder = ObservationRecorder(output_path=output_path, weather_provider=weather, cache_minutes=5)

    class Batch:
        key = "camera_20250929_060000"
        snapshots = [snapshot]

    recorder.record_batch(Batch())

    df = pd.read_csv(output_path)
    assert "location_source" in df.columns
    assert df.loc[df["camera_id"] == "cam-new", "detection_count"].iloc[0] == 8
    assert df.loc[df["camera_id"] == "cam-new", "location_source"].iloc[0] == "camera_config"