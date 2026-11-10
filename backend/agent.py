from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)
DATABASE = 'travel_booking.db'  # Replace with actual database name

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# User Authentication
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data['username']
    password = data['password']
    # Add more fields as needed

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data['username']
    password = data['password']

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"message": "Login successful", "user_id": user['id']}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

# Destination Search
@app.route('/search_destinations', methods=['GET'])
def search_destinations():
    location = request.args.get('location')
    budget = request.args.get('budget')
    interests = request.args.get('interests')  # Comma-separated list

    query = "SELECT * FROM destinations WHERE 1=1"
    params = []

    if location:
        query += " AND location LIKE ?"
        params.append(f"%{location}%")
    if budget:
        query += " AND budget <= ?"
        params.append(budget)
    if interests:
        interest_list = interests.split(',')
        for interest in interest_list:
            query += " AND interests LIKE ?"
            params.append(f"%{interest}%")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    destinations = cursor.fetchall()
    conn.close()

    return jsonify([dict(row) for row in destinations]), 200

# Booking Management
@app.route('/book_flight', methods=['POST'])
def book_flight():
    data = request.json
    user_id = data['user_id']
    flight_id = data['flight_id']
    # Add more fields as needed

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO bookings (user_id, type, item_id) VALUES (?, 'flight', ?)", (user_id, flight_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Flight booked successfully"}), 201

@app.route('/book_hotel', methods=['POST'])
def book_hotel():
    data = request.json
    user_id = data['user_id']
    hotel_id = data['hotel_id']
    check_in = data['check_in']
    check_out = data['check_out']
    # Add more fields as needed

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO bookings (user_id, type, item_id, check_in, check_out) VALUES (?, 'hotel', ?, ?, ?)", 
                   (user_id, hotel_id, check_in, check_out))
    conn.commit()
    conn.close()

    return jsonify({"message": "Hotel booked successfully"}), 201

@app.route('/book_activity', methods=['POST'])
def book_activity():
    data = request.json
    user_id = data['user_id']
    activity_id = data['activity_id']
    date = data['date']
    # Add more fields as needed

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO bookings (user_id, type, item_id, date) VALUES (?, 'activity', ?, ?)", 
                   (user_id, activity_id, date))
    conn.commit()
    conn.close()

    return jsonify({"message": "Activity booked successfully"}), 201

@app.route('/view_bookings', methods=['GET'])
def view_bookings():
    user_id = request.args.get('user_id')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings WHERE user_id = ?", (user_id,))
    bookings = cursor.fetchall()
    conn.close()

    return jsonify([dict(row) for row in bookings]), 200

@app.route('/cancel_booking', methods=['DELETE'])
def cancel_booking():
    booking_id = request.args.get('booking_id')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Booking cancelled successfully"}), 200

# Recommendations
@app.route('/recommendations', methods=['GET'])
def recommendations():
    user_id = request.args.get('user_id')

    conn = get_db_connection()
    cursor = conn.cursor()

    # Example: Recommend destinations based on user's past bookings
    cursor.execute("""
        SELECT d.* 
        FROM destinations d
        JOIN bookings b ON d.id = b.item_id
        WHERE b.user_id = ? AND b.type = 'destination'
        GROUP BY d.id
        ORDER BY COUNT(b.id) DESC
        LIMIT 5
    """, (user_id,))
    recommendations = cursor.fetchall()

    conn.close()

    return jsonify([dict(row) for row in recommendations]), 200

if __name__ == '__main__':
    app.run(debug=True)
