"""
Carbon footprint calculation service for CBC D-02 backend application.
Handles all carbon footprint related calculations and AI suggestions.
"""
import requests
import logging
from typing import Dict, Optional
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils import haversine_distance

logger = logging.getLogger(__name__)

class CarbonFootprintService:
    """Service for carbon footprint calculations and tracking."""
    
    @staticmethod
    def get_flight_distance_from_codes(origin_code: str, dest_code: str) -> Optional[float]:
        """Calculate flight distance between airport codes."""
        o, d = origin_code.upper(), dest_code.upper()
        
        if o in Config.AIRPORT_COORDINATES and d in Config.AIRPORT_COORDINATES:
            lat1, lon1 = Config.AIRPORT_COORDINATES[o]
            lat2, lon2 = Config.AIRPORT_COORDINATES[d]
            return haversine_distance(lat1, lon1, lat2, lon2)
        
        logger.warning(f"Could not find coordinates for airport codes: {origin_code} or {dest_code}")
        return None
    
    @staticmethod
    def calculate_total_emissions(mode: str, distance: float, nights: int, 
                                meals_per_day: int, days: int, activities: int, 
                                shopping_usd: float) -> Dict:
        """Calculate total carbon emissions for a trip."""
        # Transport emissions
        transport_emission = round(Config.CARBON_EMISSION_FACTORS.get(mode, 0) * distance, 2)
        
        # Accommodation emissions (6.8 kg CO2 per night)
        accommodation_emission = round(nights * 6.8, 2)
        
        # Food emissions (2.0 kg CO2 per meal)
        food_emission = round(meals_per_day * days * 2.0, 2)
        
        # Activity emissions (2.0 kg CO2 per activity)
        activity_emission = round(activities * 2.0, 2)
        
        # Shopping emissions (1.0 kg CO2 per $100 spent)
        shopping_emission = round((shopping_usd / 100) * 1.0, 2)
        
        # Total emissions
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
    
    @staticmethod
    def get_ai_summary_and_suggestion(emission_data: Dict, trip_details: Optional[Dict] = None) -> str:
        """Generate AI-powered summary and suggestions for carbon emissions."""
        if not Config.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured for AI suggestions")
            return CarbonFootprintService._get_fallback_summary(emission_data)
        
        formatted_emissions = {k: f"{v:.2f}" if isinstance(v, float) else v 
                             for k, v in emission_data.items()}
        
        prompt_intro = f"User's total carbon emission: {formatted_emissions['total_emission']} kg CO2 for a trip."
        
        if trip_details:
            prompt_intro += f" Trip Mode: {trip_details.get('mode', 'N/A')}, Distance: {trip_details.get('distance_km', 'N/A')} km."
            if (trip_details.get('mode') == 'flight' and 
                trip_details.get('origin_airport') and 
                trip_details.get('destination_airport')):
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
            "Authorization": f"Bearer {Config.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}]
        }
        
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions", 
                json=payload, 
                headers=headers, 
                timeout=20
            )
            
            if resp.status_code == 200:
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content
                else:
                    logger.error(f"Groq API returned empty content: {resp.text}")
            else:
                logger.error(f"Groq API error {resp.status_code}: {resp.text}")
                
        except Exception as e:
            logger.error(f"Groq API request failed: {e}")
        
        return CarbonFootprintService._get_fallback_summary(emission_data)
    
    @staticmethod
    def _get_fallback_summary(emission_data: Dict) -> str:
        """Generate a fallback summary when AI is not available."""
        total = emission_data.get('total_emission', 0)
        
        if total < 50:
            level = "low"
            message = "Great job keeping your carbon footprint minimal!"
        elif total < 150:
            level = "moderate"
            message = "Your carbon footprint is within a reasonable range."
        else:
            level = "high"
            message = "Consider ways to reduce your carbon impact for future trips."
        
        return f"""
        Your trip generated {total} kg of CO2 emissions - that's a {level} carbon footprint. {message}
        
        Here are some ways to offset or reduce your impact:
        • Plant trees or support reforestation projects
        • Choose eco-friendly accommodations for future trips
        • Consider train or bus travel for shorter distances
        • Pack light to reduce transportation fuel consumption
        """
    
    @staticmethod
    def validate_trip_data(data: Dict) -> Dict:
        """Validate and clean trip data for carbon calculation."""
        # Required fields
        user_id = data.get("user_id")
        mode = data.get("mode", "").lower()
        
        if not user_id:
            raise ValueError("Missing user_id")
        
        if mode not in Config.CARBON_EMISSION_FACTORS:
            raise ValueError(f"Invalid transport mode: {mode}")
        
        # Optional fields with defaults
        validated_data = {
            "user_id": user_id,
            "mode": mode,
            "distance_km": float(data.get("distance", 0.0)),
            "nights": int(data.get("nights", 0)),
            "meals_per_day": int(data.get("meals_per_day", 0)),
            "days": int(data.get("days", 0)),
            "activities": int(data.get("activities", 0)),
            "shopping_usd": float(data.get("shopping_usd", 0)),
            "origin_airport": data.get("origin_airport"),
            "destination_airport": data.get("destination_airport")
        }
        
        # Handle flight distance calculation
        if (mode == "flight" and 
            validated_data["origin_airport"] and 
            validated_data["destination_airport"]):
            
            calculated_distance = CarbonFootprintService.get_flight_distance_from_codes(
                validated_data["origin_airport"], 
                validated_data["destination_airport"]
            )
            
            if calculated_distance is not None:
                validated_data["distance_km"] = calculated_distance
                logger.info(f"Used calculated flight distance: {calculated_distance} km")
            elif validated_data["distance_km"] == 0:
                raise ValueError(
                    f"Could not calculate distance for flight {validated_data['origin_airport']}-"
                    f"{validated_data['destination_airport']} and no manual distance provided."
                )
        
        # Validate that we have some meaningful data
        if (validated_data["distance_km"] <= 0 and mode in ["flight", "car", "train"] and
            not (validated_data["nights"] > 0 or 
                 (validated_data["meals_per_day"] > 0 and validated_data["days"] > 0) or
                 validated_data["activities"] > 0 or 
                 validated_data["shopping_usd"] > 0)):
            raise ValueError(
                "Distance must be greater than 0 for selected transport mode, "
                "or provide other emission sources."
            )
        
        return validated_data
    
    @staticmethod
    def calculate_trip_emissions(trip_data: Dict) -> Dict:
        """Calculate emissions for a complete trip."""
        emissions = CarbonFootprintService.calculate_total_emissions(
            trip_data["mode"],
            trip_data["distance_km"],
            trip_data["nights"],
            trip_data["meals_per_day"],
            trip_data["days"],
            trip_data["activities"],
            trip_data["shopping_usd"]
        )
        
        # Prepare trip details for AI summary
        trip_details_for_ai = {
            "mode": trip_data["mode"],
            "distance_km": trip_data["distance_km"],
            "origin_airport": trip_data.get("origin_airport") if trip_data["mode"] == "flight" else None,
            "destination_airport": trip_data.get("destination_airport") if trip_data["mode"] == "flight" else None
        }
        
        # Get AI summary
        ai_summary = CarbonFootprintService.get_ai_summary_and_suggestion(
            emissions, 
            trip_details=trip_details_for_ai
        )
        
        return {
            "emissions": emissions,
            "ai_summary": ai_summary,
            "trip_details": trip_details_for_ai
        }
    
    @staticmethod
    def get_user_carbon_summary(trips: list) -> Dict:
        """Generate a summary of user's carbon footprint from all trips."""
        if not trips:
            return {
                "trip_count": 0,
                "total_emissions": 0.0,
                "average_emissions": 0.0,
                "summary": "No trips logged yet. Start your carbon tracking journey today!"
            }
        
        trip_count = len(trips)
        total_emissions = sum(trip.get("total_emission", 0) for trip in trips)
        average_emissions = round(total_emissions / trip_count, 2) if trip_count > 0 else 0.0
        
        # Get the most recent trip's AI summary
        latest_summary = trips[0].get("ai_summary", "No recent analysis available.") if trips else ""
        
        return {
            "trip_count": trip_count,
            "total_emissions": round(total_emissions, 2),
            "average_emissions": average_emissions,
            "summary": latest_summary
        }