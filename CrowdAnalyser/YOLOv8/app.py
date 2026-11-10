import os
import threading
import time
from typing import Dict, List, Tuple, Optional
import cv2
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO

# GPIO imports with fallback for Windows
try:
    from gpiozero import Servo
    import RPi.GPIO as GPIO
    RPI_AVAILABLE = True
except ImportError:
    # Mock GPIO for Windows/development
    class MockServo:
        def __init__(self, pin):
            self.pin = pin
            self.state = "closed"
        def max(self):
            self.state = "open"
            print(f"Mock: Servo on pin {self.pin} opened (180°)")
        def min(self):
            self.state = "closed"
            print(f"Mock: Servo on pin {self.pin} closed (0°)")
    
    Servo = MockServo
    RPI_AVAILABLE = False

# -----------------------------
# Configuration
# -----------------------------
WEIGHTS_CANDIDATES = [
    "D:\\count of people\\YOLOv8\\runs\\train\\crowd_count_model6\\weights\\best.pt"
]

# Provide placeholders for the four video sources.
VIDEO_SOURCES: Dict[int, str] = {
    1: "C:\\Users\\mayur\\Downloads\\SmellyIndian.mp4",
    2: "C:\\Users\\mayur\\Downloads\\NotSmellyAmericans.mp4",
    3: "C:\\Users\\mayur\\Downloads\\SmellyIndian.mp4",
    4: "C:\\Users\\mayur\\Downloads\\NotSmellyAmericans.mp4"
}

# Optional: static map positions per zone (lat, lng) for the frontend markers
ZONE_POSITIONS: Dict[int, Tuple[float, float]] = {
    1: (20.887939, 70.401988),
    2: (20.887683, 70.401130),
    3: (20.888034, 70.400655),
    4: (20.887577, 70.401800),
}

# Inference settings
CONF_THRESH = 0.35
IOU_THRESH = 0.45
PERSON_CLASSES = [0]  # COCO person class id
TARGET_FPS = 30  # Target frame rate for video streaming

# GPIO Setup for 4 gates
GATE_PINS = [17, 18, 27, 22]  # example GPIO pins
gates = [Servo(pin) for pin in GATE_PINS]

# -----------------------------
# Helper Functions
# -----------------------------
def pick_weights() -> str:
    for p in WEIGHTS_CANDIDATES:
        if os.path.exists(p):
            return p
    return WEIGHTS_CANDIDATES[-1]

def density_bucket(count: int) -> str:
    # Simple bucketing based solely on people count in the frame
    if count >= 30:
        return "high"
    if count >= 10:
        return "moderate"
    return "low"

def draw_annotations(frame, res) -> np.ndarray:
    annotated = frame.copy()
    try:
        boxes = res.boxes.xyxy.cpu().numpy()
        scores = res.boxes.conf.cpu().numpy()
        classes = res.boxes.cls.cpu().numpy().astype(int)
    except Exception:
        boxes = np.array(res.boxes.xyxy)
        scores = np.array(res.boxes.conf)
        classes = np.array(res.boxes.cls).astype(int)

    people_count = 0
    for box, score, cls in zip(boxes, scores, classes):
        if int(cls) in PERSON_CLASSES:
            x1, y1, x2, y2 = map(int, box)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label = f"Person {float(score):.2f}"
            cv2.putText(annotated, label, (x1, max(0, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            people_count += 1

    cv2.putText(annotated, f"People: {people_count}", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    return annotated

def generate_frames(camera_id: int, annotated: bool = False):
    """Generator for video streaming with frame rate control"""
    actual_source = VIDEO_SOURCES.get(camera_id)
    if actual_source is None:
        return
    
    try:
        actual_source = int(actual_source)
    except:
        pass
    
    cap = cv2.VideoCapture(actual_source)
    
    # Get original FPS and calculate delay
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    if original_fps == 0:
        original_fps = 30
    
    frame_delay = 1.0 / TARGET_FPS
    
    try:
        while True:
            start_time = time.time()
            
            success, frame = cap.read()
            if not success:
                # Loop the video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            
            if annotated and _model is not None:
                results = _model(
                    frame,
                    conf=CONF_THRESH,
                    iou=IOU_THRESH,
                    classes=PERSON_CLASSES,
                    verbose=False,
                )
                frame = draw_annotations(frame, results[0])
            
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if not ret:
                continue
                
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Control frame rate
            elapsed = time.time() - start_time
            sleep_time = max(0, frame_delay - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    finally:
        cap.release()

# -----------------------------
# Flask App Setup
# -----------------------------
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global model (loaded once)
_model: Optional[YOLO] = None

# -----------------------------
# API Routes
# -----------------------------

@app.route('/')
def api_info():
    """API information endpoint"""
    return jsonify({
        "service": "IoT Building Management API",
        "version": "1.0.0",
        "endpoints": {
            "frames": {
                "video_feed": "/video_feed/<1-4>",
                "video_feed_annotated": "/video_feed_annotated/<1-4>",
                "description": "Returns streaming video feed"
            },
            "api": {
                "zones": "/zones",
                "description": "Compute zone counts on demand"
            },
            "control": {
                "gates": "/gate?gate=<1-4>&action=<open|close>",
                "sound": "/sound?zone=<1-4>",
                "description": "Control gates and monitor sound levels"
            }
        }
    })

@app.route('/video_feed/<int:camera_id>')
def video_feed(camera_id: int):
    """Raw video feed endpoint"""
    if camera_id not in VIDEO_SOURCES:
        return jsonify({"error": "invalid camera id"}), 400
    
    return Response(
        generate_frames(camera_id, annotated=False),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/video_feed_annotated/<int:camera_id>')
def video_feed_annotated(camera_id: int):
    """Annotated video feed endpoint"""
    if camera_id not in VIDEO_SOURCES:
        return jsonify({"error": "invalid camera id"}), 400
    if _model is None:
        return jsonify({"error": "model not loaded"}), 500
    
    return Response(
        generate_frames(camera_id, annotated=True),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/zones')
def get_zones():
    """Compute per-zone counts on demand (one frame each)."""
    if _model is None:
        return jsonify({"error": "model not loaded"}), 500
    zones = []
    for zone_id in sorted(VIDEO_SOURCES.keys()):
        name = f"Zone {zone_id}"
        pos = ZONE_POSITIONS.get(zone_id, (0.0, 0.0))
        
        actual_source = VIDEO_SOURCES[zone_id]
        try:
            actual_source = int(actual_source)
        except:
            pass
        
        cap = cv2.VideoCapture(actual_source)
        if not cap.isOpened():
            zones.append({
                "id": zone_id,
                "name": name,
                "position": pos,
                "density": "low",
                "count": 0,
                "error": "no frame"
            })
            continue
        
        try:
            ok, frame = cap.read()
            if not ok:
                zones.append({
                    "id": zone_id,
                    "name": name,
                    "position": pos,
                    "density": "low",
                    "count": 0,
                    "error": "no frame"
                })
                continue
            
            results = _model(
                frame,
                conf=CONF_THRESH,
                iou=IOU_THRESH,
                classes=PERSON_CLASSES,
                verbose=False,
            )
            res = results[0]
            try:
                classes = res.boxes.cls.cpu().numpy().astype(int)
            except Exception:
                classes = np.array(res.boxes.cls).astype(int)
            count = int(np.sum(np.isin(classes, PERSON_CLASSES)))
            bucket = density_bucket(count)
            zones.append({
                "id": zone_id,
                "name": name,
                "position": pos,
                "level": bucket,
                "density": bucket,  # Add both for compatibility
                "count": count,
                "description": {
                    "low": "Few people present",
                    "moderate": "Some crowd present",
                    "high": "Heavy crowd"
                }[bucket]
            })
        finally:
            cap.release()
    
    return jsonify(zones)

@app.route('/gate', methods=['GET'])
def control_gate():
    """Control gate opening/closing"""
    gate_id = request.args.get('gate', type=int)
    action = request.args.get('action', type=str)

    if gate_id not in range(1, 5):
        return jsonify({"error": "Invalid gate id (1-4)"}), 400

    servo = gates[gate_id - 1]

    if action == "open":
        servo.max()   # 180°
        return jsonify({"gate": gate_id, "status": "opened"})
    elif action == "close":
        servo.min()   # 0°
        return jsonify({"gate": gate_id, "status": "closed"})
    else:
        return jsonify({"error": "Invalid action (open/close)"}), 400

@app.route('/sound', methods=['GET'])
def sound_level():
    """Measure sound level in dB with per-zone variation"""
    zone_id = request.args.get('zone', type=int, default=1)
    
    # Generate mock data with zone-specific variation
    base_db = 55.0
    zone_offsets = {1: 0, 2: 5, 3: -3, 4: 8}
    offset = zone_offsets.get(zone_id, 0)
    
    # Add some random variation
    decibels = base_db + offset + np.random.randn() * 5
    decibels = max(30.0, min(95.0, decibels))  # Clamp between 30-95 dB
    
    return jsonify({
        "zone": zone_id,
        "decibel": round(decibels, 2)
    })

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": time.time()
    })

# -----------------------------
# App Lifecycle
# -----------------------------
def startup():
    """Load YOLO model once; process frames on demand"""
    global _model
    weights_path = pick_weights()
    print(f"Loading YOLO model from: {weights_path}")
    _model = YOLO(weights_path)
    print("Model loaded successfully!")

# Initialize everything before running
startup()

@app.teardown_appcontext
def shutdown(error=None):
    """Clean up resources"""
    return None

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)