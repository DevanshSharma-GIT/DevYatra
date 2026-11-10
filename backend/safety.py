from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import json
from datetime import datetime

# SQLite database setup
DB_PATH = os.path.join(os.path.dirname(__file__), 'crowdsource.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        description TEXT,
        timestamp TEXT
    )
    ''')
    conn.commit()
    conn.close()

# Initialize database
init_db()

# Helper function to convert SQLite rows to dictionaries
def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

# Function to register safety routes with an existing Flask app
def register_safety_routes(app):
    # Endpoint to get all reports - Update route paths to include /api/safety prefix
    @app.route('/api/safety/reports', methods=['GET'])
    def get_reports():
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM incidents')
        reports = cursor.fetchall()
        conn.close()
        return jsonify(reports)

    # Endpoint to get statistics (counts of each type)
    @app.route('/api/safety/statistics', methods=['GET'])
    def get_statistics():
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'pickpocketing'")
        pickpocketing_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'scam'")
        scam_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'safe_locker'")
        safe_locker_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'harassment'")
        harassment_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'health'")
        health_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE type = 'tip'")
        tip_count = cursor.fetchone()[0]
        
        conn.close()
        
        stats = {
            'pickpocketing': pickpocketing_count,
            'scam': scam_count,
            'safe_locker': safe_locker_count,
            'harassment': harassment_count,
            'health': health_count,
            'tip': tip_count
        }
        return jsonify(stats)

    # Endpoint to add a new report (for crowd-sourcing)
    @app.route('/api/safety/report', methods=['POST'])
    def add_report():
        data = request.json
        # Basic validation
        if 'type' in data and 'latitude' in data and 'longitude' in data:
            # Add timestamp if not provided
            if 'timestamp' not in data:
                data['timestamp'] = datetime.now().isoformat()
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO incidents (type, latitude, longitude, description, timestamp) VALUES (?, ?, ?, ?, ?)',
                (data['type'], data['latitude'], data['longitude'], data.get('description', ''), data['timestamp'])
            )
            conn.commit()
            
            # Get the ID of the newly inserted report
            report_id = cursor.lastrowid
            
            # Create a response that includes the newly created report
            new_report = {
                'id': report_id,
                'type': data['type'],
                'latitude': data['latitude'],
                'longitude': data['longitude'],
                'description': data.get('description', ''),
                'username': data.get('username', 'Anonymous'),
                'timestamp': data['timestamp']
            }
            
            conn.close()
            
            return jsonify({'status': 'ok', 'report': new_report})
        else:
            return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

    # Endpoint to get reports by type
    @app.route('/api/safety/reports/<incident_type>', methods=['GET'])
    def get_reports_by_type(incident_type):
        if incident_type not in ['pickpocketing', 'scam', 'safe_locker']:
            return jsonify({'status': 'error', 'message': 'Invalid incident type'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        cursor.execute(
            'SELECT type, latitude, longitude, description, timestamp FROM incidents WHERE type = ?',
            (incident_type,)
        )
        reports = cursor.fetchall()
        conn.close()
        
        return jsonify(reports)

    # Endpoint to get heatmap data
    @app.route('/api/safety/heatmap', methods=['GET'])
    def get_heatmap_data():
        incident_type = request.args.get('type', 'pickpocketing')
        
        if incident_type not in ['pickpocketing', 'scam', 'safe_locker']:
            return jsonify({'status': 'error', 'message': 'Invalid incident type'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            'SELECT latitude, longitude FROM incidents WHERE type = ?',
            (incident_type,)
        )
        reports = cursor.fetchall()
        conn.close()
        
        heatmap_data = [[report[0], report[1], 0.5] for report in reports]
        
        return jsonify(heatmap_data)

# This part only runs if safety.py is executed directly
if __name__ == '__main__':
    app = Flask(__name__)
    CORS(app)  # Enable CORS for all routes
    register_safety_routes(app)
    app.run(debug=True, port=5000)  # Explicitly set port for clarity