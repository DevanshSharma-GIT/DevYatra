"""CLI entry-point to generate synthetic pilgrimage visitor datasets."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import (  # noqa: E402
    AppConfig,
    SyntheticGenerationSettings,
    generate_synthetic_dataset,
    save_dataset,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, default=3, help="Number of years to generate (default: 3)")
    parser.add_argument("--start-year", type=int, default=None, help="Start year for generation")
    parser.add_argument("--hourly", action="store_true", help="Emit hourly time slots in addition to daily totals")
    parser.add_argument("--seed", type=int, default=1234, help="Seed for RNG (default: 1234)")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.1,
        help="Allowed deviation ratio from annual anchors before scaling (default: 0.1)",
    )
    parser.add_argument("--output", type=Path, default=Path("data/synthetic_dataset.csv"), help="Output CSV path")
    parser.add_argument(
        "--disable-weather",
        action="store_true",
        help="Disable weather modifiers for synthetic generation",
    )
    parser.add_argument(
        "--disable-outliers",
        action="store_true",
        help="Disable outlier spikes in synthetic generation",
    )
    parser.add_argument(
        "--record-booked-slots",
        action="store_true",
        help="Populate booked_slots with synthetic ticketing counts",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = AppConfig.default()
    settings = SyntheticGenerationSettings(
        years=args.years,
        start_year=args.start_year,
        include_hourly=args.hourly,
        global_tolerance=args.tolerance,
        enable_weather=not args.disable_weather,
        enable_outliers=not args.disable_outliers,
        record_booked_slots=args.record_booked_slots,
    )
    df, metadata = generate_synthetic_dataset(config=config, settings=settings, seed=args.seed)
    save_dataset(df, args.output)

    info_path = args.output.with_suffix(".meta.json")
    info_path.write_text(
        json.dumps(asdict(metadata), indent=2),
        encoding="utf-8",
    )
    print(f"Synthetic dataset saved to {args.output}")
    print(f"Metadata written to {info_path}")


if __name__ == "__main__":
    main()
