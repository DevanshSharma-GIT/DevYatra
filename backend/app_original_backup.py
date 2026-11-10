import json
from urllib.parse import quote_plus
from flask import Flask, request, jsonify, send_file, render_template, url_for,session # Added render_template, url_for
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import requests
from datetime import datetime, timedelta
import qrcode
from flask_sqlalchemy import SQLAlchemy
from io import BytesIO
import uuid
from groq import Groq
from typing import Dict, List, Tuple, Optional
import logging
from chatbot import process_travel_query
import sqlite3
from PIL import Image 
from PIL.ExifTags import TAGS
import os
import math
from dotenv import load_dotenv
from datetime import datetime # Added datetime
import base64 # For image processing
# from google.cloud import texttospeech # Import Google TTS client
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain.output_parsers import StructuredOutputParser, ResponseSchema
# Load environment variables from .env file
load_dotenv()

# --- Flask App and SocketIO Setup ---
app = Flask(__name__, static_folder='static', static_url_path='/static')
# Update CORS configuration to be more explicit
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# API Keys - Load ALL from environment variables with fallbacks only for non-critical ones if needed
RADAR_PUBLISHABLE_KEY = os.getenv("RADAR_PUBLISHABLE_KEY")
RADAR_LIVE_KEY = os.getenv("RADAR_LIVE_KEY")
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MAPQUEST_API_KEY = os.getenv("MAPQUEST_API_KEY")
AVIATION_STACK_API_KEY = os.getenv("AVIATION_STACK_API_KEY") # Use getenv
AMADEUS_CLIENT_ID = os.getenv("AMADEUS_CLIENT_ID") # Use getenv
AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_CLIENT_SECRET") # Use getenv

# --- Add checks for essential keys ---
essential_keys = {
    "GEOAPIFY_API_KEY": GEOAPIFY_API_KEY,
    "GROQ_API_KEY": GROQ_API_KEY,
    "MAPQUEST_API_KEY": MAPQUEST_API_KEY,
    # Add others as needed, e.g., RADAR keys if routing is critical
}
missing_keys = [name for name, key in essential_keys.items() if not key]
if missing_keys:
    logger.error(f"Missing essential environment variables: {', '.join(missing_keys)}")
    # Consider raising an error or exiting if critical keys are missing
    # raise ValueError(f"Missing essential environment variables: {', '.join(missing_keys)}")

# Constants for live crowd density feature
SEARCH_RADIUS = 500  # Radius in meters for crowd density search
ACTIVITY_WINDOW = 30  # Time window in minutes for active users

# Caches
tourist_cache: Dict[str, Tuple[datetime, bool]] = {}
crowd_cache: Dict[str, Tuple[datetime, str]] = {}

# Store active user sessions for Socket.IO
user_sessions = {}

# --- Database Paths and Initialization ---
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
CROWDSOURCE_DB_PATH = os.path.join(os.path.dirname(__file__), 'crowdsource.db')

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    try:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users 
                    (id INTEGER PRIMARY KEY, username TEXT UNIQUE, role TEXT, points INTEGER, home_lat REAL, home_lon REAL)''')
        c.execute('''CREATE TABLE IF NOT EXISTS chat_history 
                    (id INTEGER PRIMARY KEY, sender TEXT, receiver TEXT, message TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS memories 
                    (id INTEGER PRIMARY KEY, username TEXT, lat REAL, lon REAL, location_name TEXT)''')
        # Add safety_reports table for legacy endpoints
        c.execute('''CREATE TABLE IF NOT EXISTS safety_reports
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    username TEXT, 
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {DB_PATH}")
    except sqlite3.Error as e:
        logger.error(f"Database initialization error: {e}")
        raise

def init_crowdsource_db():
    try:
        conn = sqlite3.connect(CROWDSOURCE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            description TEXT,
            timestamp TEXT NOT NULL,
            username TEXT
        )
        ''')
        conn.commit()
        conn.close()
        logger.info(f"Crowdsource database initialized at {CROWDSOURCE_DB_PATH}")
    except sqlite3.Error as e:
        logger.error(f"Crowdsource database initialization error: {e}")
        raise

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

# Haversine formula to calculate distance between two points (in km)
def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon1 - lon2)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Helper function to convert GPS coordinates to degrees
def convert_to_degrees(value):
    if not value:
        return None
        
    # Handle different formats of GPS data
    if isinstance(value, tuple) and len(value) == 3:
        # Standard (degrees, minutes, seconds) format
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)
    elif isinstance(value, tuple) and len(value) > 0:
        # Some devices provide rational numbers or other formats
        # Try to get the first value
        return float(value[0])
    elif isinstance(value, (int, float)):
        # Already a simple number
        return float(value)
    else:
        logger.warning(f"Unknown GPS format: {value}")
        return None

# --- Sexy Helper Functions ---

def is_tourist_attraction(place_name: str, place_data: Dict) -> bool:
    if place_name in tourist_cache:
        cached_time, is_tourist = tourist_cache[place_name]
        if datetime.now() - cached_time < timedelta(hours=24):
            return is_tourist

    place_id = place_data.get("properties", {}).get("place_id")
    if not place_id:
        logger.debug(f"No place_id for {place_name}, using fallback.")
        return _heuristic_tourist_check(place_name, place_data)

    url = "https://api.geoapify.com/v2/place-details"
    params = {"id": place_id, "features": "details", "apiKey": GEOAPIFY_API_KEY}
    try:
        resp = requests.get(url, params=params, headers={"Accept": "application/json"})
        resp.raise_for_status()
        details = resp.json()

        if not details.get("features"):
            return False

        props = details["features"][0]["properties"]
        categories = props.get("categories", [])

        tourist_categories = [
            "tourism.attraction", "tourism.sights", "entertainment.museum", "historic",
            "heritage", "tourism.information", "entertainment.culture", "leisure.park",
            "natural", "national_park"
        ]
        
        is_tourist = any(cat in tourist_categories for cat in categories)
        tourist_cache[place_name] = (datetime.now(), is_tourist)
        return is_tourist

    except requests.RequestException as e:
        logger.error(f"Place Details error for {place_name}: {e}")
        return _heuristic_tourist_check(place_name, place_data)

def _heuristic_tourist_check(place_name: str, place_data: Dict) -> bool:
    categories = place_data.get("properties", {}).get("categories", [])
    non_tourist = ["residential", "apartment", "housing", "private", "office"]
    tourist_vibes = ["tourism", "attraction", "sights", "museum", "historic", "heritage", "park"]

    if any(any(keyword in cat for keyword in non_tourist) for cat in categories):
        tourist_cache[place_name] = (datetime.now(), False)
        return False
    if any(any(keyword in cat for keyword in tourist_vibes) for cat in categories):
        tourist_cache[place_name] = (datetime.now(), True)
        return True

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"Is '{place_name}' in India a tourist attraction? Answer 'Yes' or 'No'."
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "system", "content": "Factual answers only."}, {"role": "user", "content": prompt}],
            temperature=0.1, max_tokens=10
        )
        is_tourist = response.choices[0].message.content.strip().lower() == "yes"
        tourist_cache[place_name] = (datetime.now(), is_tourist)
        return is_tourist
    except Exception as e:
        logger.error(f"Fallback error: {e}")
        return False

def search_tourist_place(query: str) -> Optional[Dict]:
    url = "https://api.geoapify.com/v1/geocode/autocomplete"
    params = {"text": query, "filter": "countrycode:in", "limit": 5, "apiKey": GEOAPIFY_API_KEY}
    try:
        resp = requests.get(url, params=params, headers={"Accept": "application/json"})
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"Search error: {e}")
        return None

def generate_map_url(lat: float, lon: float, place_name: str = "Location") -> str:
    """Generate a Google Maps iframe embed URL."""
    quoted_place_name = quote_plus(place_name)
    base_url = "https://maps.google.com/maps"
    params = {
        "width": "100%",
        "height": "600",
        "hl": "en",
        "q": f"{lat},{lon} ({quoted_place_name})",
        "t": "",
        "z": "14",
        "ie": "UTF8",
        "iwloc": "B",
        "output": "embed"
    }
    query_string = "&amp;".join(f"{key}={value}" for key, value in params.items())
    return f'<div style="width: 100%"><iframe width="100%" height="600" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="{base_url}?{query_string}"><a href="https://www.gps.ie/collections/personal-trackers/">Elderly trackers</a></iframe></div>'

def get_crowd_density(place_name: str) -> str:
    now = datetime.now()
    if place_name in crowd_cache and now - crowd_cache[place_name][0] < timedelta(hours=1):
        return crowd_cache[place_name][1]

    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"Estimate crowd density at '{place_name}' in India. Reply 'High', 'Medium', or 'Low'."
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "system", "content": "Tourism expert, concise."}, {"role": "user", "content": prompt}],
            temperature=0.1, max_tokens=10
        )
        density = response.choices[0].message.content.strip()
        density = density if density in ["High", "Medium", "Low"] else "Medium"
        crowd_cache[place_name] = (now, density)
        return density
    except Exception as e:
        logger.error(f"Crowd density error: {e}")
        return "Medium"

def get_ai_recommendation(place_name: str) -> str:
    try:
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"Give a factual travel tip for '{place_name}' in India, under 100 words."
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "system", "content": "Tourism guru, keep it tight."}, {"role": "user", "content": prompt}],
            temperature=0.3, max_tokens=150
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return f"Explore '{place_name}' and check local weather."

# --- Dynamic VR Videos Function without requiring YouTube API key ---
def get_vr_videos(place_name: str) -> list:
    """Dynamically search for VR videos related to a tourist place using web requests"""
    import re
    from urllib.parse import quote_plus
    
    # Format the search query for VR content
    search_query = f"{place_name} india virtual tour 360"
    encoded_query = quote_plus(search_query)
    
    # Use a simple YouTube search via HTML
    try:
        # This is a basic approach that doesn't require an API key
        url = f"https://www.youtube.com/results?search_query={encoded_query}"
        
        # Make request to get search results page
        response = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # If request successful, extract video IDs from the HTML response
        if response.status_code == 200:
            html_content = response.text
            
            # Use regex to find video IDs in the HTML (this is a simple approach that may need updating)
            video_ids = re.findall(r"videoId\":\"([^\"]+)", html_content)
            
            # Remove duplicates while preserving order
            unique_video_ids = []
            for vid in video_ids:
                if vid not in unique_video_ids:
                    unique_video_ids.append(vid)
            
            # Get up to 3 videos
            video_ids = unique_video_ids[:3]
            
            # Create video objects with basic information
            videos = []
            for i, video_id in enumerate(video_ids):
                videos.append({
                    "title": f"{place_name} Virtual Tour {i+1}",
                    "video_id": video_id
                })
            
            logger.info(f"Found {len(videos)} VR videos for {place_name}")
            return videos
        
        # If search fails, provide default fallback options
        logger.warning(f"Failed to search for VR videos for {place_name}, using fallbacks")
        return [
            {"title": "Incredible India - Virtual Reality Tour", "video_id": "ICqFo9DZhxM"},
            {"title": "India in 360° - Amazing Heritage Sites", "video_id": "vQpaGpkgVQs"}
        ]
        
    except Exception as e:
        logger.error(f"Error searching for VR videos: {e}")
        # Return the Taj Mahal VR video as fallback
        return [{"title": "Taj Mahal - Virtual Walking Tour in 4K", "video_id": "Bx2S7JpdOp4"}]

# --- Geoapify API Glamour ---

def geocode_address(address: str) -> Optional[Dict]:
    if not GEOAPIFY_API_KEY:
        logger.error("GEOAPIFY_API_KEY is not set!")
        return None # Return None if key is missing

    url = "https://api.geoapify.com/v1/geocode/search"
    params = {"text": address, "filter": "countrycode:in", "apiKey": GEOAPIFY_API_KEY}
    logger.debug(f"Attempting to geocode address: '{address}' using URL: {url} with params: {params}") # Log request details
    try:
        resp = requests.get(url, params=params, timeout=10) # Add timeout
        logger.debug(f"Geoapify response status: {resp.status_code}") # Log status code
        resp.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        result = resp.json()
        logger.debug(f"Geoapify response data: {result}") # Log response data
        return result
    except requests.exceptions.Timeout:
        logger.error(f"Geocode request timed out for address: {address}")
        return None
    except requests.exceptions.RequestException as e:
        # Log the full error, including response text if available
        response_text = e.response.text if e.response else "No response body"
        logger.error(f"Geocode error for address '{address}': {e}. Response: {response_text}")
        return None
    except Exception as e: # Catch any other unexpected errors
        logger.error(f"Unexpected error during geocoding for address '{address}': {e}")
        return None

@app.route('/api/geocode', methods=['GET'])
def geocode():
    address = request.args.get('address')
    logger.info(f"Received request for /geocode with address: '{address}'") # Log incoming request
    if not address:
        logger.warning("Geocode request failed: Address parameter missing.")
        return jsonify({"error": "Address required"}), 400

    result = geocode_address(address)
    
    # Check if the geocode_address function returned None (indicating an error)
    if result is None:
        logger.error(f"Geocoding failed for address: '{address}'. Returning 500.")
        return jsonify({"error": "Geocoding service failed"}), 500 # Return 500 for internal/API errors

    # Check if the API returned features
    if "features" not in result or not result["features"]:
        logger.warning(f"No geocoding results found for address: '{address}'. Returning 404.")
        return jsonify({"error": "No results found for the address"}), 404 # Return 404 if API finds nothing

    # Process successful result
    try:
        props = result["features"][0]["properties"]
        response_data = {
            "address": props.get("formatted", "N/A"), # Use .get for safety
            "latitude": props.get("lat", None),
            "longitude": props.get("lon", None),
            "confidence": props.get("rank", {}).get("confidence", "N/A")
        }
        logger.info(f"Successfully geocoded '{address}': {response_data}")
        return jsonify(response_data)
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Error processing Geoapify response structure for '{address}': {e}. Response: {result}")
        return jsonify({"error": "Error processing geocoding results"}), 500

def reverse_geocode(lat: float, lon: float) -> Optional[Dict]:
    url = "https://api.geoapify.com/v1/geocode/reverse"
    params = {"lat": lat, "lon": lon, "apiKey": GEOAPIFY_API_KEY}
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"Reverse geocode error: {e}")
        return None

def get_route_distance(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> Optional[Dict]:
    """Calculate route distance and duration using Radar Routing API."""
    if not RADAR_PUBLISHABLE_KEY: # Check if key is loaded
        logger.error("RADAR_PUBLISHABLE_KEY not configured for routing.")
        return None

    url = "https://api.radar.io/v1/route/distance"
    headers = {
        "Authorization": RADAR_PUBLISHABLE_KEY # Use the loaded key
    }
    params = {
        "origin": f"{origin_lat},{origin_lon}",
        "destination": f"{dest_lat},{dest_lon}",
        "modes": "car",
        "units": "metric"
    }
    try:
        logger.debug(f"Requesting Radar route: {url} with params {params}")
        resp = requests.get(url, params=params, headers=headers)
        resp.raise_for_status()
        route_data = resp.json()
        logger.debug(f"Radar route response: {route_data}")

        if not route_data.get("routes") or not route_data["routes"].get("car"):
            logger.warning("No route data in Radar response")
            return None
        
        route = route_data["routes"]["car"]
        
        distance_m = route.get("distance", {}).get("value")
        duration_s = route.get("duration", {}).get("value")

        if distance_m is None or duration_s is None:
            logger.error(f"Missing distance or duration in route: {route}")
            return None

        distance_km = round(distance_m / 1000, 2)
        duration_min = round(duration_s / 60, 1)

        return {
            "distance": {"value": distance_km, "text": f"{distance_km} km"},
            "duration": {"value": duration_min, "text": f"{duration_min} min"}
        }
    except requests.RequestException as e:
        logger.error(f"Radar routing error: {e}, Response: {resp.text if 'resp' in locals() else 'No response'}")
        return None

def search_nearby_places(lat: float, lon: float) -> Optional[Dict]:
    url = "https://api.geoapify.com/v2/places"
    params = {
        "categories": "tourism.attraction,entertainment.museum,leisure.park,tourism.sights",
        "filter": f"circle:{lon},{lat},1000",
        "limit": 5,
        "apiKey": GEOAPIFY_API_KEY
    }
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"Nearby places error: {e}")
        return None

# --- Flask Routes from first file ---

@app.route('/api/autocomplete', methods=['GET'])
def autocomplete_place():
    query = request.args.get('query')
    if not query:
        return jsonify({"suggestions": []}), 200

    results = search_tourist_place(query)
    if not results or "features" not in results:
        return jsonify({"suggestions": []}), 200

    suggestions = [
        {
            "label": feat["properties"].get("name", feat["properties"]["formatted"]),
            "latitude": feat["properties"]["lat"],
            "longitude": feat["properties"]["lon"]
        }
        for feat in results["features"]
    ]
    return jsonify({"suggestions": suggestions})

@app.route('/api/search', methods=['GET'])
def search_place():
    place_name = request.args.get('place')
    if not place_name:
        return jsonify({"error": "Place name required"}), 400

    # Get origin coordinates if provided
    origin_lat = request.args.get('origin_lat')
    origin_lon = request.args.get('origin_lon')

    results = search_tourist_place(place_name)
    # Fix: Return 404 only if results["features"] is missing or empty, not just missing
    if not results or "features" not in results or not results["features"]:
        return jsonify({"error": "No results found"}), 200

    place = results["features"][0]
    place_label = place["properties"].get("name", place["properties"]["formatted"])
    lat, lon = place["properties"]["lat"], place["properties"]["lon"]

    if not is_tourist_attraction(place_label, place):
        return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

    map_url = generate_map_url(lat, lon, place_label)
    density = get_crowd_density(place_label)
    base_price = 100
    dynamic_price = round(base_price * (1 + {"High": 0.8, "Medium": 0.5, "Low": 0.2}.get(density, 0.5)), 2)
    recommendation = get_ai_recommendation(place_label)
    vr_videos = get_vr_videos(place_label)

    response_data = {
        "name": place_label,
        "location": {"latitude": lat, "longitude": lon},
        "map_url": map_url,
        "crowd_density": density,
        "dynamic_price": dynamic_price,
        "recommendation": recommendation,
        "is_tourist_attraction": True,
        "vr_videos": vr_videos
    }

    # If origin coordinates are provided, calculate route information
    if origin_lat and origin_lon:
        try:
            route_info = get_route_distance(
                float(origin_lat), float(origin_lon), lat, lon
            )
            if route_info:
                response_data["route_info"] = route_info
        except (ValueError, TypeError) as e:
            logger.error(f"Error calculating route: {e}")
            # Continue without route info if there's an error

    return jsonify(response_data)

@app.route('/api/book', methods=['POST'])
def book_ticket():
    data = request.get_json()
    place_name, user_name = data.get('place'), data.get('user_name')
    if not place_name or not user_name:
        return jsonify({"error": "Missing place or user name"}), 400

    place_info = search_tourist_place(place_name)
    if not place_info or "features" not in place_info or not place_info["features"]:
        return jsonify({"error": "Place not found"}), 404

    place = place_info["features"][0]
    place_label = place["properties"].get("name", place["properties"]["formatted"])
    if not is_tourist_attraction(place_label, place):
        return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

    ticket_id = uuid.uuid4().hex
    qr_data = f"Ticket ID: {ticket_id}, Place: {place_name}, User: {user_name}"
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill='black', back_color='white')

    img_io = BytesIO()
    qr_img.save(img_io, 'PNG')
    img_io.seek(0)

    return send_file(img_io, mimetype='image/png', as_attachment=True, download_name=f'{ticket_id}_qr.png')

@app.route('/api/reverse_geocode', methods=['GET'])
def reverse_geocode_route():
    lat, lon = request.args.get('lat'), request.args.get('lon')
    if not lat or not lon:
        return jsonify({"error": "Lat and lon required"}), 400

    result = reverse_geocode(lat, lon)
    if not result or "features" not in result or not result["features"]:
        return jsonify({"error": "No results"}), 404

    props = result["features"][0]["properties"]
    return jsonify({
        "address": props["formatted"],
        "place_label": props.get("name", props["formatted"])
    })

@app.route('/api/route_distance', methods=['GET'])
def route_distance():
    coords = [request.args.get(k) for k in ['origin_lat', 'origin_lon', 'dest_lat', 'dest_lon']]
    if not all(coords):
        return jsonify({"error": "All coordinates required"}), 400

    result = get_route_distance(*map(float, coords))
    if not result:
        return jsonify({"error": "Route calculation failed"}), 404

    return jsonify(result)

@app.route('/api/nearby_places', methods=['GET'])
def nearby_places():
    lat, lon = request.args.get('lat'), request.args.get('lon')
    if not lat or not lon:
        return jsonify({"error": "Lat and lon required"}), 400

    result = search_nearby_places(float(lat), float(lon))
    if not result or "features" not in result:
        return jsonify({"places": []}), 200

    places = [
        {
            "name": feat["properties"]["name"],
            "categories": feat["properties"]["categories"],
            "location": {"latitude": feat["properties"]["lat"], "longitude": feat["properties"]["lon"]}
        }
        for feat in result["features"]
    ]
    return jsonify({"places": places})

# --- Socket.IO Routes from second file ---

@app.route('/')
def index():
    return jsonify({
        "status": "success",
        "message": "HeritEdge Travel API is running (Socket.IO enabled)"
    })

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    client_id = request.sid
    user_sessions[client_id] = {
        "profile": {
            "budget": "medium",
            "group_size": "2",
            "group_type": "couple",
            "interests": "culture, food, sightseeing",
            "travel_dates": "flexible",
            "default_location": "Paris, France",
            "currency": "USD",
            "home_location": "New York, USA"
        }
    }
    logger.info(f"Socket.IO client connected: {client_id}")
    emit('connected', {'status': 'success', 'message': 'Connected to HeritEdge Travel Assistant'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    client_id = request.sid
    if client_id in user_sessions:
        del user_sessions[client_id]
        logger.info(f"Socket.IO client disconnected: {client_id}")

@socketio.on('update_profile')
def handle_profile_update(data):
    """Update user travel profile. First the user sends the profile data, then the assistant processes it. After that only the processed data is given as context to chatbot and allowed to use by user"""
    try:
        client_id = request.sid
        if client_id not in user_sessions:
            user_sessions[client_id] = {"profile": {}}
            
        user_profile = {
            "budget": data.get('budget', '30000'),  # Changed from "medium" to numeric default
            "group_size": data.get('group_size', '2'),
            "group_type": data.get('group_type', 'couple'),
            "interests": data.get('interests', 'culture, food, sightseeing'),
            "travel_dates": data.get('travel_dates', 'flexible'),
            "default_location": data.get('default_location', 'Paris, France'),
            "currency": data.get('currency', 'USD'),
            "home_location": data.get('home_location', 'New York, USA')
        }
        
        # Add additional context fields that might help the chatbot
        if 'destination_history' in data:
            user_profile['destination_history'] = data.get('destination_history', [])
        
        if 'travel_style' in data:
            user_profile['travel_style'] = data.get('travel_style', 'balanced')
        
        user_sessions[client_id]['profile'] = user_profile
        
        emit('profile_updated', {
            "status": "success", 
            "profile": user_profile
        })
    except Exception as e:
        emit('error', {"status": "error", "message": str(e)})

def get_recent_safety_context(limit=10):
    """Fetches recent safety reports and returns a summary for chatbot context."""
    db_path = CROWDSOURCE_DB_PATH
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        cursor.execute('SELECT type, latitude, longitude, description, timestamp FROM incidents ORDER BY timestamp DESC LIMIT ?', (limit,))
        reports = cursor.fetchall()
        conn.close()
        if not reports:
            return "No recent safety reports available."
        summary_lines = []
        for r in reports:
            desc = r["description"] if r["description"] else r["type"].replace("_", " ").capitalize()
            summary_lines.append(
                f"- [{r['timestamp'][:19]}] {desc} at ({r['latitude']:.4f}, {r['longitude']:.4f})"
            )
        return (
            "Recent safety reports from the Safety Map feature:\n"
            + "\n".join(summary_lines)
            + "\nFor more details, check the Safety Map section."
        )
    except Exception as e:
        logger.error(f"Error fetching safety context: {e}")
        return "Safety map data unavailable."

@socketio.on('send_message')
def handle_message(data):
    """Process a chat message with the travel assistant"""
    try:
        client_id = request.sid
        query = data.get('message', '')
        
        # Use stored profile or the one provided in the message
        user_profile = data.get('profile') or user_sessions.get(client_id, {}).get('profile', {})
        
        if not query:
            emit('error', {"status": "error", "message": "No message provided"})
            return
            
        # Let the client know we're processing
        emit('processing', {"status": "processing", "message": "Processing your query..."})

        # --- Inject safety map context ---
        safety_context = get_recent_safety_context(limit=10)
        # Pass as extra context to process_travel_query
        result = process_travel_query(query, user_profile, extra_context=safety_context)
        # ^ You need to update process_travel_query to accept extra_context and append it to its system/user prompt.

        # Format the response for the frontend
        response = result['response']
        formatted_response = {
            "status": "success",
            "message": response.get('response', ''),
            "details": {
                "destination": response.get('destination', ''),
                "price_range": response.get('price_range', ''),
                "travel_duration": response.get('travel_duration', ''),
                "local_time": response.get('local_time', ''),
                "cultural_highlights": response.get('cultural_highlights', ''),
                "packing_suggestions": response.get('packing_suggestions', ''),
                "travel_tips": response.get('travel_tips', ''),
                "itinerary": response.get('itinerary', '')
            }
        }
        
        # Send the response back to the client
        emit('message_response', formatted_response)
        
    except Exception as e:
        emit('error', {"status": "error", "message": f"Error processing request: {str(e)}"})

# --- API Routes for Native Connect Feature ---

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')
    firebase_uid = data.get('firebase_uid')
    
    if not all([username, role, firebase_uid]):
        return jsonify({"error": "Missing required fields"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    try:
        c.execute("INSERT INTO users (username, role, points) VALUES (?, ?, 0)", 
                  (username, role))
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        logger.info(f"User endpoint called for {username}. Result: Created")
        return jsonify({"message": "User created", "user_id": user_id}), 201
    except sqlite3.IntegrityError:
        c.execute("SELECT id FROM users WHERE username=?", (username,))
        user_id = c.fetchone()[0]
        conn.close()
        logger.info(f"User endpoint called for {username}. Result: Exists")
        return jsonify({"message": "User already exists", "user_id": user_id}), 200
    finally:
        if conn: conn.close() # Ensure connection is closed

@app.route('/api/users/home', methods=['POST'])
def set_home():
    data = request.get_json()
    logger.info(f"Received data for /api/users/home: {data}") # Log the raw incoming data

    username = data.get('username')
    home_lat_raw = data.get('home_lat') # Get raw values first
    home_lon_raw = data.get('home_lon')

    # Log the raw lat/lon values received
    logger.debug(f"Raw home location data for {username}: lat='{home_lat_raw}', lon='{home_lon_raw}'")

    if not username:
        logger.warning(f"Set home failed: Missing username. Data: {data}")
        return jsonify({"error": "Missing required field: username"}), 400

    # Check if lat/lon are present and not empty strings before attempting conversion
    if home_lat_raw is None or home_lon_raw is None or str(home_lat_raw).strip() == "" or str(home_lon_raw).strip() == "":
        logger.warning(f"Set home failed for {username}: Missing or empty lat/lon. Data: {data}")
        return jsonify({"error": "Missing or invalid required fields: home_lat, home_lon"}), 400

    conn = None # Initialize conn to None
    try:
        # Attempt conversion to float
        home_lat = float(home_lat_raw)
        home_lon = float(home_lon_raw)
        logger.debug(f"Converted home location for {username}: lat={home_lat}, lon={home_lon}")

        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT id FROM users WHERE username=?", (username,))
        user = c.fetchone()

        if not user:
            logger.info(f"Creating new user {username} during home location set: ({home_lat}, {home_lon})")
            # Ensure role is set, default to 'tourist' if not provided elsewhere
            c.execute("INSERT INTO users (username, role, points, home_lat, home_lon) VALUES (?, 'tourist', 0, ?, ?)",
                    (username, home_lat, home_lon))
        else:
            logger.info(f"Updating home location for existing user {username}: ({home_lat}, {home_lon})")
            c.execute("UPDATE users SET home_lat=?, home_lon=? WHERE username=?",
                    (home_lat, home_lon, username))

        conn.commit()
        logger.info(f"Successfully set/updated home location for {username}")
        return jsonify({"message": "Home location set successfully"}), 200

    except (ValueError, TypeError) as e:
        logger.error(f"Invalid coordinates provided for {username}: lat='{home_lat_raw}', lon='{home_lon_raw}'. Error: {e}")
        return jsonify({"error": f"Invalid coordinates format. Received lat='{home_lat_raw}', lon='{home_lon_raw}'. Error: {str(e)}"}), 400
    except sqlite3.Error as e: # Catch specific DB errors
        logger.error(f"Database error setting home for {username}: {e}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error setting home for {username}: {e}")
        return jsonify({"error": "An unexpected server error occurred"}), 500
    finally:
        if conn:
            conn.close()
            logger.debug(f"Database connection closed for set_home ({username})")

@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    conn = None
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id, username, role, points, home_lat, home_lon FROM users WHERE username=?", (username,))
        user = c.fetchone()
        conn.close()
        
        if not user:
            logger.warning(f"User lookup failed for username: {username}")
            return jsonify({"error": "User not found"}), 404
        
        logger.debug(f"User data retrieved for {username}: Points={user[3]}, Home=({user[4]}, {user[5]})")
        return jsonify({
            "id": user[0],
            "username": user[1],
            "role": user[2],
            "points": user[3],
            "home_lat": user[4],
            "home_lon": user[5]
        }), 200
    except Exception as e:
         logger.error(f"Error fetching user {username}: {e}")
         return jsonify({"error": "Failed to fetch user data"}), 500
    finally:
        if conn: conn.close()

PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjOWQyOWRkYy04YzY2LTQzMDUtYjdhOC1lMTAzMWVjY2RlMDEiLCJlbWFpbCI6ImdlbmVyYWxrYWFhaUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNTZmYzdkNzQzNWQxNjRhZWZmODgiLCJzY29wZWRLZXlTZWNyZXQiOiI5OTJhYzYzZmZlMDY5NmUzMGRkMmFjYzIzNWVlYzk4NWRhYmYwYTM4NTI3MjJlMzFiYjkyMTBjYTExODQ5YTBiIiwiZXhwIjoxNzc4NDIwNzAzfQ.8Ym-LvWteSeh_kb0z79Y-VZ5QuR4D22oFBsu3WxaHNM"
if not PINATA_JWT:
    raise ValueError("PINATA_JWT not set in environment variables")

# In-memory storage for metadata
image_metadata = {}

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Placeholder for GPS conversion (simplified for this example)
def convert_to_degrees(value):
    if not value:
        return None
        
    # Handle different formats of GPS data
    if isinstance(value, tuple) and len(value) == 3:
        # Standard (degrees, minutes, seconds) format
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)
    elif isinstance(value, tuple) and len(value) > 0:
        # Some devices provide rational numbers or other formats
        # Try to get the first value
        return float(value[0])
    elif isinstance(value, (int, float)):
        # Already a simple number
        return float(value)
    else:
        logger.warning(f"Unknown GPS format: {value}")
        return None

# Add health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        # Simple check to see if Pinata is accessible
        url = "https://api.pinata.cloud/data/testAuthentication"
        headers = {"Authorization": f"Bearer {PINATA_JWT}"}
        response = requests.get(url, headers=headers)
        pinata_status = "connected" if response.status_code == 200 else "disconnected"
        
        return jsonify({
            "status": "ok",
            "pinata": pinata_status
        }), 200
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "error",
            "pinata": "disconnected",
            "error": str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        logger.warning("No image file provided")
        return jsonify({"error": "No image uploaded"}), 400

    username = request.form.get('username')
    if not username:
        logger.warning("Username missing")
        return jsonify({"error": "Username required"}), 400

    # Initialize user metadata if new
    if username not in image_metadata:
        image_metadata[username] = []

    # Save image temporarily
    image = request.files['image']
    file_extension = os.path.splitext(image.filename)[1]
    unique_filename = f"{username}_{uuid.uuid4().hex}{file_extension}"
    os.makedirs('uploads', exist_ok=True)
    image_path = os.path.join('uploads', unique_filename)
    image.save(image_path)
    logger.info(f"Image saved: {image_path}")

    # Extract basic metadata (GPS coordinates)
    lat, lon = None, None
    try:
        img = Image.open(image_path)
        exif_data = img.getexif()
        if exif_data and 0x8825 in exif_data:  # GPSInfo tag
            gps_info = exif_data.get_ifd(0x8825)
            logger.debug(f"GPS info extracted: {gps_info}")
            
            # Get latitude
            if 1 in gps_info and 2 in gps_info:  # GPSLatitude and GPSLatitudeRef
                lat = convert_to_degrees(gps_info[1])
                # If south, make latitude negative
                if gps_info[2] == 'S':
                    lat = -lat if lat is not None else None
            
            # Get longitude
            if 3 in gps_info and 4 in gps_info:  # GPSLongitude and GPSLongitudeRef
                lon = convert_to_degrees(gps_info[3])
                # If west, make longitude negative
                if gps_info[4] == 'W':
                    lon = -lon if lon is not None else None
                
            if lat is not None and lon is not None:
                logger.info(f"GPS extracted: ({lat}, {lon})")
    except Exception as e:
        logger.error(f"Error extracting metadata: {e}")
        # Don't fail here - continue with upload even if GPS extraction fails

    # Fetch user's home location
    home_lat, home_lon = None, None
    distance_from_home = 0
    points_earned = 0
    location_name = "Unknown"

    # Get user's home coordinates from database
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT home_lat, home_lon FROM users WHERE username=?", (username,))
        user_data = c.fetchone()
        conn.close()

        if user_data and user_data[0] is not None and user_data[1] is not None:
            home_lat, home_lon = user_data[0], user_data[1]
            logger.info(f"Found home location for {username}: ({home_lat}, {home_lon})")
            
            # If image has GPS and user has home location, calculate distance
            if lat is not None and lon is not None:
                distance_from_home = haversine(home_lat, home_lon, lat, lon)
                logger.info(f"Distance from home: {distance_from_home:.2f} km")
                
                # Award points based on distance
                # Minimum distance threshold of 5km (adjustable as needed)
                if distance_from_home >= 5:
                    # Award 5 points for images taken far from home, more points for greater distances
                    base_points = 5
                    # Extra points for significant distances (e.g., 1 extra point per 50km, max 10 extra)
                    extra_points = min(int(distance_from_home / 50), 10)
                    points_earned = base_points + extra_points
                    location_name = f"{distance_from_home:.1f} km from Home"
                    logger.info(f"Awarded {points_earned} points for distance of {distance_from_home:.1f} km")
                else:
                    logger.info(f"No points awarded: {distance_from_home:.1f} km is too close to home")
                    location_name = "Near Home"
        else:
            logger.warning(f"No home location found for {username}")
            # If no home location is set, award default points if image has GPS
            if lat is not None and lon is not None:
                points_earned = 5  # Default points when we can't determine distance from home
                location_name = "Location Detected"
                logger.info(f"Awarded default points (no home location for user)")
    except Exception as e:
        logger.error(f"Error retrieving user's home location: {e}")
        # Fallback - award basic points if GPS exists
        if lat is not None and lon is not None:
            points_earned = 5
            location_name = "Location Detected"

    # Upload to Pinata
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}
    
    try:
        with open(image_path, "rb") as file_to_upload:
            files = {"file": file_to_upload}
            data = {"pinataOptions": '{"isPrivate": true}'}
            response = requests.post(url, headers=headers, files=files, data=data)

        if response.status_code != 200:
            logger.error(f"Pinata upload failed: {response.text}")
            return jsonify({"error": "Failed to upload to IPFS"}), 500

        cid = response.json()["IpfsHash"]
        logger.info(f"Uploaded to Pinata, CID: {cid}")

        # Store metadata
        memory = {
            "id": len(image_metadata[username]) + 1,
            "lat": lat,
            "lon": lon,
            "location_name": location_name,
            "ipfs_cid": cid,
            "points_earned": points_earned,
            "distance_km": round(distance_from_home, 1) if distance_from_home else None
        }
        image_metadata[username].append(memory)
        
        # Update user's points in database if points were earned
        if points_earned > 0:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET points = points + ? WHERE username=?", (points_earned, username))
                conn.commit()
                conn.close()
                logger.info(f"Added {points_earned} points to user {username}")
            except Exception as e:
                logger.error(f"Error updating points for user {username}: {e}")
                
    except Exception as e:
        logger.error(f"Error during upload process: {e}")
        return jsonify({"error": f"Upload process failed: {str(e)}"}), 500
    finally:
        # Make sure the file is closed before trying to remove it
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
                logger.info(f"Temporary file removed: {image_path}")
        except Exception as e:
            logger.warning(f"Could not remove temporary file: {e}")

    # Return appropriate message based on points
    message = "Image uploaded successfully"
    if points_earned > 0:
        message += f" (+{points_earned} points for traveling {distance_from_home:.1f} km from home!)"
    else:
        if lat is not None:
            message += " (No points awarded - too close to home)"

    return jsonify({
        "message": message,
        "ipfs_cid": cid,
        "points_earned": points_earned,
        "location_name": location_name,
        "distance_km": round(distance_from_home, 1) if distance_from_home else None
    }), 200

@app.route('/api/memories/<username>', methods=['GET'])
def get_memories(username):
    if username not in image_metadata:
        return jsonify([]), 200
    return jsonify(image_metadata[username]), 200

@app.route('/api/memories/<username>/<int:memory_id>/image', methods=['GET'])
def get_memory_image(username, memory_id):
    if username not in image_metadata:
        logger.error(f"User not found: {username}")
        return jsonify({"error": "User not found"}), 404

    memory = next((m for m in image_metadata[username] if m["id"] == memory_id), None)
    if not memory:
        logger.error(f"Memory not found: {memory_id} for user {username}")
        return jsonify({"error": "Memory not found"}), 404

    try:
        # Log the CID we're trying to access
        logger.info(f"Generating access link for CID: {memory['ipfs_cid']}")
        
        # Use the gateway URL directly instead of generating an auth URL
        # This is a public gateway that should work for retrieving the content
        access_link = f"https://gateway.pinata.cloud/ipfs/{memory['ipfs_cid']}"
        logger.info(f"Generated gateway access link: {access_link}")
        
        return jsonify({"access_link": access_link}), 200
    except Exception as e:
        logger.error(f"Error generating access link: {str(e)}")
        return jsonify({"error": f"Error generating access link: {str(e)}"}), 500 

@app.route('/api/chat', methods=['GET'])
def get_chat_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, sender, receiver, message FROM chat_history ORDER BY id")
    chat_data = c.fetchall()
    conn.close()
    
    history = []
    for chat in chat_data:
        history.append({
            "id": chat[0],
            "sender": chat[1],
            "receiver": chat[2],
            "message": chat[3]
        })
    
    return jsonify(history), 200

@app.route('/api/chat', methods=['POST'])
def send_message1():
    data = request.get_json()
    sender = data.get('sender')
    message = data.get('message')
    receiver = data.get('receiver')
    username = data.get('username')
    
    if not all([sender, message, receiver, username]):
        return jsonify({"error": "Missing required fields"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO chat_history (sender, receiver, message) VALUES (?, ?, ?)", 
              (sender, receiver, message))
    
    # Award points to natives for sending messages
    if sender == 'native':
        c.execute("UPDATE users SET points = points + 1 WHERE username=?", (username,))
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Message sent successfully"}), 201

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username, points FROM users ORDER BY points DESC")
    leaderboard_data = c.fetchall()
    conn.close()
    
    leaderboard = []
    for entry in leaderboard_data:
        leaderboard.append({
            "username": entry[0],
            "points": entry[1]
        })
    
    return jsonify(leaderboard), 200

# --- New Live Crowd Density API Endpoint ---

@app.route("/api/check_activity", methods=["GET"])
def get_live_density():
    try:
        # Validate coordinates
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
        
        # Calculate bounding box (roughly 1km around the point)
        lat_offset = 0.009
        lon_offset = 0.009
        
        upper_lat = lat + lat_offset
        lower_lat = lat - lat_offset
        left_lng = lon - lon_offset
        right_lng = lon + lon_offset
        
        # Different data sources to aggregate for crowd density
        incident_data = None
        place_data = None
        time_factor = 1.0  # Multiplier based on time of day
        
        # 1. First data source: Traffic incidents via MapQuest
        try:
            # MapQuest Traffic Incidents API request
            url = f"https://www.mapquestapi.com/traffic/v2/incidents"
            
            payload = {
                "boundingBox": {
                    "ul": {"lat": upper_lat, "lng": left_lng},
                    "lr": {"lat": lower_lat, "lng": right_lng}
                },
                "filters": ["incidents", "construction", "congestion"],
                "key": MAPQUEST_API_KEY
            }
            
            logger.debug(f"MapQuest Traffic API request: {payload}")
            
            mapquest_response = requests.post(url, json=payload)
            
            if mapquest_response.status_code == 200:
                incident_data = mapquest_response.json()
                incidents = incident_data.get("incidents", [])
                logger.info(f"Found {len(incidents)} MapQuest incidents")
            else:
                logger.warning(f"MapQuest API error: {mapquest_response.status_code}")
        except Exception as e:
            logger.error(f"MapQuest API error: {str(e)}")
        
        # 2. Second data source: Place data from Geoapify
        try:
            place_url = "https://api.geoapify.com/v2/places"
            place_params = {
                "categories": "catering,entertainment,tourism,sport,building",
                "filter": f"circle:{lon},{lat},1000",
                "bias": f"proximity:{lon},{lat}",
                "limit": 50,
                "apiKey": GEOAPIFY_API_KEY
            }
            
            place_response = requests.get(place_url, params=place_params)
            if place_response.status_code == 200:
                place_data = place_response.json()
                place_features = place_data.get("features", [])
                logger.info(f"Found {len(place_features)} nearby places")
            else:
                logger.warning(f"Geoapify Places API error: {place_response.status_code}")
        except Exception as e:
            logger.error(f"Geoapify Places API error: {str(e)}")
        
        # 3. Time-based crowd factor (time of day analysis)
        current_hour = datetime.now().hour
        
        # Adjust for typical crowd patterns by time of day
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:  # Rush hours
            time_factor = 1.5  # 50% more crowded during rush hours
        elif 12 <= current_hour <= 14:  # Lunch time
            time_factor = 1.3  # 30% more crowded during lunch
        elif 22 <= current_hour or current_hour <= 5:  # Late night/early morning
            time_factor = 0.7  # 30% less crowded during off-hours
        else:
            time_factor = 1.0  # Normal hours
            
        logger.debug(f"Time factor: {time_factor} for hour {current_hour}")
        
        # Algorithm to calculate crowd density based on all available inputs
        # Start with a base crowd estimate using incident data
        incident_count = 0
        high_severity_count = 0
        
        if incident_data and "incidents" in incident_data:
            incidents = incident_data.get("incidents", [])
            incident_count = len(incidents)
            high_severity_count = sum(1 for inc in incidents if inc.get("severity", 0) >= 3)
            
            # Filter for the top incidents to return
            top_incidents = sorted(incidents, key=lambda x: x.get("severity", 0), reverse=True)[:3]
            incident_descriptions = [
                {
                    "description": inc.get("shortDesc", "Unknown incident"),
                    "severity": inc.get("severity", 0),
                    "type": inc.get("type", 0),
                    "time": inc.get("startTime", ""),
                    "fullDesc": inc.get("fullDesc", ""),
                    "impacting": inc.get("impacting", False)
                }
                for inc in top_incidents
            ]
        else:
            incident_descriptions = []
            
        # Add place density estimate
        place_weight = 0
        if place_data and "features" in place_data:
            places = place_data.get("features", [])
            
            # Weight categories differently
            category_weights = {
                "catering": 1.2,  # Restaurants/cafes
                "entertainment": 1.5,  # Entertainment venues
                "tourism": 1.8,  # Tourist attractions
                "commercial": 1.4,  # Shopping areas
                "sport": 1.3,  # Sports venues
                "building.tourism": 1.7  # Tourism buildings
            }
            
            # Calculate place weight based on categories and count
            for place in places:
                categories = place.get("properties", {}).get("categories", [])
                weight = 1.0
                
                for category in categories:
                    for key, multiplier in category_weights.items():
                        if key in category:
                            weight = max(weight, multiplier)
                            
                place_weight += weight
                
            logger.debug(f"Place weight: {place_weight} from {len(places)} places")
        
        # Combined crowd density algorithm:
        # 1. Base on incident count and severity (50% of weight)
        # 2. Adjust for places nearby (30% of weight)
        # 3. Apply time factor (20% of weight)
        
        # Calculate incident-based density
        if incident_count > 10 or high_severity_count >= 3:
            incident_factor = 3  # High
        elif incident_count > 5 or high_severity_count >= 1:
            incident_factor = 2  # Medium
        else:
            incident_factor = 1  # Low
            
        # Calculate place-based density
        if place_weight > 50:
            place_factor = 3  # High
        elif place_weight > 25:
            place_factor = 2  # Medium
        else:
            place_factor = 1  # Low
            
        # Combined crowd density score (0-3 scale)
        crowd_score = (incident_factor * 0.5) + (place_factor * 0.3) + (time_factor * 0.2)
        
        # Map score to status
        if crowd_score >= 2.5:
            status = "high"
            device_count = int(120 + incident_count * 5 + place_weight * 2)
        elif crowd_score >= 1.7:
            status = "medium"
            device_count = int(60 + incident_count * 3 + place_weight * 1.5)
        else:
            status = "low"
            device_count = int(20 + incident_count * 2 + place_weight)
            
        logger.info(f"Crowd score: {crowd_score:.2f}, Status: {status}, Devices: {device_count}")
        
        # Generate high-quality static map using Geoapify
        map_url = (
            f"https://maps.geoapify.com/v1/staticmap?"
            f"style=osm-bright&width=800&height=500&"
            f"center=lonlat:{lon},{lat}&zoom=16&"
            f"apiKey={GEOAPIFY_API_KEY}&"
            f"circle=lon:{lon};lat:{lat};radius:{SEARCH_RADIUS};color:%23ff0000;width:2;fill:%23ff000033&"
            f"marker=lonlat:{lon},{lat};color:%23ff0000;size:medium"
        )
        
        # Add nearby places to the map if available
        if place_data and "features" in place_data:
            top_places = place_data.get("features", [])[:10]  # Limit to top 10 places
            
            for i, place in enumerate(top_places):
                place_coords = place.get("geometry", {}).get("coordinates", [])
                if place_coords and len(place_coords) >= 2:
                    place_lon, place_lat = place_coords
                    map_url += f"&marker=lonlat:{place_lon},{place_lat};color:%2324a0ed;size:small"

        return jsonify({
            "status": status,
            "device_count": device_count,
            "incident_count": incident_count,
            "map_url": map_url,
            "radius": SEARCH_RADIUS,
            "timestamp": datetime.utcnow().isoformat(),
            "top_incidents": incident_descriptions,
            "crowd_score": round(crowd_score, 2)
        })

    except Exception as e:
        logger.error(f"Traffic API Error: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Crowd density analysis failed",
            "error_details": str(e),
            "resolution": "Please check the coordinates and try again"
        }), 500

# Create routes for flight and route searches (direct routes, not under /api)
@app.route('/flights', methods=['GET'])
def search_flights():
    """Search for flights using Aviation Stack API."""
    # Check if API key is configured
    if not AVIATION_STACK_API_KEY or AVIATION_STACK_API_KEY == 'your_aviationstack_api_key':
        logger.error("Aviation Stack API key is not configured or is using the placeholder.")
        return jsonify({
            'error': 'Aviation Stack API key not configured on the server.'
        }), 500
        
    # Get query parameters
    dep_iata = request.args.get('dep_iata', '')
    arr_iata = request.args.get('arr_iata', '')
    limit = request.args.get('limit', 10)
    offset = request.args.get('offset', 0)
    
    # Log request parameters
    print(f"Flight search request: dep_iata={dep_iata}, arr_iata={arr_iata}, limit={limit}, offset={offset}")
    
    # Call Aviation Stack API
    url = "http://api.aviationstack.com/v1/flights"
    params = {
        'access_key': AVIATION_STACK_API_KEY, # Use the loaded key
        'limit': limit,
        'offset': offset
    }
    
    # Add optional filters if provided
    if dep_iata:
        params['dep_iata'] = dep_iata.strip()
    if arr_iata:
        params['arr_iata'] = arr_iata.strip()
    
    try:
        response = requests.get(url, params=params)
        
        # Check for API errors (including 401 from Aviation Stack if key is invalid despite check)
        if response.status_code != 200:
            logger.error(f"Aviation Stack API returned status code {response.status_code}: {response.text}")
            return jsonify({
                'error': f"Aviation Stack API error (Status: {response.status_code})",
                'message': response.text # Forward the error from Aviation Stack
            }), response.status_code # Return the original status code
            
        # Return the API response
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error querying flight data: {e}")
        return jsonify({
            'error': f"Error querying flight data: {str(e)}"
        }), 500

@app.route('/routes', methods=['GET'])
def search_routes():
    """Search for airline routes between airports."""
    # Check if API key is configured
    if not AVIATION_STACK_API_KEY or AVIATION_STACK_API_KEY == 'your_aviationstack_api_key':
        logger.error("Aviation Stack API key is not configured or is using the placeholder.")
        return jsonify({
            'error': 'Aviation Stack API key not configured on the server.'
        }), 500
        
    # Get query parameters
    dep_iata = request.args.get('dep_iata', '')
    arr_iata = request.args.get('arr_iata', '')
    limit = request.args.get('limit', 10)
    offset = request.args.get('offset', 0)
    
    # Log request parameters
    print(f"Route search request: dep_iata={dep_iata}, arr_iata={arr_iata}, limit={limit}, offset={offset}")
    
    # Call Aviation Stack API for routes
    url = "http://api.aviationstack.com/v1/routes"
    params = {
        'access_key': AVIATION_STACK_API_KEY, # Use the loaded key
        'limit': limit,
        'offset': offset
    }
    
    # Add optional filters if provided
    if dep_iata:
        params['dep_iata'] = dep_iata.strip()
    if arr_iata:
        params['arr_iata'] = arr_iata.strip()
    
    try:
        response = requests.get(url, params=params)
        
        # Check for API errors
        if response.status_code != 200:
            logger.error(f"Aviation Stack API returned status code {response.status_code}: {response.text}")
            return jsonify({
                'error': f"Aviation Stack API error (Status: {response.status_code})",
                'message': response.text
            }), response.status_code
            
        # Return the API response
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error querying route data: {e}")
        return jsonify({
            'error': f"Error querying route data: {str(e)}"
        }), 500

@app.route('/airlines', methods=['GET'])
def search_airlines():
    """Search for airlines."""
    # Check if API key is configured
    if not AVIATION_STACK_API_KEY or AVIATION_STACK_API_KEY == 'your_aviationstack_api_key':
        logger.error("Aviation Stack API key is not configured or is using the placeholder.")
        return jsonify({
            'error': 'Aviation Stack API key not configured on the server.'
        }), 500
        
    # Get query parameters
    airline_name = request.args.get('airline_name', '')
    limit = request.args.get('limit', 10)
    offset = request.args.get('offset', 0)
    
    # Call Aviation Stack API for airlines
    url = "http://api.aviationstack.com/v1/airlines"
    params = {
        'access_key': AVIATION_STACK_API_KEY, # Use the loaded key
        'limit': limit,
        'offset': offset
    }
    
    # Add optional filters if provided
    if airline_name:
        params['airline_name'] = airline_name.strip()
    
    try:
        response = requests.get(url, params=params)
        
        # Check for API errors
        if response.status_code != 200:
            logger.error(f"Aviation Stack API returned status code {response.status_code}: {response.text}")
            return jsonify({
                'error': f"Aviation Stack API error (Status: {response.status_code})",
                'message': response.text
            }), response.status_code
            
        # Return the API response
        return jsonify(response.json())
    
    except Exception as e:
        logger.error(f"Error querying airline data: {e}")
        return jsonify({
            'error': f"Error querying airline data: {str(e)}"
        }), 500

# --- NEW: API Routes for Crowdsourced Safety ---

@app.route('/api/safety/reports', methods=['GET'])
def get_safety_reports():
    conn = None
    try:
        conn = sqlite3.connect(CROWDSOURCE_DB_PATH)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        # Fetch all reports, ordered by most recent
        cursor.execute('SELECT id, type, latitude, longitude, description, timestamp, username FROM incidents ORDER BY timestamp DESC')
        reports = cursor.fetchall()
        return jsonify(reports)
    except sqlite3.Error as e:
        logger.error(f"Error fetching safety reports: {e}")
        return jsonify({"error": "Database error fetching reports"}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/safety/report', methods=['POST'])
def add_safety_report():
    data = request.json
    report_type = data.get('type')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    description = data.get('description', '')
    username = data.get('username') # Get username from request

    # Basic validation
    if not all([report_type, latitude is not None, longitude is not None, username]):
        logger.warning(f"Invalid safety report data received: {data}")
        return jsonify({'error': 'Missing required fields: type, latitude, longitude, username'}), 400

    # Validate report type
    allowed_types = ['pickpocketing', 'scam', 'safe_locker', 'harassment', 'health', 'tip'] # Added types from frontend attempt
    if report_type not in allowed_types:
         logger.warning(f"Invalid safety report type: {report_type}")
         return jsonify({'error': f'Invalid report type. Allowed types: {", ".join(allowed_types)}'}), 400

    timestamp = datetime.now().isoformat()
    conn = None
    try:
        conn = sqlite3.connect(CROWDSOURCE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO incidents (type, latitude, longitude, description, timestamp, username) VALUES (?, ?, ?, ?, ?, ?)',
            (report_type, latitude, longitude, description, timestamp, username)
        )
        conn.commit()
        report_id = cursor.lastrowid
        logger.info(f"Safety report added by {username}: type={report_type}, id={report_id}")

        # --- Award points for submitting a report ---
        native_conn = None
        try:
            native_conn = get_db_connection()
            native_cursor = native_conn.cursor()
            # Award 5 points for submitting a safety report
            native_cursor.execute("UPDATE users SET points = points + 5 WHERE username=?", (username,))
            native_conn.commit()
            logger.info(f"Awarded 5 points to {username} for submitting safety report.")
        except sqlite3.Error as e:
            logger.error(f"Error awarding points to {username} for safety report: {e}")
            # Don't fail the whole request if points awarding fails
        finally:
            if native_conn:
                native_conn.close()
        # --- End points awarding ---

        # Fetch the newly created report to return it
        cursor.execute('SELECT id, type, latitude, longitude, description, timestamp, username FROM incidents WHERE id = ?', (report_id,))
        new_report = cursor.fetchone()
        conn.row_factory = dict_factory # Apply factory after fetchone
        new_report_dict = dict_factory(cursor, new_report) if new_report else None

        return jsonify({'status': 'ok', 'report': new_report_dict}), 201

    except sqlite3.Error as e:
        logger.error(f"Database error adding safety report: {e}")
        return jsonify({'error': 'Database error adding report'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/safety/statistics', methods=['GET'])
def get_safety_statistics():
    conn = None
    try:
        conn = sqlite3.connect(CROWDSOURCE_DB_PATH)
        cursor = conn.cursor()
        
        stats = {}
        allowed_types = ['pickpocketing', 'scam', 'safe_locker', 'harassment', 'health', 'tip']
        for report_type in allowed_types:
            cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = ?", (report_type,))
            count = cursor.fetchone()[0]
            stats[report_type] = count
            
        return jsonify(stats)
    except sqlite3.Error as e:
        logger.error(f"Error fetching safety statistics: {e}")
        return jsonify({"error": "Database error fetching statistics"}), 500
    finally:
        if conn:
            conn.close()

# --- NEW: AR Guide Backend Routes ---
# --- NEW: AR Guide Page Route ---
# ... existing code ...

# --- NEW: AR Guide Page Route ---
@app.route('/ar-guide')
def ar_guide_page():
    """Serve the AR Guide page"""
    # This will now be handled by your Next.js frontend,
    # but you might keep it if you have a direct Flask-served version too.
    # For a pure Next.js frontend, this route on the Flask backend might not be strictly necessary
    # if ar_guide.html is no longer used.
    return render_template('ar_guide.html') # Or remove if Next.js handles all AR guide rendering

# --- Sarvam AI Configuration ---
SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY") # Recommended: Set as environment variable
SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech" # New TTS URL

# --- Helper function for Sarvam AI Translation ---
def translate_text_sarvam(text_to_translate, target_language_code, source_language_code="en-IN"):
    """Translates text using Sarvam AI API."""
    if not SARVAM_API_KEY:
        logger.error("Sarvam AI API key not configured.")
        return text_to_translate # Return original text if API key is missing

    if not text_to_translate or target_language_code == source_language_code:
        return text_to_translate # No need to translate

    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "input": text_to_translate,
        "source_language_code": source_language_code, # Assuming Groq output is English
        "target_language_code": target_language_code,
        # "model": "mayura:v1" # Optional, will be deprecated
        "enable_preprocessing": True # Optional, as per documentation
    }
    try:
        logger.info(f"Translating to {target_language_code}: '{text_to_translate[:50]}...'")
        response = requests.post(SARVAM_TRANSLATE_URL, headers=headers, json=payload)
        response.raise_for_status() # Raise an exception for HTTP errors
        translated_data = response.json()
        logger.info(f"Sarvam AI translation response: {translated_data}")
        return translated_data.get("translated_text", text_to_translate)
    except requests.exceptions.RequestException as e:
        logger.error(f"Sarvam AI translation request failed: {e}")
        if response is not None:
            logger.error(f"Sarvam AI error response: {response.text}")
        return text_to_translate # Fallback to original text
    except Exception as e:
        logger.error(f"Error during Sarvam AI translation: {e}")
        return text_to_translate # Fallback to original text
def generate_speech_sarvam(text_to_speak, language_code, speaker="Meera"):
    """Generates speech using Sarvam AI TTS API and returns base64 audio."""
    if not SARVAM_API_KEY:
        logger.error("Sarvam AI API key not configured for TTS.")
        return None
    if not text_to_speak:
        logger.info("No text provided for TTS.")
        return None

    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    # Ensure language_code is in BCP-47 format for TTS
    # Most of your existing codes like 'en-IN', 'hi-IN' should be fine.
    payload = {
        "text": text_to_speak,
        "target_language_code": language_code,
        "speaker": speaker,  # Default speaker, check Sarvam docs for compatibility
        "model": "bulbul:v1", # Or "bulbul:v2", ensure speaker is compatible
        # "enable_preprocessing": True, # Consider for mixed language robustness
        # "speech_sample_rate": 22050, # Default is 22050 Hz
    }
    try:
        logger.info(f"Requesting TTS for language {language_code} with speaker {speaker}: '{text_to_speak[:70]}...'")
        response = requests.post(SARVAM_TTS_URL, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for HTTP errors
        tts_data = response.json()
        logger.info(f"Sarvam AI TTS response received. Audios list length: {len(tts_data.get('audios', []))}")

        if tts_data.get("audios") and len(tts_data["audios"]) > 0:
            # API returns a list of base64 strings. We'll use the first one.
            return tts_data["audios"][0]
        else:
            logger.error(f"No audio data in Sarvam AI TTS response: {tts_data}")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Sarvam AI TTS request failed: {e}")
        if response is not None:
            logger.error(f"Sarvam AI TTS error response content: {response.text}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during Sarvam AI TTS generation: {e}")
        return None


@app.route('/api/process_tap', methods=['POST'])
def process_ar_image():
    """Processes an image captured via the AR interface and translates text if needed."""
    if not GROQ_API_KEY:
        return jsonify({"error": "Image analysis service not configured"}), 503

    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400

    image_data_url = data.get('image')
    target_language = data.get('language', 'en-IN')
    logger.info(f"AR Image received. Target language for results: {target_language}")

    try:
        header, encoded = image_data_url.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        image = Image.open(BytesIO(image_bytes))
        logger.info(f"AR Image received and decoded for language: {target_language}")

        client = Groq(api_key=GROQ_API_KEY)
        logger.info("Sending image to Groq Vision API...")

        prompt = f"""You are an expert virtual tour guide specializing in Indian historical and cultural sites. Analyze the main subject in this image.

        If it is a recognizable historical monument, building, or significant cultural site primarily within India, provide a detailed and engaging description. Your response MUST be in JSON format with the following keys: "object_name", "info", and "history".

        1.  **object_name:** The official or most common name of the site.
        2.  **info:** A captivating and informative description (aim for 4-6 sentences). Explain its primary significance, architectural style (if applicable), and what makes it unique or important. Use vivid language to paint a picture for the user. For example, instead of 'It is old', try 'It stands as a testament to centuries of craftsmanship...'.
        3.  **history:** Key historical narrative (aim for 3-5 sentences). Include significant dates, periods, or events associated with its construction, use, or important moments in its past. Mention key figures if relevant. Make it story-like and engaging.

        Example for a known site:
        {{
        "object_name": "Taj Mahal",
        "info": "The Taj Mahal, an ivory-white marble mausoleum on the south bank of the Yamuna river in Agra, is an architectural marvel and a symbol of eternal love. Commissioned by Mughal emperor Shah Jahan in memory of his beloved wife Mumtaz Mahal, its breathtaking beauty combines elements from Islamic, Persian, Ottoman Turkish and Indian architectural styles. Millions visit annually to witness its symmetrical perfection and intricate inlay work.",
        "history": "Construction began in 1632 AD and the mausoleum was completed in 1648 AD, with the mosque, guest house, and main gateway on the south, the outer courtyard and its cloisters added subsequently and completed in 1653 AD. The project employed some 20,000 artisans under a board of architects. It is a UNESCO World Heritage Site and one of the New7Wonders of the world, standing as a testament to Mughal grandeur and artistic achievement."
        }}

        If the image is NOT a recognizable Indian cultural or historical site, or if you are uncertain, respond with the following specific JSON:
        {{"object_name": "Unknown Site", "info": "I'm sorry, I couldn't identify this as a known Indian historical or cultural site from the image. Perhaps try a different angle or a more prominent landmark.", "history": ""}}

        Focus on sites within India. If it's a very famous global landmark clearly outside India (e.g., Eiffel Tower), you can state it's not an Indian site using the 'Unknown Site' format but adjust the info text accordingly.
        """

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user", 
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url,
                            },
                        },
                    ],
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2,
            max_tokens=300,
        )

        response_content = chat_completion.choices[0].message.content
        logger.info(f"Groq Vision API response received: {response_content}")

        try:
            if response_content.strip().startswith("```json"):
                response_content = response_content.strip()[7:-3].strip()
            analysis_result = json.loads(response_content)
            object_name = analysis_result.get("object_name", "Unknown Site")
            info = analysis_result.get("info", "Analysis failed or object not recognized.")
            history = analysis_result.get("history", "")

        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse JSON response from Groq: {json_err}")
            logger.error(f"Raw response content: {response_content}")
            object_name = "Unknown Site"
            info = "Could not process the visual information correctly. The raw response was: " + response_content[:200]
            history = ""

        source_language_for_translation = "en-IN"
        translated_object_name = object_name
        translated_info = info 
        translated_history = history

        if target_language != source_language_for_translation:
            logger.info(f"Translating content from {source_language_for_translation} to {target_language}")
            if object_name != "Unknown Site":
                translated_object_name = translate_text_sarvam(object_name, target_language, source_language_for_translation)
                translated_info = translate_text_sarvam(info, target_language, source_language_for_translation)
                translated_history = translate_text_sarvam(history, target_language, source_language_for_translation)
            else:
                translated_object_name = translate_text_sarvam(object_name, target_language, source_language_for_translation)
                translated_info = translate_text_sarvam(info, target_language, source_language_for_translation)

        audio_base64 = None
        tts_input_text = ""

        if translated_object_name != "Unknown Site":
            tts_input_text = f"{translated_object_name}. {translated_info}"
            if translated_history:
                tts_input_text += f" {translated_history}"
        else:
            tts_input_text = translated_info

        if tts_input_text:
            max_tts_chars = 1450
            if len(tts_input_text) > max_tts_chars:
                logger.warning(f"TTS text too long ({len(tts_input_text)} chars), truncating to {max_tts_chars}.")
                tts_input_text = tts_input_text[:max_tts_chars]
            
            audio_base64 = generate_speech_sarvam(tts_input_text, target_language)

        return jsonify({
            "object_name": translated_object_name,
            "info": translated_info,
            "history": translated_history,
            "audio_base64": audio_base64
        })

    except Exception as e:
        logger.error(f"Error processing AR image: {str(e)}", exc_info=True)
        error_message_en = "Sorry, an error occurred while processing your request."
        error_object_name_en = "Processing Error"
        target_lang_for_error = data.get('language', 'en-IN') if data else 'en-IN'
        final_error_message = translate_text_sarvam(error_message_en, target_lang_for_error, "en-IN")
        final_object_name = translate_text_sarvam(error_object_name_en, target_lang_for_error, "en-IN")

        return jsonify({
            "object_name": final_object_name,
            "info": final_error_message,
            "history": "",
            "audio_base64": generate_speech_sarvam(final_error_message, target_lang_for_error)
        }), 500
class Member:
    def __init__(self, name: str, personal_budget: float):
        self.id = str(uuid.uuid4())
        self.name = name
        self.personal_budget = personal_budget
        self.remaining_budget = personal_budget
        self.expenses: List[Dict] = []
        self.preferences: Dict[str, bool] = {}  # activity_type: like/dislike
        self.payments: Dict[str, bool] = {}  # expense_id: paid/unpaid
        self.activities: List[str] = []  # List of activity IDs

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "personal_budget": self.personal_budget,
            "remaining_budget": self.remaining_budget,
            "preferences": self.preferences,
            "activities": self.activities,
            "expenses": self.expenses, # Added for potential frontend use
            "payments": self.payments  # Added for potential frontend use
        }

class Group:
    def __init__(self, name: str, total_budget: float, leader_id: str):
        self.id = str(uuid.uuid4())
        self.name = name
        self.total_budget = total_budget
        self.remaining_budget = total_budget
        self.leader_id = leader_id
        self.members: Dict[str, Member] = {}
        self.expenses: List[Dict] = []
        self.activities: List[Dict] = []
        self.total_spent = 0

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "total_budget": self.total_budget,
            "remaining_budget": self.remaining_budget,
            "total_spent": self.total_spent,
            "leader_id": self.leader_id,
            "members": [member.to_dict() for member in self.members.values()],
            "expenses": self.expenses,
            "activities": self.activities
        }

class DevTracker:
    def __init__(self):
        self.groups: Dict[str, Group] = {}
        self.users: Dict[str, Dict] = {}  # user_id: {name, groups}

    def create_group(self, name: str, total_budget: float, leader_id: str) -> str:
        group = Group(name, total_budget, leader_id)
        self.groups[group.id] = group
        if leader_id not in self.users:
            # For simplicity, creating a default user if leader_id doesn't exist
            self.users[leader_id] = {"name": f"User-{leader_id}", "groups": []}
        self.users[leader_id]["groups"].append(group.id)
        return group.id

    def delete_group(self, group_id: str) -> bool:
        if group_id not in self.groups:
            return False
        group = self.groups[group_id]
        # Remove group from all users' group lists
        for user_id in list(self.users.keys()): # Iterate over a copy for safe modification
            if group_id in self.users[user_id]["groups"]:
                self.users[user_id]["groups"].remove(group_id)
        del self.groups[group_id]
        return True

    def add_member(self, group_id: str, name: str, personal_budget: float) -> Optional[str]:
        if group_id not in self.groups:
            raise ValueError("Group not found")
        
        member = Member(name, personal_budget)
        self.groups[group_id].members[member.id] = member
        return member.id

    def remove_member(self, group_id: str, member_id: str) -> bool:
        if group_id not in self.groups:
            return False
        group = self.groups[group_id]
        if member_id not in group.members:
            return False
        del group.members[member_id]
        # Consider additional cleanup like removing member from expenses, activities if needed
        return True

    def add_expense(self, group_id: str, amount: float, description: str, 
                   paid_by: str, split_type: str = "equal", 
                   custom_splits: Optional[Dict[str, float]] = None) -> Optional[str]:
        if group_id not in self.groups:
            raise ValueError("Group not found")
        group = self.groups[group_id]
        expense_id = str(uuid.uuid4())
        
        if not group.members:
             raise ValueError("Cannot add expense: No members in the group to split with.")

        if split_type == "equal":
            share = amount / len(group.members) if len(group.members) > 0 else 0
            splits = {member_id: share for member_id in group.members}
        elif split_type == "custom":
            if not custom_splits or abs(sum(custom_splits.values()) - amount) > 0.01: # Check sum with tolerance
                raise ValueError("Invalid custom splits: Sum of splits must equal total amount.")
            splits = custom_splits
            # Ensure all members in custom_splits exist in the group
            for member_id in custom_splits:
                if member_id not in group.members:
                    raise ValueError(f"Invalid member ID in custom splits: {member_id}")
        else:
            raise ValueError(f"Invalid split_type: {split_type}")


        expense = {
            "id": expense_id,
            "amount": amount,
            "description": description,
            "paid_by": paid_by, # In a real app, validate paid_by member ID
            "splits": splits,
            "date": datetime.now().isoformat(),
            "status": "pending" # e.g. pending, verified, rejected
        }

        group.expenses.append(expense)
        group.remaining_budget -= amount
        group.total_spent += amount
        
        for member_id, share in splits.items():
            if member_id in group.members: # Ensure member exists
                member = group.members[member_id]
                member.remaining_budget -= share
                member.expenses.append({"expense_id": expense_id, "share": share, "description": description}) # Store simplified expense info
                member.payments[expense_id] = False # False means unpaid by this member

        return expense_id

    def mark_payment(self, group_id: str, expense_id: str, member_id: str, paid: bool) -> bool:
        if group_id not in self.groups or member_id not in self.groups[group_id].members:
            return False
        member = self.groups[group_id].members[member_id]
        if expense_id not in member.payments:
            return False # Expense might not involve this member or doesn't exist
        member.payments[expense_id] = paid
        return True

    def verify_payment(self, group_id: str, expense_id: str, verifier_member_id: str, verified: bool) -> bool:
        if group_id not in self.groups:
            return False
        group = self.groups[group_id]
        # Assuming only the group leader can verify for now
        if group.leader_id != verifier_member_id: 
            # Or check if verifier_member_id is an admin/leader of the group
            # For simplicity, let's restrict to leader_id or allow any member to trigger this
            # but actual verification status might be different from payment status
            # This logic might need refinement based on actual roles.
            # For now, let's say only leader can verify.
             raise PermissionError("Only the group leader can verify payments.")
        
        for expense in group.expenses:
            if expense["id"] == expense_id:
                expense["status"] = "verified" if verified else "rejected"
                # Potentially update member balances or group budget based on verification
                return True
        return False

    def add_activity(self, group_id: str, name: str, cost: float, 
                    participants: List[str], activity_type: str) -> Optional[str]:
        if group_id not in self.groups:
            raise ValueError("Group not found")
        group = self.groups[group_id]
        activity_id = str(uuid.uuid4())
        
        valid_participants = []
        for participant_id in participants:
            if participant_id not in group.members:
                # Option: raise error or just skip non-existent members
                print(f"Warning: Participant ID {participant_id} not found in group {group_id}. Skipping.")
                # raise ValueError(f"Invalid participant ID: {participant_id}")
            else:
                valid_participants.append(participant_id)
        
        if not valid_participants and participants: # If participants were provided but none were valid
             raise ValueError("No valid participants found for the activity.")

        activity = {
            "id": activity_id,
            "name": name,
            "cost": cost,
            "participants": valid_participants,
            "activity_type": activity_type, # Renamed from 'type' to avoid conflict
            "date": datetime.now().isoformat(),
            "status": "planned" # e.g. planned, completed, cancelled
        }
        
        group.activities.append(activity)
        
        for participant_id in valid_participants:
            group.members[participant_id].activities.append(activity_id)
        
        # Optionally, if activity has a cost, it could be treated as an expense
        # group.remaining_budget -= cost 
        # This depends on whether activity cost directly impacts group budget or is paid by participants separately

        return activity_id

    def set_preference(self, group_id: str, member_id: str, activity_type: str, likes: bool) -> bool:
        if group_id not in self.groups or member_id not in self.groups[group_id].members:
            return False
        self.groups[group_id].members[member_id].preferences[activity_type] = likes
        return True

    def get_recommendations(self, group_id: str, member_id: str) -> List[Dict]:
        if group_id not in self.groups or member_id not in self.groups[group_id].members:
            return []
        
        group = self.groups[group_id]
        member = group.members[member_id]
        recommendations = []
        
        for activity in group.activities:
            # Check preference, budget, and if member is not already a participant
            if (activity.get("activity_type") in member.preferences and 
                member.preferences[activity["activity_type"]] and 
                activity.get("cost", 0) <= member.remaining_budget and
                member_id not in activity.get("participants", [])):
                recommendations.append(activity)
        
        return recommendations

# Initialize DevTracker
tracker = DevTracker()

# --- API Routes ---

@app.route('/api/groups', methods=['POST'])
def api_create_group():
    try:
        data = request.json
        if not data or 'name' not in data or 'total_budget' not in data:
            return jsonify({"status": "error", "message": "Missing name or total_budget"}), 400
        
        # For simplicity, using a placeholder leader_id if not provided by client.
        # In a real app, this would come from an authenticated user session.
        leader_id = data.get('leader_id', 'default_leader_id') 
        if leader_id == 'default_leader_id' and leader_id not in tracker.users:
             tracker.users[leader_id] = {"name": "Default Leader", "groups": []}


        group_id = tracker.create_group(
            data['name'],
            float(data['total_budget']),
            leader_id 
        )
        group = tracker.groups[group_id]
        return jsonify({"status": "success", "message": "Group created successfully", "data": group.to_dict()}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups', methods=['GET'])
def api_get_groups():
    try:
        groups = [group.to_dict() for group in tracker.groups.values()]
        return jsonify({"status": "success", "data": groups})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>', methods=['GET'])
def api_get_group_details(group_id):
    try:
        if group_id not in tracker.groups:
            return jsonify({"status": "error", "message": "Group not found"}), 404
        group = tracker.groups[group_id]
        return jsonify({"status": "success", "data": group.to_dict()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# This route is largely the same as get_group_details, consider if summary needs to be different.
# For now, it's an alias to get full group details for frontend compatibility from original main.js.
@app.route('/api/groups/<group_id>/summary', methods=['GET'])
def api_get_group_summary(group_id):
    return api_get_group_details(group_id)


@app.route('/api/groups/<group_id>', methods=['DELETE'])
def api_delete_group(group_id):
    try:
        if tracker.delete_group(group_id):
            return jsonify({"status": "success", "message": "Group deleted successfully"})
        return jsonify({"status": "error", "message": "Group not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/members', methods=['POST'])
def api_add_member(group_id):
    try:
        data = request.json
        if not data or 'name' not in data or 'personal_budget' not in data:
            return jsonify({"status": "error", "message": "Missing name or personal_budget"}), 400

        member_id = tracker.add_member(
            group_id,
            data['name'],
            float(data['personal_budget'])
        )
        if member_id is None: # Should be caught by add_member's potential ValueError
             return jsonify({"status": "error", "message": "Failed to add member, group might not exist"}), 404
        
        member = tracker.groups[group_id].members[member_id]
        return jsonify({"status": "success", "message": "Member added successfully", "data": member.to_dict()}), 201
    except ValueError as e: # Catch specific "Group not found"
        return jsonify({"status": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/members/<member_id>', methods=['DELETE'])
def api_remove_member(group_id, member_id):
    try:
        if tracker.remove_member(group_id, member_id):
            return jsonify({"status": "success", "message": "Member removed successfully"})
        return jsonify({"status": "error", "message": "Group or member not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/expenses', methods=['POST'])
def api_add_expense(group_id):
    try:
        data = request.json
        if not data or 'amount' not in data or 'description' not in data or 'paid_by' not in data:
             return jsonify({"status": "error", "message": "Missing required fields for expense (amount, description, paid_by)"}), 400

        # Validate paid_by member exists (optional, depends on strictness)
        # if data['paid_by'] != 'current_user' and data['paid_by'] not in tracker.groups[group_id].members:
        #     return jsonify({"status": "error", "message": f"Payer ID {data['paid_by']} not found in group"}), 400


        expense_id = tracker.add_expense(
            group_id,
            float(data['amount']),
            data['description'],
            data['paid_by'], # In a real app, this should be a valid member_id or 'group_funds'
            data.get('split_type', 'equal'),
            data.get('custom_splits') # e.g. {"member_id1": amount1, "member_id2": amount2}
        )
        # Find the expense to return it
        expense = next((exp for exp in tracker.groups[group_id].expenses if exp["id"] == expense_id), None)
        return jsonify({"status": "success", "message": "Expense added successfully", "data": expense}), 201
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400 # For split errors, group not found, no members
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/expenses/<expense_id>/payments', methods=['POST'])
def api_mark_payment(group_id, expense_id):
    try:
        data = request.json
        if 'member_id' not in data or 'paid' not in data:
            return jsonify({"status": "error", "message": "Missing member_id or paid status"}), 400
        
        if tracker.mark_payment(group_id, expense_id, data['member_id'], bool(data['paid'])):
            return jsonify({"status": "success", "message": "Payment status updated"})
        return jsonify({"status": "error", "message": "Failed to update payment status. Invalid group, member, or expense."}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/expenses/<expense_id>/verify', methods=['POST'])
def api_verify_payment(group_id, expense_id):
    try:
        data = request.json
        # In a real app, 'verifier_member_id' should come from authenticated user.
        verifier_member_id = data.get('verifier_member_id', tracker.groups[group_id].leader_id if group_id in tracker.groups else None)
        if not verifier_member_id:
             return jsonify({"status": "error", "message": "Verifier ID missing or group not found"}), 400
        if 'verified' not in data:
             return jsonify({"status": "error", "message": "Missing verification status ('verified': true/false)"}), 400

        if tracker.verify_payment(group_id, expense_id, verifier_member_id, bool(data['verified'])):
            return jsonify({"status": "success", "message": "Payment verification status updated"})
        return jsonify({"status": "error", "message": "Failed to verify payment. Invalid request or expense not found."}), 400
    except PermissionError as e:
        return jsonify({"status": "error", "message": str(e)}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/activities', methods=['POST'])
def api_add_activity(group_id):
    try:
        data = request.json
        if not data or 'name' not in data or 'cost' not in data or 'participants' not in data or 'activity_type' not in data:
             return jsonify({"status": "error", "message": "Missing required fields for activity"}), 400
        
        # Participants should be a list of member_ids. 
        # The JS used ['current_user'] placeholder. If actual user IDs aren't available yet,
        # this part of the frontend logic might need to select actual members.
        # For now, if 'current_user' is passed, and we have members, we can pick the first one as a demo.
        participants = data['participants']
        if 'current_user' in participants and group_id in tracker.groups and tracker.groups[group_id].members:
            first_member_id = list(tracker.groups[group_id].members.keys())[0]
            participants = [pid if pid != 'current_user' else first_member_id for pid in participants]


        activity_id = tracker.add_activity(
            group_id,
            data['name'],
            float(data['cost']),
            participants, # This should be a list of member IDs
            data['activity_type']
        )
        activity = next((act for act in tracker.groups[group_id].activities if act["id"] == activity_id), None)
        return jsonify({"status": "success", "message": "Activity added successfully", "data": activity}), 201
    except ValueError as e: # For group not found or participant issues
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/members/<member_id>/preferences', methods=['POST'])
def api_set_preference(group_id, member_id):
    try:
        data = request.json
        if 'activity_type' not in data or 'likes' not in data:
             return jsonify({"status": "error", "message": "Missing activity_type or likes status"}), 400

        if tracker.set_preference(group_id, member_id, data['activity_type'], bool(data['likes'])):
            return jsonify({"status": "success", "message": "Preference updated"})
        return jsonify({"status": "error", "message": "Failed to set preference. Invalid group or member."}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups/<group_id>/members/<member_id>/recommendations', methods=['GET'])
def api_get_recommendations(group_id, member_id):
    try:
        recommendations = tracker.get_recommendations(group_id, member_id)
        if recommendations is None: # Should be caught by get_recommendations returning [] for invalid ids
            return jsonify({"status": "error", "message": "Could not retrieve recommendations. Invalid group or member."}), 404
        return jsonify({"status": "success", "data": recommendations})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Example: Get a specific member's details including their expenses and payments
@app.route('/api/groups/<group_id>/members/<member_id>', methods=['GET'])
def api_get_member_details(group_id, member_id):
    try:
        if group_id not in tracker.groups or member_id not in tracker.groups[group_id].members:
            return jsonify({"status": "error", "message": "Group or member not found"}), 404
        member = tracker.groups[group_id].members[member_id]
        return jsonify({"status": "success", "data": member.to_dict()})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# The following routes were in the original file but might need review for their exact purpose in a decoupled frontend
# For example, get_member_transactions might be covered by fetching the member details which now includes expenses.
@app.route('/api/groups/<group_id>/members/<member_id>/transactions', methods=['GET'])
def get_member_transactions(group_id, member_id):
    try:
        if group_id not in tracker.groups or member_id not in tracker.groups[group_id].members:
            return jsonify({"status": "error", "message": "Group or member not found"}), 404
        member = tracker.groups[group_id].members[member_id]
        # Member.expenses now stores {expense_id, share, description}
        return jsonify({"status": "success", "data": member.expenses}) 
    except KeyError: # Should be caught by the check above
        return jsonify({"status": "error", "message": "Group or member not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/groups/<group_id>/members/<member_id>/toggle-payment', methods=['POST'])
def toggle_payment_status_for_all_member_expenses(group_id, member_id):
    # This endpoint toggles ALL payment statuses for a member. This seems like a batch operation.
    # Consider if this is intended or if individual payment marking is preferred.
    try:
        if group_id not in tracker.groups or member_id not in tracker.groups[group_id].members:
            return jsonify({"status": "error", "message": "Group or member not found"}), 404
        
        member = tracker.groups[group_id].members[member_id]
        # This toggles every payment record the member has.
        for expense_id in member.payments:
            member.payments[expense_id] = not member.payments[expense_id]
        return jsonify({"status": "success", "message": f"All payment statuses for member {member_id} toggled."})
    except KeyError:
        return jsonify({"status": "error", "message": "Group or member not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nativechat.db'
app.config['SARVAM_API_KEY'] = os.environ.get('SARVAM_API_KEY', 'your_sarvam_api_key_here')
app.config['SARVAM_API_URL'] = 'https://api.sarvam.ai/translate'
db = SQLAlchemy(app)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_type = db.Column(db.String(20), nullable=False)  # 'native' or 'traveller'
    sender_name = db.Column(db.String(80), nullable=False)
    content = db.Column(db.Text, nullable=False)
    original_content = db.Column(db.Text, nullable=False)
    original_language = db.Column(db.String(20), nullable=False)
    translated_language = db.Column(db.String(20), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Add this function to recreate the database
def recreate_database():
    with app.app_context():
        # Drop all tables
        db.drop_all()
        # Create all tables
        db.create_all()
        print("Database tables recreated successfully!")

@app.route('/api/messages', methods=['GET'])
def get_messages():
    # Get all messages
    messages = Message.query.order_by(Message.timestamp).all()
    
    return jsonify({
        'success': True,
        'messages': [{
            'id': m.id,
            'sender': m.sender_name,
            'senderType': m.sender_type,
            'content': m.content,
            'originalContent': m.original_content,
            'originalLanguage': m.original_language,
            'translatedLanguage': m.translated_language,
            'timestamp': m.timestamp.isoformat()
        } for m in messages]
    })

@app.route('/api/messages', methods=['POST'])
def send_message():
    data = request.json
    original_lang = data.get('originalLang', 'auto')
    target_lang = data.get('targetLang', 'en-IN')
    original_content = data.get('message', '')
    sender_type = data.get('senderType', 'traveller')
    sender_name = data.get('senderName', 'Anonymous')
    
    # Translate message using Sarvam AI API
    try:
        # Prepare headers and payload for Sarvam AI API
        headers = {
            'api-subscription-key': app.config['SARVAM_API_KEY'],
            'Content-Type': 'application/json'
        }
        
        payload = {
            'input': original_content,
            'source_language_code': original_lang,
            'target_language_code': target_lang
        }
        
        # Make API request to Sarvam AI
        response = requests.post(
            app.config['SARVAM_API_URL'],
            headers=headers,
            json=payload
        )
        
        # Check if request was successful
        response.raise_for_status()
        translation_data = response.json()
        
        translated_text = translation_data['translated_text']
        
        # If auto-detect was used, get the detected language
        if original_lang == 'auto':
            original_lang = translation_data['source_language_code']
        
        message = Message(
            sender_type=sender_type,
            sender_name=sender_name,
            content=translated_text,
            original_content=original_content,
            original_language=original_lang,
            translated_language=target_lang
        )
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': {
                'id': message.id,
                'sender': message.sender_name,
                'senderType': message.sender_type,
                'content': translated_text,
                'originalContent': original_content,
                'originalLanguage': original_lang,
                'translatedLanguage': target_lang,
                'timestamp': message.timestamp.isoformat()
            }
        })
    except requests.exceptions.RequestException as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f"Translation API error: {str(e)}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/supported-languages', methods=['GET'])
def get_supported_languages():
    # Return a list of supported languages
    languages = {
        'en-IN': 'English',
        'hi-IN': 'Hindi',
        'ta-IN': 'Tamil',
        'te-IN': 'Telugu',
        'kn-IN': 'Kannada',
        'ml-IN': 'Malayalam',
        'mr-IN': 'Marathi',
        'bn-IN': 'Bengali',
        'gu-IN': 'Gujarati'
    }
    return jsonify({'success': True, 'languages': languages})

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "your_groq_api_key")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "your_sarvam_api_key")

class ChatHistory:
    def __init__(self):
        self.history: Dict[str, List[Dict]] = {}
        self.max_history_per_session = 50

    def add_message(self, session_id: str, text: str, is_user: bool, language: Optional[str] = None):
        if session_id not in self.history:
            self.history[session_id] = []
        message = {
            "text": text,
            "isUser": is_user,
            "timestamp": datetime.now().isoformat(),
            "language": language
        }
        self.history[session_id].append(message)
        if len(self.history[session_id]) > self.max_history_per_session:
            self.history[session_id] = self.history[session_id][-self.max_history_per_session:]

    def get_history_as_text(self, session_id: str) -> str:
        messages = self.history.get(session_id, [])
        formatted = [f"{'User' if msg['isUser'] else 'TravelGuide'}: {msg['text']}" for msg in messages]
        return "\n".join(formatted)

chat_history = ChatHistory()

response_schemas = [
    ResponseSchema(name="result", description="Final response to the user's travel-related query"),
    ResponseSchema(name="historical_context", description="Historical information about the location"),
    ResponseSchema(name="cultural_insights", description="Cultural insights about the location or attraction"),
    ResponseSchema(name="travel_tips", description="Practical travel tips for the location"),
    ResponseSchema(name="additional_info", description="Any extra information relevant to the location"),
]
output_parser = StructuredOutputParser.from_response_schemas(response_schemas)

llm = ChatGroq(model="llama3-70b-8192", temperature=0.3, api_key=GROQ_API_KEY)

system_prompt = """You are a Travel Guide AI named "TravelGuide". Your job is to assist users with information about famous tourist destinations, historical sites, and cultural landmarks around the world.

*Guidelines:*
- Answer questions related to travel destinations, historical sites, cultural landmarks, and travel tips.
- Provide concise, structured, and accurate travel and historical information.
- If the question is not about travel or tourism, respond with: "I specialize in travel guidance. How can I assist with your travel plans or questions about destinations?"

*Chat History:*
{chat_history}

## **Introduction**
Welcome to "TravelGuide," a specialized AI-based travel assistant built to provide detailed information about tourist destinations, historical sites, and cultural landmarks worldwide.

## **Scope of Responses**
- **Destination Information**: Historical background, cultural significance, architectural details, geographical context
- **Visitor Information**: Opening hours, best time to visit, entry fees, accessibility
- **Travel Advice**: Local customs, safety tips, transportation options, accommodation recommendations

## **Language Support**
Supports English, Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati

## **Response Guidelines**
- Keep responses under 500 words unless detailed clarification is required.
- Use Markdown for clarity, numbering for steps, bullet points for lists, and bold for emphasis.

*User Query:* {input}
*Response Format:* {format_instructions}
context= 

# Comprehensive Guide to Indian Monuments: Entry Fees, Timings, and Historical Significance

India's rich cultural heritage is embodied in its magnificent monuments that span thousands of years of history. This guide provides detailed information about entry fees, timings, and historical significance of major monuments across India as of May 2025.

## North India Monuments

### Taj Mahal, Agra

#### Entry Fees and Timings

* **Indian Citizens**: ₹45\[18]
* **Foreign Tourists/NRIs**: ₹1050\[18]
* **SAARC/BIMSTEC Visitors**: ₹535\[18]
* **Main Mausoleum Additional Ticket**: ₹200\[1]
* **Children Under 15**: Free entry\[19]
* **Online Booking Discount**: ₹5 for Indians, ₹50 for foreigners\[16]
* **Timings**: Sunrise to sunset, closed on Fridays
* **Note**: Tourists purchasing tickets online receive discounts mentioned above\[16]

#### Historical Significance

The Taj Mahal is an ivory-white marble mausoleum commissioned in 1632 by Mughal Emperor Shah Jahan to house the tomb of his favorite wife, Mumtaz Mahal. This UNESCO World Heritage Site exemplifies the pinnacle of Mughal architecture and symbolizes eternal love.

### Red Fort, Delhi

#### Entry Fees and Timings

* **Indian Citizens**: ₹35\[17]
* **Foreign Tourists**: ₹550\[17]
* **Timings**: 9:30 AM to 4:30 PM\[17]
* **Location**: Netaji Subhash Marg, Lal Qila, Chandni Chowk, New Delhi\[17]

#### Historical Significance

Constructed by Emperor Shah Jahan in the 17th century, the Red Fort served as the residence of Mughal emperors for two centuries. This UNESCO World Heritage Site is where India's first Prime Minister, Jawaharlal Nehru, hoisted the national flag on Independence Day in 1947, a tradition that continues today\[17].

### India Gate, Delhi

#### Entry Fees and Timings

* **Entry Fee**: Free\[7]
* **Timings**: Open 24 hours\[7]
* **Visit Duration**: 2-3 hours recommended\[7]
* **Best Time to Visit**: October to March\[7]

#### Special Features

India Gate features an enchanting light and sound show during evenings with advanced audio-visual effects illuminating the monument alongside informative narration about its historical significance\[7].

### Humayun's Tomb, Delhi

#### Entry Fees and Timings

* **Indian Citizens and SAARC Nations**: ₹40\[2]
* **Foreign Tourists**: ₹600\[2]
* **Photography**: Free\[2]
* **Video Filming**: ₹25 per person\[2]
* **Timings**: Daily, 6:00 AM to 6:00 PM\[2]
* **Contact**: 011 2435 5275\[2]

#### Historical Significance

Built between 1565-1572 by Humayun's wife Hamida Banu Begum, this tomb was designed by Persian architect Mirak Mirza Ghiyas and completed by his son. It's the first garden tomb in India and the first structure built in the Mughal architectural style, earning UNESCO World Heritage status in 1993\[2].

### Lotus Temple (Baháʼí Temple), Delhi

#### Entry Fees and Timings

* **Entry Fee**: Free (special permission needed for photography)\[8]
* **Summer Timings**: 9:00 AM to 7:00 PM\[8]
* **Winter Timings**: 9:00 AM to 5:30 PM\[8]
* **Closed**: Mondays\[8]
* **Contact**: 011 2338 9326\[8]

#### Architectural Features

Constructed on November 13, 1986, the Lotus Temple was designed by architect Fariborz Sahba. Made of pristine white marble, it stands 34 meters tall with 27 lotus petals and can accommodate 2,500 people. Unlike other religious structures, it's not dedicated to a specific deity but symbolizes unity and oneness\[8].

### Jama Masjid, Delhi

#### Entry Fees and Timings

* **Indian Nationals**: ₹50\[9]
* **Foreign Tourists**: ₹300\[9]
* **Additional Charges**: Camera fee (₹300, optional) and charges for climbing minaret towers\[9]
* **Location**: Old Delhi\[9]

### Akshardham Temple, Delhi

#### Entry Fees and Timings

* **Adults (Exhibition)**: ₹170\[10]
* **Children (Exhibition)**: ₹100\[10]
* **Senior Citizens (Exhibition)**: ₹125\[10]
* **Adults (Musical Fountain)**: ₹80\[10]
* **Children (Musical Fountain)**: ₹50\[10]
* **Senior Citizens (Musical Fountain)**: ₹80\[10]
* **Children Below 4 Years**: Free entry for both attractions\[10]
* **Timings**: 10:00 AM to 6:30 PM (Closed on Mondays)\[10]
* **Contact**: 011 4344 2344, 011 2201 6688\[10]

#### Historical Information

Opened on November 6, 2005, Akshardham Temple was created by Pramukh Swami Maharaj and constructed by BAPS. The complex features exhibitions on Hindu religion and culture alongside the main temple structure\[10].

## Rajasthan Monuments

### Amber/Amer Fort, Jaipur

#### Entry Fees and Timings

* **Indian Citizens**: ₹25\[3]
* **Indian Students**: ₹10\[3]
* **Foreign Tourists**: ₹550\[3]
* **Foreign Students**: ₹100\[3]
* **Light Show (English)**: ₹200 per person\[3]
* **Light Show (Hindi)**: ₹100 per person\[3]
* **Elephant Ride**: ₹1,100 per couple\[3]
* **Timings**: 8:00 AM to 5:30 PM daily\[3]
* **Light Show Timings**: English at 7:30 PM, Hindi at 8:00 PM\[3]
* **Elephant Ride Timings**: 7:30 AM to 12:30 PM\[3]
* **Contact**: 0141 253 0293\[3]

#### Historical Significance

Built in 1727 by Maharaja Sawai Jai Singh II, Amber Fort was declared a UNESCO World Heritage Site in 2013 in the category of "Hillforts of Rajasthan." The fort exemplifies the architectural patronage of Rajput rulers\[3].

### Hawa Mahal, Jaipur

#### Entry Fees and Timings

* **Indian Tourists**: ₹50\[4]
* **Foreign Tourists**: ₹200\[4]
* **Indian Students**: ₹20 (with valid ID)\[4]
* **Children Below 7 Years**: Free entry\[4]
* **Timings**: Daily from 9:00 AM to 4:30 PM\[4]

#### Historical Features

Constructed in 1799 by Maharaja Sawai Pratap Singh, Hawa Mahal is famous for its unique design that allows air flow through the building, giving it the name "Palace of Winds." The five-story structure stands without a foundation, remaining stable due to its pyramid-like shape. It was specifically built for royal women to observe street festivals without being seen by the public\[4].

#### Composite Ticket Option

A composite ticket covering multiple Jaipur monuments (including Hawa Mahal, Amber Fort, Jantar Mantar, and City Palace) is available: ₹300 for Indians and ₹1,000 for foreigners, valid for two days\[4].

### City Palace, Jaipur

#### Entry Fees for Indian Nationals

* **Museum**: ₹300 (Adult), ₹150 (Child 7-12 years/Students)\[5]
* **Composite**: ₹400 (Adult), ₹250 (Child/Students)\[5]
* **Museum at Night**: ₹500 (Adult), ₹250 (Child/Students)\[5]
* **Sculpture Lumiere Show**: ₹250 (Adult), ₹150 (Child/Students)\[5]
* **Royal Grandeur**: ₹1,500 (Adult), ₹1,000 (Child/Students)\[5]
* **Royal Splendor**: ₹3,000 (Adult), ₹1,500 (Child/Students)\[5]

#### Entry Fees for Foreign Nationals

* **Museum**: ₹1,000 (Adult), ₹500 (Child/Students)\[5]
* **Composite**: ₹1,250 (Adult), ₹650 (Child/Students)\[5]
* **Museum at Night**: ₹1,000 (Adult), ₹500 (Child/Students)\[5]
* **Sculpture Lumiere Show**: ₹500 (Adult), ₹250 (Child/Students)\[5]
* **Royal Grandeur**: ₹2,000 (Adult), ₹1,500 (Child/Students)\[5]
* **Royal Splendor**: ₹4,000 (Adult), ₹2,000 (Child/Students)\[5]

#### Timings

* **Day Visit**: 9:30 AM to 5:00 PM\[5]
* **Night Visit**: 7:00 PM to 10:00 PM\[5]
* **Contact**: 0141 408 8855\[5]

### Jantar Mantar, Jaipur

#### Entry Fees and Timings

* **Indian Citizens**: ₹50\[6]
* **Indian Students**: ₹15\[6]
* **Foreign Tourists**: ₹200\[6]
* **Foreign Students**: ₹100\[6]
* **Contact**: 0141 261 0494\[6]

#### Historical Significance

Built in the early 18th century by Maharaja Sawai Jai Singh II, Jantar Mantar consists of 19 large instruments for observing celestial objects. Construction was completed in 1734, and the site is now a UNESCO World Heritage Site. The most prominent instrument is the Samrat Yantra, considered to be the largest sundial in India\[6].

## South India Monuments

### Mysore Maharaja Palace, Karnataka

#### Entry Fees and Timings

* **Adults**: ₹40\[11]
* **Children (10-18 Years)**: ₹20\[11]
* **Students** (with letter from school): ₹10\[11]
* **Foreign Tourists**: ₹200 (Audio Kit Included)\[11]
* **Free Entry**: Children below 10 years\[11]
* **Timings**: 10:00 AM to 5:30 PM daily\[11]
* **Contact**: 0821 242 1051\[11]

#### Sound and Light Show

* **Adults**: ₹40\[11]
* **Children (7-12 Years)**: ₹25\[11]
* **Foreign Tourists**: ₹200\[11]
* **Timings**: 7:00 PM to 7:40 PM on weekdays (except Sundays, National Holidays, and State Festivals)\[11]

#### Palace Illumination

* **Timings**: 7:00 PM to 7:45 PM on Sundays, National Holidays, and State Festivals\[11]
* **Weekday Illumination**: 7:40 PM to 7:45 PM after sound and light show\[11]
* **Charges**: Free\[11]

#### Additional Facilities

Free camera custody counter, wheelchair facility, footwear stand, drinking water, clean toilets, and government-approved guides\[11].

### Charminar, Hyderabad

#### Entry Fees and Timings

* **Indian Citizens**: ₹25 per person\[12]
* **Foreign Nationals**: ₹300 per person\[12]
* **Contact**: 040 6674 5986, 040 2452 2990\[12]

#### Historical Significance

Built by Sultan Mohammed Quli Qutb Shah in 1591, Charminar has been called the "Arc de Triomphe of the East" and the "Mosque of the four minarets." The structure may have been built to honor the sultan's wife Bhagmati or to commemorate the elimination of a plague that had affected the city\[12].

### Golconda Fort, Hyderabad

#### Entry Fees and Timings

* **Indian Citizens**: ₹25 per person\[14]
* **Foreign Tourists**: ₹300 per person\[14]
* **Still Camera**: ₹25\[14]
* **Timings**: 9:00 AM to 5:30 PM daily\[14]
* **Contact**: 040 2351 2401\[14]

#### Sound & Light Show

* **Executive Class**: ₹140 (Adult), ₹110 (Child)\[14]
* **Normal Class**: ₹80 (Adult), ₹60 (Child)\[14]
* **Show Timings (Nov-Feb)**: 1st Show 6:30 PM, 2nd Show 7:45 PM\[14]
* **Show Timings (Mar-Oct)**: 1st Show 7:00 PM, 2nd Show 8:15 PM\[14]
* **Languages**: 1st Show in English (all days); 2nd Show in Telugu (Mon, Wed, Fri) and Hindi (Tue, Thu, Sat, Sun)\[14]
* **Bookings Contact**: +91 9640069290\[14]

### Hampi Monuments, Karnataka

#### Entry Fees and Timings

* **Virupaksha Temple**: ₹2; ₹50 (Still Camera)\[13]
* **Vittala Temple**:

  * Indian Citizens, SAARC, and BIMSTEC Countries: ₹30\[13]
  * Others: ₹500\[13]
  * Children up to 15 years: Free entry\[13]
  * Still camera fee: Free\[13]
* **Heritage Museum @ Hampi Bazaar**: Free entry\[13]
* **Archeology Museum @ Kamalapura**: ₹5; Children up to 15 years free; Closed on Fridays\[13]
* **Zenena Enclosure, Elephant Stable & Lotus Mahal**: Vittala Temple ticket valid for same day\[13]
* **Queen's Bath**: Free entry\[13]

#### Timings

* **Virupaksha Temple**: Sunrise to sunset\[13]
* **Vittala Temple**: 6:00 AM to 6:00 PM\[13]
* **Heritage Museum**: 10:00 AM to 1:00 PM & 3:00 PM to 6:00 PM\[13]
* **Archeology Museum**: 10:00 AM to 5:00 PM (Closed on Fridays)\[13]
* **Other monuments**: 6:00 AM to 6:00 PM\[13]

## Western India Monuments

### Ellora Caves, Maharashtra

#### Entry Fees and Timings

* **Indian Citizens**: ₹40 (Offline Counter), ₹35 (Online)\[15]
* **SAARC and BIMSTEC Countries**: ₹40 (Offline Counter), ₹35 (Online)\[15]
* **Foreign Nationals**: ₹600 (Offline Counter), ₹550 (Online)\[15]
* **Children Under 15 Years**: Free Entry\[15]
* **Opening Hours**: 9:00 AM to 6:00 PM (Closed on Tuesdays)\[15]
* **Last Entry**: 5:00 PM\[15]

#### Day-Wise Schedule

* **Sunday to Monday**: 6:00 AM to 6:00 PM\[15]
* **Tuesday**: Closed\[15]
* **Wednesday to Saturday**: 6:00 AM to 6:00 PM\[15]

#### Booking Information

Online booking is recommended to avoid queues and secure preferred visiting slots. Tickets can be booked through the Archaeological Survey of India (ASI) official website\[15].

## Conclusion

India's monuments represent a diverse tapestry of architectural styles, historical periods, and cultural influences. When planning your visit, consider the following tips:

1. Many monuments offer discounted rates for online bookings.
2. Several cities offer composite tickets covering multiple monuments.
3. Photography policies and charges vary by location.
4. Most monuments have different timings for summer and winter seasons.
5. Special shows (sound and light, illumination) often have separate charges and schedules.

This guide provides a snapshot of India's monumental wealth as of May 2025, though prices and timings may change. For the most current information, check official websites or contact the monuments directly before your visit.


"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "User's language: {language}. Chat history: {chat_history}. User's question: {input}")
])

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    emit('status', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")

@socketio.on('audio_message')
def handle_audio_message(data):
    try:
        session_id = request.sid
        logger.info("New audio message received")

        auto_detect = data.get('auto_detect', True)
        current_language = data.get('language', 'en-IN')

        if auto_detect:
            stt_result = speech_to_text(data['audio'], detect_language=True)
        else:
            stt_result = speech_to_text(data['audio'], language=current_language)

        if not stt_result:
            raise ValueError("Failed to transcribe audio")

        original_text = stt_result['transcript']
        current_language = stt_result['language_code'] if auto_detect else current_language

        logger.info(f"Original text ({current_language}): {original_text}")
        chat_history.add_message(session_id, original_text, True, current_language)

        needs_translation = current_language != "en-IN"
        translated_text = translate_text(original_text, current_language, "en-IN") if needs_translation else original_text

        format_instructions = output_parser.get_format_instructions()
        english_response = process_with_llm(translated_text, current_language, chat_history.get_history_as_text(session_id), format_instructions)

        try:
            extracted_info = output_parser.parse(english_response)
            for key in ["result", "historical_context", "cultural_insights", "travel_tips", "additional_info"]:
                extracted_info.setdefault(key, "")
            english_response = format_response(extracted_info)
        except Exception as e:
            logger.error(f"Error parsing structured output: {str(e)}")

        translated_response = translate_text(english_response, "en-IN", current_language) if needs_translation else english_response
        chat_history.add_message(session_id, translated_response, False, current_language)

        audio_data = generate_audio_for_large_text(translated_response, current_language)

        emit('response', {
            'original_text': original_text,
            'english_text': translated_text,
            'english_response': english_response,
            'text': translated_response,
            'audio_chunks': audio_data,
            'language': current_language,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        emit('error', {'message': str(e)})

def process_with_llm(user_input, language, chat_history_text, format_instructions):
    try:
        response = llm.invoke(prompt.format(input=user_input, language=language, chat_history=chat_history_text, format_instructions=format_instructions))
        return response.content
    except Exception as e:
        logger.error(f"LLM processing error: {str(e)}")
        return "I'm having trouble processing your request. Please try again."

def format_response(extracted_info):
    result_text = extracted_info.get("result", "").replace('```json', '').replace('```', '').strip()
    if result_text.startswith('{') and result_text.endswith('}'):
        try:
            parsed = json.loads(result_text)
            result_text = parsed.get("result", result_text)
        except:
            result_text = result_text.strip('{}').strip()

    formatted = result_text + "\n\n"
    for field, title in [
        ("historical_context", "Historical Context"),
        ("cultural_insights", "Cultural Insights"),
        ("travel_tips", "Travel Tips"),
        ("additional_info", "Additional Information")
    ]:
        if extracted_info.get(field):
            formatted += f"**{title}:** {extracted_info[field]}\n\n"
    return formatted.strip()

def split_into_chunks(text: str, max_length: int = 490) -> List[str]:
    """Splits text into chunks of at most max_length characters, preserving word boundaries."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    for word in words:
        word_length = len(word)
        space_length = 1 if current_chunk else 0
        if current_length + word_length + space_length > max_length:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_length = 0
        current_chunk.append(word)
        current_length += word_length + space_length
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks

def generate_audio_for_large_text(text: str, language: str) -> List[str]:
    url = "https://api.sarvam.ai/text-to-speech"
    headers = {"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY}
    
    speaker_map = {
        'hi-IN': 'arya',    # Hindi - Female
        'en-IN': 'arvind',   # English - Male
        'ta-IN': 'pavithra', # Tamil - Female
        'te-IN': 'amol',     # Telugu - Male
        'kn-IN': 'maitreyi', # Kannada - Female
        'ml-IN': 'vidya',    # Malayalam - Female
        'mr-IN': 'anushka',  # Marathi - Female
        'bn-IN': 'diya',     # Bengali - Female
        'gu-IN': 'abhilash', # Gujarati - Male
        'od-IN': 'arya'     # Odia - Female
    }
    
    valid_speakers = ['meera', 'pavithra', 'maitreyi', 'arvind', 'amol', 'amartya', 'diya', 'neel', 'misha', 'vian', 'arjun', 'maya', 'anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh']
    
    speaker = speaker_map.get(language, 'meera')
    if speaker not in valid_speakers:
        logger.warning(f"Speaker '{speaker}' is not valid for language '{language}'. Falling back to 'meera'.")
        speaker = 'meera'

    chunks = split_into_chunks(text, max_length=490)
    
    audio_base64_chunks = []
    for i, chunk in enumerate(chunks):
        logger.info(f"Sending TTS chunk {i+1}/{len(chunks)} with {len(chunk)} characters")
        payload = {
            "inputs": [chunk],
            "target_language_code": language,
            "speaker": speaker,
            "enable_preprocessing": True,
            "speech_sample_rate": 22050
        }
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            if audio_chunk := response.json().get("audios", [None])[0]:
                audio_base64_chunks.append(audio_chunk)
        except Exception as e:
            logger.error(f"TTS Error for chunk {i+1}: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response content: {e.response.text}")
    return audio_base64_chunks

def speech_to_text(audio_base64: str, language: Optional[str] = None, detect_language: bool = False) -> Optional[Dict]:
    url = "https://api.sarvam.ai/speech-to-text"
    headers = {"api-subscription-key": SARVAM_API_KEY}
    try:
        audio_data = base64.b64decode(audio_base64)
        payload = {'model': 'saarika:v2', 'with_timesteps': 'false'}
        if detect_language:
            payload['detect_language'] = 'true'
        elif language:
            payload['language_code'] = language
        files = [('file', ('audio.wav', audio_data, 'audio/wav'))]
        response = requests.post(url, headers=headers, data=payload, files=files)
        response.raise_for_status()
        result = response.json()
        return {'transcript': result.get('transcript', ''), 'language_code': result.get('language_code', language)}
    except Exception as e:
        logger.error(f"STT Error: {str(e)}")
        return None

def translate_text(text: str, source_language: str, target_language: str) -> str:
    if source_language == target_language:
        return text
    url = "https://api.sarvam.ai/translate"
    headers = {"Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY}
    chunks = [text[i:i+900] for i in range(0, len(text), 900)]
    translated_chunks = []
    for chunk in chunks:
        payload = {
            "input": chunk,
            "source_language_code": source_language,
            "target_language_code": target_language,
            "mode": "formal",
            "enable_preprocessing": True
        }
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            translated_chunks.append(response.json().get('translated_text', chunk))
        except Exception as e:
            logger.error(f"Translation Error: {str(e)}")
            translated_chunks.append(chunk)
    return ' '.join(translated_chunks)

# ...existing code...

import threading

# --- Carbon Footprint Calculation Constants ---
CARBON_DB_PATH = os.path.join(os.path.dirname(__file__), 'carbon_footprint.db')
CARBON_DB_LOCK = threading.Lock()

CARBON_EMISSION_FACTORS = {
    "flight": 0.158,
    "car": 0.120,
    "train": 0.041
}

def carbon_haversine_distance(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    dLat = radians(lat2 - lat1)
    dLon = radians(lon2 - lon1)
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    a = sin(dLat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dLon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return round(R * c, 2)

CARBON_AIRPORT_COORDINATES = {
    "JFK": (40.6413, -73.7781), "LAX": (33.9416, -118.4085), "LHR": (51.4700, -0.4543),
    "CDG": (49.0097, 2.5479), "DEL": (28.5562, 77.1000), "BOM": (19.0896, 72.8656),
    "SFO": (37.6213, -122.3790), "DXB": (25.2532, 55.3657), "AMS": (52.3105, 4.7683),
    "SIN": (1.3644, 103.9915)
}

def carbon_get_flight_distance_from_codes(origin_code, dest_code):
    o, d = origin_code.upper(), dest_code.upper()
    if o in CARBON_AIRPORT_COORDINATES and d in CARBON_AIRPORT_COORDINATES:
        lat1, lon1 = CARBON_AIRPORT_COORDINATES[o]
        lat2, lon2 = CARBON_AIRPORT_COORDINATES[d]
        return carbon_haversine_distance(lat1, lon1, lat2, lon2)
    logger.warning(f"Could not find coordinates for airport codes: {origin_code} or {dest_code}")
    return None

def carbon_calculate_total_emissions(mode, distance, nights, meals_per_day, days, activities, shopping_usd):
    transport_emission = round(CARBON_EMISSION_FACTORS.get(mode, 0) * distance, 2)
    accommodation_emission = round(nights * 6.8, 2)
    food_emission = round(meals_per_day * days * 2.0, 2)
    activity_emission = round(activities * 2.0, 2)
    shopping_emission = round((shopping_usd / 100) * 1.0, 2)
    total = round(
        transport_emission + accommodation_emission +
        food_emission + activity_emission + shopping_emission,
        2
    )
    return {
        "transport_emission": transport_emission,
        "accommodation_emission": accommodation_emission,
        "food_emission": food_emission,
        "activity_emission": activity_emission,
        "shopping_emission": shopping_emission,
        "total_emission": total,
        "calculated_distance_km": distance
    }

def carbon_get_ai_summary_and_suggestion(emission_data, trip_details=None):
    formatted_emissions = {k: f"{v:.2f}" if isinstance(v, float) else v for k, v in emission_data.items()}
    prompt_intro = f"User's total carbon emission: {formatted_emissions['total_emission']} kg CO2 for a trip."
    if trip_details:
        prompt_intro += f" Trip Mode: {trip_details.get('mode', 'N/A')}, Distance: {trip_details.get('distance_km', 'N/A')} km."
        if trip_details.get('mode') == 'flight' and trip_details.get('origin_airport') and trip_details.get('destination_airport'):
            prompt_intro += f" Flight from {trip_details['origin_airport']} to {trip_details['destination_airport']}."
    prompt = f"""
    {prompt_intro}
    Breakdown:
    - Transport Emissions: {formatted_emissions['transport_emission']} kg CO2
    - Accommodation Emissions: {formatted_emissions['accommodation_emission']} kg CO2
    - Food Emissions: {formatted_emissions['food_emission']} kg CO2
    - Activity Emissions: {formatted_emissions['activity_emission']} kg CO2
    - Shopping Emissions: {formatted_emissions['shopping_emission']} kg CO2

    Please generate a friendly and motivating AI-based summary of this user's carbon emissions (approximately 50-100 words) and suggest 2-3 practical, actionable, and environmentally friendly ways to compensate or reduce future impact.
    Format the suggestions as a bulleted list.
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=20)
        if resp.status_code == 200:
            content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                logger.error(f"Groq API returned empty content: {resp.text}")
                return "AI summary not available (empty response from Groq)."
            return content
        else:
            logger.error(f"Groq API error {resp.status_code}: {resp.text}")
            return f"Failed to get AI summary from Groq (status {resp.status_code}): {resp.text}"
    except Exception as e:
        logger.error(f"Groq API request failed: {e}")
        return f"Failed to get AI summary from Groq: {str(e)}"

def carbon_init_db():
    with CARBON_DB_LOCK:
        conn = sqlite3.connect(CARBON_DB_PATH)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS carbon_trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                distance_km REAL NOT NULL,
                nights INTEGER DEFAULT 0,
                meals_per_day INTEGER DEFAULT 0,
                days INTEGER DEFAULT 0,
                activities INTEGER DEFAULT 0,
                shopping_usd REAL DEFAULT 0,
                transport_emission REAL,
                accommodation_emission REAL,
                food_emission REAL,
                activity_emission REAL,
                shopping_emission REAL,
                total_emission REAL,
                ai_summary TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()

carbon_init_db()

@app.route('/api/carbon/calculate', methods=['POST'])
def api_carbon_calculate():
    data = request.get_json()
    user_id = data.get("user_id")
    mode = data.get("mode", "").lower()
    distance_manual = data.get("distance", 0.0)
    nights = data.get("nights", 0)
    meals_per_day = data.get("meals_per_day", 0)
    days = data.get("days", 0)
    activities = data.get("activities", 0)
    shopping_usd = data.get("shopping_usd", 0)
    origin_airport = data.get("origin_airport")
    destination_airport = data.get("destination_airport")
    distance_to_use = float(distance_manual)
    if mode == "flight" and origin_airport and destination_airport:
        calculated_flight_distance = carbon_get_flight_distance_from_codes(origin_airport, destination_airport)
        if calculated_flight_distance is not None:
            distance_to_use = calculated_flight_distance
            logger.info(f"Used calculated flight distance: {distance_to_use} km for {origin_airport} to {destination_airport}")
        elif distance_to_use == 0:
            return jsonify({"error": f"Could not calculate distance for flight {origin_airport}-{destination_airport} and no manual distance provided."}), 400
    if not user_id or mode not in CARBON_EMISSION_FACTORS:
        return jsonify({"error": "Missing or invalid user_id or transport mode"}), 400
    if distance_to_use <= 0 and mode in ["flight", "car", "train"]:
        if not (nights > 0 or (meals_per_day > 0 and days > 0) or activities > 0 or shopping_usd > 0):
            return jsonify({"error": "Distance must be greater than 0 for selected transport mode, or provide other emission sources."}), 400
    emissions = carbon_calculate_total_emissions(mode, distance_to_use, nights, meals_per_day, days, activities, shopping_usd)
    trip_details_for_ai = {
        "mode": mode,
        "distance_km": distance_to_use,
        "origin_airport": origin_airport if mode == "flight" else None,
        "destination_airport": destination_airport if mode == "flight" else None
    }
    ai_summary = carbon_get_ai_summary_and_suggestion(emissions, trip_details=trip_details_for_ai)
    emissions_for_db = emissions.copy()
    emissions_for_db.pop('calculated_distance_km', None)
    with CARBON_DB_LOCK:
        conn = sqlite3.connect(CARBON_DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO carbon_trips (
                user_id, mode, distance_km, nights, meals_per_day, days, activities, shopping_usd,
                transport_emission, accommodation_emission, food_emission, activity_emission, shopping_emission, total_emission, ai_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, mode, distance_to_use, nights, meals_per_day, days, activities, shopping_usd,
            emissions["transport_emission"], emissions["accommodation_emission"], emissions["food_emission"],
            emissions["activity_emission"], emissions["shopping_emission"], emissions["total_emission"], ai_summary
        ))
        trip_id = c.lastrowid
        conn.commit()
        conn.close()
    return jsonify({
        "user_id": user_id,
        "trip_id": trip_id,
        "trip_emissions": emissions,
        "ai_summary": ai_summary
    })

@app.route('/api/carbon/user/<user_id>/summary', methods=['GET'])
def api_carbon_user_summary(user_id):
    with CARBON_DB_LOCK:
        conn = sqlite3.connect(CARBON_DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM carbon_trips WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
        trips = c.fetchall()
        trip_count = len(trips)
        total_emissions = sum(trip["total_emission"] for trip in trips) if trip_count > 0 else 0.0
        ai_summary = trips[0]["ai_summary"] if trip_count > 0 else "No trips logged yet. Start your carbon tracking journey today!"
        trip_list = []
        for trip in trips:
            trip_list.append({
                "id": trip["id"],
                "user_id": trip["user_id"],
                "mode": trip["mode"],
                "distance_km": trip["distance_km"],
                "nights": trip["nights"],
                "meals_per_day": trip["meals_per_day"],
                "days": trip["days"],
                "activities": trip["activities"],
                "shopping_usd": trip["shopping_usd"],
                "emissions_breakdown": {
                    "transport_emission": trip["transport_emission"],
                    "accommodation_emission": trip["accommodation_emission"],
                    "food_emission": trip["food_emission"],
                    "activity_emission": trip["activity_emission"],
                    "shopping_emission": trip["shopping_emission"],
                    "total_emission": trip["total_emission"]
                },
                "timestamp": trip["timestamp"]
            })
        result = {
            "user_id": user_id,
            "trip_count": trip_count,
            "total_emissions": float(total_emissions),
            "ai_summary": ai_summary,
            "trips": trip_list
        }
        conn.close()
    return jsonify(result)

# --- Main Execution ---
if __name__ == "__main__":
    init_db()  # Initialize the main database on startup
    init_crowdsource_db() # Initialize the crowdsource safety database

    # Function to check if a port is available
    def is_port_available(port, host='0.0.0.0'):
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind((host, port))
            available = True
        except OSError:
            available = False
        finally:
            sock.close()
        return available

    # Find an available port
    port = 5000  # Start with default port
    max_port = 9000  # Maximum port to try

    while (port < max_port):
        if is_port_available(port):
            break
        print(f"Port {port} is busy, trying next port...")
        port += 1

    if port >= max_port:
        print("Could not find an available port. Exiting.")
        import sys
        sys.exit(1)

    # Print connection information
    import socket
    hostname = socket.gethostname()
    try:
        # Try getting IP associated with the hostname
        local_ip = socket.gethostbyname(hostname)
    except socket.gaierror:
        # Fallback if hostname doesn't resolve directly (e.g., some Docker setups)
        try:
            # Try connecting to an external address to find the local interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "127.0.0.1" # Default fallback

    print(f"\n\n==================================")
    print(f"🚀 Server running!")
    print(f"✨ AR Guide available at /ar-guide on the frontend")
    print(f"📱 Local: http://localhost:{port}")
    print(f"🌐 Network: http://{local_ip}:{port}")
    print(f"👆 Use the Network URL on your mobile device for AR")
    print(f"==================================\n")

    # Run the socketio server with the available port
    # Use threaded mode for better handling of concurrent requests (like TTS generation)
    socketio.run(app, debug=True, host='0.0.0.0', port=port, use_reloader=False, allow_unsafe_werkzeug=True)

# --- Add this helper to provide safety map context for the chatbot ---