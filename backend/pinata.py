import os
from flask import Flask, jsonify, request
import uuid
from PIL import Image
import requests
import logging
from flask_cors import CORS  # Add CORS support

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Pinata JWT from environment variable
PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjOWQyOWRkYy04YzY2LTQzMDUtYjdhOC1lMTAzMWVjY2RlMDEiLCJlbWFpbCI6ImdlbmVyYWxrYWFhaUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiNTZmYzdkNzQzNWQxNjRhZWZmODgiLCJzY29wZWRLZXlTZWNyZXQiOiI5OTJhYzYzZmZlMDY5NmUzMGRkMmFjYzIzNWVlYzk4NWRhYmYwYTM4NTI3MjJlMzFiYjkyMTBjYTExODQ5YTBiIiwiZXhwIjoxNzc4NDIwNzAzfQ.8Ym-LvWteSeh_kb0z79Y-VZ5QuR4D22oFBsu3WxaHNM"
if not PINATA_JWT:
    raise ValueError("PINATA_JWT not set in environment variables")

# In-memory storage for metadata
image_metadata = {}

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Placeholder for GPS conversion (simplified for this example)
def convert_to_degrees(value):
    return float(value) if value else 0.0

# Add health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        # Simple check to see if Pinata is accessible
        url = "https://api.pinata.cloud/data/testAuthentication"
        headers = {"Authorization": f"Bearer {PINATA_JWT}"}
        response = requests.get(url, headers=headers)
        pinata_status = "connected" if response.status_code == 200 else "disconnected"
        
        return jsonify({
            "status": "ok",
            "pinata": pinata_status
        }), 200
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            "status": "error",
            "pinata": "disconnected",
            "error": str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        logger.warning("No image file provided")
        return jsonify({"error": "No image uploaded"}), 400

    username = request.form.get('username')
    if not username:
        logger.warning("Username missing")
        return jsonify({"error": "Username required"}), 400

    # Initialize user metadata if new
    if username not in image_metadata:
        image_metadata[username] = []

    # Save image temporarily
    image = request.files['image']
    file_extension = os.path.splitext(image.filename)[1]
    unique_filename = f"{username}_{uuid.uuid4().hex}{file_extension}"
    os.makedirs('uploads', exist_ok=True)
    image_path = os.path.join('uploads', unique_filename)
    image.save(image_path)
    logger.info(f"Image saved: {image_path}")

    # Extract basic metadata (simplified GPS extraction)
    lat, lon = None, None
    try:
        img = Image.open(image_path)
        exif_data = img.getexif()
        if exif_data and 0x8825 in exif_data:  # GPSInfo tag
            gps_info = exif_data.get_ifd(0x8825)
            lat = convert_to_degrees(gps_info.get(1))  # GPSLatitude
            lon = convert_to_degrees(gps_info.get(3))  # GPSLongitude
            logger.info(f"GPS extracted: ({lat}, {lon})")
    except Exception as e:
        logger.error(f"Error extracting metadata: {e}")

    # Upload to Pinata
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}
    
    try:
        with open(image_path, "rb") as file_to_upload:
            files = {"file": file_to_upload}
            data = {"pinataOptions": '{"isPrivate": true}'}
            response = requests.post(url, headers=headers, files=files, data=data)

        if response.status_code != 200:
            logger.error(f"Pinata upload failed: {response.text}")
            return jsonify({"error": "Failed to upload to IPFS"}), 500

        cid = response.json()["IpfsHash"]
        logger.info(f"Uploaded to Pinata, CID: {cid}")

        # Store metadata
        memory = {
            "id": len(image_metadata[username]) + 1,
            "lat": lat,
            "lon": lon,
            "location_name": "Unknown" if lat is None else "Location Detected",
            "ipfs_cid": cid,
            "points_earned": 5 if lat else 0  # Simple points logic
        }
        image_metadata[username].append(memory)
    except Exception as e:
        logger.error(f"Error during upload process: {e}")
        return jsonify({"error": f"Upload process failed: {str(e)}"}), 500
    finally:
        # Make sure the file is closed before trying to remove it
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
                logger.info(f"Temporary file removed: {image_path}")
        except Exception as e:
            logger.warning(f"Could not remove temporary file: {e}")

    return jsonify({
        "message": "Image uploaded successfully",
        "ipfs_cid": cid,
        "points_earned": memory["points_earned"],
        "location_name": memory["location_name"]
    }), 200

@app.route('/api/memories/<username>', methods=['GET'])
def get_memories(username):
    if username not in image_metadata:
        return jsonify([]), 200
    return jsonify(image_metadata[username]), 200

@app.route('/api/memories/<username>/<int:memory_id>/image', methods=['GET'])
def get_memory_image(username, memory_id):
    if username not in image_metadata:
        logger.error(f"User not found: {username}")
        return jsonify({"error": "User not found"}), 404

    memory = next((m for m in image_metadata[username] if m["id"] == memory_id), None)
    if not memory:
        logger.error(f"Memory not found: {memory_id} for user {username}")
        return jsonify({"error": "Memory not found"}), 404

    try:
        # Log the CID we're trying to access
        logger.info(f"Generating access link for CID: {memory['ipfs_cid']}")
        
        # Use the gateway URL directly instead of generating an auth URL
        # This is a public gateway that should work for retrieving the content
        access_link = f"https://gateway.pinata.cloud/ipfs/{memory['ipfs_cid']}"
        logger.info(f"Generated gateway access link: {access_link}")
        
        return jsonify({"access_link": access_link}), 200
    except Exception as e:
        logger.error(f"Error generating access link: {str(e)}")
        return jsonify({"error": f"Error generating access link: {str(e)}"}), 500   
if __name__ == "__main__":
    app.run(debug=True)