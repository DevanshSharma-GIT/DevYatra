"""
Travel services module for CBC D-02 backend application.
Handles all travel-related API calls and business logic with optimized search capabilities.
"""
import requests
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from urllib.parse import quote_plus
import math

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils import haversine_distance, SimpleCache
from search_optimization import search_engine, PlaceInfo, SearchResult

logger = logging.getLogger(__name__)

# Initialize caches
tourist_cache = SimpleCache(default_ttl=86400)  # 24 hours
crowd_cache = SimpleCache(default_ttl=3600)     # 1 hour
crowd_activity_cache = SimpleCache(default_ttl=300)  # 5 minutes for geo crowd scans

# Initialize optimized search engine with sample data
def initialize_search_engine():
    """Initialize the optimized search engine with popular Indian tourist destinations."""
    sample_places = [
        {"name": "Taj Mahal", "latitude": 27.1751, "longitude": 78.0421, "category": "monument", 
         "rating": 4.8, "popularity_score": 0.95, "search_count": 15000},
        {"name": "Red Fort", "latitude": 28.6562, "longitude": 77.2410, "category": "historic", 
         "rating": 4.5, "popularity_score": 0.85, "search_count": 8000},
        {"name": "Gateway of India", "latitude": 18.9220, "longitude": 72.8347, "category": "monument", 
         "rating": 4.3, "popularity_score": 0.80, "search_count": 9500},
        {"name": "Hawa Mahal", "latitude": 26.9239, "longitude": 75.8267, "category": "palace", 
         "rating": 4.4, "popularity_score": 0.75, "search_count": 6000},
        {"name": "Mysore Palace", "latitude": 12.3051, "longitude": 76.6551, "category": "palace", 
         "rating": 4.6, "popularity_score": 0.78, "search_count": 5500},
        {"name": "Lotus Temple", "latitude": 28.5535, "longitude": 77.2588, "category": "temple", 
         "rating": 4.5, "popularity_score": 0.72, "search_count": 4200},
        {"name": "Charminar", "latitude": 17.3616, "longitude": 78.4747, "category": "monument", 
         "rating": 4.2, "popularity_score": 0.68, "search_count": 3800},
        {"name": "Qutub Minar", "latitude": 28.5245, "longitude": 77.1855, "category": "monument", 
         "rating": 4.3, "popularity_score": 0.70, "search_count": 4500},
        {"name": "Victoria Memorial", "latitude": 22.5448, "longitude": 88.3426, "category": "museum", 
         "rating": 4.4, "popularity_score": 0.73, "search_count": 3200},
        {"name": "Amber Palace", "latitude": 26.9855, "longitude": 75.8513, "category": "palace", 
         "rating": 4.5, "popularity_score": 0.76, "search_count": 4800},
        {"name": "India Gate", "latitude": 28.6129, "longitude": 77.2295, "category": "monument", 
         "rating": 4.2, "popularity_score": 0.82, "search_count": 7200},
        {"name": "Golden Temple", "latitude": 31.6200, "longitude": 74.8765, "category": "temple", 
         "rating": 4.8, "popularity_score": 0.90, "search_count": 12000},
        {"name": "Ajanta Caves", "latitude": 20.5530, "longitude": 75.7033, "category": "historic", 
         "rating": 4.6, "popularity_score": 0.74, "search_count": 2800},
        {"name": "Ellora Caves", "latitude": 20.0269, "longitude": 75.1799, "category": "historic", 
         "rating": 4.5, "popularity_score": 0.72, "search_count": 2600},
        {"name": "Hampi", "latitude": 15.3350, "longitude": 76.4600, "category": "ruins", 
         "rating": 4.7, "popularity_score": 0.77, "search_count": 3400},
        {"name": "Khajuraho Temples", "latitude": 24.8318, "longitude": 79.9199, "category": "temple", 
         "rating": 4.4, "popularity_score": 0.69, "search_count": 2200},
        {"name": "Backwaters Alleppey", "latitude": 9.4981, "longitude": 76.3388, "category": "nature", 
         "rating": 4.6, "popularity_score": 0.79, "search_count": 5800},
        {"name": "Goa Beaches", "latitude": 15.2993, "longitude": 74.1240, "category": "beach", 
         "rating": 4.3, "popularity_score": 0.83, "search_count": 11000},
        {"name": "Valley of Flowers", "latitude": 30.7268, "longitude": 79.6034, "category": "nature", 
         "rating": 4.8, "popularity_score": 0.71, "search_count": 1800},
        {"name": "Ladakh", "latitude": 34.1526, "longitude": 77.5771, "category": "nature", 
         "rating": 4.9, "popularity_score": 0.88, "search_count": 8500}
    ]
    
    try:
        search_engine.initialize_data(sample_places)
        logger.info("Optimized search engine initialized with sample tourist destinations")
    except Exception as e:
        logger.error(f"Failed to initialize search engine: {e}")

# Initialize search engine on module load
initialize_search_engine()

class GeocodeService:
    """Service for geocoding and reverse geocoding operations."""
    
    @staticmethod
    def geocode_address(address: str) -> Optional[Dict]:
        """Geocode an address using Geoapify API."""
        if not Config.GEOAPIFY_API_KEY:
            logger.error("GEOAPIFY_API_KEY is not configured")
            return None

        url = "https://api.geoapify.com/v1/geocode/search"
        params = {"text": address, "filter": "countrycode:in", "apiKey": Config.GEOAPIFY_API_KEY}
        
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            result = resp.json()
            logger.debug(f"Geocoded '{address}': {result}")
            return result
            
        except requests.exceptions.Timeout:
            logger.error(f"Geocode request timed out for address: {address}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Geocode error for address '{address}': {e}")
        except Exception as e:
            logger.error(f"Unexpected error during geocoding: {e}")
        
        return None
    
    @staticmethod
    def reverse_geocode(lat: float, lon: float) -> Optional[Dict]:
        """Reverse geocode coordinates using Geoapify API."""
        if not Config.GEOAPIFY_API_KEY:
            logger.error("GEOAPIFY_API_KEY is not configured")
            return None
            
        url = "https://api.geoapify.com/v1/geocode/reverse"
        params = {"lat": lat, "lon": lon, "apiKey": Config.GEOAPIFY_API_KEY}
        
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            return resp.json()
            
        except requests.RequestException as e:
            logger.error(f"Reverse geocode error: {e}")
            return None

class OptimizedPlaceService:
    """
    Enhanced PlaceService with optimized search capabilities using advanced data structures.
    """
    
    @staticmethod
    def search_tourist_place_optimized(query: str, user_id: str = None, 
                                     user_lat: float = None, user_lon: float = None,
                                     limit: int = 5) -> Optional[Dict]:
        """
        Optimized search using advanced data structures for better performance.
        Falls back to external API if needed.
        """
        try:
            # First try optimized search
            results = search_engine.search_places(
                query=query,
                user_id=user_id,
                user_lat=user_lat,
                user_lon=user_lon,
                search_type="auto",
                limit=limit
            )
            
            if results:
                # Convert SearchResult objects to API format
                features = []
                for result in results:
                    place = result.place
                    feature = {
                        "properties": {
                            "name": place.name,
                            "formatted": place.name,
                            "lat": place.latitude,
                            "lon": place.longitude,
                            "categories": [place.category],
                            "confidence": result.relevance_score,
                            "search_type": result.search_type,
                            "distance_km": result.distance_km
                        },
                        "type": "Feature"
                    }
                    features.append(feature)
                    
                    # Update popularity for learning
                    search_engine.update_place_popularity(place.name, "search")
                
                return {"features": features}
            
            # Fallback to external API search
            logger.info(f"Falling back to external API for query: {query}")
            return PlaceService.search_tourist_place(query)
            
        except Exception as e:
            logger.error(f"Optimized search error: {e}")
            # Fallback to original search
            return PlaceService.search_tourist_place(query)
    
    @staticmethod
    def get_recommendations(user_id: str, user_lat: float = None, user_lon: float = None,
                          limit: int = 10) -> List[Dict]:
        """Get personalized recommendations for a user."""
        try:
            results = search_engine.search_places(
                query="",
                user_id=user_id,
                user_lat=user_lat,
                user_lon=user_lon,
                search_type="recommendation",
                limit=limit
            )
            
            recommendations = []
            for result in results:
                place = result.place
                rec = {
                    "name": place.name,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                    "category": place.category,
                    "rating": place.rating,
                    "relevance_score": result.relevance_score,
                    "popularity_score": place.popularity_score,
                    "recommendation_type": result.search_type
                }
                if result.distance_km:
                    rec["distance_km"] = result.distance_km
                recommendations.append(rec)
                
            return recommendations
            
        except Exception as e:
            logger.error(f"Recommendation error: {e}")
            return []
    
    @staticmethod
    def search_nearby_optimized(lat: float, lon: float, radius_km: float = 25.0, 
                              limit: int = 10) -> List[Dict]:
        """Optimized nearby search using spatial indexing."""
        try:
            results = search_engine.search_places(
                query="",
                user_lat=lat,
                user_lon=lon,
                search_type="location",
                limit=limit
            )
            
            nearby_places = []
            for result in results:
                place = result.place
                nearby = {
                    "name": place.name,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                    "category": place.category,
                    "rating": place.rating,
                    "distance_km": result.distance_km,
                    "relevance_score": result.relevance_score
                }
                nearby_places.append(nearby)
                
            return nearby_places
            
        except Exception as e:
            logger.error(f"Nearby search error: {e}")
            return []
    
    @staticmethod
    def record_user_interaction(user_id: str, place_name: str, interaction_type: str = "search"):
        """Record user interaction for recommendation learning."""
        try:
            # Find the place in our data
            for place in search_engine.places_data:
                if place.name.lower() == place_name.lower():
                    rating = 1.0
                    if interaction_type == "book":
                        rating = 2.0
                    elif interaction_type == "view":
                        rating = 1.5
                    elif interaction_type == "like":
                        rating = 1.8
                        
                    search_engine.recommendation_engine.add_user_interaction(
                        user_id, place, interaction_type, rating
                    )
                    search_engine.update_place_popularity(place_name, interaction_type)
                    break
                    
        except Exception as e:
            logger.error(f"Error recording user interaction: {e}")

class PlaceService:
    """Service for place-related operations."""
    
    @staticmethod
    def search_tourist_place(query: str) -> Optional[Dict]:
        """Search for tourist places using Geoapify API."""
        if not Config.GEOAPIFY_API_KEY:
            logger.error("GEOAPIFY_API_KEY is not configured")
            return None
            
        url = "https://api.geoapify.com/v1/geocode/autocomplete"
        params = {"text": query, "filter": "countrycode:in", "limit": 5, "apiKey": Config.GEOAPIFY_API_KEY}
        
        try:
            resp = requests.get(url, params=params, headers={"Accept": "application/json"})
            resp.raise_for_status()
            return resp.json()
            
        except requests.RequestException as e:
            logger.error(f"Search error: {e}")
            return None
    
    @staticmethod
    def search_nearby_places(lat: float, lon: float) -> Optional[Dict]:
        """Search for nearby tourist attractions."""
        if not Config.GEOAPIFY_API_KEY:
            logger.error("GEOAPIFY_API_KEY is not configured")
            return None
            
        url = "https://api.geoapify.com/v2/places"
        params = {
            "categories": "tourism.attraction,entertainment.museum,leisure.park,tourism.sights",
            "filter": f"circle:{lon},{lat},1000",
            "limit": 5,
            "apiKey": Config.GEOAPIFY_API_KEY
        }
        
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            return resp.json()
            
        except requests.RequestException as e:
            logger.error(f"Nearby places error: {e}")
            return None
    
    @staticmethod
    def is_tourist_attraction(place_name: str, place_data: Dict) -> bool:
        """Determine if a place is a tourist attraction."""
        # Check cache first
        cached_result = tourist_cache.get(place_name)
        if cached_result is not None:
            return cached_result

        place_id = place_data.get("properties", {}).get("place_id")
        if not place_id:
            logger.debug(f"No place_id for {place_name}, using fallback.")
            return PlaceService._heuristic_tourist_check(place_name, place_data)

        if not Config.GEOAPIFY_API_KEY:
            return PlaceService._heuristic_tourist_check(place_name, place_data)

        url = "https://api.geoapify.com/v2/place-details"
        params = {"id": place_id, "features": "details", "apiKey": Config.GEOAPIFY_API_KEY}
        
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
            tourist_cache.set(place_name, is_tourist)
            return is_tourist

        except requests.RequestException as e:
            logger.error(f"Place Details error for {place_name}: {e}")
            return PlaceService._heuristic_tourist_check(place_name, place_data)
    
    @staticmethod
    def _heuristic_tourist_check(place_name: str, place_data: Dict) -> bool:
        """Fallback heuristic check for tourist attractions."""
        categories = place_data.get("properties", {}).get("categories", [])
        non_tourist = ["residential", "apartment", "housing", "private", "office"]
        tourist_vibes = ["tourism", "attraction", "sights", "museum", "historic", "heritage", "park"]

        if any(any(keyword in cat for keyword in non_tourist) for cat in categories):
            tourist_cache.set(place_name, False)
            return False
            
        if any(any(keyword in cat for keyword in tourist_vibes) for cat in categories):
            tourist_cache.set(place_name, True)
            return True

        # Use AI as last resort
        return PlaceService._ai_tourist_check(place_name)
    
    @staticmethod
    def _ai_tourist_check(place_name: str) -> bool:
        """Use AI to determine if place is tourist attraction."""
        if not Config.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured for AI tourist check")
            return False
            
        try:
            from groq import Groq
            client = Groq(api_key=Config.GROQ_API_KEY)
            prompt = f"Is '{place_name}' in India a tourist attraction? Answer 'Yes' or 'No'."
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": "Factual answers only."}, 
                         {"role": "user", "content": prompt}],
                temperature=0.1, max_tokens=10
            )
            response_text = response.choices[0].message.content.strip().lower()
            is_tourist = "yes" in response_text or "tourist" in response_text
            tourist_cache.set(place_name, is_tourist)
            return is_tourist
            
        except Exception as e:
            logger.error(f"AI tourist check error: {e}")
            return False

class RouteService:
    """Service for route calculations and navigation."""
    
    @staticmethod
    def get_route_distance(origin_lat: float, origin_lon: float, 
                          dest_lat: float, dest_lon: float) -> Optional[Dict]:
        """Calculate route distance and duration using Radar API."""
        if not Config.RADAR_PUBLISHABLE_KEY:
            logger.error("RADAR_PUBLISHABLE_KEY not configured for routing.")
            return None

        url = "https://api.radar.io/v1/route/distance"
        headers = {"Authorization": Config.RADAR_PUBLISHABLE_KEY}
        params = {
            "origin": f"{origin_lat},{origin_lon}",
            "destination": f"{dest_lat},{dest_lon}",
            "modes": "car",
            "units": "metric"
        }
        
        try:
            resp = requests.get(url, params=params, headers=headers)
            resp.raise_for_status()
            route_data = resp.json()

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
            logger.error(f"Radar routing error: {e}")
            return None

class AIService:
    """Service for AI-powered features."""
    
    @staticmethod
    def get_crowd_density(place_name: str) -> str:
        """Get crowd density estimate using AI."""
        # Check cache first
        cached_result = crowd_cache.get(place_name)
        if cached_result is not None:
            return cached_result

        if not Config.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured for crowd density")
            return "Medium"

        try:
            from groq import Groq
            client = Groq(api_key=Config.GROQ_API_KEY)
            prompt = f"Estimate crowd density at '{place_name}' in India. Reply 'High', 'Medium', or 'Low'."
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": "Tourism expert, concise."}, 
                         {"role": "user", "content": prompt}],
                temperature=0.1, max_tokens=10
            )
            response_text = response.choices[0].message.content.strip().lower()
            if "high" in response_text:
                density = "High"
            elif "low" in response_text:
                density = "Low"
            else:
                density = "Medium"
            crowd_cache.set(place_name, density)
            return density
            
        except Exception as e:
            logger.error(f"Crowd density error: {e}")
            return "Medium"
    
    @staticmethod
    def get_ai_recommendation(place_name: str) -> str:
        """Get AI-powered travel recommendation."""
        if not Config.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured for recommendations")
            return f"Explore '{place_name}' and check local weather."

        try:
            from groq import Groq
            client = Groq(api_key=Config.GROQ_API_KEY)
            prompt = f"Give a factual travel tip for '{place_name}' in India, under 100 words."
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": "Tourism guru, keep it tight."}, 
                         {"role": "user", "content": prompt}],
                temperature=0.3, max_tokens=150
            )
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Recommendation error: {e}")
            return f"Explore '{place_name}' and check local weather."


class CrowdActivityService:
    """Service for live crowd activity analysis using traffic and place data."""

    @staticmethod
    def analyze_crowd_activity(lat: float, lon: float) -> Dict:
        """Aggregate multiple data sources to estimate live crowd density."""
        cache_key = f"{round(lat, 4)}:{round(lon, 4)}"
        cached = crowd_activity_cache.get(cache_key)
        if cached:
            return cached

        mapquest_key = Config.MAPQUEST_API_KEY
        geoapify_key = Config.GEOAPIFY_API_KEY

        missing_keys = []
        if not mapquest_key:
            missing_keys.append("MAPQUEST_API_KEY")
        if not geoapify_key:
            missing_keys.append("GEOAPIFY_API_KEY")
        if missing_keys:
            raise RuntimeError(f"Missing required API keys: {', '.join(missing_keys)}")

        lat_offset = 0.009
        lon_offset = 0.009
        upper_lat = lat + lat_offset
        lower_lat = lat - lat_offset
        left_lng = lon - lon_offset
        right_lng = lon + lon_offset

        incident_data = None
        place_data = None

        # Traffic incidents (MapQuest)
        try:
            url = "https://www.mapquestapi.com/traffic/v2/incidents"
            payload = {
                "boundingBox": {
                    "ul": {"lat": upper_lat, "lng": left_lng},
                    "lr": {"lat": lower_lat, "lng": right_lng}
                },
                "filters": ["incidents", "construction", "congestion"],
                "key": mapquest_key
            }
            resp = requests.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            incident_data = resp.json()
            logger.info(
                "MapQuest incidents: %s (lat=%.4f, lon=%.4f)",
                len(incident_data.get("incidents", [])), lat, lon
            )
        except requests.RequestException as exc:
            logger.warning("MapQuest traffic API error: %s", exc)

        # Nearby places (Geoapify)
        try:
            place_url = "https://api.geoapify.com/v2/places"
            params = {
                "categories": "catering,entertainment,tourism,sport,building",
                "filter": f"circle:{lon},{lat},1000",
                "bias": f"proximity:{lon},{lat}",
                "limit": 50,
                "apiKey": geoapify_key
            }
            place_resp = requests.get(place_url, params=params, timeout=10)
            place_resp.raise_for_status()
            place_data = place_resp.json()
            logger.info(
                "Geoapify places: %s (lat=%.4f, lon=%.4f)",
                len(place_data.get("features", [])), lat, lon
            )
        except requests.RequestException as exc:
            logger.warning("Geoapify places API error: %s", exc)

        # Time factor adjustment
        current_hour = datetime.now().hour
        if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
            time_factor = 1.5
        elif 12 <= current_hour <= 14:
            time_factor = 1.3
        elif 22 <= current_hour or current_hour <= 5:
            time_factor = 0.7
        else:
            time_factor = 1.0

        incidents = incident_data.get("incidents", []) if incident_data else []
        incident_count = len(incidents)
        high_severity_count = sum(1 for inc in incidents if inc.get("severity", 0) >= 3)
        top_incidents_raw = sorted(
            incidents,
            key=lambda inc: inc.get("severity", 0),
            reverse=True
        )[:3]
        top_incidents = [
            {
                "description": inc.get("shortDesc", "Unknown incident"),
                "severity": inc.get("severity", 0),
                "type": inc.get("type", 0),
                "time": inc.get("startTime", ""),
                "fullDesc": inc.get("fullDesc", ""),
                "impacting": inc.get("impacting", False)
            }
            for inc in top_incidents_raw
        ]

        place_weight = 0.0
        features = place_data.get("features", []) if place_data else []
        if features:
            category_weights = {
                "catering": 1.2,
                "entertainment": 1.5,
                "tourism": 1.8,
                "commercial": 1.4,
                "sport": 1.3,
                "building.tourism": 1.7
            }
            for feature in features:
                props = feature.get("properties", {})
                categories = props.get("categories", [])
                weight = 1.0
                for category in categories:
                    for key, multiplier in category_weights.items():
                        if key in category:
                            weight = max(weight, multiplier)
                place_weight += weight

        if incident_count > 10 or high_severity_count >= 3:
            incident_factor = 3
        elif incident_count > 5 or high_severity_count >= 1:
            incident_factor = 2
        else:
            incident_factor = 1

        if place_weight > 50:
            place_factor = 3
        elif place_weight > 25:
            place_factor = 2
        else:
            place_factor = 1

        crowd_score = (incident_factor * 0.5) + (place_factor * 0.3) + (time_factor * 0.2)
        if crowd_score >= 2.5:
            status = "high"
            device_count = int(120 + incident_count * 5 + place_weight * 2)
        elif crowd_score >= 1.7:
            status = "medium"
            device_count = int(60 + incident_count * 3 + place_weight * 1.5)
        else:
            status = "low"
            device_count = int(20 + incident_count * 2 + place_weight)

        map_url = ""
        if geoapify_key:
            radius = Config.SEARCH_RADIUS or 500
            map_url = (
                "https://maps.geoapify.com/v1/staticmap?"
                f"style=osm-bright&width=800&height=500&"
                f"center=lonlat:{lon},{lat}&zoom=16&"
                f"apiKey={geoapify_key}&"
                f"circle=lon:{lon};lat:{lat};radius:{radius};color:%23ff0000;width:2;fill:%23ff000033&"
                f"marker=lonlat:{lon},{lat};color:%23ff0000;size:medium"
            )

            for feature in features[:10]:
                coords = feature.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    place_lon, place_lat = coords[0], coords[1]
                    map_url += (
                        f"&marker=lonlat:{place_lon},{place_lat};color:%2324a0ed;size:small"
                    )

        result = {
            "status": status,
            "device_count": device_count,
            "incident_count": incident_count,
            "map_url": map_url,
            "radius": Config.SEARCH_RADIUS,
            "timestamp": datetime.utcnow().isoformat(),
            "top_incidents": top_incidents,
            "crowd_score": round(crowd_score, 2)
        }

        crowd_activity_cache.set(cache_key, result)
        return result

class MediaService:
    """Service for media and content generation."""
    
    @staticmethod
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
    
    @staticmethod
    def get_vr_videos(place_name: str) -> List[Dict]:
        """Get VR videos for a tourist place."""
        import re
        from urllib.parse import quote_plus
        
        search_query = f"{place_name} india virtual tour 360"
        encoded_query = quote_plus(search_query)
        
        try:
            url = f"https://www.youtube.com/results?search_query={encoded_query}"
            
            response = requests.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code == 200:
                html_content = response.text
                video_ids = re.findall(r"videoId\":\"([^\"]+)", html_content)
                
                # Remove duplicates while preserving order
                unique_video_ids = []
                for vid in video_ids:
                    if vid not in unique_video_ids:
                        unique_video_ids.append(vid)
                
                # Get up to 3 videos
                video_ids = unique_video_ids[:3]
                
                videos = []
                for i, video_id in enumerate(video_ids):
                    videos.append({
                        "title": f"{place_name} Virtual Tour {i+1}",
                        "video_id": video_id
                    })
                
                logger.info(f"Found {len(videos)} VR videos for {place_name}")
                return videos
        
        except Exception as e:
            logger.error(f"Error searching for VR videos: {e}")
        
        # Return fallback videos
        return [
            {"title": "Incredible India - Virtual Reality Tour", "video_id": "ICqFo9DZhxM"},
            {"title": "India in 360° - Amazing Heritage Sites", "video_id": "vQpaGpkgVQs"}
        ]

class PricingService:
    """Service for dynamic pricing calculations."""
    
    @staticmethod
    def calculate_dynamic_price(base_price: float, crowd_density: str) -> float:
        """Calculate dynamic pricing based on crowd density."""
        multipliers = {"High": 1.8, "Medium": 1.5, "Low": 1.2}
        multiplier = multipliers.get(crowd_density, 1.5)
        return round(base_price * multiplier, 2)