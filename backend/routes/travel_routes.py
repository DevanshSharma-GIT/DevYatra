"""
Travel routes blueprint for CBC D-02 backend application.
Contains all travel-related API endpoints with optimized search capabilities.
"""
from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import uuid
import qrcode
import logging

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from travel_services import (GeocodeService, PlaceService, OptimizedPlaceService, RouteService, 
                             AIService, MediaService, PricingService, CrowdActivityService)

logger = logging.getLogger(__name__)

# Create blueprint
travel_bp = Blueprint('travel', __name__, url_prefix='/api')

@travel_bp.route('/geocode', methods=['GET'])
def geocode():
    """Geocode an address to coordinates."""
    address = request.args.get('address')
    
    if not address:
        return jsonify({"error": "Address required"}), 400

    result = GeocodeService.geocode_address(address)
    
    if result is None:
        return jsonify({"error": "Geocoding service failed"}), 500

    if "features" not in result or not result["features"]:
        return jsonify({"error": "No results found for the address"}), 404

    try:
        props = result["features"][0]["properties"]
        response_data = {
            "address": props.get("formatted", "N/A"),
            "latitude": props.get("lat", None),
            "longitude": props.get("lon", None),
            "confidence": props.get("rank", {}).get("confidence", "N/A")
        }
        return jsonify(response_data)
        
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Error processing geocoding response: {e}")
        return jsonify({"error": "Error processing geocoding results"}), 500

@travel_bp.route('/reverse_geocode', methods=['GET'])
def reverse_geocode():
    """Reverse geocode coordinates to address."""
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not lat or not lon:
        return jsonify({"error": "Lat and lon required"}), 400

    try:
        lat_val = float(lat)
        lon_val = float(lon)
    except ValueError:
        return jsonify({"error": "Invalid coordinates"}), 400

    result = GeocodeService.reverse_geocode(lat_val, lon_val)
    
    if not result or "features" not in result or not result["features"]:
        return jsonify({"error": "No results"}), 404

    props = result["features"][0]["properties"]
    return jsonify({
        "address": props["formatted"],
        "place_label": props.get("name", props["formatted"])
    })

@travel_bp.route('/autocomplete', methods=['GET'])
def autocomplete_place():
    """Get autocomplete suggestions for places using optimized search."""
    query = request.args.get('query')
    user_id = request.args.get('user_id')  # Optional for personalization
    
    if not query:
        return jsonify({"suggestions": []}), 200

    # Use optimized search for autocomplete
    results = OptimizedPlaceService.search_tourist_place_optimized(
        query=query, 
        user_id=user_id,
        limit=8
    )
    
    if not results or "features" not in results:
        return jsonify({"suggestions": []}), 200

    suggestions = [
        {
            "label": feat["properties"].get("name", feat["properties"]["formatted"]),
            "latitude": feat["properties"]["lat"],
            "longitude": feat["properties"]["lon"],
            "confidence": feat["properties"].get("confidence", 0.0),
            "search_type": feat["properties"].get("search_type", "text")
        }
        for feat in results["features"]
    ]
    
    return jsonify({"suggestions": suggestions})

@travel_bp.route('/search', methods=['GET'])
def search_place():
    """Search for a tourist place with optimized algorithms and get detailed information."""
    place_name = request.args.get('place')
    user_id = request.args.get('user_id')  # Optional for personalization
    
    if not place_name:
        return jsonify({"error": "Place name required"}), 400

    # Get origin coordinates if provided for route calculation
    origin_lat = request.args.get('origin_lat')
    origin_lon = request.args.get('origin_lon')

    # Convert coordinates to float if provided
    user_lat = None
    user_lon = None
    if origin_lat and origin_lon:
        try:
            user_lat = float(origin_lat)
            user_lon = float(origin_lon)
        except (ValueError, TypeError):
            pass

    # Use optimized search
    results = OptimizedPlaceService.search_tourist_place_optimized(
        query=place_name,
        user_id=user_id,
        user_lat=user_lat,
        user_lon=user_lon,
        limit=5
    )
    
    if not results or "features" not in results or not results["features"]:
        return jsonify({"error": "No results found"}), 200

    place = results["features"][0]
    place_label = place["properties"].get("name", place["properties"]["formatted"])
    lat, lon = place["properties"]["lat"], place["properties"]["lon"]

    # Check if it's a tourist attraction (using existing logic for external API compatibility)
    if not PlaceService.is_tourist_attraction(place_label, place):
        return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

    # Record user interaction for recommendation learning
    if user_id:
        OptimizedPlaceService.record_user_interaction(user_id, place_label, "search")

    # Get place details
    map_url = MediaService.generate_map_url(lat, lon, place_label)
    density = AIService.get_crowd_density(place_label)
    base_price = 100
    dynamic_price = PricingService.calculate_dynamic_price(base_price, density)
    recommendation = AIService.get_ai_recommendation(place_label)
    vr_videos = MediaService.get_vr_videos(place_label)

    response_data = {
        "name": place_label,
        "location": {"latitude": lat, "longitude": lon},
        "map_url": map_url,
        "crowd_density": density,
        "dynamic_price": dynamic_price,
        "recommendation": recommendation,
        "is_tourist_attraction": True,
        "vr_videos": vr_videos,
        "search_metadata": {
            "confidence": place["properties"].get("confidence", 0.0),
            "search_type": place["properties"].get("search_type", "text"),
            "optimized_search": True
        }
    }

    # Add route information if origin coordinates are provided
    if origin_lat and origin_lon:
        try:
            route_info = RouteService.get_route_distance(
                float(origin_lat), float(origin_lon), lat, lon
            )
            if route_info:
                response_data["route_info"] = route_info
        except (ValueError, TypeError) as e:
            logger.error(f"Error calculating route: {e}")

    return jsonify(response_data)

@travel_bp.route('/route_distance', methods=['GET'])
def route_distance():
    """Calculate route distance between two points."""
    coords = [request.args.get(k) for k in ['origin_lat', 'origin_lon', 'dest_lat', 'dest_lon']]
    
    if not all(coords):
        return jsonify({"error": "All coordinates required"}), 400

    try:
        coords_float = list(map(float, coords))
    except ValueError:
        return jsonify({"error": "Invalid coordinates"}), 400

    result = RouteService.get_route_distance(*coords_float)
    
    if not result:
        return jsonify({"error": "Route calculation failed"}), 404

    return jsonify(result)

@travel_bp.route('/nearby_places', methods=['GET'])
def nearby_places():
    """Get nearby tourist places using optimized spatial indexing."""
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    radius = request.args.get('radius', 25.0)  # Default 25km radius
    user_id = request.args.get('user_id')  # Optional for personalization
    
    if not lat or not lon:
        return jsonify({"error": "Lat and lon required"}), 400

    try:
        lat_val = float(lat)
        lon_val = float(lon)
        radius_val = float(radius)
    except ValueError:
        return jsonify({"error": "Invalid coordinates or radius"}), 400

    # Use optimized nearby search
    nearby_results = OptimizedPlaceService.search_nearby_optimized(
        lat=lat_val, 
        lon=lon_val, 
        radius_km=radius_val,
        limit=15
    )
    
    if nearby_results:
        places = [
            {
                "name": place["name"],
                "categories": [place["category"]],
                "location": {
                    "latitude": place["latitude"], 
                    "longitude": place["longitude"]
                },
                "distance_km": place.get("distance_km"),
                "rating": place.get("rating", 0),
                "relevance_score": place.get("relevance_score", 0)
            }
            for place in nearby_results
        ]
        
        return jsonify({"places": places, "search_type": "optimized_spatial"})
    
    # Fallback to external API
    result = PlaceService.search_nearby_places(lat_val, lon_val)
    
    if not result or "features" not in result:
        return jsonify({"places": []}), 200

    places = [
        {
            "name": feat["properties"]["name"],
            "categories": feat["properties"]["categories"],
            "location": {
                "latitude": feat["properties"]["lat"], 
                "longitude": feat["properties"]["lon"]
            },
            "search_type": "external_api"
        }
        for feat in result["features"]
    ]
    
    return jsonify({"places": places})


@travel_bp.route('/check_activity', methods=['GET'])
def check_activity():
    """Analyze crowd activity around the provided coordinates."""
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if lat is None or lon is None:
        return jsonify({
            "status": "error",
            "message": "Lat and lon query parameters are required"
        }), 400

    try:
        lat_val = float(lat)
        lon_val = float(lon)
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Invalid coordinate format"
        }), 400

    try:
        result = CrowdActivityService.analyze_crowd_activity(lat_val, lon_val)
        return jsonify(result)
    except RuntimeError as exc:
        logger.error("Crowd activity configuration error: %s", exc)
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 503
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Crowd activity analysis failed: %s", exc, exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Crowd density analysis failed",
            "error_details": str(exc)
        }), 500

@travel_bp.route('/book', methods=['POST'])
def book_ticket():
    """Book a ticket for a tourist place and generate QR code with interaction tracking."""
    data = request.get_json()
    place_name = data.get('place')
    user_name = data.get('user_name')
    user_id = data.get('user_id')  # Optional for recommendation learning
    
    if not place_name or not user_name:
        return jsonify({"error": "Missing place or user name"}), 400

    # Verify the place exists and is a tourist attraction
    place_info = PlaceService.search_tourist_place(place_name)
    
    if not place_info or "features" not in place_info or not place_info["features"]:
        return jsonify({"error": "Place not found"}), 404

    place = place_info["features"][0]
    place_label = place["properties"].get("name", place["properties"]["formatted"])
    
    if not PlaceService.is_tourist_attraction(place_label, place):
        return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

    # Record booking interaction for recommendation learning
    if user_id:
        OptimizedPlaceService.record_user_interaction(user_id, place_label, "book")

    # Generate ticket and QR code
    ticket_id = uuid.uuid4().hex
    qr_data = f"Ticket ID: {ticket_id}, Place: {place_name}, User: {user_name}"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill='black', back_color='white')

    # Save QR code to bytes
    img_io = BytesIO()
    qr_img.save(img_io, 'PNG')
    img_io.seek(0)

    return send_file(
        img_io, 
        mimetype='image/png', 
        as_attachment=True, 
        download_name=f'{ticket_id}_qr.png'
    )

@travel_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Get personalized recommendations for a user."""
    user_id = request.args.get('user_id')
    user_lat = request.args.get('lat')
    user_lon = request.args.get('lon')
    limit = request.args.get('limit', 10)
    
    if not user_id:
        return jsonify({"error": "User ID required for personalized recommendations"}), 400

    try:
        limit = int(limit)
        user_lat_val = float(user_lat) if user_lat else None
        user_lon_val = float(user_lon) if user_lon else None
    except (ValueError, TypeError):
        user_lat_val = user_lon_val = None

    recommendations = OptimizedPlaceService.get_recommendations(
        user_id=user_id,
        user_lat=user_lat_val,
        user_lon=user_lon_val,
        limit=limit
    )
    
    return jsonify({
        "recommendations": recommendations,
        "user_id": user_id,
        "personalized": True,
        "algorithm": "hybrid_recommendation"
    })

@travel_bp.route('/search_performance', methods=['GET'])
def search_performance():
    """Get search engine performance statistics."""
    try:
        from search_optimization import search_engine
        stats = search_engine.get_search_statistics()
        return jsonify({
            "status": "success",
            "performance_stats": stats,
            "optimization_enabled": True
        })
    except Exception as e:
        logger.error(f"Error getting search performance: {e}")
        return jsonify({
            "status": "error",
            "error": str(e),
            "optimization_enabled": False
        }), 500

@travel_bp.route('/user_interaction', methods=['POST'])
def record_interaction():
    """Record user interaction for recommendation learning."""
    data = request.get_json()
    user_id = data.get('user_id')
    place_name = data.get('place_name')
    interaction_type = data.get('interaction_type', 'view')  # view, like, book, search
    
    if not user_id or not place_name:
        return jsonify({"error": "Missing user_id or place_name"}), 400

    try:
        OptimizedPlaceService.record_user_interaction(user_id, place_name, interaction_type)
        return jsonify({
            "status": "success",
            "message": "Interaction recorded for recommendation learning"
        })
    except Exception as e:
        logger.error(f"Error recording interaction: {e}")
        return jsonify({"error": "Failed to record interaction"}), 500

# Health check endpoint for travel services
@travel_bp.route('/travel/health', methods=['GET'])
def travel_health():
    """Health check for travel services with optimization status."""
    try:
        from search_optimization import search_engine
        optimization_status = "enabled"
        search_stats = search_engine.get_search_statistics()
    except Exception as e:
        optimization_status = f"disabled: {str(e)}"
        search_stats = {}
    
    return jsonify({
        "status": "healthy",
        "service": "travel",
        "optimization": optimization_status,
        "search_statistics": search_stats,
        "endpoints": [
            "/api/geocode",
            "/api/reverse_geocode", 
            "/api/autocomplete",
            "/api/search",
            "/api/route_distance",
            "/api/nearby_places",
            "/api/book",
            "/api/recommendations",
            "/api/user_interaction",
            "/api/search_performance"
        ]
    })