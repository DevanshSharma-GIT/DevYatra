# maps_routes.py
from flask import jsonify, request

def register_map_routes(app, search_tourist_place, is_tourist_attraction, generate_map_url, 
                       get_crowd_density, get_ai_recommendation, geocode_address, 
                       reverse_geocode, get_route_distance, search_nearby_places):
    
    @app.route('/autocomplete', methods=['GET'])
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

    @app.route('/search', methods=['GET'])
    def search_place():
        place_name = request.args.get('place')
        if not place_name:
            return jsonify({"error": "Place name required"}), 400

        results = search_tourist_place(place_name)
        if not results or "features" not in results or not results["features"]:
            return jsonify({"error": "No results found"}), 404

        place = results["features"][0]
        place_label = place["properties"].get("name", place["properties"]["formatted"])
        lat, lon = place["properties"]["lat"], place["properties"]["lon"]

        if not is_tourist_attraction(place_label, place):
            return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

        map_url = generate_map_url(lat, lon)
        density = get_crowd_density(place_label)
        base_price = 100
        dynamic_price = round(base_price * (1 + {"High": 0.8, "Medium": 0.5, "Low": 0.2}.get(density, 0.5)), 2)
        recommendation = get_ai_recommendation(place_label)

        return jsonify({
            "name": place_label,
            "location": {"latitude": lat, "longitude": lon},
            "map_url": map_url,
            "crowd_density": density,
            "dynamic_price": dynamic_price,
            "recommendation": recommendation,
            "is_tourist_attraction": True
        })

    @app.route('/geocode', methods=['GET'])
    def geocode():
        address = request.args.get('address')
        if not address:
            return jsonify({"error": "Address required"}), 400

        result = geocode_address(address)
        if not result or "features" not in result or not result["features"]:
            return jsonify({"error": "No results"}), 404

        props = result["features"][0]["properties"]
        return jsonify({
            "address": props["formatted"],
            "latitude": props["lat"],
            "longitude": props["lon"],
            "confidence": props.get("rank", {}).get("confidence", "N/A")
        })

    @app.route('/reverse_geocode', methods=['GET'])
    def reverse_geocode_route():
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        if not lat or not lon:
            return jsonify({"error": "Lat and lon required"}), 400

        result = reverse_geocode(float(lat), float(lon))
        if not result or "features" not in result or not result["features"]:
            return jsonify({"error": "No results"}), 404

        props = result["features"][0]["properties"]
        return jsonify({
            "address": props["formatted"],
            "place_label": props.get("name", props["formatted"])
        })

    @app.route('/route_distance', methods=['GET'])
    def route_distance():
        origin_lat = request.args.get('origin_lat')
        origin_lon = request.args.get('origin_lon')
        dest_lat = request.args.get('dest_lat')
        dest_lon = request.args.get('dest_lon')
        
        if not all([origin_lat, origin_lon, dest_lat, dest_lon]):
            return jsonify({"error": "Origin and destination coordinates are required"}), 400
        
        result = get_route_distance(origin_lat, origin_lon, dest_lat, dest_lon)
        if not result or "routes" not in result:
            return jsonify({"error": "Unable to calculate route"}), 404
        
        car_route = result["routes"]["car"]
        return jsonify({
            "distance": car_route["distance"]["text"],
            "duration": car_route["duration"]["text"]
        })

    @app.route('/nearby_places', methods=['GET'])
    def nearby_places():
        lat = request.args.get('lat')
        lon = request.args.get('lon')
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