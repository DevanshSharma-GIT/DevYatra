# ticket_routes.py
from flask import jsonify, request, send_file
import qrcode
from io import BytesIO
import uuid

# Define functions that will be registered with the app
def register_ticket_routes(app, search_tourist_place, is_tourist_attraction):
    @app.route('/api/tickets', methods=['GET'], endpoint='ticket_get_tickets')
    def get_tickets():
        # This is a placeholder endpoint that returns available ticket types
        return jsonify({
            "status": "success",
            "tickets": [
                {
                    "id": "standard",
                    "name": "Standard Ticket",
                    "description": "Regular entry ticket for heritage sites",
                    "price": 500
                },
                {
                    "id": "premium",
                    "name": "Premium Ticket",
                    "description": "Premium entry with guided tour",
                    "price": 1200
                },
                {
                    "id": "family",
                    "name": "Family Package",
                    "description": "Entry for 2 adults and 2 children",
                    "price": 1800
                }
            ]
        })
    
    @app.route('/api/book', methods=['POST'], endpoint='ticket_book_ticket')
    def book_ticket():
        data = request.get_json()
        place_name = data.get('place')
        user_name = data.get('user_name')
        if not place_name or not user_name:
            return jsonify({"error": "Missing place or user name"}), 400

        place_info = search_tourist_place(place_name)
        if not place_info or "features" not in place_info or not place_info["features"]:
            return jsonify({"error": "Place not found"}), 404

        place = place_info["features"][0]
        place_label = place["properties"].get("name", place["properties"]["formatted"])
        if not is_tourist_attraction(place_label, place):
            return jsonify({"error": f"'{place_label}' isn't a tourist spot"}), 400

        ticket_id = uuid.uuid4().hex
        qr_data = f"Ticket ID: {ticket_id}, Place: {place_name}, User: {user_name}"
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill='black', back_color='white')

        img_io = BytesIO()
        qr_img.save(img_io, 'PNG')
        img_io.seek(0)

        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name=f'{ticket_id}_qr.png')