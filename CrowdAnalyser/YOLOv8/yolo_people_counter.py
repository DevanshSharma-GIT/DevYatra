"""
yolo_people_counter.py

Usage examples:
    # run on webcam 0:
    python yolo_people_counter.py --source 0 --weights runs/train/weights/best.pt

    # run on video file and save output:
    --save_output output.mp4

    # run on single image:
    python yolo_people_counter.py --source some_image.jpg --weights runs/train/weights/best.pt

    # run on folder of images:
    python yolo_people_counter.py --source /path/to/images_folder --weights runs/train/weights/best.pt
"""

import argparse
import os
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO  # ultralytics package

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--weights", required=True, help="runs/detect/crowd_count_model6/weights/best.pt")
    p.add_argument("--source", default=0,
                   help="Source: 0 (webcam), path to video file, path to image, or folder of images")
    p.add_argument("--conf_thresh", type=float, default=0.3, help="Confidence threshold")
    p.add_argument("--iou_thresh", type=float, default=0.45, help="NMS IoU threshold")
    p.add_argument("--person_classes", nargs="+", type=int, default=[0],
                   help="Class id(s) that correspond to 'person' in your dataset (default: 0 for COCO)")
    p.add_argument("--skip_frames", type=int, default=0,
                   help="Process every (skip_frames+1)-th frame to speed up; 0 = process all frames")
    p.add_argument("--save_output", default=None, help="Path to save output video (mp4). If omitted, don't save.")
    p.add_argument("--real_world_area_m2", type=float, default=None,
                   help="Optional: area (in square meters) captured in each frame. If provided, density will be people/m^2.")
    p.add_argument("--display_scale", type=float, default=1.0,
                   help="Scale factor to display window size (1.0 = original)")
    return p.parse_args()

def is_image_file(path):
    return Path(path).suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".tiff"]

def draw_box_and_label(frame, xyxy, label, conf):
    x1, y1, x2, y2 = map(int, xyxy)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
    txt = f"{label} {conf:.2f}"
    (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 6, y1), (0, 255, 0), -1)
    cv2.putText(frame, txt, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

def process_frame_with_model(model, frame, args):
    """
    Run model on frame and return:
      - annotated_frame (copy of input frame with boxes)
      - people_count (int)
      - people_boxes (list of [x1,y1,x2,y2,conf])
    """
    # ultralytics model returns a Results sequence; take first
    results = model(frame, conf=args.conf_thresh, iou=args.iou_thresh, verbose=False)
    res = results[0]  # first (and only) result
    annotated = frame.copy()
    people_boxes = []

    # Results.boxes.xyxy, .conf, .cls are tensors/numpy-like. handle gracefully
    try:
        boxes = res.boxes.xyxy.cpu().numpy()  # Nx4
        scores = res.boxes.conf.cpu().numpy()  # N
        classes = res.boxes.cls.cpu().numpy().astype(int)  # N
    except Exception:
        # fallback if those attrs are lists
        boxes = np.array(res.boxes.xyxy)
        scores = np.array(res.boxes.conf)
        classes = np.array(res.boxes.cls).astype(int)

    h, w = frame.shape[:2]
    for box, score, cls in zip(boxes, scores, classes):
        # if this class id is a 'person' class
        if int(cls) in args.person_classes:
            x1, y1, x2, y2 = box
            people_boxes.append([x1, y1, x2, y2, float(score)])
            draw_box_and_label(annotated, (x1, y1, x2, y2), "person", float(score))

    people_count = len(people_boxes)
    return annotated, people_count, people_boxes

def calc_density(people_count, frame_shape, args):
    """
    If real_world_area_m2 provided -> people per m^2
    Else -> people per 10k pixels (normalized) for a stable, comparable metric
    """
    h, w = frame_shape[:2]
    frame_area = w * h
    if args.real_world_area_m2 and args.real_world_area_m2 > 0:
        density = people_count / args.real_world_area_m2  # people / m^2
        density_str = f"{density:.3f} ppl/m^2"
    else:
        # normalize per 10,000 pixels
        unit = 10000.0
        density = people_count / (frame_area / unit) if frame_area > 0 else 0.0
        density_str = f"{density:.3f} ppl/10kpx"
    return density, density_str

def main():
    args = parse_args()

    # load model
    print(f"[INFO] Loading YOLO weights from: {args.weights}")
    model = YOLO(args.weights)  # will auto-select device if CUDA available

    # If source is an image folder
    if os.path.isdir(str(args.source)):
        image_paths = sorted([str(Path(args.source) / p) for p in os.listdir(args.source) if is_image_file(p)])
        if not image_paths:
            print("[ERROR] No images found in folder.")
            return
        process_images(image_paths, model, args)
        return

    # If source is single image
    if isinstance(args.source, str) and is_image_file(args.source):
        img = cv2.imread(args.source)
        if img is None:
            print("[ERROR] Could not read image:", args.source)
            return
        annotated, people_count, boxes = process_frame_with_model(model, img, args)
        density, density_str = calc_density(people_count, img.shape, args)
        cv2.putText(annotated, f"People: {people_count}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,255), 2)
        cv2.putText(annotated, f"Density: {density_str}", (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
        out_path = Path("annotated_image.jpg")
        cv2.imwrite(str(out_path), annotated)
        print(f"[INFO] People: {people_count} | {density_str} | saved annotated -> {out_path}")
        cv2.imshow("Result", cv2.resize(annotated, (int(annotated.shape[1]*args.display_scale), int(annotated.shape[0]*args.display_scale))))
        cv2.waitKey(0)
        cv2.destroyAllWindows()
        return

    # Otherwise treat source as video or webcam index
    # handle numeric webcam index
    source = args.source
    try:
        cam_index = int(args.source)
        source = cam_index
    except Exception:
        source = args.source

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print("[ERROR] Could not open video source:", args.source)
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

    writer = None
    if args.save_output:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save_output, fourcc, fps, (width, height))
        print(f"[INFO] Saving output to {args.save_output} (fps={fps}, size=({width},{height}))")

    frame_idx = 0
    t0 = time.time()
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if args.skip_frames and (frame_idx % (args.skip_frames + 1) != 0):
                frame_idx += 1
                continue

            annotated, people_count, boxes = process_frame_with_model(model, frame, args)
            density, density_str = calc_density(people_count, frame.shape, args)

            # overlay stats
            cv2.putText(annotated, f"People: {people_count}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,255), 2)
            cv2.putText(annotated, f"Density: {density_str}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
            elapsed = time.time() - t0
            fps_text = f"FPS: {1.0 / (max(1e-6, elapsed/frame_idx)):.1f}" if frame_idx>0 else "FPS: -"
            cv2.putText(annotated, fps_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)

            # show
            display = cv2.resize(annotated, (int(annotated.shape[1]*args.display_scale), int(annotated.shape[0]*args.display_scale)))
            cv2.imshow("YOLO People Counter", display)

            # write if required
            if writer:
                writer.write(annotated)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

            frame_idx += 1

    except KeyboardInterrupt:
        print("[INFO] Interrupted by user")

    finally:
        cap.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()
        print("[INFO] Finished. Processed frames:", frame_idx)

def process_images(image_paths, model, args):
    out_dir = Path("annotated_images")
    out_dir.mkdir(exist_ok=True)
    for p in image_paths:
        img = cv2.imread(p)
        if img is None:
            print("[WARN] Could not read:", p)
            continue
        annotated, people_count, boxes = process_frame_with_model(model, img, args)
        density, density_str = calc_density(people_count, img.shape, args)
        cv2.putText(annotated, f"People: {people_count}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,255,255), 2)
        cv2.putText(annotated, f"Density: {density_str}", (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
        out_path = out_dir / (Path(p).stem + "_annotated.jpg")
        cv2.imwrite(str(out_path), annotated)
        print(f"[INFO] {p} -> people: {people_count}, {density_str} -> saved {out_path}")

if __name__ == "__main__":
    main()
