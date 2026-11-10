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
    return value

try:
    # Load GROQ_API_KEY from environment variable
    GROQ_API_KEY = get_required_env("GROQ_API_KEY")
    WEATHER_API_KEY = get_required_env("WEATHER_API_KEY") # Assuming this is also required
    EXCHANGE_RATE_API_KEY = get_required_env("EXCHANGE_RATE_API_KEY") # Assuming this is also required
except ValueError as e:
    print(f"Configuration error: {str(e)}")
    raise

llm = ChatGroq(model="llama3-70b-8192", temperature=0.3, api_key=GROQ_API_KEY)

# ===================== Tools ========================
@tool
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

@tool
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

@tool
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

@tool
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

@tool
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
    ResponseSchema(name="weather_report", description="Current weather information"),
    ResponseSchema(name="local_time", description="Current local time at destination"),
    ResponseSchema(name="currency_conversion", description="Cost in user's currency"),
    ResponseSchema(name="travel_duration", description="Estimated travel time"),
    ResponseSchema(name="cultural_highlights", description="Cultural insights"),
    ResponseSchema(name="packing_suggestions", description="Packing tips"),
    ResponseSchema(name="tool_call", description="Which tool to use if needed"),
    ResponseSchema(name="tool_params", description="Parameters for tool call"),
]

travel_parser = StructuredOutputParser.from_response_schemas(travel_response_schemas)

travel_prompt = ChatPromptTemplate.from_template("""
You are HeritEdge - Edge to lost heritage. Speak in user's preferred language.

*Guidelines:*
1. Focus on personalized travel planning
2. Consider: {{
   - Budget: {budget}
   - Group: {group_size} {group_type}
   - Preferences: {interests}
   - Dates: {travel_dates}
   - Currency: {currency}
   - Home Location: {home_location}
}}
3. Support indic languages 
4. Maintain friendly/professional tone
5. Include weather, time, cultural info, and packing tips when relevant

*Travel Profile:*
{user_profile}

*Current Query:* {query}

*Response Format:*
{format_instructions}
""")

travel_chain = travel_prompt | llm | travel_parser

def process_travel_query(query: str, user_profile: dict):
    """Handle travel query with enhanced features"""
    travel_context = vector_search.get_travel_context(query)
    
    chain_input = {
        "query": query,
        "user_profile": json.dumps(user_profile),
        "format_instructions": travel_parser.get_format_instructions(),
        **user_profile
    }
    
    parsed_response = travel_chain.invoke(chain_input)
    
    if parsed_response["destination"] or "weather" in query.lower():
        location = parsed_response["destination"] or user_profile.get("default_location", "Paris, France")
        
        # Weather
        weather_data = get_weather.invoke(location)  # Updated to use invoke
        if "error" not in weather_data:
            parsed_response["weather_report"] = (
                f"Current Weather in {weather_data['location']}: {weather_data['temperature']}°C, "
                f"{weather_data['condition']}, Humidity: {weather_data['humidity']}%, "
                f"Wind: {weather_data['wind_speed']} m/s\n"
                f"5-day Forecast: {weather_data['forecast']}"
            )
            temp = weather_data["temperature"]
            parsed_response["packing_suggestions"] = (
                "Light clothing and sunscreen" if temp > 25 else
                "Warm layers and a jacket" if temp < 15 else
                "Comfortable clothing with a light jacket"
            )
        else:
            parsed_response["weather_report"] = f"Weather data unavailable: {weather_data['error']}"

        # Local Time
        time_data = get_local_time.invoke(location)  # Updated to use invoke
        if "error" not in time_data:
            parsed_response["local_time"] = f"Current Local Time: {time_data['local_time']} ({time_data['timezone']})"

        # Currency Conversion
        if parsed_response["price_range"]:
            try:
                amount = float(parsed_response["price_range"].split("-")[0].replace("$", "").replace(",", ""))
                currency_data = convert_currency.invoke({"amount": amount, "from_currency": "USD", "to_currency": user_profile.get("currency", "USD")})
                if "error" not in currency_data:
                    parsed_response["currency_conversion"] = (
                        f"Estimated Cost in {currency_data['to_currency']}: {currency_data['converted_amount']}"
                    )
            except Exception as e:
                parsed_response["currency_conversion"] = f"Currency conversion failed: {str(e)}"

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
    print("Welcome to HetridgeAI Travel Assistant!")
    print("Type 'exit' or 'quit' to end the conversation.\n")
    
    user_profile = {
        "budget": "medium",
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
        user_profile["budget"] = input("Budget (low/medium/high): ")
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
            print(f"\nHetridgeAI: {response['response']}")
            
            if response.get('destination'):
                print(f"\nRecommended Destination: {response['destination']}")
            if response.get('price_range'):
                print(f"Price Range: {response['price_range']}")
            if response.get('currency_conversion'):
                print(f"Converted Cost: {response['currency_conversion']}")
            if response.get('travel_duration'):
                print(f"Travel Duration: {response['travel_duration']}")
            if response.get('weather_report'):
                print(f"\nWeather Report: {response['weather_report']}")
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
