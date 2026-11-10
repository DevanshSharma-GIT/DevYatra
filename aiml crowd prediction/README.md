# Gujarat Pilgrimage Crowd Intelligence Module

This repository hosts a modular AI/ML pipeline for synthetic data generation, crowd-traffic forecasting, real-time detection fusion, and alerting for four Gujarat pilgrimage hubs (Ambaji, Somnath, Dwarka, Pavagadh).

> **Status:** Synthetic generation, feature engineering, forecasting (SARIMAX + advanced ensembles), detection, fusion, alerting, and real-time ingestion pipelines are implemented with automated tests.

## Project layout (abridged)

```text
├── data/                              # Generated synthetic datasets & features
├── models/
│   ├── baseline/                      # SARIMAX artefacts & metrics
│   └── advanced/                      # LightGBM/XGBoost/LSTM artefacts & metrics
├── src/
│   └── crowd_forecast/
│       ├── config.py                  # Synthetic data knobs
│       ├── synthetic.py               # Reproducible data generator
│       ├── features.py                # Feature engineering utilities
│       ├── model_utils.py             # Time splits & metrics helpers
│       ├── fusion.py                  # Forecast/detection signal fusion
│       ├── alerting.py                # Threshold-based alert generation
│       ├── ingestion.py               # Directory polling + stateful ingestion
│       ├── streaming.py               # Queue-based ingestion utilities
│       ├── pipeline.py                # End-to-end orchestration helpers
│       ├── models/
│       │   ├── baseline.py            # SARIMAX trainer
│       │   └── advanced.py            # LightGBM/XGBoost/LSTM ensemble trainer
│       ├── detection.py               # YOLO-based real-time detection helpers
│       └── scripts/
│           ├── generate_synthetic.py  # CLI for synthetic data
│           ├── train_baseline.py      # CLI for SARIMAX baseline
│           └── train_advanced.py      # CLI for advanced ensemble
│           ├── run_detection.py       # CLI for YOLO detections
│           ├── run_fusion.py          # CLI for fusing forecasts + detections
│           ├── run_alerts.py          # CLI for alert generation
│           ├── run_pipeline.py        # CLI for full fuse+alert pass
│           ├── run_realtime.py        # CLI for continuous ingestion + pipeline
│           └── run_stream_listener.py # CLI for Redis-streamed ingestion
├── dashboard/
│   └── app.py                         # Streamlit dashboard for fused outputs
└── tests/                             # End-to-end and unit coverage
```

## Getting started

1. Create and activate a Python 3.10+ environment.
1. Install dependencies:

```powershell
pip install -r requirements.txt
```

1. Run the full test suite:

```powershell
pytest
```

## Typical workflow

### Step 1 – Generate or refresh synthetic data

```powershell
python src/crowd_forecast/scripts/generate_synthetic.py --output-dir data
```

### Step 2 – Build the feature matrix

```powershell
python - <<'PY'
import pandas as pd
from crowd_forecast.features import build_features

df = pd.read_csv("data/synthetic_dataset.csv")
features = build_features(df)
features.to_csv("data/features_full.csv", index=False)
PY
```

### Step 3 – Train baseline SARIMAX models

```powershell
python src/crowd_forecast/scripts/train_baseline.py --features-path data/features_full.csv --output-dir models/baseline
```

### Step 4 – Train boosted/LSTM ensembles (improved accuracy)

```powershell
python src/crowd_forecast/scripts/train_advanced.py --features-path data/features_full.csv --output-dir models/advanced
```

### Step 5 – Run real-time detection on sample frames

```powershell
python src/crowd_forecast/scripts/run_detection.py --model-path yolov8n.pt sample_frame.jpg
```

### Step 6 – Fuse detections with forecasts

```powershell
python src/crowd_forecast/scripts/run_fusion.py --forecasts data/forecasts.csv --detections data/detections.csv --output data/fused.csv
```

### Step 7 – Generate alerts from fused estimates

```powershell
python src/crowd_forecast/scripts/run_alerts.py --fused data/fused.csv --output data/alerts.csv --default-capacity 80000
```

### Step 8 – Run the full pipeline (fuse + alert) in one shot

```powershell
python src/crowd_forecast/scripts/run_pipeline.py `
    --forecasts data/forecasts.csv `
    --detections data/detections.csv `
    --fused-output data/fused.csv `
    --alerts-output data/alerts.csv
```

### Step 9 – Enable near real-time ingestion + pipeline execution

```powershell
python src/crowd_forecast/scripts/run_realtime.py `
    --forecast-dir data/incoming/forecasts `
    --detection-dir data/incoming/detections `
    --output-dir data/processed `
    --state-path data/processed/ingestion_state.json `
    --archive-dir data/processed/archive
```

Drop new CSVs (with matching filenames) into the `forecast-dir` and `detection-dir`; the watcher will fuse, alert, archive processed inputs, and emit outputs into `output-dir`. Pass `--allow-forecast-only` if you need to proceed when detections lag.

### Step 10 – Consume pipeline inputs from Redis queues

```powershell
python src/crowd_forecast/scripts/run_stream_listener.py `
    --redis-url redis://localhost:6379/0 `
    --forecast-queue crowd_forecasts `
    --detection-queue crowd_detections `
    --output-dir data/processed `
    --allow-forecast-only
```

Push JSON messages shaped like `{ "key": "batch-id", "records": [ ... ] }` onto the forecast and detection queues (each record mirrors the CSV schemas). The listener fuses and alerts on arrival, with optional `--dry-run` for smoke testing.

### Step 11 – Launch the live dashboard

```powershell
streamlit run dashboard/app.py
```

Point the sidebar to your processed output directory to explore fused crowd estimates, alert trends, and per-site metrics. Use the slider to enable auto-refresh (powered by `streamlit-autorefresh`) or tap **Refresh now** for manual reruns during ingestion runs.

### Configure OpenWeatherMap (live weather cards)

The dashboard surfaces real-time weather for Ambaji, Dwarka, Somnath, and Pavagadh through the OpenWeatherMap API. A demo key is already baked into the dashboard for quick local runs, but you can override it by exporting your own before launching:

```powershell
$env:OPENWEATHER_API_KEY = "your-openweather-key"
```

For persistent keys or Streamlit Cloud deployments, add the secret instead:

```toml
# .streamlit/secrets.toml
openweather_api_key = "your-openweather-key"

# or nested
[openweather]
api_key = "your-openweather-key"
```

Once populated, the Forecast Outlook tab automatically fetches and caches current conditions plus short-term forecasts for the four flagship temples.

### Step 12 – Capture live camera feeds with YOLO (optional)

1. Duplicate `configs/cameras.example.yaml` and update the `source` fields for your webcams or RTSP/HTTP streams and map each camera to a site name used elsewhere in the pipeline. Populate `latitude`, `longitude`, and `timezone` (IANA identifier) so downstream logs can align detections with local conditions. If coordinates are omitted, the capture CLI will perform a one-time GeoIP lookup on start-up (`ipapi.co`) so that observations still include a coarse location.
2. Launch the capture loop in simulate mode to verify wiring:

   ```powershell
   python -m crowd_forecast.scripts.run_camera_capture `
       --config configs/cameras.example.yaml `
       --detection-dir data/incoming/detections `
       --forecast-dir data/incoming/forecasts `
       --metadata-dir data/processed/metadata `
       --max-batches 1 `
       --simulate
   ```

   This drops aligned detection/forecast CSVs into the ingestion directories, allowing `run_realtime.py` to pick them up automatically.

3. When hardware is ready, remove `--simulate` and provide your YOLO weights path (default `yolov8n.pt`). Optionally supply `--processed-dir data/processed` to emit fused/alert CSVs immediately after each batch.

Need a quick sanity-check while wiring? Use the live preview helper to render bounding boxes and counts in a window without writing CSVs:

```powershell
python -m crowd_forecast.scripts.run_camera_preview --config configs/cameras.yaml --camera-id gate-ambaji
```

`run_camera_capture.py` generates lightweight exponential-smoothed forecasts to accompany each detection batch, ensuring the fusion pipeline has both signals even before a full model retrain is available.

Each CLI emits per-site metrics JSON and a model card capturing splits, artefact paths, and provenance. The new queue listener and dashboard components round out real-time monitoring—extend them further with your preferred broker or UI branding as you deploy.

### Step 13 – Log 5-minute observation snapshots for future model tuning

Capture enriched per-camera observations by appending `--record-csv` (set your interval to five minutes with `--interval-sec 300`):

```powershell
python -m crowd_forecast.scripts.run_camera_capture `
    --config configs/cameras.yaml `
    --interval-sec 300 `
    --record-csv data/incoming/observations.csv `
    --detection-dir data/incoming/detections `
    --forecast-dir data/incoming/forecasts `
    --events-dir data/incoming/events
```

Each batch appends a row per camera containing the UTC and local capture times, detection counts/confidence, frame sample statistics, geo coordinates, coarse location metadata, and current weather (sourced from Open-Meteo, cached by default for five minutes to avoid hammering the API). Use `--record-weather-cache-minutes 15` (or any value) to widen the cache interval, `--record-no-weather` if the host is offline, and `--record-disable-auto-location` when you already provide precise coordinates and want to skip GeoIP. Additional columns capture the local hour and a day/night flag to simplify downstream feature engineering. The resulting CSV is ready for incremental training or analytics.
