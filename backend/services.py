from flask import Flask, jsonify, request
import requests
import os
from flask_cors import CORS
from amadeus import Client, ResponseError
from serpapi.google_search import GoogleSearch
from dotenv import load_dotenv
import logging # Import logging

from travel_services import CrowdActivityService

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Hardcoded API keys
AVIATION_STACK_API_KEY = "bee30a82af53762dd2c11dd7f727d9f5"
AMADEUS_CLIENT_ID = "omfRjhkvayyYmgPXVA07myAi1T6PdOWB"
AMADEUS_CLIENT_SECRET = "fParVSwsFqhq0AZa"
SERPAPI_API_KEY = "ba05376a10d7d0d0d1ebffa9af4c7015134a393b29cf98e49f28462a67eaeab2"

# Validate API keys
if not AVIATION_STACK_API_KEY:
    logger.error("No Aviation Stack API key found. Please set the AVIATION_STACK_API_KEY environment variable.")
    # raise ValueError("No Aviation Stack API key found. Please set the AVIATION_STACK_API_KEY environment variable.") # Optionally raise error
if not AMADEUS_CLIENT_ID or not AMADEUS_CLIENT_SECRET:
    logger.error("No Amadeus API credentials found. Please set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET environment variables.")
    # raise ValueError("No Amadeus API credentials found. Please set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET environment variables.")
if not SERPAPI_API_KEY:
    logger.error("No SerpApi API key found. Please set the SERPAPI_API_KEY environment variable.")
    # raise ValueError("No SerpApi API key found. Please set the SERPAPI_API_KEY environment variable.")


# Initialize Amadeus client only if keys are present
amadeus = None
if AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET:
    try:
        amadeus = Client(
            client_id=AMADEUS_CLIENT_ID,
            client_secret=AMADEUS_CLIENT_SECRET
        )
        logger.info("Amadeus client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Amadeus client: {e}")
else:
    logger.warning("Amadeus client not initialized due to missing credentials.")


# Aviation Stack base URL (using HTTPS)
AVIATION_STACK_BASE_URL = "https://api.aviationstack.com/v1/" # Correctly defined

# Crowd analysis endpoint leveraging shared travel service logic
@app.route('/api/check_activity', methods=['GET'])
def check_activity():
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
        logger.error(f"Crowd activity configuration error: {exc}")
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 503
    except Exception as exc:
        logger.error(f"Crowd activity analysis failed: {exc}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Crowd density analysis failed",
            "error_details": str(exc)
        }), 500

# Endpoint for flights (Aviation Stack)
@app.route('/api/flights', methods=['GET'])
def get_flights():
    if not AVIATION_STACK_API_KEY:
        return jsonify({'error': 'Aviation Stack API key not configured'}), 500
        
    params = {
        'access_key': AVIATION_STACK_API_KEY,
        'limit': request.args.get('limit', 10),
        'offset': request.args.get('offset', 0),
        'dep_iata': request.args.get('dep_iata', ''),
        'arr_iata': request.args.get('arr_iata', '')
    }
    try:
        # Use the correct base URL
        response = requests.get(AVIATION_STACK_BASE_URL + 'flights', params=params, timeout=10)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        
        data = response.json()
        # Check for API-specific errors within the JSON response
        if data.get('error'):
             logger.error(f"Aviation Stack API error: {data['error']}")
             return jsonify({'error': data['error'].get('info', 'Failed to fetch flight data')}), 400 # Use API error message
        
        return jsonify(data)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching flights from Aviation Stack: {e}")
        return jsonify({'error': f'Failed to fetch flight data: {e}'}), 503 # Service Unavailable
    except Exception as e:
        logger.error(f"Unexpected error in get_flights: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


# Endpoint for flight routes (Aviation Stack)
@app.route('/api/routes', methods=['GET'])
def get_routes():
    # Routes endpoint requires paid Aviation Stack plan
    return jsonify({
        'error': 'Routes endpoint requires paid Aviation Stack subscription',
        'message': 'Free tier only includes flights and airlines. Upgrade to access routes.',
        'available_endpoints': ['flights', 'airlines', 'amadeus_flight_search']
    }), 403

# Endpoint for airlines (Aviation Stack)
@app.route('/api/airlines', methods=['GET'])
def get_airlines():
    if not AVIATION_STACK_API_KEY:
        return jsonify({'error': 'Aviation Stack API key not configured'}), 500
        
    params = {
        'access_key': AVIATION_STACK_API_KEY,
        'limit': request.args.get('limit', 10),
        'offset': request.args.get('offset', 0),
        'airline_name': request.args.get('airline_name', '')
    }
    try:
        # Use the correct base URL
        response = requests.get(AVIATION_STACK_BASE_URL + 'airlines', params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data.get('error'):
             logger.error(f"Aviation Stack API error: {data['error']}")
             return jsonify({'error': data['error'].get('info', 'Failed to fetch airline data')}), 400
             
        return jsonify(data)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching airlines from Aviation Stack: {e}")
        return jsonify({'error': f'Failed to fetch airline data: {e}'}), 503
    except Exception as e:
        logger.error(f"Unexpected error in get_airlines: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# Endpoint for Amadeus Flight Offers Search
@app.route('/api/amadeus_flight_search', methods=['GET'])
def amadeus_flight_search():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
        
    origin = request.args.get('origin')
    destination = request.args.get('destination')
    departure_date = request.args.get('departure_date')
    adults = request.args.get('adults', 1)

    if not origin or not destination or not departure_date:
        return jsonify({'error': 'Missing required parameters: origin, destination, departure_date'}), 400

    try:
        response = amadeus.shopping.flight_offers_search.get(
            originLocationCode=origin,
            destinationLocationCode=destination,
            departureDate=departure_date,
            adults=int(adults)
        )
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus flight search error: {error}")
        # Attempt to parse error response for more details
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in amadeus_flight_search: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


# Endpoint for Amadeus Airport & City Search
@app.route('/api/amadeus_location_search', methods=['GET'])
def amadeus_location_search():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
        
    keyword = request.args.get('keyword')
    if not keyword:
        return jsonify({'error': 'Missing required parameter: keyword'}), 400

    try:
        response = amadeus.reference_data.locations.get(keyword=keyword, subType='AIRPORT,CITY')
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus location search error: {error}")
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in amadeus_location_search: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# SerpApi Google Hotels Search Endpoint
@app.route('/api/serpapi_hotel_search', methods=['GET'])
def hotel_search():
    if not SERPAPI_API_KEY:
        return jsonify({'error': 'SerpApi API key not configured'}), 500
        
    try:
        # ... (parameter fetching remains the same) ...
        query = request.args.get('query', 'Paris Hotels')
        check_in_date = request.args.get('check_in_date', '2025-05-01')
        check_out_date = request.args.get('check_out_date', '2025-05-10')
        adults = request.args.get('adults', 2)
        currency = request.args.get('currency', 'USD')

        if not all([query, check_in_date, check_out_date]):
            return jsonify({'error': 'Missing required parameters (query, check_in_date, check_out_date)'}), 400

        params = {
            'api_key': SERPAPI_API_KEY, # Use loaded key
            'engine': 'google_hotels',
            'q': query,
            'check_in_date': check_in_date,
            'check_out_date': check_out_date,
            'adults': adults,
            'currency': currency,
            'hl': 'en',
            'gl': 'us'
        }

        search = GoogleSearch(params)
        response_dict = search.get_dict()
        
        # Check for SerpApi specific errors
        if 'error' in response_dict:
            logger.error(f"SerpApi hotel search error: {response_dict['error']}")
            return jsonify({'error': response_dict['error']}), 400

        hotels = response_dict.get('properties', [])
        return jsonify({'data': hotels})

    except Exception as e:
        logger.error(f"Error during SerpApi hotel search: {e}")
        return jsonify({'error': str(e)}), 500

# ... (rest of the Amadeus endpoints remain largely the same, but add checks for 'amadeus' client initialization and improve logging) ...

# Example for one more Amadeus endpoint:
@app.route('/api/amadeus_activities', methods=['GET'])
def activities():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
        
    try:
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        if not all([latitude, longitude]):
            return jsonify({'error': 'Missing required parameters'}), 400

        response = amadeus.shopping.activities.get(
            latitude=float(latitude), # Ensure float conversion
            longitude=float(longitude)
        )
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus activities error: {error}")
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except ValueError:
         return jsonify({'error': 'Invalid latitude or longitude format'}), 400
    except Exception as e:
        logger.error(f"Unexpected error in activities: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


# ... (Apply similar checks and logging to other Amadeus endpoints: points_of_interest, checkin_links, trip_purpose, car_rental_search, connection_package, transfer_search) ...

# Endpoint for Points of Interest
@app.route('/api/amadeus_points_of_interest', methods=['GET'])
def points_of_interest():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
    try:
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        if not all([latitude, longitude]):
            return jsonify({'error': 'Missing required parameters'}), 400

        response = amadeus.reference_data.locations.points_of_interest.get(
            latitude=float(latitude),
            longitude=float(longitude)
        )
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus POI error: {error}")
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except ValueError:
         return jsonify({'error': 'Invalid latitude or longitude format'}), 400
    except Exception as e:
        logger.error(f"Unexpected error in points_of_interest: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# Endpoint for Flight Check-in Links
@app.route('/api/amadeus_checkin_links', methods=['GET'])
def checkin_links():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
    try:
        airline_code = request.args.get('airline_code')
        if not airline_code:
            return jsonify({'error': 'Airline code is required'}), 400

        response = amadeus.reference_data.urls.checkin_links.get(
            airlineCode=airline_code
        )
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus checkin links error: {error}")
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in checkin_links: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# Endpoint for Trip Purpose Prediction
@app.route('/api/amadeus_trip_purpose', methods=['GET'])
def trip_purpose():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
    try:
        origin = request.args.get('origin')
        destination = request.args.get('destination')
        departure_date = request.args.get('departure_date')
        return_date = request.args.get('return_date')

        if not all([origin, destination, departure_date, return_date]):
            return jsonify({'error': 'Missing required parameters'}), 400

        response = amadeus.travel.predictions.trip_purpose.get(
            originLocationCode=origin,
            destinationLocationCode=destination,
            departureDate=departure_date,
            returnDate=return_date
        )
        return jsonify(response.data)
    except ResponseError as error:
        logger.error(f"Amadeus trip purpose error: {error}")
        try:
            error_details = error.response.result
            return jsonify({'error': 'Amadeus API error', 'details': error_details}), error.response.status_code
        except:
             return jsonify({'error': str(error)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in trip_purpose: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

# Endpoint for Car Rental Search (Simulated)
@app.route('/api/amadeus_car_rental_search', methods=['GET'])
def amadeus_car_rental_search():
    # This endpoint remains simulated as Amadeus SDK might not support it directly
    pickup_location = request.args.get('pickup_location')
    # ... (rest of params) ...
    currency_code = request.args.get('currency_code', 'USD')

    if not pickup_location: # Add checks for other required params
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Placeholder response
        response = {
            'data': [
                {'provider': 'Hertz', 'vehicle': 'Sedan', 'price': {'total': '50.00', 'currency': currency_code}},
                {'provider': 'Avis', 'vehicle': 'SUV', 'price': {'total': '70.00', 'currency': currency_code}}
            ],
            'note': 'This is simulated data. Amadeus Car Rental API might not be available via SDK.'
        }
        return jsonify(response) # Return the whole simulated structure
    except Exception as e: # Keep broad exception for simulation
        logger.error(f"Error in simulated car rental search: {e}")
        return jsonify({'error': str(e)}), 500


# Endpoint for Connection Packages (Flight + Transfer combination)
@app.route('/api/amadeus_connection_package', methods=['GET'])
def amadeus_connection_package():
    if not amadeus:
        return jsonify({'error': 'Amadeus client not initialized'}), 500
        
    origin = request.args.get('origin')
    # ... (rest of params) ...
    currency_code = request.args.get('currency_code', 'USD')

    if not origin: # Add checks for other required params
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Step 1: Search for flights (add error handling)
        try:
            flight_response = amadeus.shopping.flight_offers_search.get(
                originLocationCode=origin,
                # ... other params ...
                currencyCode=currency_code
            )
            flights = flight_response.data
        except ResponseError as flight_error:
             logger.error(f"Amadeus flight search error within connection package: {flight_error}")
             return jsonify({'error': 'Failed to fetch flights for package', 'details': str(flight_error)}), 500

        packages = []
        # ... (rest of the logic for finding transfers) ...
        # Add try-except around transfer search if using a real API
        for flight in flights[:5]:
             # ... existing logic ...
             try:
                 # Assuming amadeus.shopping.transfers.get exists and works
                 # transfer_response = amadeus.shopping.transfers.get(...)
                 # transfers = transfer_response.data
                 # ... combine ...
                 # --- Simulation/Placeholder ---
                 packages.append({'flight': flight, 'transfer': {'provider': 'Simulated Transfer', 'price': {'total': '30.00', 'currency': currency_code}}, 'note': 'Transfer Search simulated'})
                 # --- End Simulation ---
             except AttributeError: # Handle if transfers API doesn't exist in SDK
                 logger.warning("Transfer Search API not available in Amadeus SDK during package creation.")
                 packages.append({'flight': flight, 'transfer': None, 'note': 'Transfer Search not implemented in SDK'})
             except ResponseError as transfer_error:
                 logger.error(f"Amadeus transfer search error within connection package: {transfer_error}")
                 packages.append({'flight': flight, 'transfer': None, 'note': f'Transfer search failed: {transfer_error}'})
             except Exception as e:
                 logger.error(f"Unexpected error during transfer search in package: {e}")
                 packages.append({'flight': flight, 'transfer': None, 'note': 'Unexpected error during transfer search'})


        return jsonify(packages)
    except Exception as e: # Broad exception for the overall function
        logger.error(f"Unexpected error in amadeus_connection_package: {e}")
        return jsonify({'error': 'An unexpected error occurred while creating packages'}), 500

# Endpoint for Transfer Search (Simulated/Placeholder)
@app.route('/api/amadeus_transfer_search', methods=['GET'])
def amadeus_transfer_search():
    # This endpoint remains simulated/placeholder
    pickup_location = request.args.get('pickup_location')
    # ... (rest of params) ...
    currency_code = request.args.get('currency_code', 'USD')

    if not pickup_location: # Add checks for other required params
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Simulate response as the SDK might not have this
        response = {
            'data': [
                {'provider': 'City Shuttle', 'vehicle': 'Van', 'price': {'total': '25.00', 'currency': currency_code}},
            ],
            'note': 'This is simulated data. Amadeus Transfer Search API might not be available via SDK.'
        }
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in simulated transfer search: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Check if keys are loaded before running
    if not all([AVIATION_STACK_API_KEY, AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, SERPAPI_API_KEY]):
         logger.warning("One or more API keys are missing. Some endpoints may not function correctly.")
    app.run(debug=True, port=5001)  # Run travel services on port 5001