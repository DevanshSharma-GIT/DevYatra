import json
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import StructuredOutputParser, ResponseSchema
from langchain_core.tools import tool
import requests
from requests.exceptions import RequestException
from datetime import datetime
import pytz
import math
import sys

# Mock vector search implementation
class VectorSearch:
    def query_destinations(self, query):
        return ["Paris, France", "Tokyo, Japan", "New York, USA"]
    
    def get_travel_context(self, query):
        return {"relevant_info": "Travel context for " + query}

vector_search = VectorSearch()

load_dotenv()

def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value.strip() # Added .strip()

def validate_api_key(api_name, api_key, test_url=None, test_function=None):
    """Validate an API key by making a test request or using a test function"""
    try:
        if test_function:
            return test_function(api_key)
        elif test_url:
            response = requests.get(test_url, timeout=5)
            return response.status_code == 200
        return True  # If no validation method provided, assume valid
    except Exception as e:
        print(f"Failed to validate {api_name} API key: {str(e)}")
        return False

def test_groq_key(api_key):
    """Test if Groq API key is valid"""
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        response = requests.get("https://api.groq.com/v1/models", headers=headers, timeout=5)
        return response.status_code == 200
    except Exception:
        return False

# Initialize API keys with proper validation
try:
    # Get API keys from environment variables
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
    
    # Validate API keys
    if not validate_api_key("Groq", GROQ_API_KEY, test_function=test_groq_key):
        print("Warning: Groq API key validation failed. The service may not work correctly.")
    
    if not validate_api_key("Weather", WEATHER_API_KEY, 
                          test_url=f"http://api.openweathermap.org/data/2.5/weather?q=London&appid={WEATHER_API_KEY}"):
        print("Warning: Weather API key validation failed. Weather features may not work correctly.")
    
    # Use a placeholder key for exchange rate API - this service has a free tier that doesn't require authentication
    EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
    
except ValueError as e:
    print(f"Configuration error: {str(e)}")
    print("Please ensure you have a valid .env file with GROQ_API_KEY and WEATHER_API_KEY.")
    sys.exit(1)

# Create LLM with better error handling
try:
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7, api_key=GROQ_API_KEY)
except Exception as e:
    print(f"Error initializing language model: {str(e)}")
    print("Please check your Groq API key and internet connection.")
    sys.exit(1)

# ===================== Tools ========================
@tool("Currency Conversion")
def convert_currency(amount: float, from_currency: str, to_currency: str) -> dict:
    """Convert amount from one currency to another."""
    try:
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        response = requests.get(url, timeout=5).json()
        if "rates" not in response:
            return {"error": "Currency conversion failed"}
        rate = response["rates"].get(to_currency, 1)
        converted_amount = amount * rate
        return {"converted_amount": round(converted_amount, 2), "to_currency": to_currency}
    except Exception as e:
        return {"error": f"Currency conversion error: {str(e)}"}

@tool("Travel Duration Calculator")
def calculate_travel_duration(start: str, end: str) -> dict:
    """Estimate travel time between two locations (mock distances)."""
    distances = {
        ("Paris, France", "Tokyo, Japan"): 9700,
        ("Paris, France", "New York, USA"): 5800,
        ("Tokyo, Japan", "New York, USA"): 10800
    }
    distance = distances.get((start, end), distances.get((end, start), 5000))
    speed = 800  # Average plane speed in km/h
    hours = distance / speed
    return {"duration": f"{int(hours)}h {int((hours % 1) * 60)}m"}

@tool("Local Time Checker")
def get_local_time(location: str) -> dict:
    """Get current local time at a location."""
    try:
        timezone_map = {
            "Paris, France": "Europe/Paris",
            "Tokyo, Japan": "Asia/Tokyo",
            "New York, USA": "America/New_York"
        }
        tz_name = timezone_map.get(location, "UTC")
        tz = pytz.timezone(tz_name)
        local_time = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
        return {"local_time": local_time, "timezone": tz_name}
    except Exception as e:
        return {"error": f"Time error: {str(e)}"}

@tool("Weather Information")
def get_weather(location: str) -> dict:
    """Get current weather and forecast for a location."""
    try:
        if not location or not isinstance(location, str):
            return {"error": "Invalid location provided"}
        current_url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={WEATHER_API_KEY}&units=metric"
        current_response = requests.get(current_url, timeout=5)
        current_response.raise_for_status()
        current_data = current_response.json()
        if current_data["cod"] != 200:
            return {"error": f"Weather API error: {current_data.get('message', 'Unknown error')}"}
        forecast_url = f"http://api.openweathermap.org/data/2.5/forecast?q={location}&appid={WEATHER_API_KEY}&units=metric"
        forecast_response = requests.get(forecast_url, timeout=5)
        forecast_response.raise_for_status()
        forecast_data = forecast_response.json()
        daily_forecast = []
        for i in range(0, 40, 8):
            if i < len(forecast_data["list"]):
                forecast = forecast_data["list"][i]
                daily_forecast.append(
                    f"{forecast['dt_txt'][:10]}: {forecast['main']['temp']}°C, {forecast['weather'][0]['description']}"
                )
        return {
            "location": location,
            "temperature": current_data["main"]["temp"],
            "condition": current_data["weather"][0]["description"],
            "humidity": current_data["main"]["humidity"],
            "wind_speed": current_data["wind"]["speed"],
            "forecast": "; ".join(daily_forecast)
        }
    except RequestException as e:
        return {"error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}

@tool("Destination Matcher")
def match_destination(user_prefs: str) -> dict:
    """Match user preferences with ideal travel destinations."""
    destinations = vector_search.query_destinations(user_prefs)
    prompt = ChatPromptTemplate.from_template("""
    Analyze user travel preferences and match with ideal destinations:
    User Preferences: {user_prefs}
    Available Destinations: {destinations}
    Response Format: {format_instructions}
    """).format(
        user_prefs=user_prefs,
        destinations=destinations,
        format_instructions=destination_parser.get_format_instructions()
    )
    response = llm.invoke(prompt)
    return destination_parser.parse(response.content)

destination_match_schema = [
    ResponseSchema(name="destination", description="Recommended destination name"),
    ResponseSchema(name="match_score", description="Matching score out of 100"),
    ResponseSchema(name="reason", description="Reason for recommendation"),
    ResponseSchema(name="best_season", description="Recommended travel months"),
    ResponseSchema(name="price_range", description="Estimated cost range"),
]

destination_parser = StructuredOutputParser.from_response_schemas(destination_match_schema)

travel_response_schemas = [
    ResponseSchema(name="response", description="Main response to user query"),
    ResponseSchema(name="destination", description="Recommended destination"),
    ResponseSchema(name="price_range", description="Estimated cost range"),
    ResponseSchema(name="itinerary", description="Suggested travel plan"),
    ResponseSchema(name="travel_tips", description="Location-specific advice"),
    ResponseSchema(name="local_time", description="Current local time at destination"),
    ResponseSchema(name="travel_duration", description="Estimated travel time"),
    ResponseSchema(name="cultural_highlights", description="Cultural insights"),
    ResponseSchema(name="packing_suggestions", description="Packing tips"),
    ResponseSchema(name="tool_call", description="Which tool to use if needed"),
    ResponseSchema(name="tool_params", description="Parameters for tool call"),
]

travel_parser = StructuredOutputParser.from_response_schemas(travel_response_schemas)

# Update travel prompt to handle numeric budget and provide more context
travel_prompt = ChatPromptTemplate.from_template("""
You are HeritEdge - Edge to lost heritage. Speak in user's preferred language.

*Guidelines:*
1. Focus on personalized travel planning
2. Consider these user preferences in detail: {{
   - Budget: {budget} (in {currency}, numeric value)
   - Group: {group_size} {group_type}
   - Preferences: {interests}
   - Dates: {travel_dates}
   - Currency: {currency}
   - Home Location: {home_location}
}}
3. Support indic languages
4. Maintain friendly/professional tone
5. Include current local time, cultural info, and packing tips when relevant
6. Provide specific recommendations that match the exact budget amount

*Travel Profile:*
{user_profile}

*Location Context:*
- For Indian destinations, emphasize cultural heritage and historical significance
- Suggest authentic local experiences based on the user's interests
- If the budget is under 20000 {currency}, focus on budget-friendly options
- If the budget is over 50000 {currency}, include premium experiences
Blue Flag Beaches in India - List
Puri Beach, located on the Konark coast of Odisha, became Asia’s first beach to get the blue flag certificate.

As of October 2022, 12 beaches in India have been awarded this prestigious certification, namely:

Golden Beach – Odisha
Shivrajpur Beach – Gujarat
Kappad Beach – Kerala
Ghoghla Beach – Diu
Radhanagar Beach – Andaman and Nicobar
Kasarkod Beach – Karnataka
Padubidri Beach – Karnataka
Rushikonda Beach – Andhra Pradesh
Kovalam Beach – Tamil Nadu
Eden Beach – Puducherry
Minicoy Thundi Beach – Lakshwadeep
Kadmat Beach – Lakshadweep
*Current Query:* {query}

*Response Format:*
{format_instructions}
""")

travel_chain = travel_prompt | llm | travel_parser

def process_travel_query(query: str, user_profile: dict, extra_context: str = None):
    """Handle travel query with enhanced features and optional extra context"""
    try:
        travel_context = vector_search.get_travel_context(query)
        
        # Extract user's preferred destination
        user_preferred_destination = user_profile.get("default_location", "Paris, France")
        
        # Process budget as numeric value if possible
        try:
            budget = user_profile.get("budget", "medium")
            # If it's not already a number, try to convert legacy values
            if isinstance(budget, str) and budget.lower() in ["low", "medium", "high"]:
                budget_map = {"low": "15000", "medium": "30000", "high": "80000"}
                user_profile["budget"] = budget_map.get(budget.lower(), "30000")
        except:
            # Keep existing value if conversion fails
            pass
        
        # Add explicit destination preference to the query context
        enhanced_query = f"Consider that my preferred destination is {user_preferred_destination} with a budget of {user_profile.get('budget')} {user_profile.get('currency', 'USD')}. {query}"
        
        # Add seasonal considerations based on travel dates
        if "travel_dates" in user_profile and user_profile["travel_dates"] not in ["flexible", ""]:
            enhanced_query += f" Also consider seasonal factors for traveling in {user_profile['travel_dates']}."
        
        # Inject extra context if provided (e.g., safety map context)
        if extra_context:
            enhanced_query += f"\n\n[Safety Map Context]\n{extra_context}\n"
        
        chain_input = {
            "query": enhanced_query,  # Use enhanced query that includes location preference
            "user_profile": json.dumps(user_profile),
            "format_instructions": travel_parser.get_format_instructions(),
            **user_profile
        }
        
        # Add error handling for LLM call
        try:
            parsed_response = travel_chain.invoke(chain_input)
        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg or "invalid_api_key" in error_msg:
                return {
                    "response": {
                        "response": "I'm having trouble connecting to my knowledge source. Please check your API key configuration.",
                        "error": f"API authentication error: {error_msg}"
                    }, 
                    "context": {}
                }
            else:
                return {
                    "response": {
                        "response": "I encountered an error processing your request. Let's try again.",
                        "error": f"Processing error: {error_msg}"
                    },
                    "context": {}
                }
        
        # Explicitly check if user is asking about a specific different location
        query_contains_location = any(loc.lower() in query.lower() for loc in 
                                    ["delhi", "mumbai", "chennai", "kolkata", "lucknow", "agra", "jaipur"])
        query_explicitly_mentions_location = any(phrase in query.lower() for phrase in
                                  ["in ", "at ", "about ", "visit ", "traveling to ", "going to "])
        
        # Determine if we should override the default location
        should_override_default = (query_contains_location and query_explicitly_mentions_location) or \
                                 (parsed_response.get("destination") and query_explicitly_mentions_location)
        
        # If user is specifically asking about another place, use that destination
        # Otherwise, respect their preferred destination
        if should_override_default:
            location = parsed_response.get("destination", "")
        else:
            # Strongly prefer the user's default location
            location = user_preferred_destination
            # Update the response to use the preferred destination
            if parsed_response.get("destination") and parsed_response.get("destination") != location:
                parsed_response["destination"] = location
        
        # If we have a location (either from response or default), fetch additional details
        if location:
            # Local Time
            time_data = get_local_time.invoke(location)
            if "error" not in time_data:
                parsed_response["local_time"] = f"Current Local Time: {time_data['local_time']} ({time_data['timezone']})"

            # Budget alignment checks
            if parsed_response["price_range"]:
                try:
                    amount = float(parsed_response["price_range"].split("-")[0].replace("$", "").replace(",", ""))
                    user_budget = float(user_profile.get("budget").replace(",", "")) if isinstance(user_profile.get("budget"), str) else float(user_profile.get("budget", 30000))
                    
                    if amount > user_budget * 1.2:
                        parsed_response["price_range"] += f" (Warning: This exceeds your budget of {user_profile.get('budget')} {user_profile.get('currency', 'USD')})"
                    elif amount < user_budget * 0.7:
                        parsed_response["price_range"] += f" (Note: This is well within your budget of {user_profile.get('budget')} {user_profile.get('currency', 'USD')})"
                except Exception:
                    pass

            # Travel Duration
            home = user_profile.get("home_location", "New York, USA")
            duration_data = calculate_travel_duration.invoke({"start": home, "end": location})
            parsed_response["travel_duration"] = f"Estimated Travel Time from {home}: {duration_data['duration']}"

            # Cultural Highlights (mock data)
            cultural_map = {
                "Paris, France": "Visit the Louvre, enjoy croissants, explore Notre-Dame",
                "Tokyo, Japan": "Experience sushi culture, visit temples, see cherry blossoms",
                "New York, USA": "See the Statue of Liberty, Broadway shows, diverse cuisine"
            }
            parsed_response["cultural_highlights"] = cultural_map.get(location, "Rich cultural experiences await")

        if parsed_response["tool_call"]:
            tool_result = execute_travel_tool(parsed_response["tool_call"], parsed_response["tool_params"])
            parsed_response.update(tool_result)
        
        return {"response": parsed_response, "context": travel_context}
    except Exception as e:
        return {
            "response": {
                "response": "Sorry, I encountered an unexpected error. Please try again with a different question.",
                "error": str(e)
            },
            "context": {}
        }

def execute_travel_tool(tool_name: str, params: dict):
    """Execute travel-specific tools"""
    tools = {
        "destination_matcher": match_destination,
        "weather_checker": get_weather,
        "currency_converter": convert_currency,
        "travel_duration_calculator": calculate_travel_duration,
        "local_time_checker": get_local_time
    }
    if tool_name in tools:
        try:
            return tools[tool_name].invoke(params)  # Updated to use invoke
        except Exception as e:
            return {"error": f"Tool execution error: {str(e)}"}
    return {"error": "Unknown tool"}

if __name__ == "__main__":
    print("Welcome to HeritEdge Travel Assistant!")
    print("Type 'exit' or 'quit' to end the conversation.\n")
    
    user_profile = {
        "budget": "30000",  # Changed from "medium" to numeric value
        "group_size": "2",
        "group_type": "couple",
        "interests": "culture, food, sightseeing",
        "travel_dates": "flexible",
        "default_location": "Paris, France",
        "currency": "USD",
        "home_location": "New York, USA"
    }
    
    customize = input("Would you like to customize your travel profile? (yes/no): ").lower()
    if customize.startswith('y'):
        user_profile["budget"] = input("Budget (numeric value, e.g. 30000): ")  # Updated prompt
        user_profile["group_size"] = input("Group size (number): ")
        user_profile["group_type"] = input("Group type (solo/couple/family/friends): ")
        user_profile["interests"] = input("Interests (comma separated): ")
        user_profile["travel_dates"] = input("Travel dates: ")
        user_profile["default_location"] = input("Default location (city, country): ")
        user_profile["currency"] = input("Preferred currency (e.g., USD, EUR, JPY): ")
        user_profile["home_location"] = input("Home location (city, country): ")
    
    print("\nYou can now start chatting with the travel assistant!")
    
    while True:
        user_input = input("\nYou: ")
        
        if user_input.lower() in ['exit', 'quit']:
            print("Thank you for using HetridgeAI Travel Assistant. Goodbye!")
            break
            
        try:
            result = process_travel_query(user_input, user_profile)
            response = result['response']
            
            # Check if there was an error
            if "error" in response:
                print(f"\nHetridgeAI: {response['response']}")
                print(f"Error details: {response['error']}")
                continue
                
            print(f"\nHetridgeAI: {response['response']}")
            
            if response.get('destination'):
                print(f"\nRecommended Destination: {response['destination']}")
            if response.get('price_range'):
                print(f"Price Range: {response['price_range']}")
            if response.get('travel_duration'):
                print(f"Travel Duration: {response['travel_duration']}")
            if response.get('local_time'):
                print(f"Local Time: {response['local_time']}")
            if response.get('cultural_highlights'):
                print(f"\nCultural Highlights: {response['cultural_highlights']}")
            if response.get('packing_suggestions'):
                print(f"Packing Suggestions: {response['packing_suggestions']}")
            if response.get('travel_tips'):
                print(f"\nTravel Tips: {response['travel_tips']}")
                
        except Exception as e:
            print(f"\nSorry, I encountered an error: {str(e)}")
            print("Let's try again with a different question.")