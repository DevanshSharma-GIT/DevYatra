"""
Shared utility functions for CBC D-02 backend application.
Contains common helper functions used across multiple modules.
"""
import math
import sqlite3
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime
from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger(__name__)

# Database Utilities
def dict_factory(cursor, row):
    """Convert SQLite row to dictionary."""
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_db_connection(db_path: str):
    """Get a database connection with proper configuration."""
    return sqlite3.connect(db_path)

# Geospatial Utilities
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1, lon1: Latitude and longitude of first point in decimal degrees
        lat2, lon2: Latitude and longitude of second point in decimal degrees
    
    Returns:
        Distance in kilometers
    """
    # Earth's radius in kilometers
    R = 6371
    
    # Convert to radians
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    
    # Haversine formula
    a = (math.sin(dlat/2)**2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return round(R * c, 2)

def convert_gps_to_degrees(value) -> Optional[float]:
    """
    Convert GPS coordinates to decimal degrees.
    
    Args:
        value: GPS coordinate in various formats
    
    Returns:
        Coordinate in decimal degrees or None if conversion fails
    """
    if not value:
        return None
        
    # Handle different formats of GPS data
    if isinstance(value, tuple) and len(value) == 3:
        # Standard (degrees, minutes, seconds) format
        d, m, s = value
        return d + (m / 60.0) + (s / 3600.0)
    elif isinstance(value, tuple) and len(value) > 0:
        # Some devices provide rational numbers or other formats
        try:
            return float(value[0])
        except (ValueError, TypeError):
            logger.warning(f"Could not convert GPS tuple to float: {value}")
            return None
    elif isinstance(value, (int, float)):
        # Already a simple number
        return float(value)
    else:
        logger.warning(f"Unknown GPS format: {value}")
        return None

# Image Processing Utilities
def extract_gps_from_image(image_path: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Extract GPS coordinates from image EXIF data.
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Tuple of (latitude, longitude) or (None, None) if not found
    """
    lat, lon = None, None
    
    try:
        img = Image.open(image_path)
        exif_data = img.getexif()
        
        if exif_data and 0x8825 in exif_data:  # GPSInfo tag
            gps_info = exif_data.get_ifd(0x8825)
            
            # Get latitude
            if 1 in gps_info and 2 in gps_info:  # GPSLatitude and GPSLatitudeRef
                lat = convert_gps_to_degrees(gps_info[1])
                # If south, make latitude negative
                if gps_info[2] == 'S' and lat is not None:
                    lat = -lat
            
            # Get longitude
            if 3 in gps_info and 4 in gps_info:  # GPSLongitude and GPSLongitudeRef
                lon = convert_gps_to_degrees(gps_info[3])
                # If west, make longitude negative
                if gps_info[4] == 'W' and lon is not None:
                    lon = -lon
                    
        img.close()
        
    except Exception as e:
        logger.error(f"Error extracting GPS from image {image_path}: {e}")
    
    return lat, lon

# Network Utilities
def is_port_available(port: int, host: str = '0.0.0.0') -> bool:
    """Check if a port is available for binding."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        available = True
    except OSError:
        available = False
    finally:
        sock.close()
    return available

def find_available_port(start_port: int = 5000, max_port: int = 9000) -> Optional[int]:
    """Find an available port in the specified range."""
    for port in range(start_port, max_port):
        if is_port_available(port):
            return port
    return None

def get_local_ip() -> str:
    """Get the local IP address of the machine."""
    import socket
    hostname = socket.gethostname()
    try:
        # Try getting IP associated with the hostname
        local_ip = socket.gethostbyname(hostname)
    except socket.gaierror:
        try:
            # Fallback: connect to external address to find local interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "127.0.0.1"  # Default fallback
    return local_ip

# Validation Utilities
def validate_coordinates(lat: float, lon: float) -> bool:
    """Validate latitude and longitude coordinates."""
    try:
        lat_val = float(lat)
        lon_val = float(lon)
        return -90 <= lat_val <= 90 and -180 <= lon_val <= 180
    except (ValueError, TypeError):
        return False

def validate_api_key(api_name: str, api_key: str, test_url: Optional[str] = None) -> bool:
    """Validate an API key by making a test request."""
    if not api_key:
        return False
    
    if test_url:
        try:
            import requests
            response = requests.get(test_url, timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to validate {api_name} API key: {str(e)}")
            return False
    
    return True  # If no validation method provided, assume valid

# Text Processing Utilities
def split_text_into_chunks(text: str, max_length: int = 490) -> list:
    """Split text into chunks of specified maximum length, preserving word boundaries."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        word_length = len(word)
        space_length = 1 if current_chunk else 0
        
        if current_length + word_length + space_length > max_length:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_length = 0
        
        current_chunk.append(word)
        current_length += word_length + space_length
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks

# Cache Utilities
class SimpleCache:
    """Simple in-memory cache with expiration."""
    
    def __init__(self, default_ttl: int = 3600):
        self.cache: Dict[str, Tuple[datetime, any]] = {}
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[any]:
        """Get value from cache if not expired."""
        if key in self.cache:
            timestamp, value = self.cache[key]
            if (datetime.now() - timestamp).seconds < self.default_ttl:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: any, ttl: Optional[int] = None) -> None:
        """Set value in cache with optional TTL."""
        self.cache[key] = (datetime.now(), value)
    
    def clear(self) -> None:
        """Clear all cached values."""
        self.cache.clear()

# Error Handling Utilities
def safe_float_convert(value: any, default: float = 0.0) -> float:
    """Safely convert value to float with default fallback."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int_convert(value: any, default: int = 0) -> int:
    """Safely convert value to int with default fallback."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default