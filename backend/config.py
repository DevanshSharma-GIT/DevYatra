"""
Shared configuration module for CBC D-02 backend application.
Centralizes all environment variables, API keys, and configuration settings.
"""
import os
import logging
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Config:
    """Central configuration class for all application settings."""
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    
    # Database Configuration
    DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
    CROWDSOURCE_DB_PATH = os.path.join(os.path.dirname(__file__), 'crowdsource.db')
    CARBON_DB_PATH = os.path.join(os.path.dirname(__file__), 'carbon_footprint.db')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///nativechat.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # API Keys - Core Services
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
    MAPQUEST_API_KEY = os.getenv("MAPQUEST_API_KEY")
    
    # API Keys - Travel Services
    AMADEUS_CLIENT_ID = os.getenv("AMADEUS_CLIENT_ID")
    AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_CLIENT_SECRET")
    AVIATION_STACK_API_KEY = os.getenv("AVIATION_STACK_API_KEY")
    SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
    
    # API Keys - Location and Weather
    RADAR_PUBLISHABLE_KEY = os.getenv("RADAR_PUBLISHABLE_KEY")
    RADAR_LIVE_KEY = os.getenv("RADAR_LIVE_KEY")
    WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
    EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY")

    # Emergency Communications (Twilio)
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_SMS_FROM_NUMBER = os.getenv("TWILIO_SMS_FROM_NUMBER")
    TWILIO_WHATSAPP_FROM_NUMBER = os.getenv("TWILIO_WHATSAPP_FROM_NUMBER")
    TWILIO_VOICE_FROM_NUMBER = os.getenv("TWILIO_VOICE_FROM_NUMBER", TWILIO_SMS_FROM_NUMBER)
    TWILIO_ALERT_SMS_TO = os.getenv("TWILIO_ALERT_SMS_TO")
    TWILIO_ALERT_WHATSAPP_TO = os.getenv("TWILIO_ALERT_WHATSAPP_TO")
    TWILIO_ALERT_CALL_TO = os.getenv("TWILIO_ALERT_CALL_TO")
    
    # API Keys - AI and Translation
    SARVAM_API_KEY = 'sk_53lmvyuc_2qTf7adNVnqM3mkncgrH5pFT'
    SARVAM_API_URL = 'https://api.sarvam.ai/translate'
    
    # API Keys - Storage and Media
    PINATA_JWT = os.getenv("PINATA_JWT")
    
    # Constants
    SEARCH_RADIUS = 500  # Radius in meters for crowd density search
    ACTIVITY_WINDOW = 30  # Time window in minutes for active users
    
    # Carbon Footprint Constants
    CARBON_EMISSION_FACTORS = {
        "flight": 0.158,
        "car": 0.120,
        "train": 0.041
    }
    
    # Airport Coordinates for Carbon Footprint Calculations
    AIRPORT_COORDINATES = {
        # International Airports
        "JFK": (40.6413, -73.7781), "LAX": (33.9416, -118.4085), "LHR": (51.4700, -0.4543),
        "CDG": (49.0097, 2.5479), "SFO": (37.6213, -122.3790), "DXB": (25.2532, 55.3657), 
        "AMS": (52.3105, 4.7683), "SIN": (1.3644, 103.9915),
        
        # Major Indian Airports
        "DEL": (28.5562, 77.1000),  # Delhi - Indira Gandhi International
        "BOM": (19.0896, 72.8656),  # Mumbai - Chhatrapati Shivaji Maharaj International
        "BLR": (13.1986, 77.7066),  # Bangalore - Kempegowda International
        "MAA": (12.9941, 80.1709),  # Chennai - Chennai International
        "CCU": (22.6549, 88.4467),  # Kolkata - Netaji Subhas Chandra Bose International
        "HYD": (17.2313, 78.4298),  # Hyderabad - Rajiv Gandhi International
        "AMD": (23.0775, 72.6347),  # Ahmedabad - Sardar Vallabhbhai Patel International
        "COK": (10.1520, 76.4019),  # Kochi - Cochin International
        "GOI": (15.3808, 73.8313),  # Goa - Dabolim Airport
        "PNQ": (18.5822, 73.9197),  # Pune - Pune Airport
        "JAI": (26.8242, 75.8122),  # Jaipur - Jaipur International
        "TRV": (8.4821, 76.9200)    # Thiruvananthapuram - Trivandrum International
    }
    
    @classmethod
    def validate_api_keys(cls) -> list:
        """Validate essential API keys and return list of missing keys."""
        essential_keys = {
            "GROQ_API_KEY": cls.GROQ_API_KEY,
            "GEOAPIFY_API_KEY": cls.GEOAPIFY_API_KEY,
        }
        
        missing_keys = [name for name, key in essential_keys.items() if not key]
        
        if missing_keys:
            logger.error(f"Missing essential environment variables: {', '.join(missing_keys)}")
        else:
            logger.info("All essential API keys are configured")
            
        return missing_keys
    
    @classmethod
    def get_api_key(cls, key_name: str) -> Optional[str]:
        """Safely get an API key with logging."""
        key = getattr(cls, key_name, None)
        if not key:
            logger.warning(f"API key {key_name} is not configured")
        return key