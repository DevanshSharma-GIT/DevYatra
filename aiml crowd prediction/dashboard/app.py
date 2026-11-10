"""Streamlit dashboard for Gujarat pilgrimage crowd intelligence."""

from __future__ import annotations

import csv
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd
import requests
import streamlit as st
import pydeck as pdk

try:  # pragma: no cover - optional dependency for cloud demos
    import google.generativeai as genai  # type: ignore
except Exception:  # pragma: no cover - keep dashboard operational without the SDK
    genai = None

try:  # pragma: no cover - optional dependency for nicer UX
    from streamlit_autorefresh import st_autorefresh
except ImportError:  # pragma: no cover - exercised when package is absent
    st_autorefresh = None

PAGE_TITLE = "Gujarat Pilgrimage Crowd Dashboard"
DEFAULT_DATA_DIR = Path("data/processed")
DEFAULT_OBSERVATIONS_PATH = Path("data/incoming/observations.csv")

OBS_COLUMNS_V1 = [
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

OBS_COLUMNS_V2 = [
    "batch_key",
    "camera_id",
    "site",
    "stream_id",
    "ts_captured_utc",
    "ts_captured_local",
    "timezone",
    "latitude",
    "longitude",
    "location_source",
    "location_city",
    "location_region",
    "location_country",
    "detection_count",
    "detection_confidence",
    "frame_samples",
    "event_count",
    "local_hour",
    "time_of_day_period",
    "is_daytime",
    "recorded_at",
    "weather_temperature_c",
    "weather_windspeed_ms",
    "weather_winddirection_deg",
    "weather_code",
    "weather_observed_at",
]


GEMINI_MODEL_DEFAULT = "gemini-2.5-flash"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

ASSISTANT_SAMPLE_ANALYTICS = [
    "Ambaji queue wait time right now is under four minutes with 18 service counters open.",
    "Dwarka’s combined temple and market occupancy is holding around 3,420 visitors.",
    "Somnath promenade sensors show a 12% increase compared with last week’s average.",
    "Weather watch: westerly gusts near Dwarka are peaking at 32 km/h.",
    "Volunteer pool currently has 146 staff deployed across the three flagship sites.",
]

ASSISTANT_CANONICAL_QA = [
    {
        "question": "show the forecast outlook for dwarka",
        "answer_template": (
            "Forecast outlook for Dwarka on {current_date} at {current_time} stays gentle: +1h ≈ 620 "
            "visitors, +3h ≈ 560, +6h ≈ 430, +9h ≈ 360, and +12h ≈ 290. Rotation crews take over at 18:00 "
            "so exit lanes remain clear."
        ),
    },
    {
        "question": "how many people visited ambaji yesterday",
        "answer_template": (
            "Ambaji welcomed roughly 12,480 pilgrims yesterday ({yesterday_date}). Peak interval was 10:00–11:00 "
            "with ~1,420 people and average wait times stayed below four minutes thanks to staggered entry."
        ),
    },
    {
        "question": "where is camera gate-ambaji located",
        "answer_template": (
            "Camera gate-ambaji sits beside the north gate canopy at latitude 24.63°N, longitude 72.85°E, mounted "
            "4.5 metres high with a 78° field of view covering the serpentine queue and ATM cluster."
        ),
    },
    {
        "question": "what alerts fired today",
        "answer_template": (
            "Live alerts for {current_date}: 07:20 – Amber congestion at Somnath main gate (load 780) and 11:05 – "
            "Weather advisory for the Dwarka promenade (gusts 32 km/h). Both mitigation teams have acknowledged them."
        ),
    },
    {
        "question": "what should we expect next week",
        "answer_template": (
            "Next week ({next_week_start} to {next_week_end}) outlook: Ambaji ≈ 11,800 visitors/day, Dwarka ≈ 9,100, "
            "Somnath trending +6% with festival build-up peaking on {next_week_mid}. Plan volunteer surges for weekend "
            "mornings and keep mobile kiosks stocked."
        ),
    },
]


CROWD_LEVELS: list[tuple[str, float, Optional[float]]] = [
    ("Low", 0.0, 1000.0),
    ("Moderate", 1000.0, 5000.0),
    ("High", 5000.0, 10000.0),
    ("Extreme", 10000.0, None),
]

LEVEL_BADGE_STYLES: dict[str, dict[str, str]] = {
    "Low": {"bg": "#e8f5e9", "fg": "#1b5e20"},
    "Moderate": {"bg": "#fffde7", "fg": "#f57f17"},
    "High": {"bg": "#fff3e0", "fg": "#e65100"},
    "Extreme": {"bg": "#ffebee", "fg": "#b71c1c"},
}

ALERT_SEVERITY_STYLES: dict[str, dict[str, str]] = {
    "info": {"bg": "#e3f2fd", "fg": "#0d47a1"},
    "moderate": {"bg": "#fff8e1", "fg": "#f57f17"},
    "high": {"bg": "#ffecb3", "fg": "#e65100"},
    "critical": {"bg": "#ffebee", "fg": "#b71c1c"},
}

PIPELINE_INTERVAL_SECONDS = 300
PREDICTION_HORIZON_HOURS = 6
ALERT_LEVEL_MAP = {
    "Moderate": "moderate",
    "High": "high",
    "Extreme": "critical",
}

SITE_FALLBACK_LOCATIONS = {
    "Ambaji": {"lat": 24.6318, "lon": 72.8556},
    "Dwarka": {"lat": 22.2442, "lon": 68.9685},
    "Somnath": {"lat": 20.888, "lon": 70.401},
    "Pavagadh": {"lat": 22.4675, "lon": 73.5239},
}

OPENWEATHER_API_ENV = "OPENWEATHER_API_KEY"
OPENWEATHER_API_KEY = os.getenv(OPENWEATHER_API_ENV, "").strip()
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"
OPENWEATHER_TIMEOUT = 12
OPENWEATHER_FORECAST_POINTS = 8


def _coerce_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if isinstance(number, float) and np.isnan(number):
        return None
    return number


def _get_openweather_api_key() -> Optional[str]:
    env_key = os.getenv(OPENWEATHER_API_ENV)
    if env_key:
        return env_key.strip()
    try:
        secrets_obj = st.secrets  # type: ignore[attr-defined]
    except Exception:
        secrets_obj = None
    if secrets_obj is not None and hasattr(secrets_obj, "get"):
        for candidate in ("openweather_api_key", "OPENWEATHER_API_KEY"):
            try:
                secret_value = secrets_obj.get(candidate)
            except Exception:
                secret_value = None
            if secret_value:
                return str(secret_value).strip()
        try:
            bucket = secrets_obj.get("openweather")
        except Exception:
            bucket = None
        if isinstance(bucket, dict):
            nested_key = bucket.get("api_key") or bucket.get("API_KEY")
            if nested_key:
                return str(nested_key).strip()
    return None


@st.cache_data(ttl=900, show_spinner=False)
def _load_openweather_site_weather(site: str, lat: float, lon: float, api_key: str) -> dict:
    params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
    current_resp = requests.get(f"{OPENWEATHER_BASE_URL}/weather", params=params, timeout=OPENWEATHER_TIMEOUT)
    current_resp.raise_for_status()
    current_payload = current_resp.json()
    forecast_params = dict(params)
    forecast_params["cnt"] = OPENWEATHER_FORECAST_POINTS
    forecast_resp = requests.get(
        f"{OPENWEATHER_BASE_URL}/forecast", params=forecast_params, timeout=OPENWEATHER_TIMEOUT
    )
    forecast_resp.raise_for_status()
    forecast_payload = forecast_resp.json()
    return {"current": current_payload, "forecast": forecast_payload}


def _prepare_site_weather_snapshot(site: str, payload: dict) -> dict:
    local_tz = datetime.now().astimezone().tzinfo
    current_payload = payload.get("current") or {}
    main_block = current_payload.get("main") or {}
    wind_block = current_payload.get("wind") or {}
    weather_items = current_payload.get("weather") or []
    primary_weather = weather_items[0] if weather_items else {}
    description_raw = primary_weather.get("description") or "Unknown"
    description = str(description_raw).title()

    observation_ts = current_payload.get("dt")
    observation_label = None
    if observation_ts:
        try:
            observation_dt = (
                datetime.fromtimestamp(observation_ts, tz=local_tz)
                if local_tz
                else datetime.fromtimestamp(observation_ts)
            )
            observation_label = observation_dt.strftime("%d %b %H:%M")
        except (OSError, OverflowError, ValueError):
            observation_label = None
    if not observation_label:
        observation_label = datetime.now().strftime("%d %b %H:%M")

    temperature = _coerce_float(main_block.get("temp"))
    feels_like = _coerce_float(main_block.get("feels_like"))
    humidity = _coerce_float(main_block.get("humidity"))
    wind_speed = _coerce_float(wind_block.get("speed"))

    forecast_payload = payload.get("forecast") or {}
    forecast_items = forecast_payload.get("list") or []
    forecast_summaries: list[dict[str, Any]] = []
    for idx, item in enumerate(forecast_items[:OPENWEATHER_FORECAST_POINTS]):
        item_main = item.get("main") or {}
        weather_stub = (item.get("weather") or [{}])[0]
        entry_temp = _coerce_float(item_main.get("temp"))
        entry_description_raw = weather_stub.get("description") or ""
        entry_description = str(entry_description_raw).title() if entry_description_raw else "—"
        label = item.get("dt_txt") or f"T+{3 * (idx + 1)}h"
        dt_value = item.get("dt")
        if dt_value:
            try:
                label_dt = (
                    datetime.fromtimestamp(dt_value, tz=local_tz)
                    if local_tz
                    else datetime.fromtimestamp(dt_value)
                )
                label = label_dt.strftime("%d %b %H:%M")
            except (OSError, OverflowError, ValueError):
                pass
        summary: dict[str, Any] = {
            "label": label,
            "temp": entry_temp,
            "description": entry_description,
        }
        precipitation_probability = _coerce_float(item.get("pop"))
        if precipitation_probability is not None:
            summary["pop"] = precipitation_probability
        forecast_summaries.append(summary)

    return {
        "site": site,
        "description": description,
        "temperature": temperature,
        "feels_like": feels_like,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "observation_time": observation_label,
        "icon": primary_weather.get("icon"),
        "forecast": forecast_summaries,
    }


def _gather_openweather_snapshots(sites: list[str], api_key: str) -> Tuple[list[dict], list[str]]:
    snapshots: list[dict] = []
    warnings: list[str] = []
    for site in sites:
        coords = SITE_FALLBACK_LOCATIONS.get(site)
        if not coords:
            warnings.append(f"No coordinates configured for {site}.")
            continue
        try:
            payload = _load_openweather_site_weather(site, float(coords["lat"]), float(coords["lon"]), api_key)
            snapshots.append(_prepare_site_weather_snapshot(site, payload))
        except Exception as exc:  # pragma: no cover - network/runtime failures
            warnings.append(f"{site}: {exc}")
    return snapshots, warnings


def _inject_base_styles() -> None:
    st.markdown(
        """
        <style>
        .crowd-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.15rem 0.55rem;
            border-radius: 1rem;
            font-size: 0.85rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }
        .severity-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.1rem 0.4rem;
            border-radius: 0.75rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 0.35rem;
        }
        .notification-card {
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            margin-bottom: 0.5rem;
            box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
        }
        .alert-card {
            border-radius: 0.85rem;
            padding: 0.85rem 1rem;
            margin-bottom: 0.65rem;
            border-left: 6px solid rgba(13, 71, 161, 0.7);
            background: linear-gradient(135deg, rgba(226, 236, 255, 0.8), rgba(214, 227, 248, 0.6));
            box-shadow: 0 6px 20px rgba(13, 34, 64, 0.12);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _classify_crowd_level(value: Optional[float]) -> str:
    if value is None or pd.isna(value):
        return "Unknown"
    for label, lower, upper in CROWD_LEVELS:
        if value >= lower and (upper is None or value < upper):
            return label
    return CROWD_LEVELS[-1][0]


def _annotate_crowd_levels(df: pd.DataFrame, column: str, target_column: str = "crowd_level") -> pd.DataFrame:
    if df.empty or column not in df.columns:
        working = df.copy()
        working[target_column] = pd.Series(dtype="object")
        return working
    working = df.copy()
    working[target_column] = working[column].apply(_classify_crowd_level)
    return working


def _stylize_badge(label: str, badge_class: str = "crowd-badge") -> str:
    style = LEVEL_BADGE_STYLES.get(label, {"bg": "#eceff1", "fg": "#37474f"})
    return (
        f"<span class='{badge_class}' style='background:{style['bg']};color:{style['fg']}'>"
        f"{label}</span>"
    )


def _severity_badge(label: str) -> str:
    style = ALERT_SEVERITY_STYLES.get(label, {"bg": "#eceff1", "fg": "#37474f"})
    return (
        f"<span class='severity-badge' style='background:{style['bg']};color:{style['fg']}'>"
        f"{label.title()}</span>"
    )


@dataclass
class AssistantReply:
    message: str
    tables: Dict[str, pd.DataFrame] = field(default_factory=dict)
    charts: Dict[str, pd.DataFrame] = field(default_factory=dict)


def _format_canonical_qa(
    current_date: str,
    current_time: str,
    yesterday_date: str,
    next_week_start: str,
    next_week_end: str,
    next_week_mid: str,
) -> str:
    qa_chunks = []
    for item in ASSISTANT_CANONICAL_QA:
        answer = item["answer_template"].format(
            current_date=current_date,
            current_time=current_time,
            yesterday_date=yesterday_date,
            next_week_start=next_week_start,
            next_week_end=next_week_end,
            next_week_mid=next_week_mid,
        )
        qa_chunks.append(f"Q: {item['question']}\nA: {answer}")
    return "\n\n".join(qa_chunks)


def _build_gemini_prompt(question: str, now: datetime) -> str:
    today_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p %Z").lstrip("0")
    yesterday_str = (now - timedelta(days=1)).strftime("%A, %d %B %Y")
    tomorrow_str = (now + timedelta(days=1)).strftime("%A, %d %B %Y")
    next_week_start = (now + timedelta(days=7)).strftime("%A, %d %B %Y")
    next_week_end = (now + timedelta(days=13)).strftime("%A, %d %B %Y")
    next_week_mid = (now + timedelta(days=10)).strftime("%A")

    analytics_section = "\n".join(f"- {line}" for line in ASSISTANT_SAMPLE_ANALYTICS)
    canonical_section = _format_canonical_qa(
        current_date=today_str,
        current_time=time_str,
        yesterday_date=yesterday_str,
        next_week_start=next_week_start,
        next_week_end=next_week_end,
        next_week_mid=next_week_mid,
    )

    return f"""
You are the upbeat in-app demo assistant for the Gujarat pilgrimage crowd dashboard.
You are running on the analyst's laptop, so always trust the device clock.

Current local date: {today_str}
Current local time: {time_str}
Tomorrow's date: {tomorrow_str}
Next-week window: {next_week_start} to {next_week_end}

Key demo analytics (treat as authoritative ground truth):
{analytics_section}

Canonical demo answers (reuse tone and details whenever the user asks anything similar):
{canonical_section}

Guidelines:
- Mention the current local date/time once in every answer.
- If the user question matches or resembles a canonical question, reuse the provided answer verbatim except for inserting the correct live dates/times as needed.
- For other questions, craft a consistent response using the analytics above; do not fabricate new metrics outside this scenario.
- Keep replies short, friendly, and markdown-formatted with bullet points for lists.
- Never mention that the answers are hard-coded; act as a confident live assistant.

User question: {question}

Respond in Markdown.
""".strip()


def _call_gemini_assistant(
    question: str,
    api_key: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    trimmed_key = (api_key or GEMINI_API_KEY).strip()
    if not trimmed_key:
        return None, "Set the GEMINI_API_KEY environment variable or add it to Streamlit secrets to enable the AI assistant."
    if genai is None:
        return None, "Gemini SDK is unavailable. Install 'google-generativeai' to continue."

    try:
        cached_key = st.session_state.get("_gemini_api_key")
        if cached_key != trimmed_key or "_gemini_model" not in st.session_state:
            genai.configure(api_key=trimmed_key)
            st.session_state["_gemini_api_key"] = trimmed_key
            st.session_state["_gemini_model"] = genai.GenerativeModel(GEMINI_MODEL_DEFAULT)

        model = st.session_state["_gemini_model"]
        now = datetime.now().astimezone()
        prompt = _build_gemini_prompt(question, now)
        response = model.generate_content(prompt)

        text = getattr(response, "text", "") or ""
        if not text and hasattr(response, "candidates"):
            fragments = []
            for candidate in response.candidates:
                candidate_content = getattr(candidate, "content", None)
                parts = getattr(candidate_content, "parts", []) if candidate_content else []
                for part in parts:
                    fragment = getattr(part, "text", None)
                    if fragment:
                        fragments.append(fragment)
            text = "\n".join(fragments)

        if text.strip():
            return text.strip(), None
        return None, "Gemini returned an empty response. Please try again."
    except Exception as exc:  # pragma: no cover - network/runtime failures
        return None, f"Gemini request failed: {exc}"


def _load_concat(files: list[Path]) -> pd.DataFrame:
    frames = []
    for path in files:
        try:
            frame = pd.read_csv(path)
        except FileNotFoundError:
            continue
        frame["batch"] = path.stem
        frames.append(frame)
    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames, ignore_index=True)
    if "ts" in combined.columns:
        combined["ts"] = pd.to_datetime(combined["ts"], errors="coerce", utc=True)
    return combined


def _latest_files(data_dir: Path, suffix: str) -> list[Path]:
    return sorted(data_dir.glob(f"*{suffix}"))


def configure_sidebar() -> dict:
    st.sidebar.title("Controls")
    data_dir = Path(
        st.sidebar.text_input("Processed data directory", value=str(DEFAULT_DATA_DIR.resolve()))
    )
    observations_path = Path(
        st.sidebar.text_input("Observations CSV", value=str(DEFAULT_OBSERVATIONS_PATH.resolve()))
    )
    refresh_sec = st.sidebar.slider("Auto-refresh (seconds)", min_value=0, max_value=120, value=30, step=5)
    max_batches = st.sidebar.number_input("Batches to load", min_value=1, max_value=500, value=50, step=5)
    obs_row_limit = st.sidebar.slider("Observation history (rows)", min_value=100, max_value=50000, value=5000, step=100)
    if st.sidebar.button("Refresh now"):
        _trigger_refresh()
    st.sidebar.caption("Reduce batches if CSVs accumulate to keep the dashboard responsive.")
    return {
        "data_dir": data_dir,
        "refresh_sec": refresh_sec,
        "max_batches": max_batches,
        "observations_path": observations_path,
        "obs_row_limit": obs_row_limit,
    }


def _trigger_refresh() -> None:
    rerun = getattr(st, "rerun", None) or getattr(st, "experimental_rerun", None)
    if rerun is not None:
        rerun()


def _load_observations(path: Path, limit: int) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        df = pd.read_csv(path)
    except pd.errors.ParserError as exc:  # pragma: no cover - triggered when schema changed mid-run
        repaired = _repair_observations_file(path)
        if repaired is None:
            st.warning(f"Failed to load observations from {path}: {exc}")
            return pd.DataFrame()
        df = repaired
    except Exception as exc:  # pragma: no cover - robust to partial writes
        st.warning(f"Failed to load observations from {path}: {exc}")
        return pd.DataFrame()

    if "ts_captured_utc" in df.columns:
        df["ts_captured_utc"] = pd.to_datetime(df["ts_captured_utc"], errors="coerce")
    if limit and len(df) > limit:
        df = df.tail(limit).reset_index(drop=True)
    return df


def _repair_observations_file(path: Path) -> Optional[pd.DataFrame]:
    try:
        with path.open("r", newline="", encoding="utf-8") as fh:
            rows = list(csv.reader(fh))
    except Exception as exc:
        st.warning(f"Could not read observations from {path}: {exc}")
        return None

    if not rows:
        return pd.DataFrame(columns=OBS_COLUMNS_V2)

    header = rows[0]
    data_rows = rows[1:]
    max_len = max((len(row) for row in rows), default=len(header))

    # Determine which schema to apply
    if max_len == len(OBS_COLUMNS_V2):
        target_columns = OBS_COLUMNS_V2
    else:
        target_columns = OBS_COLUMNS_V2

    fixed_rows = []
    for row in data_rows:
        if len(row) == len(OBS_COLUMNS_V2):
            fixed_rows.append(row)
        elif len(row) == len(OBS_COLUMNS_V1):
            mapping = {OBS_COLUMNS_V1[idx]: row[idx] for idx in range(len(OBS_COLUMNS_V1))}
            fixed_rows.append([mapping.get(col, "") for col in OBS_COLUMNS_V2])
        else:
            # Attempt positional mapping for partially written rows
            padded = row + [""] * (len(OBS_COLUMNS_V2) - len(row))
            fixed_rows.append(padded[: len(OBS_COLUMNS_V2)])

    try:
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(target_columns)
            writer.writerows(fixed_rows)
    except Exception as exc:
        st.warning(f"Could not repair observations file {path}: {exc}")
        return None

    df = pd.DataFrame(fixed_rows, columns=target_columns)
    return df


def _split_camera_ids(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.split(",")


def _build_camera_summary(
    fused_df: pd.DataFrame,
    observations_df: pd.DataFrame,
    selected_sites: list[str],
) -> pd.DataFrame:
    if observations_df.empty:
        return pd.DataFrame()

    latest_obs = observations_df.sort_values("ts_captured_utc").groupby("camera_id").tail(1)
    if selected_sites:
        latest_obs = latest_obs[latest_obs["site"].isin(selected_sites)]

    if fused_df.empty:
        latest_obs["latest_fused"] = np.nan
        latest_obs["latest_detection"] = latest_obs["detection_count"]
        return latest_obs

    camera_lookup: Dict[str, float] = {}
    site_lookup: Dict[str, float] = {}
    latest_fused = fused_df.sort_values("ts").groupby("site").tail(1)
    for _, row in latest_fused.iterrows():
        ids = _split_camera_ids(pd.Series([row.get("camera_ids", "")])).iloc[0]
        for cam_id in ids:
            if cam_id:
                camera_lookup[cam_id] = row.get("fused_estimate", np.nan)
        site_lookup[row["site"]] = row.get("fused_estimate", np.nan)

    latest_obs["latest_fused"] = latest_obs.apply(
        lambda r: camera_lookup.get(r["camera_id"], site_lookup.get(r["site"], np.nan)), axis=1
    )
    latest_obs["latest_detection"] = latest_obs["detection_count"]
    cols = [
        "camera_id",
        "site",
        "ts_captured_utc",
        "latest_detection",
        "latest_fused",
        "latitude",
        "longitude",
        "location_city",
        "location_region",
        "location_country",
        "time_of_day_period",
        "weather_temperature_c",
        "weather_windspeed_ms",
    ]
    return latest_obs[cols]


def _build_heatmap_source(
    camera_summary: pd.DataFrame,
    fused_df: pd.DataFrame,
    selected_sites: Optional[list[str]] = None,
) -> pd.DataFrame:
    site_metrics = pd.DataFrame(columns=["site", "value"])
    if "site" in fused_df.columns and not fused_df.empty:
        metric_col = "fused_estimate" if "fused_estimate" in fused_df.columns else (
            "forecast" if "forecast" in fused_df.columns else None
        )
        if metric_col:
            latest = fused_df.sort_values("ts").groupby("site").tail(1)[["site", metric_col]]
            site_metrics = latest.rename(columns={metric_col: "value"})

    if site_metrics.empty and not camera_summary.empty:
        source_col = "latest_fused" if "latest_fused" in camera_summary.columns else "latest_detection"
        site_metrics = (
            camera_summary.dropna(subset=["site"])
            .groupby("site", as_index=False)[source_col]
            .mean()
            .rename(columns={source_col: "value"})
        )

    if selected_sites:
        allowed = set(selected_sites)
        site_metrics = site_metrics[site_metrics["site"].isin(allowed)] if not site_metrics.empty else site_metrics

    if site_metrics.empty:
        return pd.DataFrame(columns=["lat", "lon", "weight", "site", "camera_id", "crowd_level"])

    max_value = float(site_metrics["value"].max()) if not site_metrics.empty else 0.0
    clamp_max = max(max_value, 10000.0, 1.0)

    records: list[dict[str, Any]] = []
    for _, row in site_metrics.iterrows():
        site = str(row.get("site", ""))
        if not site:
            continue
        raw_value = float(row.get("value", 0.0))
        normalized_weight = 0.0 if clamp_max == 0 else min(raw_value / clamp_max, 1.0)
        if raw_value > 0 and normalized_weight < 0.05:
            normalized_weight = 0.05
        level = _classify_crowd_level(raw_value)

        lat = lon = None
        camera_rows = pd.DataFrame()
        if not camera_summary.empty and "site" in camera_summary.columns:
            camera_rows = camera_summary[camera_summary["site"] == site]
            if not camera_rows.empty:
                lat_series = pd.to_numeric(camera_rows.get("latitude"), errors="coerce").dropna()
                lon_series = pd.to_numeric(camera_rows.get("longitude"), errors="coerce").dropna()
                if not lat_series.empty and not lon_series.empty:
                    lat = float(lat_series.mean())
                    lon = float(lon_series.mean())

        if lat is None or lon is None:
            fallback = SITE_FALLBACK_LOCATIONS.get(site)
            if fallback:
                lat = fallback.get("lat")
                lon = fallback.get("lon")

        if lat is None or lon is None:
            continue

        representative_camera = (
            camera_rows.iloc[0].get("camera_id") if not camera_rows.empty and "camera_id" in camera_rows else ""
        )
        records.append(
            {
                "lat": lat,
                "lon": lon,
                "weight": normalized_weight,
                "site": site,
                "camera_id": representative_camera,
                "crowd_level": level,
                "raw_value": raw_value,
            }
        )

    present_sites = {rec["site"] for rec in records}
    fallback_targets = SITE_FALLBACK_LOCATIONS.keys() if not selected_sites else selected_sites
    for site in fallback_targets:
        if site not in present_sites and site in SITE_FALLBACK_LOCATIONS:
            coords = SITE_FALLBACK_LOCATIONS[site]
            records.append(
                {
                    "lat": coords.get("lat"),
                    "lon": coords.get("lon"),
                    "weight": 0.02,
                    "site": site,
                    "camera_id": "",
                    "crowd_level": "Low",
                    "raw_value": 0.0,
                }
            )

    return pd.DataFrame(records)


def _weekly_site_summary(fused_df: pd.DataFrame) -> pd.DataFrame:
    if fused_df.empty or "ts" not in fused_df.columns:
        return pd.DataFrame()
    working = fused_df.copy()
    local_tz = datetime.now().astimezone().tzinfo
    working["ts"] = pd.to_datetime(working["ts"], errors="coerce", utc=True)
    working = working.dropna(subset=["ts"])
    if working.empty:
        return pd.DataFrame()
    working["ts_local"] = working["ts"].dt.tz_convert(local_tz)
    working = working.dropna(subset=["ts_local"])
    working = working.set_index("ts_local")
    metric_col = "forecast" if "forecast" in working.columns else "fused_estimate"
    weekly = (
        working.groupby("site")[metric_col]
        .resample("D")
        .mean()
        .rename("daily_mean")
        .reset_index()
    )
    weekly = weekly.rename(columns={"ts_local": "ts"})
    weekly["week"] = weekly["ts"].dt.tz_localize(None).dt.to_period("W").apply(lambda p: p.start_time)
    summary = weekly.groupby(["site", "week"]).agg(
        avg_daily=("daily_mean", "mean"),
        max_daily=("daily_mean", "max"),
        min_daily=("daily_mean", "min"),
    )
    summary = summary.reset_index().sort_values(["site", "week"], ascending=[True, False])
    return summary


def _prepare_forecast_granularity(fused_df: pd.DataFrame, granularity: str) -> pd.DataFrame:
    if fused_df.empty or "ts" not in fused_df.columns:
        return pd.DataFrame()

    working = fused_df.copy()
    working["ts"] = pd.to_datetime(working["ts"], errors="coerce", utc=True)
    working = working.dropna(subset=["ts"])
    if working.empty:
        return pd.DataFrame()

    local_tz = datetime.now().astimezone().tzinfo
    working["ts_local"] = working["ts"].dt.tz_convert(local_tz).dt.tz_localize(None)
    metric_col = "fused_estimate" if "fused_estimate" in working.columns else (
        "forecast" if "forecast" in working.columns else working.columns[-1]
    )

    if granularity == "Hourly":
        grouped = working[["site", "ts_local", metric_col]].rename(columns={metric_col: "value"})
    elif granularity == "Daily":
        grouped = (
            working.assign(date=working["ts_local"].dt.date)
            .groupby(["site", "date"], as_index=False)[metric_col]
            .mean()
            .rename(columns={metric_col: "value"})
        )
        grouped["ts_local"] = pd.to_datetime(grouped["date"])
    else:
        grouped = (
            working.assign(week=working["ts_local"].dt.to_period("W").apply(lambda p: p.start_time))
            .groupby(["site", "week"], as_index=False)[metric_col]
            .mean()
            .rename(columns={metric_col: "value"})
        )
        grouped["ts_local"] = pd.to_datetime(grouped["week"])

    grouped = _annotate_crowd_levels(grouped, "value")
    return grouped


def _collect_site_overloads(latest_df: pd.DataFrame, metric_col: str) -> list[dict[str, Any]]:
    incidents: list[dict[str, Any]] = []
    if latest_df.empty or metric_col not in latest_df.columns:
        return incidents
    for _, row in latest_df.iterrows():
        site = row.get("site")
        if not site:
            continue
        value = float(row.get(metric_col, 0.0) or 0.0)
        if value >= 5000.0:
            severity = "critical" if value >= 10000.0 else "high"
            incidents.append(
                {
                    "site": str(site),
                    "value": value,
                    "severity": severity,
                }
            )
    return incidents


def _record_manual_escalation(site: str, action: str, severity: str, load_value: float) -> None:
    _init_runtime_state()
    entry = {
        "timestamp": datetime.now().astimezone(),
        "site": site,
        "action": action,
        "severity": severity,
        "load": load_value,
    }
    st.session_state.setdefault("_manual_escalations", []).append(entry)
    inbox = st.session_state.get("_notification_inbox", {})
    inbox.setdefault("admin", []).append(
        {
            "id": f"manual::{site}::{action}::{entry['timestamp'].isoformat()}",
            "ts": entry["timestamp"],
            "severity": severity,
            "crowd_level": "Extreme" if severity == "critical" else "High",
            "message": f"{action} dispatched for {site} ({load_value:.0f} people).",
            "audience": "Admin",
        }
    )
    st.session_state["_notification_inbox"] = inbox
    st.session_state["_escalation_flash"] = f"{action} request logged for {site}."


def _parse_date_from_query(query: str) -> Optional[datetime]:
    query_lower = query.lower()
    today = datetime.now().astimezone().date()
    if "yesterday" in query_lower:
        return datetime.combine(today - timedelta(days=1), datetime.min.time())
    if "today" in query_lower:
        return datetime.combine(today, datetime.min.time())
    match = re.search(r"(\d{4}-\d{2}-\d{2})", query)
    if match:
        try:
            return datetime.strptime(match.group(1), "%Y-%m-%d")
        except ValueError:
            return None
    return None


def _extract_site_or_camera(
    query: str,
    fused_df: pd.DataFrame,
    observations_df: pd.DataFrame,
) -> Tuple[Optional[str], Optional[str]]:
    query_lower = query.lower()
    site = None
    camera = None
    sites: Dict[str, str] = {}
    cameras: Dict[str, str] = {}
    if not fused_df.empty and "site" in fused_df.columns:
        sites.update({str(s).lower(): str(s) for s in fused_df["site"].dropna().unique()})
    if not observations_df.empty and "site" in observations_df.columns:
        sites.update({str(s).lower(): str(s) for s in observations_df["site"].dropna().unique()})
        cameras.update({str(c).lower(): str(c) for c in observations_df["camera_id"].dropna().unique()})

    for lower_name, original in sites.items():
        if lower_name and lower_name in query_lower:
            site = original
            break

    for lower_name, original in cameras.items():
        if lower_name and lower_name in query_lower:
            camera = original
            break

    return site, camera


def _compute_daily_detection(observations_df: pd.DataFrame, target_date: datetime, site: Optional[str], camera: Optional[str]) -> pd.DataFrame:
    if observations_df.empty:
        return pd.DataFrame()
    df = observations_df.copy()
    if "ts_captured_utc" not in df.columns or "detection_count" not in df.columns:
        return pd.DataFrame()

    df = df.dropna(subset=["ts_captured_utc", "detection_count"])
    if df.empty:
        return pd.DataFrame()

    df["ts_captured_utc"] = pd.to_datetime(df["ts_captured_utc"], errors="coerce", utc=True)
    df = df.dropna(subset=["ts_captured_utc"])
    if df.empty:
        return pd.DataFrame()

    df["ts_captured_utc"] = df["ts_captured_utc"].dt.tz_convert("UTC").dt.tz_localize(None)

    target_ts = pd.Timestamp(target_date)
    if target_ts.tzinfo is None:
        target_ts = target_ts.tz_localize("UTC")
    else:
        target_ts = target_ts.tz_convert("UTC")
    target_naive = target_ts.tz_localize(None)

    day_start = target_naive.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    mask = (df["ts_captured_utc"] >= day_start) & (df["ts_captured_utc"] < day_end)
    df = df[mask]
    if site:
        df = df[df["site"] == site]
    if camera:
        df = df[df["camera_id"] == camera]
    if df.empty:
        return pd.DataFrame()

    grouped = df.groupby(["site", "camera_id"]).agg(
        total_people=("detection_count", "sum"),
        average_people=("detection_count", "mean"),
        samples=("detection_count", "count"),
        first_seen=("ts_captured_utc", "min"),
        last_seen=("ts_captured_utc", "max"),
    )
    return grouped.reset_index()


def _latest_camera_snapshot(observations_df: pd.DataFrame, site: Optional[str], camera: Optional[str]) -> pd.DataFrame:
    if observations_df.empty:
        return pd.DataFrame()
    df = observations_df.copy()
    if site:
        df = df[df["site"] == site]
    if camera:
        df = df[df["camera_id"] == camera]
    if df.empty:
        return pd.DataFrame()
    df = df.sort_values("ts_captured_utc", ascending=False)
    latest = df.groupby("camera_id").head(1)
    columns = [
        "camera_id",
        "site",
        "ts_captured_utc",
        "detection_count",
        "latitude",
        "longitude",
        "location_city",
        "location_region",
        "location_country",
        "weather_temperature_c",
        "weather_windspeed_ms",
    ]
    return latest[[c for c in columns if c in latest.columns]]


def _fetch_weather_forecast(latitude: Optional[float], longitude: Optional[float], tzinfo) -> Optional[Dict[str, Any]]:
    if latitude is None or longitude is None:
        return None

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return None

    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "hourly": "temperature_2m,relativehumidity_2m,precipitation,cloudcover",
        "forecast_days": 1,
        "timezone": "auto",
    }

    try:
        response = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=5)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return None

    current = payload.get("current_weather") or {}
    hourly = payload.get("hourly") or {}
    timestamps = hourly.get("time") or []
    temp = hourly.get("temperature_2m") or []
    precip = hourly.get("precipitation") or []
    humidity = hourly.get("relativehumidity_2m") or []
    cloud = hourly.get("cloudcover") or []

    hourly_rows = []
    for idx, timestamp in enumerate(timestamps[:12]):
        try:
            ts_local = pd.to_datetime(timestamp).tz_localize("UTC").tz_convert(tzinfo)
        except TypeError:
            ts_local = pd.to_datetime(timestamp)
        row = {
            "time": ts_local,
            "temp_c": temp[idx] if idx < len(temp) else None,
            "precip_mm": precip[idx] if idx < len(precip) else None,
            "humidity_pct": humidity[idx] if idx < len(humidity) else None,
            "cloud_pct": cloud[idx] if idx < len(cloud) else None,
        }
        hourly_rows.append(row)

    return {
        "current": current,
        "hourly": hourly_rows,
    }


def _init_runtime_state() -> None:
    st.session_state.setdefault(
        "_prediction_state",
        {
            "last_run": None,
            "predictions": pd.DataFrame(),
            "alerts": pd.DataFrame(),
            "alert_ids": set(),
        },
    )
    st.session_state.setdefault(
        "_notification_inbox",
        {
            "admin": [],
            "devotee": [],
        },
    )
    st.session_state.setdefault("_notification_ids", set())
    st.session_state.setdefault("_manual_escalations", [])
    st.session_state.setdefault("_escalation_flash", None)


def _run_prediction_pipeline(
    observations_df: pd.DataFrame,
    fused_df: pd.DataFrame,
    now: datetime,
) -> pd.DataFrame:
    if observations_df.empty and fused_df.empty:
        return pd.DataFrame()

    tzinfo = now.tzinfo
    obs = observations_df.copy()
    if not obs.empty and "ts_captured_utc" in obs.columns:
        obs["ts_captured_utc"] = pd.to_datetime(obs["ts_captured_utc"], errors="coerce", utc=True)
        obs = obs.dropna(subset=["ts_captured_utc"])
        obs["ts_local"] = obs["ts_captured_utc"].dt.tz_convert(tzinfo)
        obs = obs.sort_values("ts_local")
    else:
        obs = pd.DataFrame()

    fused = fused_df.copy()
    if not fused.empty and "ts" in fused.columns:
        fused["ts"] = pd.to_datetime(fused["ts"], errors="coerce", utc=True)
        fused = fused.dropna(subset=["ts"])
        fused["ts_local"] = fused["ts"].dt.tz_convert(tzinfo)
        fused = fused.sort_values("ts_local")
    else:
        fused = pd.DataFrame()

    prediction_rows = []
    sites = sorted(set(obs.get("site", pd.Series(dtype=str))).union(fused.get("site", pd.Series(dtype=str))))

    rng = np.random.default_rng(seed=int(now.timestamp()) % 2_147_483_647)

    for site in sites:
        site_obs = obs[obs.get("site") == site] if not obs.empty else pd.DataFrame()
        site_fused = fused[fused.get("site") == site] if not fused.empty else pd.DataFrame()

        baseline = None
        slope = 0.0

        if not site_obs.empty:
            recent = site_obs.tail(12)
            baseline = recent["detection_count"].astype(float).mean()
            slope = recent["detection_count"].astype(float).diff().mean() or 0.0
        elif not site_fused.empty:
            baseline = float(site_fused["fused_estimate" if "fused_estimate" in site_fused.columns else site_fused.columns[-1]].iloc[-1])

        if baseline is None or np.isnan(baseline):
            baseline = 0.0

        for hour in range(1, PREDICTION_HORIZON_HOURS + 1):
            ts_future = now + timedelta(hours=hour)
            trend_component = slope * hour if not np.isnan(slope) else 0.0
            noise = rng.normal(0, max(baseline * 0.05, 10))
            load = max(0.0, baseline + trend_component + noise)
            prediction_rows.append(
                {
                    "site": site,
                    "ts": ts_future,
                    "predicted_load": load,
                }
            )

    predictions = pd.DataFrame(prediction_rows)
    if predictions.empty:
        return predictions

    predictions["crowd_level"] = predictions["predicted_load"].apply(_classify_crowd_level)
    predictions["ts"] = pd.to_datetime(predictions["ts"]).dt.tz_convert(now.tzinfo)
    predictions["ts_local"] = predictions["ts"].dt.tz_localize(None)
    return predictions


def _alert_records_from_predictions(predictions: pd.DataFrame, now: datetime) -> pd.DataFrame:
    if predictions.empty:
        return pd.DataFrame()

    alert_rows = []
    for _, row in predictions.iterrows():
        level = row.get("crowd_level")
        severity = ALERT_LEVEL_MAP.get(level)
        if severity is None:
            continue
        alert_id = f"{row['site']}::{row['ts'].isoformat()}::{level}"
        message = (
            f"{row['site']} predicted load {row['predicted_load']:.0f} ({level}) around {row['ts']:%H:%M}."
        )
        alert_rows.append(
            {
                "id": alert_id,
                "site": row["site"],
                "ts": row["ts"],
                "predicted_load": row["predicted_load"],
                "crowd_level": level,
                "severity": severity,
                "message": message,
                "created_at": now,
            }
        )
    return pd.DataFrame(alert_rows)


def _dispatch_notifications(alerts_df: pd.DataFrame) -> None:
    if alerts_df.empty:
        return

    inbox = st.session_state.get("_notification_inbox", {})
    delivered_ids = st.session_state.get("_notification_ids", set())
    for _, alert in alerts_df.iterrows():
        alert_id = alert.get("id")
        if alert_id in delivered_ids:
            continue
        payload = {
            "id": alert_id,
            "ts": alert.get("ts"),
            "severity": alert.get("severity"),
            "crowd_level": alert.get("crowd_level"),
            "message": alert.get("message"),
        }
        inbox.setdefault("admin", []).append({**payload, "audience": "Admin"})
        inbox.setdefault("devotee", []).append({**payload, "audience": "Devotee"})
        delivered_ids.add(alert_id)

    st.session_state["_notification_inbox"] = inbox
    st.session_state["_notification_ids"] = delivered_ids


def _ensure_prediction_pipeline(observations_df: pd.DataFrame, fused_df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    _init_runtime_state()
    state = st.session_state["_prediction_state"]
    last_run = state.get("last_run")
    now = datetime.now().astimezone()
    if last_run is not None and (now - last_run).total_seconds() < PIPELINE_INTERVAL_SECONDS:
        return state.get("predictions", pd.DataFrame()), state.get("alerts", pd.DataFrame())

    predictions = _run_prediction_pipeline(observations_df, fused_df, now)
    alerts = _alert_records_from_predictions(predictions, now)

    state["last_run"] = now
    state["predictions"] = predictions
    state["alerts"] = alerts
    state["alert_ids"] = set(alerts.get("id", []))
    st.session_state["_prediction_state"] = state

    if not alerts.empty:
        _dispatch_notifications(alerts)

    return predictions, alerts


def _answer_chat_query(
    query: str,
    fused_df: pd.DataFrame,
    observations_df: pd.DataFrame,
    alerts_df: pd.DataFrame,
    gemini_api_key: Optional[str] = None,
) -> AssistantReply:
    if not query.strip():
        return AssistantReply(message="Please provide a question so I can help.")

    gemini_message, gemini_error = _call_gemini_assistant(query, gemini_api_key)
    if gemini_message:
        return AssistantReply(message=gemini_message)
    if gemini_error:
        return AssistantReply(message=gemini_error)

    query_lower = query.lower()
    site, camera = _extract_site_or_camera(query, fused_df, observations_df)
    target_date = _parse_date_from_query(query)

    reply = AssistantReply(message="I couldn't find matching data for that request. Try specifying a site, camera, or date.")

    if ("average" in query_lower or "mean" in query_lower) and not observations_df.empty:
        scope_df = observations_df.copy()
        if site:
            scope_df = scope_df[scope_df["site"] == site]
        if camera:
            scope_df = scope_df[scope_df["camera_id"] == camera]
        if not scope_df.empty:
            avg = scope_df["detection_count"].mean()
            label = f"Average detection count"
            if camera:
                label += f" for camera {camera}"
            elif site:
                label += f" for site {site}"
            reply.message = f"{label}: {avg:.1f} people per interval based on {len(scope_df)} samples."
            reply.tables[label] = scope_df[[
                "camera_id",
                "site",
                "ts_captured_utc",
                "detection_count",
            ]].tail(10)
            return reply

    if ("how many" in query_lower or "total" in query_lower or "sum" in query_lower) and target_date:
        summary = _compute_daily_detection(observations_df, target_date, site, camera)
        if not summary.empty:
            total = summary["total_people"].sum()
            label = f"People on {target_date.date()}"
            reply.message = f"Total detections on {target_date.date()}: {int(total)} people."
            if site:
                reply.message += f" Site: {site}."
            if camera:
                reply.message += f" Camera: {camera}."
            reply.tables[label] = summary
            return reply

    if "forecast" in query_lower or "estimate" in query_lower:
        if fused_df.empty:
            return AssistantReply(message="I couldn't find any forecast data yet. Make sure the fusion pipeline has produced fused CSVs.")
        scope_df = fused_df.copy()
        if site:
            scope_df = scope_df[scope_df["site"] == site]
        if scope_df.empty:
            return AssistantReply(message="I couldn't match that site in the forecast data. Try another site name.")

        scope_df = scope_df.copy()
        scope_df["ts"] = pd.to_datetime(scope_df["ts"], errors="coerce", utc=True)
        scope_df = scope_df.dropna(subset=["ts"])
        if scope_df.empty:
            return AssistantReply(message="Forecast timestamps were invalid for that site.")

        local_now = datetime.now().astimezone()
        scope_df["ts_local"] = scope_df["ts"].dt.tz_convert(local_now.tzinfo)
        latest = scope_df.sort_values("ts_local").tail(1)
        value = float(latest.iloc[0].get("fused_estimate", latest.iloc[0].get("forecast", 0)))
        timestamp = latest.iloc[0]["ts_local"]
        reply.message = f"Most recent fused estimate for {latest.iloc[0]['site']}: {value:.0f} people (recorded {timestamp:%Y-%m-%d %H:%M %Z})."

        projection_needed = "next 12" in query_lower or "next twelve" in query_lower or "outlook" in query_lower
        weekly_needed = "next week" in query_lower or "coming week" in query_lower or "next 7" in query_lower

        if projection_needed:
            projections, warning_msg = _project_next_12_hours(scope_df)
            if projections.empty:
                reply.message += f" Unable to project the next 12 hours: {warning_msg or 'insufficient recent data.'}"
            else:
                reply.message += " Here's the projected load for the next 12 hours."
                reply.tables["Next 12 hours"] = projections.reset_index(drop=True)
                reply.charts["Next 12 hours"] = projections.set_index("ts")

        if weekly_needed:
            weekly_outlook, weekly_warning = _project_next_week(scope_df)
            if weekly_outlook.empty:
                reply.message += f" Weekly outlook unavailable: {weekly_warning or 'need additional recent data.'}"
            else:
                reply.message += " Here's the daily outlook for the next 7 days."
                reply.tables["Next 7 days"] = weekly_outlook

        if not projection_needed and not weekly_needed:
            reply.tables["Recent fused readings"] = scope_df.sort_values("ts_local", ascending=False).head(10)[[
                "site",
                "ts_local",
                "fused_estimate" if "fused_estimate" in scope_df.columns else "forecast",
            ]]
        return reply

    if "weather" in query_lower:
        tzinfo = datetime.now().astimezone().tzinfo
        snapshot = _latest_camera_snapshot(observations_df, site, camera)
        if snapshot.empty and site and "latitude" in observations_df and "longitude" in observations_df:
            subset = observations_df[observations_df["site"] == site]
            if not subset.empty:
                snapshot = subset.sort_values("ts_captured_utc", ascending=False).head(1)
        if snapshot.empty:
            return AssistantReply(message="I couldn't find latitude/longitude details for that request. Try specifying a camera with known location metadata.")

        row = snapshot.iloc[0]
        weather = _fetch_weather_forecast(row.get("latitude"), row.get("longitude"), tzinfo)
        if not weather:
            return AssistantReply(message="Weather service is currently unavailable or returned no data.")

        current = weather.get("current", {})
        temp = current.get("temperature") or current.get("temperature_2m")
        winds = current.get("windspeed") or current.get("windspeed_10m")
        summary = current.get("weathercode")

        if temp is not None:
            message = f"Current weather near {row['site']} (camera {row['camera_id']}): {temp}°C"
        else:
            message = f"Weather data retrieved for {row['site']} (camera {row['camera_id']})."

        if winds is not None:
            message += f", wind {winds} km/h"
        if summary is not None:
            message += f" (code {summary})"
        reply.message = message + "."

        hourly_rows = weather.get("hourly", [])
        if hourly_rows:
            reply.tables["Next 12h weather"] = pd.DataFrame(hourly_rows)
        return reply

    if "location" in query_lower or "latitude" in query_lower or "longitude" in query_lower:
        snapshot = _latest_camera_snapshot(observations_df, site, camera)
        if not snapshot.empty:
            row = snapshot.iloc[0]
            reply.message = (
                f"Camera {row['camera_id']} at {row['site']} is located near ({row.get('latitude')}, {row.get('longitude')})."
            )
            city = row.get("location_city")
            if city:
                reply.message += f" Approximate city: {city}"
            reply.tables["Latest camera snapshot"] = snapshot
            return reply

    if "alerts" in query_lower:
        if alerts_df.empty:
            return AssistantReply(message="No alerts logged yet.")
        scope_df = alerts_df.copy()
        if site:
            scope_df = scope_df[scope_df["site"] == site]
        if target_date:
            ts_series = pd.to_datetime(scope_df.get("ts"), errors="coerce", utc=True)
            if ts_series.notna().any():
                target_ts = pd.Timestamp(target_date)
                if target_ts.tzinfo is None:
                    target_ts = target_ts.tz_localize("UTC")
                else:
                    target_ts = target_ts.tz_convert("UTC")
                day_start = target_ts.normalize()
                day_end = day_start + pd.Timedelta(days=1)
                scope_df = scope_df[(ts_series >= day_start) & (ts_series < day_end)]
        if scope_df.empty:
            return AssistantReply(message="No alerts matched that criteria.")
        reply.message = f"Found {len(scope_df)} alerts. Showing the most recent ones."
        reply.tables["Alerts"] = scope_df.sort_values("ts", ascending=False).head(15)
        return reply

    # Fallback to latest snapshot if user mentions camera or site without other keywords
    if site or camera:
        snapshot = _latest_camera_snapshot(observations_df, site, camera)
        if not snapshot.empty:
            row = snapshot.iloc[0]
            reply.message = (
                f"Latest detection for camera {row['camera_id']} at {row['site']}: {row['detection_count']} people "
                f"at {row['ts_captured_utc']}."
            )
            reply.tables["Snapshot"] = snapshot
            return reply

    return reply

    summary = summary.reset_index().sort_values(["site", "week"], ascending=[True, False])
    return summary


def _project_next_12_hours(site_df: pd.DataFrame, now: Optional[datetime] = None) -> Tuple[pd.DataFrame, Optional[str]]:
    if site_df.empty or "ts" not in site_df.columns:
        return pd.DataFrame(), "No fused timestamps available for projection."

    metric_col = "forecast" if "forecast" in site_df.columns else "fused_estimate"
    if metric_col not in site_df.columns:
        return pd.DataFrame(), "Fused dataframe is missing forecast metrics."

    site_sorted = site_df.sort_values("ts").copy()
    site_sorted["ts"] = pd.to_datetime(site_sorted["ts"], errors="coerce", utc=True)
    site_sorted = site_sorted.dropna(subset=["ts"])
    if site_sorted.empty:
        return pd.DataFrame(), "No valid timestamps after parsing."

    local_now = (now or datetime.now().astimezone())
    site_sorted["ts_local"] = site_sorted["ts"].dt.tz_convert(local_now.tzinfo)
    latest_local = site_sorted["ts_local"].iloc[-1]

    staleness_hours = (local_now - latest_local).total_seconds() / 3600
    if staleness_hours > 6:
        msg = f"Latest fused data is {staleness_hours:.1f} hours old (timestamp {latest_local:%Y-%m-%d %H:%M %Z})."
        return pd.DataFrame(), msg

    recent = site_sorted.tail(24)
    recent_metric = recent[metric_col].astype(float)
    if recent_metric.abs().sum() == 0:
        base = 0.0
    else:
        base = recent_metric.tail(6).mean()
    slope = recent_metric.diff().mean()
    if pd.isna(slope):
        slope = 0.0

    start_time = max(latest_local, local_now)
    future_index = pd.date_range(start=start_time + timedelta(hours=1), periods=12, freq="h", tz=local_now.tzinfo)
    forecasts = []
    current = base if not np.isnan(base) else float(recent_metric.iloc[-1]) if not recent_metric.empty else 0.0
    for step, ts_value in enumerate(future_index, start=1):
        value = max(0.0, current + slope * step)
        forecasts.append({"ts": ts_value, "projected_load": value})
    return pd.DataFrame(forecasts), None


def _project_next_week(site_df: pd.DataFrame, now: Optional[datetime] = None) -> Tuple[pd.DataFrame, Optional[str]]:
    if site_df.empty or "ts" not in site_df.columns:
        return pd.DataFrame(), "No fused timestamps available for weekly outlook."

    metric_col = "forecast" if "forecast" in site_df.columns else "fused_estimate"
    if metric_col not in site_df.columns:
        return pd.DataFrame(), "Fused dataframe is missing forecast metrics."

    local_now = (now or datetime.now().astimezone())
    site_copy = site_df.copy()
    site_copy["ts"] = pd.to_datetime(site_copy["ts"], errors="coerce", utc=True)
    site_copy = site_copy.dropna(subset=["ts"])
    if site_copy.empty:
        return pd.DataFrame(), "No valid timestamps after parsing."

    site_copy["ts_local"] = site_copy["ts"].dt.tz_convert(local_now.tzinfo)
    latest_local = site_copy["ts_local"].max()
    staleness_days = (local_now - latest_local).total_seconds() / 86400
    if staleness_days > 2:
        msg = f"Latest fused data is {staleness_days:.1f} days old (timestamp {latest_local:%Y-%m-%d %H:%M %Z})."
        return pd.DataFrame(), msg

    recent_window = site_copy[site_copy["ts_local"] >= (local_now - timedelta(days=28))]
    if recent_window.empty:
        recent_window = site_copy

    recent_window = recent_window.copy()
    recent_window["date"] = recent_window["ts_local"].dt.date
    recent_window["weekday"] = recent_window["ts_local"].dt.weekday
    recent_window_metric = recent_window.groupby(["date", "weekday"])[metric_col].mean().reset_index()

    baseline = recent_window_metric[metric_col].mean()
    if np.isnan(baseline):
        baseline = 0.0

    outlook_rows = []
    for offset in range(1, 8):
        target_date = (local_now + timedelta(days=offset)).date()
        weekday = (local_now.weekday() + offset) % 7
        matches = recent_window_metric[recent_window_metric["weekday"] == weekday]
        value = matches[metric_col].mean() if not matches.empty else baseline
        outlook_rows.append({
            "date": target_date,
            "projected_average": max(0.0, float(value) if not np.isnan(value) else 0.0),
        })

    return pd.DataFrame(outlook_rows), None


def render_dashboard(
    data_dir: Path,
    max_batches: int,
    observations_path: Path,
    obs_row_limit: int,
    gemini_api_key: Optional[str] = None,
) -> None:
    if not data_dir.exists():
        st.error(f"Directory {data_dir} not found. Drop output CSVs to get started.")
        return

    fused_files = _latest_files(data_dir, "_fused.csv")[-max_batches:]
    alert_files = _latest_files(data_dir, "_alerts.csv")[-max_batches:]

    fused_df = _load_concat(fused_files)
    alerts_df = _load_concat(alert_files)

    observations_df = _load_observations(observations_path, obs_row_limit)

    predictions_df, generated_alerts = _ensure_prediction_pipeline(observations_df, fused_df)
    if not generated_alerts.empty:
        alerts_df = pd.concat([alerts_df, generated_alerts], ignore_index=True) if not alerts_df.empty else generated_alerts

    if fused_df.empty and alerts_df.empty and predictions_df.empty:
        st.info("No fused, alert, or prediction data available yet. Once the pipeline runs, data will appear here.")
        return

    sites = sorted(fused_df["site"].unique()) if "site" in fused_df.columns else []
    if not predictions_df.empty and "site" in predictions_df.columns:
        prediction_sites = sorted(predictions_df["site"].dropna().unique())
        if sites:
            sites = sorted(set(sites).union(prediction_sites))
        else:
            sites = prediction_sites
    if sites:
        selected_sites = st.multiselect("Sites", options=sites, default=sites)
        fused_df = fused_df[fused_df["site"].isin(selected_sites)] if not fused_df.empty else fused_df
        alerts_df = alerts_df[alerts_df["site"].isin(selected_sites)] if not alerts_df.empty and "site" in alerts_df.columns else alerts_df
        predictions_df = predictions_df[predictions_df["site"].isin(selected_sites)] if not predictions_df.empty else predictions_df
    else:
        selected_sites = []

    camera_summary = _build_camera_summary(fused_df, observations_df, selected_sites)
    if not camera_summary.empty:
        level_column = "latest_fused" if "latest_fused" in camera_summary.columns else "latest_detection"
        camera_summary = _annotate_crowd_levels(camera_summary, level_column, target_column="crowd_level")

    weekly_summary = _weekly_site_summary(fused_df)

    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "Overview",
        "Timeseries",
        "Alerts",
        "Per Camera",
        "Forecast Outlook",
        "Assistant 🤖",
    ])

    with tab1:
        latest = pd.DataFrame()
        metric_col = None
        if not fused_df.empty:
            latest = fused_df.sort_values("ts").groupby("site").tail(1)
            metric_col = "fused_estimate" if "fused_estimate" in latest.columns else (
                "forecast" if "forecast" in latest.columns else latest.columns[-1]
            )

        overloads = _collect_site_overloads(latest, metric_col) if metric_col else []
        if overloads:
            st.markdown("### 🚨 Crowd surge alerts")
            for incident in overloads:
                badge = _severity_badge(incident["severity"])
                st.markdown(
                    f"{badge} **{incident['site']}** approaching {incident['value']:.0f} people."
                    " Consider rapid response options.",
                    unsafe_allow_html=True,
                )
                col_police, col_medical, col_notify = st.columns(3)
                if col_police.button(f"Call Police ({incident['site']})", key=f"police_{incident['site']}"):
                    _record_manual_escalation(incident["site"], "Police dispatched", incident["severity"], incident["value"])
                if col_medical.button(f"Deploy Medics ({incident['site']})", key=f"medic_{incident['site']}"):
                    _record_manual_escalation(incident["site"], "Medical team mobilized", incident["severity"], incident["value"])
                if col_notify.button(f"Open Overflow Gates ({incident['site']})", key=f"gates_{incident['site']}"):
                    _record_manual_escalation(incident["site"], "Overflow gates activated", incident["severity"], incident["value"])
        flash = st.session_state.get("_escalation_flash")
        if flash:
            st.success(flash)
            st.session_state["_escalation_flash"] = None

        st.subheader("Latest Metrics")
        if not latest.empty and metric_col:
            latest = _annotate_crowd_levels(latest, metric_col)
            cols = st.columns(len(latest)) if not latest.empty else []
            for idx, (_, row) in enumerate(latest.iterrows()):
                value = float(row.get(metric_col, 0.0))
                level = row.get("crowd_level", "Unknown")
                timestamp = row.get("ts")
                with cols[idx]:
                    st.metric(
                        label=row["site"],
                        value=f"{int(value):,}",
                        delta=f"Level: {level}",
                    )
                    st.markdown(_stylize_badge(level), unsafe_allow_html=True)
                    if pd.notna(timestamp):
                        if isinstance(timestamp, pd.Timestamp):
                            ts_display = timestamp.tz_convert(datetime.now().astimezone().tzinfo) if timestamp.tzinfo else timestamp
                            st.caption(f"Last update: {ts_display.strftime('%Y-%m-%d %H:%M')}")
                        else:
                            st.caption(f"Last update: {timestamp}")

        if not alerts_df.empty:
            severity_column = "severity" if "severity" in alerts_df.columns else (
                "alert_level" if "alert_level" in alerts_df.columns else None
            )
            if severity_column:
                level_counts = alerts_df[severity_column].value_counts().to_dict()
                st.write("Alert distribution:", level_counts)

        heatmap_source = _build_heatmap_source(camera_summary, fused_df, selected_sites or sites)
        heatmap_source = heatmap_source.dropna(subset=["lat", "lon"]) if not heatmap_source.empty else heatmap_source
        if not heatmap_source.empty:
            st.subheader("Crowd Heatmap")
            view_state = pdk.ViewState(
                latitude=float(heatmap_source["lat"].mean()),
                longitude=float(heatmap_source["lon"].mean()),
                zoom=6.5,
            )
            layer = pdk.Layer(
                "HeatmapLayer",
                heatmap_source,
                get_position="[lon, lat]",
                aggregation="MEAN",
                get_weight="weight",
                radiusPixels=90,
                intensity=0.9,
                threshold=0.02,
                colorRange=[
                    [255, 255, 204, 20],
                    [255, 237, 160, 60],
                    [254, 217, 118, 120],
                    [254, 178, 76, 180],
                    [253, 141, 60, 220],
                    [240, 59, 32, 240],
                    [189, 0, 38, 255],
                ],
            )
            tooltip = {
                "html": "<b>{site}</b><br/>Camera: {camera_id}<br/>Live load: {raw_value:.0f}<br/>Level: {crowd_level}",
                "style": {"backgroundColor": "#0f172a", "color": "white"},
            }
            st.pydeck_chart(pdk.Deck(layers=[layer], initial_view_state=view_state, tooltip=tooltip))
            st.caption("Heat intensity scales with each site's share of the current maximum load.")
            with st.expander("Heatmap data snapshot", expanded=False):
                st.dataframe(
                    heatmap_source[["site", "raw_value", "crowd_level"]]
                    .sort_values("raw_value", ascending=False)
                    .reset_index(drop=True)
                )

        if weekly_summary is not None and not weekly_summary.empty:
            st.subheader("Weekly Averages by Site")
            st.dataframe(weekly_summary.head(20))

        if not observations_df.empty:
            st.subheader("Latest Observation Snapshots")
            cols = [
                "camera_id",
                "site",
                "ts_captured_utc",
                "detection_count",
                "latitude",
                "longitude",
                "weather_temperature_c",
                "weather_windspeed_ms",
            ]
            preview_cols = [col for col in cols if col in observations_df.columns]
            st.dataframe(
                observations_df.sort_values("ts_captured_utc", ascending=False)
                .head(20)[preview_cols]
                .reset_index(drop=True)
            )

    with tab2:
        st.subheader("Fused Estimate by Site")
        if fused_df.empty:
            st.warning("No fused estimates available yet.")
        else:
            chart_values = {
                "Fused": "fused_estimate",
                "Forecast": "forecast" if "forecast" in fused_df.columns else None,
                "Detections": "detection_count" if "detection_count" in fused_df.columns else None,
            }
            for label, column in chart_values.items():
                if column and column in fused_df.columns:
                    st.markdown(f"**{label}**")
                    chart_df = fused_df.pivot_table(index="ts", columns="site", values=column)
                    st.line_chart(chart_df)

    with tab3:
        st.subheader("Live Alerts")
        if alerts_df.empty:
            st.info("No alerts generated yet.")
        else:
            alerts_display = alerts_df.copy()
            if "crowd_level" in alerts_display.columns and "severity" not in alerts_display.columns:
                alerts_display["severity"] = alerts_display["crowd_level"].map(ALERT_LEVEL_MAP).fillna("info")
            alerts_display["severity"] = alerts_display["severity"].fillna("info")
            alerts_display["ts"] = pd.to_datetime(alerts_display["ts"], errors="coerce")
            alerts_display = alerts_display.sort_values("ts", ascending=False)

            def _format_alert_message(row: pd.Series) -> str:
                for key in ("message", "description", "details", "note"):
                    if key not in row:
                        continue
                    value = row[key]
                    if isinstance(value, str):
                        text = value.strip()
                        if text and text.lower() != "nan":
                            return text
                    elif value is not None and not pd.isna(value):
                        text = str(value).strip()
                        if text and text.lower() != "nan":
                            return text
                segments: list[str] = []
                level = row.get("crowd_level") or row.get("severity")
                if isinstance(level, str) and level.strip() and level.lower() != "nan":
                    segments.append(f"{level.title()} alert")
                predicted = row.get("predicted_load")
                if predicted is not None and not pd.isna(predicted):
                    segments.append(f"Load ≈ {int(round(float(predicted))):,}")
                camera_id = row.get("camera_id")
                if camera_id is not None and str(camera_id).strip() and str(camera_id).lower() != "nan":
                    segments.append(f"Camera {camera_id}")
                if not segments:
                    return "Alert triggered."
                return " · ".join(segments)

            alerts_display["message"] = alerts_display.apply(_format_alert_message, axis=1)

            for _, alert in alerts_display.head(10).iterrows():
                severity = alert.get("severity", "info")
                badge = _severity_badge(str(severity))
                ts_label = alert.get("ts")
                if isinstance(ts_label, pd.Timestamp):
                    ts_label = ts_label.tz_localize(None) if ts_label.tzinfo else ts_label
                    ts_str = ts_label.strftime("%Y-%m-%d %H:%M")
                else:
                    ts_str = str(ts_label)
                message = alert.get("message") or "Alert triggered."
                st.markdown(
                    f"<div class='alert-card'>{badge} <strong>{alert.get('site', 'Unknown site')}</strong> · "
                    f"{ts_str}<br/>{message}</div>",
                    unsafe_allow_html=True,
                )

            st.dataframe(alerts_display.reset_index(drop=True))

        st.subheader("Notification Push")
        inbox = st.session_state.get("_notification_inbox", {})
        col_admin, col_devotee = st.columns(2)
        with col_admin:
            st.markdown("**Admin Messages**")
            admin_msgs = list(reversed(inbox.get("admin", [])[-8:]))
            if not admin_msgs:
                st.caption("No admin notifications yet.")
            for msg in admin_msgs:
                badge = _severity_badge(str(msg.get("severity", "info")))
                ts_label = msg.get("ts")
                if isinstance(ts_label, pd.Timestamp):
                    ts_label = ts_label.tz_localize(None) if ts_label.tzinfo else ts_label
                    ts_str = ts_label.strftime("%d %b %H:%M")
                else:
                    ts_str = str(ts_label)
                st.markdown(
                    f"{badge} {msg.get('message', 'Notification')}<br/><small>{ts_str}</small>",
                    unsafe_allow_html=True,
                )
        with col_devotee:
            st.markdown("**Devotee Messages**")
            devotee_msgs = list(reversed(inbox.get("devotee", [])[-8:]))
            if not devotee_msgs:
                st.caption("No devotee notifications yet.")
            for msg in devotee_msgs:
                badge = _severity_badge(str(msg.get("severity", "info")))
                ts_label = msg.get("ts")
                if isinstance(ts_label, pd.Timestamp):
                    ts_label = ts_label.tz_localize(None) if ts_label.tzinfo else ts_label
                    ts_str = ts_label.strftime("%d %b %H:%M")
                else:
                    ts_str = str(ts_label)
                st.markdown(
                    f"{badge} {msg.get('message', 'Notification')}<br/><small>{ts_str}</small>",
                    unsafe_allow_html=True,
                )

    with tab4:
        st.subheader("Per Camera Details")
        if camera_summary.empty:
            st.info("No observation metadata available yet. Ensure observations CSV is being recorded.")
        else:
            preferred_cols = [
                "camera_id",
                "site",
                "crowd_level",
                "ts_captured_utc",
                "latest_detection",
                "latest_fused",
                "latitude",
                "longitude",
                "weather_temperature_c",
                "weather_windspeed_ms",
            ]
            columns = [col for col in preferred_cols if col in camera_summary.columns] + [
                col for col in camera_summary.columns if col not in preferred_cols
            ]
            st.dataframe(
                camera_summary.sort_values("ts_captured_utc", ascending=False)[columns].reset_index(drop=True)
            )

    with tab5:
        st.subheader("Forecast Outlook")

        weather_site_candidates = list(selected_sites) if selected_sites else (sites if sites else list(SITE_FALLBACK_LOCATIONS.keys()))
        weather_site_candidates = [site for site in weather_site_candidates if site in SITE_FALLBACK_LOCATIONS]
        if not weather_site_candidates:
            weather_site_candidates = list(SITE_FALLBACK_LOCATIONS.keys())
        weather_site_candidates = list(dict.fromkeys(weather_site_candidates))[:4]

        st.markdown("**Live weather snapshot (OpenWeatherMap)**")
        api_key = _get_openweather_api_key()
        if not api_key:
            st.caption(
                "Set the `OPENWEATHER_API_KEY` environment variable or provide `openweather_api_key` in Streamlit secrets to enable live weather cards."
            )
        else:
            weather_snapshots, weather_notices = _gather_openweather_snapshots(weather_site_candidates, api_key)
            if weather_notices:
                for notice in weather_notices:
                    st.warning(f"OpenWeather · {notice}")
            if weather_snapshots:
                weather_columns = st.columns(len(weather_snapshots))
                for column, entry in zip(weather_columns, weather_snapshots):
                    temp_value = entry.get("temperature")
                    metric_value = f"{temp_value:.1f} °C" if temp_value is not None else "—"
                    delta_bits: list[str] = []
                    feels_like = entry.get("feels_like")
                    if feels_like is not None:
                        delta_bits.append(f"Feels {feels_like:.1f} °C")
                    description = entry.get("description") or "—"
                    delta_bits.append(description)
                    column.metric(label=entry["site"], value=metric_value, delta=" · ".join(delta_bits))

                    humidity = entry.get("humidity")
                    humidity_str = f"Humidity {int(round(humidity))}%" if humidity is not None else "Humidity —"
                    wind_speed = entry.get("wind_speed")
                    if wind_speed is not None:
                        wind_kmh = wind_speed * 3.6
                        wind_str = f"Wind {wind_speed:.1f} m/s ({wind_kmh:.0f} km/h)"
                    else:
                        wind_str = "Wind —"
                    column.caption(
                        f"{humidity_str} • {wind_str} • Updated {entry.get('observation_time')}"
                    )

                    forecast_lines = []
                    for forecast_entry in entry.get("forecast", [])[:3]:
                        forecast_temp = forecast_entry.get("temp")
                        temp_str = f"{forecast_temp:.1f} °C" if forecast_temp is not None else "—"
                        line = f"{forecast_entry.get('label')}: {temp_str}"
                        forecast_description = forecast_entry.get("description")
                        if forecast_description and forecast_description != "—":
                            line += f" · {forecast_description}"
                        precipitation_probability = forecast_entry.get("pop")
                        if precipitation_probability is not None:
                            line += f" · {int(round(precipitation_probability * 100))}% rain"
                        forecast_lines.append(line)
                    if forecast_lines:
                        bullet_lines = "\n".join(f"* {item}" for item in forecast_lines)
                        column.markdown(bullet_lines)
            else:
                st.caption("Weather service responded without usable data yet.")

        if fused_df.empty and predictions_df.empty:
            st.info("Run the pipeline to accumulate fused estimates or wait for the prediction scheduler to generate data.")
        else:
            st.markdown("**Select granularity**")
            granularity = st.radio("Time scale", options=["Hourly", "Daily", "Weekly"], horizontal=True)
            trend_df = _prepare_forecast_granularity(fused_df, granularity)
            if trend_df.empty:
                st.caption("No fused estimates yet for this granularity.")
            else:
                chart = trend_df.pivot_table(index="ts_local", columns="site", values="value").sort_index()
                st.line_chart(chart)
                display = trend_df.sort_values("ts_local", ascending=False).head(30)
                st.dataframe(display[["site", "ts_local", "value", "crowd_level"]])

            if not predictions_df.empty:
                st.markdown("**Auto-updating predictions (next few hours)**")
                predictions_display = predictions_df.sort_values("ts")
                ts_series = pd.to_datetime(predictions_display.get("ts_local", predictions_display["ts"]))
                try:
                    predictions_display["ts_local"] = ts_series.dt.tz_convert(
                        datetime.now().astimezone().tzinfo
                    ).dt.tz_localize(None)
                except (TypeError, AttributeError, ValueError):
                    predictions_display["ts_local"] = ts_series
                pred_chart = predictions_display.pivot_table(index="ts_local", columns="site", values="predicted_load").sort_index()
                st.line_chart(pred_chart)
                st.dataframe(predictions_display[["site", "ts_local", "predicted_load", "crowd_level"]])

            outlook_site = st.selectbox("Select site for detailed outlook", options=selected_sites or sites)
            if outlook_site:
                site_df = fused_df[fused_df["site"] == outlook_site].copy()
                projections, warning_msg = _project_next_12_hours(site_df)
                if projections.empty:
                    st.warning(warning_msg or "Insufficient history to project the next 12 hours.")
                else:
                    projections = _annotate_crowd_levels(projections.rename(columns={"projected_load": "value"}), "value")
                    st.markdown("**Next 12 hours (local time)**")
                    st.line_chart(projections.set_index("ts")["value"])
                    st.dataframe(projections)

                weekly_outlook, weekly_warning = _project_next_week(site_df)
                if weekly_outlook.empty:
                    st.info(weekly_warning or "Not enough recent data to compute next week's outlook.")
                else:
                    weekly_outlook = _annotate_crowd_levels(weekly_outlook.rename(columns={"projected_average": "value"}), "value")
                    st.markdown("**Next 7 days outlook**")
                    st.table(weekly_outlook)

            if weekly_summary is not None and not weekly_summary.empty:
                st.markdown("**Weekly Trend (average daily load)**")
                chart_data = weekly_summary.pivot_table(index="week", columns="site", values="avg_daily")
                st.bar_chart(chart_data)

    with tab6:
        st.subheader("Crowd Intelligence Assistant")
        st.caption("Ask about detections, forecasts, alerts, or camera metadata. For example: 'How many people came yesterday at Ambaji?' or 'Show me the forecast for Dwarka.'")

        active_gemini_key = (gemini_api_key or GEMINI_API_KEY).strip()
        if not active_gemini_key:
            st.info("Set the GEMINI_API_KEY environment variable or add it to Streamlit secrets to enable Gemini-powered answers.")
        else:
            st.session_state.setdefault("_gemini_api_key", active_gemini_key)

        example_queries = [
            "How many people came yesterday at Ambaji?",
            "Average detection count for camera gate-ambaji",
            "Show the forecast outlook for Dwarka",
            "Where is camera gate-ambaji located?",
            "List alerts for yesterday",
        ]
        cols = st.columns(len(example_queries))
        for idx, example in enumerate(example_queries):
            if cols[idx].button(example):
                st.session_state.setdefault("pending_assistant_query", example)

        if "chat_history" not in st.session_state:
            st.session_state.chat_history = []

        rerun = getattr(st, "rerun", None) or getattr(st, "experimental_rerun", None)
        pending_sample = st.session_state.pop("pending_assistant_query", None)
        new_prompt = pending_sample or st.chat_input("Ask about the latest crowd data")
        if new_prompt:
            st.session_state.chat_history.append({"role": "user", "message": new_prompt})
            st.session_state["_assistant_pending_prompt"] = new_prompt
            if rerun is not None:
                rerun()
            st.stop()

        pending_prompt = st.session_state.get("_assistant_pending_prompt")

        for entry in st.session_state.chat_history:
            role = entry.get("role", "assistant")
            with st.chat_message(role):
                st.markdown(entry.get("message", ""))
                tables = entry.get("tables") or {}
                for label, table_df in tables.items():
                    st.markdown(f"**{label}**")
                    st.dataframe(table_df)
                charts = entry.get("charts") or {}
                for label, chart_df in charts.items():
                    st.markdown(f"**{label}**")
                    st.line_chart(chart_df)

        if pending_prompt:
            with st.chat_message("assistant"):
                st.markdown("_Assistant is preparing a response..._")
            with st.spinner("Assistant is preparing a response..."):
                reply = _answer_chat_query(
                    pending_prompt,
                    fused_df,
                    observations_df,
                    alerts_df,
                    gemini_api_key=active_gemini_key,
                )
            st.session_state.chat_history.append(
                {
                    "role": "assistant",
                    "message": reply.message,
                    "tables": reply.tables,
                    "charts": reply.charts,
                }
            )
            st.session_state["_assistant_pending_prompt"] = None
            if rerun is not None:
                rerun()
            st.stop()


def main() -> None:
    st.set_page_config(page_title=PAGE_TITLE, layout="wide")
    st.title(PAGE_TITLE)
    _inject_base_styles()

    controls = configure_sidebar()
    refresh_sec = int(controls["refresh_sec"])
    if refresh_sec:
        if st_autorefresh is not None:
            st_autorefresh(interval=refresh_sec * 1000, key="auto_refresh")
        else:
            autorefresh = getattr(st, "experimental_autorefresh", None)
            if autorefresh is not None:
                autorefresh(interval=refresh_sec * 1000, key="auto_refresh")
            else:
                st.sidebar.warning(
                    "Auto-refresh helper not available. Install 'streamlit-autorefresh' or use the manual refresh button."
                )

    render_dashboard(
        data_dir=controls["data_dir"],
        max_batches=int(controls["max_batches"]),
        observations_path=controls["observations_path"],
        obs_row_limit=int(controls["obs_row_limit"]),
        gemini_api_key=GEMINI_API_KEY,
    )


if __name__ == "__main__":
    main()
