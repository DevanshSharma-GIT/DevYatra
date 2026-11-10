"""
Consolidated Flask application for CBC D-02 backend.
This replaces the original app.py with a more modular and organized structure.
"""
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime
import requests
try:  # pragma: no cover - optional Twilio dependency
    from twilio.base.exceptions import TwilioException  # type: ignore[attr-defined]
except ImportError:  # pragma: no cover
    TwilioException = Exception  # type: ignore[assignment]

# Import our new modular components
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils import find_available_port, get_local_ip
from models import db, init_all_databases, UserOperations, SafetyOperations
from routes.travel_routes import travel_bp
from routes.carbon_routes import carbon_bp
from emergency_alerts import EmergencyAlertService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


SUPPORTED_LANGUAGES = {
    'en-IN': 'English',
    'hi-IN': 'Hindi',
    'ta-IN': 'Tamil',
    'te-IN': 'Telugu',
    'kn-IN': 'Kannada',
    'ml-IN': 'Malayalam',
    'mr-IN': 'Marathi',
    'bn-IN': 'Bengali',
    'gu-IN': 'Gujarati',
    'pa-IN': 'Punjabi',
    'or-IN': 'Odia'
}

def create_app():
    """Application factory pattern for creating Flask app."""
    app = Flask(__name__, static_folder='static', static_url_path='/static')
    
    # Load configuration
    app.config.from_object(Config)
    
    # Validate essential API keys
    missing_keys = Config.validate_api_keys()
    if missing_keys:
        logger.warning(f"Some API keys are missing: {missing_keys}. Some features may not work.")
    
    # Configure CORS
    CORS(app, resources={
        r"/*": {
            "origins": "*", 
            "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"], 
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Initialize database
    db.init_app(app)
    
    # Register blueprints
    app.register_blueprint(travel_bp)
    app.register_blueprint(carbon_bp)
    
    return app

# Create the Flask app
app = create_app()

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# =======================
# Core Application Routes
# =======================

@app.route('/')
def index():
    """Root endpoint - API status."""
    return jsonify({
        "status": "success",
        "message": "CBC D-02 Travel API is running",
        "version": "2.0",
        "features": ["travel_search", "carbon_footprint", "user_management", "socketio_enabled"],
        "endpoints": {
            "travel": "/api/",
            "carbon": "/api/carbon/",
            "users": "/api/users/",
            "health": "/api/health"
        }
    })


@app.route('/api/supported-languages', methods=['GET'])
def get_supported_languages():
    """Return supported language codes for translation UI."""
    return jsonify({'success': True, 'languages': SUPPORTED_LANGUAGES})


@app.route('/api/translate-batch', methods=['POST'])
def translate_batch():
    """Translate a batch of text snippets using Sarvam AI."""
    payload = request.get_json(silent=True) or {}
    texts = payload.get('texts')
    target_language = payload.get('target_language_code', 'en-IN')
    source_language = payload.get('source_language_code', 'auto')

    if not isinstance(texts, list) or not texts:
        return jsonify({'success': False, 'message': 'texts must be a non-empty list'}), 400

    if len(texts) > 200:
        return jsonify({'success': False, 'message': 'Too many texts requested'}), 400

    sarvam_key = Config.SARVAM_API_KEY
    sarvam_url = getattr(Config, 'SARVAM_API_URL', 'https://api.sarvam.ai/translate')

    translations = []
    if not sarvam_key:
        logger.warning("SARVAM_API_KEY missing: returning original text for translate-batch")
        translations = texts
    else:
        headers = {
            'api-subscription-key': sarvam_key,
            'Content-Type': 'application/json'
        }
        for text in texts:
            if not isinstance(text, str) or not text.strip():
                translations.append(text or '')
                continue
            try:
                response = requests.post(
                    sarvam_url,
                    headers=headers,
                    json={
                        'input': text,
                        'source_language_code': source_language,
                        'target_language_code': target_language
                    },
                    timeout=20
                )
                response.raise_for_status()
                data_json = response.json()
                translations.append(data_json.get('translated_text', text))
            except Exception as exc:
                logger.error(f"translate-batch failed for text '{text[:30]}...': {exc}")
                translations.append(text)

    return jsonify({
        'success': True,
        'translations': translations,
        'target_language_code': target_language,
        'source_language_code': source_language
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint."""
    try:
        # Check database connectivity
        try:
            from models import get_db_connection
            conn = get_db_connection(Config.DB_PATH)
            conn.close()
            db_status = "healthy"
        except Exception as e:
            db_status = f"error: {str(e)}"
        
        # Check essential API keys
        api_key_status = "configured" if not Config.validate_api_keys() else "missing_keys"
        
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": db_status,
            "api_keys": api_key_status,
            "services": {
                "travel": "available",
                "carbon_footprint": "available",
                "user_management": "available",
                "socketio": "enabled"
            }
        })
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

# =======================
# User Management Routes
# =======================

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user or return existing user."""
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')
    firebase_uid = data.get('firebase_uid')
    
    if not all([username, role]):
        return jsonify({"error": "Missing required fields: username, role"}), 400
    
    try:
        result = UserOperations.create_user(username, role, firebase_uid)
        
        if result["created"]:
            return jsonify({
                "message": "User created successfully",
                "user_id": result["user_id"]
            }), 201
        else:
            return jsonify({
                "message": "User already exists", 
                "user_id": result["user_id"]
            }), 200
            
    except Exception as e:
        logger.error(f"Error creating user {username}: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    """Get user information by username."""
    try:
        user = UserOperations.get_user(username)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify(user), 200
        
    except Exception as e:
        logger.error(f"Error fetching user {username}: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/users/home', methods=['POST'])
def set_home_location():
    """Set user's home location."""
    data = request.get_json()
    username = data.get('username')
    home_lat = data.get('home_lat')
    home_lon = data.get('home_lon')
    
    if not username:
        return jsonify({"error": "Missing required field: username"}), 400
    
    # Validate coordinates
    if (home_lat is None or home_lon is None or 
        str(home_lat).strip() == "" or str(home_lon).strip() == ""):
        return jsonify({"error": "Missing or invalid coordinates"}), 400
    
    try:
        # Convert to float
        lat = float(home_lat)
        lon = float(home_lon)
        
        # Validate coordinate ranges
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return jsonify({"error": "Invalid coordinate ranges"}), 400
        
        UserOperations.update_home_location(username, lat, lon)
        
        return jsonify({"message": "Home location set successfully"}), 200
        
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid coordinate format"}), 400
    except Exception as e:
        logger.error(f"Error setting home location for {username}: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get user leaderboard by points."""
    try:
        from models import get_db_connection
        import sqlite3
        
        conn = get_db_connection(Config.DB_PATH)
        c = conn.cursor()
        c.execute("SELECT username, points FROM users ORDER BY points DESC LIMIT 50")
        leaderboard_data = c.fetchall()
        conn.close()
        
        leaderboard = [
            {"username": entry[0], "points": entry[1]}
            for entry in leaderboard_data
        ]
        
        return jsonify(leaderboard), 200
        
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        return jsonify({"error": "Internal server error"}), 500

# =======================
# Safety and Incident Routes  
# =======================

@app.route('/api/safety/reports', methods=['GET'])
def get_safety_reports():
    """Get all safety incident reports."""
    try:
        reports = SafetyOperations.get_all_incidents()
        return jsonify(reports)
    except Exception as e:
        logger.error(f"Error fetching safety reports: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/safety/reports', methods=['POST'])
def add_safety_report():
    """Add a new safety incident report."""
    data = request.get_json()
    
    required_fields = ['type', 'latitude', 'longitude']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        incident_id = SafetyOperations.add_incident(
            data['type'],
            float(data['latitude']),
            float(data['longitude']),
            data.get('description'),
            data.get('username')
        )
        
        return jsonify({
            "message": "Safety report added successfully",
            "incident_id": incident_id
        }), 201
        
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid coordinate format"}), 400
    except Exception as e:
        logger.error(f"Error adding safety report: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/api/sos/trigger', methods=['POST', 'OPTIONS'])
def trigger_emergency_sos():
    """Trigger emergency communication workflow (voice, SMS, WhatsApp)."""
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}

    name = str(payload.get('name') or 'Guest Traveller').strip()

    location_label_raw = payload.get('locationLabel') or payload.get('homeLocation')
    location_label = str(location_label_raw).strip() if isinstance(location_label_raw, str) else None

    home_coordinates = payload.get('homeCoordinates') if isinstance(payload.get('homeCoordinates'), dict) else {}
    device_coordinates = payload.get('deviceCoordinates') if isinstance(payload.get('deviceCoordinates'), dict) else {}
    contacts = payload.get('contacts') if isinstance(payload.get('contacts'), dict) else None
    notes = payload.get('notes') or payload.get('additionalMessage')
    triggered_at = payload.get('triggeredAt')

    try:
        dispatch_result = EmergencyAlertService.dispatch_alerts(
            name=name or 'Guest Traveller',
            location_label=location_label,
            home_coordinates=home_coordinates,
            device_coordinates=device_coordinates,
            contacts=contacts,
            additional_message=str(notes) if notes else None,
        )

        response_payload = {
            "success": True,
            "message": "Emergency alerts dispatched",
            "dispatch": dispatch_result,
        }
        if triggered_at:
            response_payload["triggeredAt"] = triggered_at

        return jsonify(response_payload), 200

    except ValueError as exc:
        logger.error(f"SOS dispatch aborted: {exc}")
        return jsonify({"success": False, "message": str(exc)}), 400
    except (TwilioException, RuntimeError) as exc:
        logger.error(f"SOS dispatch failed: {exc}", exc_info=True)
        return jsonify({
            "success": False,
            "message": "Failed to dispatch emergency alerts",
            "detail": str(exc),
        }), 502
    except Exception as exc:
        logger.exception("Unexpected error while triggering SOS")
        return jsonify({"success": False, "message": "Unexpected server error"}), 500

# =======================
# SocketIO Events for Real-time Communication
# =======================

# Store active user sessions
user_sessions = {}

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    client_id = request.sid
    user_sessions[client_id] = {
        "connected_at": datetime.now().isoformat(),
        "profile": {}
    }
    logger.info(f"Client connected: {client_id}")
    emit('connected', {
        'status': 'success', 
        'message': 'Connected to CBC D-02 Travel Assistant',
        'session_id': client_id
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    client_id = request.sid
    if client_id in user_sessions:
        del user_sessions[client_id]
        logger.info(f"Client disconnected: {client_id}")

@socketio.on('update_profile')
def handle_profile_update(data):
    """Update user travel profile."""
    try:
        client_id = request.sid
        if client_id not in user_sessions:
            user_sessions[client_id] = {"profile": {}}
        
        # Validate and store profile data
        user_profile = {
            "budget": data.get('budget', '30000'),
            "group_size": data.get('group_size', '2'),
            "group_type": data.get('group_type', 'couple'),
            "interests": data.get('interests', 'culture, food, sightseeing'),
            "travel_dates": data.get('travel_dates', 'flexible'),
            "default_location": data.get('default_location', 'Delhi, India'),
            "currency": data.get('currency', 'INR'),
            "home_location": data.get('home_location', 'Delhi, India')
        }
        
        user_sessions[client_id]['profile'] = user_profile
        
        emit('profile_updated', {
            "status": "success",
            "profile": user_profile
        })
        
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        emit('error', {"status": "error", "message": str(e)})

@socketio.on('ping')
def handle_ping():
    """Handle ping for connection testing."""
    emit('pong', {'timestamp': datetime.now().isoformat()})

# =======================
# Error Handlers
# =======================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        "error": "Not found",
        "message": "The requested resource was not found",
        "available_endpoints": [
            "/api/",
            "/api/health",
            "/api/users/",
            "/api/carbon/",
            "/api/safety/"
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        "error": "Internal server error",
        "message": "An unexpected error occurred"
    }), 500

# =======================
# Application Initialization
# =======================

def initialize_app():
    """Initialize the application and all its components."""
    try:
        # Initialize databases
        with app.app_context():
            init_all_databases()
            logger.info("All databases initialized successfully")
        
        # Log configuration status
        logger.info("Application configuration loaded")
        logger.info(f"Debug mode: {Config.DEBUG}")
        
        return True
        
    except Exception as e:
        logger.error(f"Application initialization failed: {e}")
        return False

# =======================
# Main Execution
# =======================

if __name__ == "__main__":
    # Initialize the application
    if not initialize_app():
        logger.error("Failed to initialize application. Exiting.")
        exit(1)
    
    # Find an available port
    port = find_available_port(start_port=5000, max_port=9000)
    
    if not port:
        logger.error("Could not find an available port. Exiting.")
        exit(1)
    
    # Get network information for display
    local_ip = get_local_ip()
    
    # Print startup information
    print(f"\n{'='*50}")
    print(f"🚀 CBC D-02 Travel API Server Starting")
    print(f"{'='*50}")
    print(f"📱 Local: http://localhost:{port}")
    print(f"🌐 Network: http://{local_ip}:{port}")
    print(f"✨ SocketIO enabled for real-time features")
    print(f"📊 Health check: http://localhost:{port}/api/health")
    print(f"{'='*50}\n")
    
    # Run the application
    try:
        socketio.run(
            app,
            debug=Config.DEBUG,
            host='0.0.0.0',
            port=port,
            use_reloader=False,  # Disabled to prevent double initialization
            allow_unsafe_werkzeug=True
        )
    except KeyboardInterrupt:
        logger.info("Application stopped by user")
    except Exception as e:
        logger.error(f"Application crashed: {e}")
        exit(1)