import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2 # For Haversine

app = Flask(__name__)
CORS(app)  
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///carbon_footprint.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Groq API key and endpoint
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"  # Make sure this is the correct endpoint

# ----------------------------
# Models
# ----------------------------
class Trip(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    mode = db.Column(db.String(20), nullable=False)
    distance_km = db.Column(db.Float, nullable=False)
    nights = db.Column(db.Integer, default=0)
    meals_per_day = db.Column(db.Integer, default=0)
    days = db.Column(db.Integer, default=0)
    activities = db.Column(db.Integer, default=0)
    shopping_usd = db.Column(db.Float, default=0.0)
    transport_emission = db.Column(db.Float)
    accommodation_emission = db.Column(db.Float)
    food_emission = db.Column(db.Float)
    activity_emission = db.Column(db.Float)
    shopping_emission = db.Column(db.Float)
    total_emission = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "mode": self.mode,
            "distance_km": self.distance_km,
            "nights": self.nights,
            "meals_per_day": self.meals_per_day,
            "days": self.days,
            "activities": self.activities,
            "shopping_usd": self.shopping_usd,
            "emissions_breakdown": {
                "transport_emission": self.transport_emission,
                "accommodation_emission": self.accommodation_emission,
                "food_emission": self.food_emission,
                "activity_emission": self.activity_emission,
                "shopping_emission": self.shopping_emission,
                "total_emission": self.total_emission
            },
            "timestamp": self.timestamp.isoformat()
        }

# ----------------------------
# Constants
# ----------------------------
EMISSION_FACTORS = {
    "flight": 0.158,
    "car": 0.120,
    "train": 0.041
}

# Airport coordinates for Haversine calculation (ICAO or IATA codes)
# This is a small sample. A real application would use a larger database or an API.
AIRPORT_COORDINATES = {
    "JFK": (40.6413, -73.7781),  # New York JFK
    "LAX": (33.9416, -118.4085), # Los Angeles LAX
    "LHR": (51.4700, -0.4543),  # London Heathrow
    "CDG": (49.0097, 2.5479),   # Paris Charles de Gaulle
    "DEL": (28.5562, 77.1000),   # Delhi Indira Gandhi
    "BOM": (19.0896, 72.8656),   # Mumbai Chhatrapati Shivaji
    "SFO": (37.6213, -122.3790), # San Francisco
    "DXB": (25.2532, 55.3657),   # Dubai
    "AMS": (52.3105, 4.7683),    # Amsterdam Schiphol
    "SIN": (1.3644, 103.9915)    # Singapore Changi
}

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Radius of Earth in kilometers
    dLat = radians(lat2 - lat1)
    dLon = radians(lat2 - lon1)
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    a = sin(dLat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dLon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = R * c
    return round(distance, 2)

def get_flight_distance_from_codes(origin_code, dest_code):
    origin_code_upper = origin_code.upper()
    dest_code_upper = dest_code.upper()
    if origin_code_upper in AIRPORT_COORDINATES and dest_code_upper in AIRPORT_COORDINATES:
        lat1, lon1 = AIRPORT_COORDINATES[origin_code_upper]
        lat2, lon2 = AIRPORT_COORDINATES[dest_code_upper]
        return haversine_distance(lat1, lon1, lat2, lon2)
    app.logger.warning(f"Could not find coordinates for airport codes: {origin_code} or {dest_code}")
    return None

# ----------------------------
# Emissions Calculator
# ----------------------------
def calculate_total_emissions(mode, distance, nights, meals_per_day, days, activities, shopping_usd):
    transport_emission = round(EMISSION_FACTORS.get(mode, 0) * distance, 2)
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
        "calculated_distance_km": distance # Include the distance used for calculation
    }

# ----------------------------
# Groq API Request Helper
# ----------------------------
def get_ai_summary_and_suggestion(emission_data, trip_details=None): # Added trip_details
    # Format emission_data to two decimal places for the prompt
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
        response = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=20)
        if response.status_code == 200:
            content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                app.logger.error(f"Groq API returned empty content: {response.text}")
                return "AI summary not available (empty response from Groq)."
            return content
        else:
            app.logger.error(f"Groq API error {response.status_code}: {response.text}")
            return f"Failed to get AI summary from Groq (status {response.status_code}): {response.text}"
    except Exception as e:
        app.logger.error(f"Groq API request failed: {e}")
        return f"Failed to get AI summary from Groq: {str(e)}"

# ----------------------------
# Routes
# ----------------------------
@app.route("/calculate", methods=["POST"])
def calculate_footprint():
    data = request.get_json()
    user_id = data.get("user_id")
    mode = data.get("mode", "").lower()
    distance_manual = data.get("distance", 0.0) # Manual distance from form
    nights = data.get("nights", 0)
    meals_per_day = data.get("meals_per_day", 0)
    days = data.get("days", 0)
    activities = data.get("activities", 0)
    shopping_usd = data.get("shopping_usd", 0)

    origin_airport = data.get("origin_airport")
    destination_airport = data.get("destination_airport")

    distance_to_use = float(distance_manual)

    if mode == "flight" and origin_airport and destination_airport:
        calculated_flight_distance = get_flight_distance_from_codes(origin_airport, destination_airport)
        if calculated_flight_distance is not None:
            distance_to_use = calculated_flight_distance
            app.logger.info(f"Used calculated flight distance: {distance_to_use} km for {origin_airport} to {destination_airport}")
        elif distance_to_use == 0: # No manual distance and airport codes failed
             return jsonify({"error": f"Could not calculate distance for flight {origin_airport}-{destination_airport} and no manual distance provided."}), 400


    if not user_id or mode not in EMISSION_FACTORS:
        return jsonify({"error": "Missing or invalid user_id or transport mode"}), 400
    
    if distance_to_use <= 0 and mode in ["flight", "car", "train"]: # Transport modes require distance
        # Exception for non-transport calculations if all other inputs are zero too
        if not (nights > 0 or (meals_per_day > 0 and days > 0) or activities > 0 or shopping_usd > 0):
             return jsonify({"error": "Distance must be greater than 0 for selected transport mode, or provide other emission sources."}), 400


    emissions = calculate_total_emissions(mode, distance_to_use, nights, meals_per_day, days, activities, shopping_usd)

    # Prepare trip details for AI summary
    trip_details_for_ai = {
        "mode": mode,
        "distance_km": distance_to_use,
        "origin_airport": origin_airport if mode == "flight" else None,
        "destination_airport": destination_airport if mode == "flight" else None
    }
    ai_summary = get_ai_summary_and_suggestion(emissions, trip_details=trip_details_for_ai)

    # Remove 'calculated_distance_km' from emissions before creating Trip object
    # as it's not a column in the Trip model and distance_km is set explicitly.
    emissions_for_trip_model = emissions.copy()
    emissions_for_trip_model.pop('calculated_distance_km', None)


    trip = Trip(
        user_id=user_id,
        mode=mode,
        distance_km=distance_to_use, # Store the actual distance used
        nights=nights,
        meals_per_day=meals_per_day,
        days=days,
        activities=activities,
        shopping_usd=shopping_usd,
        **emissions_for_trip_model # Use the modified dictionary
    )
    db.session.add(trip)
    db.session.commit()

    return jsonify({
        "user_id": user_id,
        "trip_id": trip.id,
        "trip_emissions": emissions, # Return the original emissions dict with calculated_distance_km
        "ai_summary": ai_summary
    })

@app.route("/user/<user_id>/summary", methods=["GET"])
def user_summary(user_id):
    trips = Trip.query.filter_by(user_id=user_id).all()
    if not trips:
        return jsonify({
            "user_id": user_id,
            "trip_count": 0,
            "total_emissions": 0,
            "ai_summary": "No trips logged yet. Start your carbon tracking journey today!",
            "trips": []
        })

    total_emissions = sum(t.total_emission for t in trips)
    emissions_data = {
        "total_emission": total_emissions,
        "transport_emission": sum(t.transport_emission for t in trips),
        "accommodation_emission": sum(t.accommodation_emission for t in trips),
        "food_emission": sum(t.food_emission for t in trips),
        "activity_emission": sum(t.activity_emission for t in trips),
        "shopping_emission": sum(t.shopping_emission for t in trips)
    }

    # For overall summary, we might not pass specific trip details, or aggregate them
    ai_summary = get_ai_summary_and_suggestion(emissions_data)

    return jsonify({
        "user_id": user_id,
        "trip_count": len(trips),
        "total_emissions": round(total_emissions, 2),
        "ai_summary": ai_summary,
        "trips": [t.to_dict() for t in trips]
    })

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "message": "AI-Powered Carbon Footprint Tracker",
        "routes": {
            "POST /calculate": "Log a trip and get AI summary",
            "GET /user/<user_id>/summary": "View your travel emissions summary and AI suggestions"
        }
    })

# ----------------------------
# App Launch
# ----------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
