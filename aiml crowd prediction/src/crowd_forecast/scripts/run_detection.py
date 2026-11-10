"""CLI to run YOLO-based crowd detection on images or video frames."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast import DetectionConfig, Detector, crowd_count_from_detections


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", help="Image paths to process" )
    parser.add_argument("--model-path", default="yolov8n.pt", help="Ultralytics YOLO weights file")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold")
    parser.add_argument("--max-det", type=int, default=300, help="Maximum number of detections per image")
    parser.add_argument("--device", default=None, help="Torch device string, e.g. 'cpu' or 'cuda:0'")
    parser.add_argument("--output", type=Path, default=None, help="Optional JSON file for results")
    parser.add_argument("--stream-id", default=None, help="Optional stream identifier")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = DetectionConfig(
        model_path=args.model_path,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        max_detections=args.max_det,
        device=args.device,
        stream_id=args.stream_id,
    )

    detector = Detector(config=config)
    results = []
    for path in args.inputs:
        result = detector.detect(path)
        count = crowd_count_from_detections(result, config.person_class_names)
        print(f"{path}: {count} people detected")
        results.append({"path": path, **result.to_dict(), "people_count": count})

    if args.output:
        args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Detection summary written to {args.output}")


if __name__ == "__main__":
    main()