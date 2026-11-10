"""
Carbon footprint routes blueprint for CBC D-02 backend application.
Contains all carbon footprint calculation and tracking endpoints.
"""
from flask import Blueprint, request, jsonify
import logging

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from carbon_service import CarbonFootprintService
from models import CarbonOperations

logger = logging.getLogger(__name__)

# Create blueprint
carbon_bp = Blueprint('carbon', __name__, url_prefix='/api/carbon')

@carbon_bp.route('/calculate', methods=['POST'])
def calculate_carbon_footprint():
    """Calculate carbon footprint for a trip."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate and clean the input data
        validated_data = CarbonFootprintService.validate_trip_data(data)
        
        # Calculate emissions and get AI summary
        result = CarbonFootprintService.calculate_trip_emissions(validated_data)
        
        # Save to database
        trip_id = CarbonOperations.save_trip(
            validated_data["user_id"],
            validated_data,
            result["emissions"],
            result["ai_summary"]
        )
        
        # Prepare response
        response = {
            "user_id": validated_data["user_id"],
            "trip_id": trip_id,
            "trip_emissions": result["emissions"],
            "ai_summary": result["ai_summary"]
        }
        
        logger.info(f"Carbon footprint calculated for user {validated_data['user_id']}: "
                   f"{result['emissions']['total_emission']} kg CO2")
        
        return jsonify(response)
        
    except ValueError as e:
        logger.warning(f"Validation error in carbon calculation: {e}")
        return jsonify({"error": str(e)}), 400
        
    except Exception as e:
        logger.error(f"Error calculating carbon footprint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@carbon_bp.route('/user/<user_id>/summary', methods=['GET'])
def get_user_carbon_summary(user_id):
    """Get carbon footprint summary for a user."""
    try:
        # Get all trips for the user
        trips = CarbonOperations.get_user_trips(user_id)
        
        # Generate summary
        summary = CarbonFootprintService.get_user_carbon_summary(trips)
        
        # Prepare detailed trip list
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
            "trip_count": summary["trip_count"],
            "total_emissions": summary["total_emissions"],
            "average_emissions": summary["average_emissions"],
            "ai_summary": summary["summary"],
            "trips": trip_list
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting carbon summary for user {user_id}: {e}")
        return jsonify({"error": "Internal server error"}), 500

@carbon_bp.route('/emission-factors', methods=['GET'])
def get_emission_factors():
    """Get current carbon emission factors used in calculations."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config
    
    return jsonify({
        "emission_factors": Config.CARBON_EMISSION_FACTORS,
        "units": "kg CO2 per km",
        "other_factors": {
            "accommodation": "6.8 kg CO2 per night",
            "food": "2.0 kg CO2 per meal",
            "activities": "2.0 kg CO2 per activity",
            "shopping": "1.0 kg CO2 per $100 spent"
        }
    })

@carbon_bp.route('/airports', methods=['GET'])
def get_airport_coordinates():
    """Get available airport coordinates for flight distance calculations."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config
    
    return jsonify({
        "airports": Config.AIRPORT_COORDINATES,
        "note": "These coordinates are used for automatic flight distance calculation"
    })

@carbon_bp.route('/flight-distance', methods=['GET'])
def calculate_flight_distance():
    """Calculate distance between two airports."""
    origin = request.args.get('origin')
    destination = request.args.get('destination')
    
    if not origin or not destination:
        return jsonify({"error": "Both origin and destination airport codes required"}), 400
    
    distance = CarbonFootprintService.get_flight_distance_from_codes(origin, destination)
    
    if distance is None:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from config import Config
        
        return jsonify({
            "error": f"Could not calculate distance between {origin} and {destination}",
            "available_airports": list(Config.AIRPORT_COORDINATES.keys())
        }), 404
    
    return jsonify({
        "origin": origin.upper(),
        "destination": destination.upper(),
        "distance_km": distance,
        "note": "Distance calculated using great circle formula"
    })

# Health check endpoint for carbon services
@carbon_bp.route('/health', methods=['GET'])
def carbon_health():
    """Health check for carbon footprint services."""
    return jsonify({
        "status": "healthy",
        "service": "carbon_footprint",
        "endpoints": [
            "/api/carbon/calculate",
            "/api/carbon/user/<user_id>/summary",
            "/api/carbon/emission-factors",
            "/api/carbon/airports",
            "/api/carbon/flight-distance"
        ]
    })