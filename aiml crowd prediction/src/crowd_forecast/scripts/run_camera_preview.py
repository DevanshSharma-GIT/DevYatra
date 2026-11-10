"""Live YOLO preview with bounding boxes and crowd counts."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Dict, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from crowd_forecast.capture import CameraConfig, CaptureSettings, build_detector  # noqa: E402
from crowd_forecast.scripts.run_camera_capture import load_camera_configs  # noqa: E402
from crowd_forecast.detection import crowd_count_from_detections  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True, help="Path to camera config (JSON/YAML)")
    parser.add_argument("--camera-id", type=str, default=None, help="Camera ID to preview (defaults to first entry)")
    parser.add_argument("--model-path", type=str, default="yolov8n.pt", help="YOLO weights file")
    parser.add_argument("--confidence", type=float, default=0.25, help="Confidence threshold override")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold override")
    parser.add_argument("--max-det", type=int, default=300, help="Maximum detections per frame")
    parser.add_argument("--device", type=str, default=None, help="Torch device string (e.g. cpu, cuda:0)")
    parser.add_argument("--person-classes", type=str, nargs="+", default=["person"], help="Class labels treated as people")
    parser.add_argument("--frame-skip", type=int, default=1, help="Only show every Nth frame to lighten load")
    return parser.parse_args()


def _select_camera(cameras: Dict[str, CameraConfig], camera_id: Optional[str]) -> CameraConfig:
    if camera_id:
        if camera_id not in cameras:
            raise ValueError(f"Camera id '{camera_id}' not found; available ids: {list(cameras)}`")
        return cameras[camera_id]
    if not cameras:
        raise ValueError("No cameras defined in configuration")
    return next(iter(cameras.values()))


def main() -> None:
    args = parse_args()

    try:
        import cv2  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime dependency only
        raise RuntimeError("opencv-python is required for preview") from exc

    cams = load_camera_configs(args.config)
    cameras = {cam.camera_id: cam for cam in cams}
    camera = _select_camera(cameras, args.camera_id)

    detector_overrides = {
        "conf_threshold": args.confidence,
        "iou_threshold": args.iou,
        "max_detections": args.max_det,
        "device": args.device,
    }
    detector = build_detector(args.model_path, detector_overrides)

    settings = CaptureSettings(person_classes=tuple(cls.lower() for cls in args.person_classes))
    person_classes = {cls.lower() for cls in settings.person_classes}

    source = camera.source
    capture = cv2.VideoCapture(int(source) if source.isdigit() else source)
    if not capture.isOpened():
        raise RuntimeError(f"Failed to open camera source '{source}'")

    print("Press 'q' to exit the preview window.")
    window_name = f"YOLO Crowd Preview - {camera.camera_id}"
    frame_index = 0
    prev_time = time.perf_counter()
    fps = 0.0

    try:
        while True:
            ret, frame = capture.read()
            if not ret:
                print("[preview] stream ended")
                break
            if frame_index % max(1, args.frame_skip) != 0:
                frame_index += 1
                continue

            result = detector.detect(frame, stream_id=camera.stream_id)
            people_count = crowd_count_from_detections(result, settings.person_classes)

            for det in result.detections:
                x1, y1, x2, y2 = map(int, det.bbox.as_tuple())
                class_name = det.class_name
                conf = det.confidence
                is_person = class_name.lower() in person_classes
                color = (0, 255, 0) if is_person else (0, 165, 255)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"{class_name} {conf:.2f}"
                cv2.putText(frame, label, (x1, max(0, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

            now = time.perf_counter()
            dt = now - prev_time
            if dt > 0:
                fps = 1.0 / dt
            prev_time = now

            overlay = f"People: {people_count}  |  FPS: {fps:.1f}"
            cv2.rectangle(frame, (0, 0), (300, 34), (0, 0, 0), -1)
            cv2.putText(frame, overlay, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

            frame_index += 1
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
