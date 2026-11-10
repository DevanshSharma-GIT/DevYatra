"""
Consolidated database models for CBC D-02 backend application.
Contains all database models and operations in one centralized location.
"""
import sqlite3
import threading
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils import dict_factory, get_db_connection
import logging

logger = logging.getLogger(__name__)

# SQLAlchemy instance for Flask-SQLAlchemy models
db = SQLAlchemy()

# Thread locks for database operations
DB_LOCK = threading.Lock()
CARBON_DB_LOCK = threading.Lock()

# =======================
# Flask-SQLAlchemy Models
# =======================

class Message(db.Model):
    """Model for native chat messages."""
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    sender_type = db.Column(db.String(20), nullable=False)  # 'native' or 'traveller'
    sender_name = db.Column(db.String(80), nullable=False)
    content = db.Column(db.Text, nullable=False)
    original_content = db.Column(db.Text, nullable=False)
    original_language = db.Column(db.String(20), nullable=False)
    translated_language = db.Column(db.String(20), nullable=False)
    # timestamp = db.Column(db.DateTime, default=datetime.utcnow)
       # In models.py, change line 41 to:
    timestamp = db.Column(db.DateTime, default=datetime.now)  # Local time instead of UTC

class Trip(db.Model):
    """Model for carbon footprint trips."""
    __tablename__ = 'trips'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    mode = db.Column(db.String(20), nullable=False)
    distance_km = db.Column(db.Float, nullable=False)
    nights = db.Column(db.Integer, default=0)
    meals_per_day = db.Column(db.Integer, default=0)
    days = db.Column(db.Integer, default=0)
    activities = db.Column(db.Integer, default=0)
    shopping_usd = db.Column(db.Float, default=0.0)
    transport_emission = db.Column(db.Float)
    accommodation_emission = db.Column(db.Float)
    food_emission = db.Column(db.Float)
    activity_emission = db.Column(db.Float)
    shopping_emission = db.Column(db.Float)
    total_emission = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "mode": self.mode,
            "distance_km": self.distance_km,
            "nights": self.nights,
            "meals_per_day": self.meals_per_day,
            "days": self.days,
            "activities": self.activities,
            "shopping_usd": self.shopping_usd,
            "emissions_breakdown": {
                "transport_emission": self.transport_emission,
                "accommodation_emission": self.accommodation_emission,
                "food_emission": self.food_emission,
                "activity_emission": self.activity_emission,
                "shopping_emission": self.shopping_emission,
                "total_emission": self.total_emission
            },
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

# =======================
# Database Initialization Functions
# =======================

def init_main_db():
    """Initialize the main application database."""
    try:
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            
            # Users table
            c.execute('''CREATE TABLE IF NOT EXISTS users 
                        (id INTEGER PRIMARY KEY, 
                         username TEXT UNIQUE, 
                         role TEXT, 
                         points INTEGER, 
                         home_lat REAL, 
                         home_lon REAL)''')
            
            # Chat history table
            c.execute('''CREATE TABLE IF NOT EXISTS chat_history 
                        (id INTEGER PRIMARY KEY, 
                         sender TEXT, 
                         receiver TEXT, 
                         message TEXT)''')
            
            # Memories table
            c.execute('''CREATE TABLE IF NOT EXISTS memories 
                        (id INTEGER PRIMARY KEY, 
                         username TEXT, 
                         lat REAL, 
                         lon REAL, 
                         location_name TEXT)''')
            
            # Safety reports table
            c.execute('''CREATE TABLE IF NOT EXISTS safety_reports
                        (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                         username TEXT, 
                         latitude REAL NOT NULL,
                         longitude REAL NOT NULL,
                         type TEXT NOT NULL,
                         description TEXT,
                         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

            # Group expense manager tables
            c.execute('''CREATE TABLE IF NOT EXISTS groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        total_budget REAL DEFAULT 0,
                        remaining_budget REAL DEFAULT 0,
                        total_spent REAL DEFAULT 0,
                        leader_id TEXT,
                        currency TEXT DEFAULT 'USD',
                        notes TEXT,
                        start_date TEXT,
                        end_date TEXT
                    )''')

            c.execute('''CREATE TABLE IF NOT EXISTS group_members (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        personal_budget REAL DEFAULT 0,
                        remaining_budget REAL DEFAULT 0,
                        role TEXT DEFAULT 'Member',
                        currency TEXT,
                        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
                    )''')

            c.execute('''CREATE TABLE IF NOT EXISTS group_expenses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        description TEXT NOT NULL,
                        amount REAL NOT NULL,
                        paid_by TEXT,
                        category TEXT DEFAULT 'Misc',
                        currency TEXT,
                        date TEXT,
                        status TEXT DEFAULT 'recorded',
                        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
                    )''')

            c.execute('''CREATE TABLE IF NOT EXISTS group_expense_splits (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        expense_id INTEGER NOT NULL,
                        member_id INTEGER NOT NULL,
                        share REAL NOT NULL,
                        FOREIGN KEY(expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE,
                        FOREIGN KEY(member_id) REFERENCES group_members(id) ON DELETE CASCADE
                    )''')

            c.execute('''CREATE TABLE IF NOT EXISTS group_activities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        cost REAL DEFAULT 0,
                        activity_type TEXT,
                        currency TEXT,
                        date TEXT,
                        status TEXT DEFAULT 'planned',
                        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
                    )''')

            c.execute('''CREATE TABLE IF NOT EXISTS group_activity_participants (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        activity_id INTEGER NOT NULL,
                        member_id INTEGER NOT NULL,
                        FOREIGN KEY(activity_id) REFERENCES group_activities(id) ON DELETE CASCADE,
                        FOREIGN KEY(member_id) REFERENCES group_members(id) ON DELETE CASCADE
                    )''')
            
            conn.commit()
            conn.close()
            logger.info(f"Main database initialized at {Config.DB_PATH}")
            
    except sqlite3.Error as e:
        logger.error(f"Main database initialization error: {e}")
        raise

def init_crowdsource_db():
    """Initialize the crowdsource safety database."""
    try:
        with DB_LOCK:
            conn = sqlite3.connect(Config.CROWDSOURCE_DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                description TEXT,
                timestamp TEXT NOT NULL,
                username TEXT
            )
            ''')
            conn.commit()
            conn.close()
            logger.info(f"Crowdsource database initialized at {Config.CROWDSOURCE_DB_PATH}")
            
    except sqlite3.Error as e:
        logger.error(f"Crowdsource database initialization error: {e}")
        raise

def init_carbon_db():
    """Initialize the carbon footprint database."""
    try:
        with CARBON_DB_LOCK:
            conn = sqlite3.connect(Config.CARBON_DB_PATH)
            c = conn.cursor()
            c.execute('''
                CREATE TABLE IF NOT EXISTS carbon_trips (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    distance_km REAL NOT NULL,
                    nights INTEGER DEFAULT 0,
                    meals_per_day INTEGER DEFAULT 0,
                    days INTEGER DEFAULT 0,
                    activities INTEGER DEFAULT 0,
                    shopping_usd REAL DEFAULT 0,
                    transport_emission REAL,
                    accommodation_emission REAL,
                    food_emission REAL,
                    activity_emission REAL,
                    shopping_emission REAL,
                    total_emission REAL,
                    ai_summary TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            conn.close()
            logger.info(f"Carbon database initialized at {Config.CARBON_DB_PATH}")
            
    except sqlite3.Error as e:
        logger.error(f"Carbon database initialization error: {e}")
        raise

def init_all_databases():
    """Initialize all databases."""
    init_main_db()
    init_crowdsource_db()
    init_carbon_db()

# =======================
# Database Operation Classes
# =======================

class UserOperations:
    """Database operations for users."""
    
    @staticmethod
    def create_user(username: str, role: str, firebase_uid: str = None):
        """Create a new user or return existing user ID."""
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            
            try:
                c.execute("INSERT INTO users (username, role, points) VALUES (?, ?, 0)", 
                          (username, role))
                conn.commit()
                user_id = c.lastrowid
                logger.info(f"User created: {username}")
                return {"created": True, "user_id": user_id}
                
            except sqlite3.IntegrityError:
                c.execute("SELECT id FROM users WHERE username=?", (username,))
                user_id = c.fetchone()[0]
                logger.info(f"User already exists: {username}")
                return {"created": False, "user_id": user_id}
                
            finally:
                conn.close()
    
    @staticmethod
    def get_user(username: str):
        """Get user by username."""
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            c.execute("SELECT id, username, role, points, home_lat, home_lon FROM users WHERE username=?", 
                     (username,))
            user = c.fetchone()
            conn.close()
            
            if user:
                return {
                    "id": user[0],
                    "username": user[1],
                    "role": user[2],
                    "points": user[3],
                    "home_lat": user[4],
                    "home_lon": user[5]
                }
            return None
    
    @staticmethod
    def update_home_location(username: str, home_lat: float, home_lon: float):
        """Update user's home location."""
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            
            c.execute("SELECT id FROM users WHERE username=?", (username,))
            user = c.fetchone()
            
            if not user:
                # Create new user with home location
                c.execute("INSERT INTO users (username, role, points, home_lat, home_lon) VALUES (?, 'tourist', 0, ?, ?)",
                         (username, home_lat, home_lon))
            else:
                # Update existing user
                c.execute("UPDATE users SET home_lat=?, home_lon=? WHERE username=?",
                         (home_lat, home_lon, username))
            
            conn.commit()
            conn.close()
            logger.info(f"Home location updated for user: {username}")
    
    @staticmethod
    def update_points(username: str, points_to_add: int):
        """Add points to user account."""
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            c.execute("UPDATE users SET points = points + ? WHERE username=?", 
                     (points_to_add, username))
            conn.commit()
            conn.close()
            logger.info(f"Added {points_to_add} points to user: {username}")

class SafetyOperations:
    """Database operations for safety incidents."""
    
    @staticmethod
    def get_all_incidents():
        """Get all safety incidents."""
        conn = sqlite3.connect(Config.CROWDSOURCE_DB_PATH)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM incidents ORDER BY timestamp DESC')
        incidents = cursor.fetchall()
        conn.close()
        return incidents
    
    @staticmethod
    def add_incident(incident_type: str, latitude: float, longitude: float, 
                    description: str = None, username: str = None):
        """Add a new safety incident."""
        conn = sqlite3.connect(Config.CROWDSOURCE_DB_PATH)
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()
        
        cursor.execute('''INSERT INTO incidents 
                         (type, latitude, longitude, description, timestamp, username) 
                         VALUES (?, ?, ?, ?, ?, ?)''',
                      (incident_type, latitude, longitude, description, timestamp, username))
        
        incident_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Safety incident added: {incident_type} at ({latitude}, {longitude})")
        return incident_id
    
    @staticmethod
    def get_recent_incidents(limit: int = 10):
        """Get recent safety incidents for context."""
        conn = sqlite3.connect(Config.CROWDSOURCE_DB_PATH)
        conn.row_factory = dict_factory
        cursor = conn.cursor()
        cursor.execute('SELECT type, latitude, longitude, description, timestamp FROM incidents ORDER BY timestamp DESC LIMIT ?', 
                      (limit,))
        incidents = cursor.fetchall()
        conn.close()
        return incidents

class CarbonOperations:
    """Database operations for carbon footprint tracking."""
    
    @staticmethod
    def save_trip(user_id: str, trip_data: dict, emissions: dict, ai_summary: str):
        """Save carbon footprint trip data."""
        with CARBON_DB_LOCK:
            conn = sqlite3.connect(Config.CARBON_DB_PATH)
            c = conn.cursor()
            c.execute('''
                INSERT INTO carbon_trips (
                    user_id, mode, distance_km, nights, meals_per_day, days, activities, shopping_usd,
                    transport_emission, accommodation_emission, food_emission, activity_emission, 
                    shopping_emission, total_emission, ai_summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, trip_data['mode'], trip_data['distance_km'], trip_data['nights'],
                trip_data['meals_per_day'], trip_data['days'], trip_data['activities'],
                trip_data['shopping_usd'], emissions["transport_emission"], 
                emissions["accommodation_emission"], emissions["food_emission"],
                emissions["activity_emission"], emissions["shopping_emission"], 
                emissions["total_emission"], ai_summary
            ))
            trip_id = c.lastrowid
            conn.commit()
            conn.close()
            return trip_id
    
    @staticmethod
    def get_user_trips(user_id: str):
        """Get all trips for a user."""
        with CARBON_DB_LOCK:
            conn = sqlite3.connect(Config.CARBON_DB_PATH)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM carbon_trips WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
            trips = c.fetchall()
            conn.close()
            return [dict(trip) for trip in trips]


class GroupOperations:
    """Database operations for group expense manager."""

    @staticmethod
    def _get_columns(c, table: str) -> set:
        try:
            c.execute(f"PRAGMA table_info({table})")
            return {row[1] for row in c.fetchall()}
        except Exception:
            return set()

    @staticmethod
    def _ensure_schema(c) -> None:
        """Best-effort ensure new columns exist on existing installations."""
        try:
            cols = GroupOperations._get_columns(c, 'groups')
            if 'currency' not in cols:
                try: c.execute("ALTER TABLE groups ADD COLUMN currency TEXT")
                except Exception: pass
            if 'notes' not in cols:
                try: c.execute("ALTER TABLE groups ADD COLUMN notes TEXT")
                except Exception: pass
            if 'start_date' not in cols:
                try: c.execute("ALTER TABLE groups ADD COLUMN start_date TEXT")
                except Exception: pass
            if 'end_date' not in cols:
                try: c.execute("ALTER TABLE groups ADD COLUMN end_date TEXT")
                except Exception: pass
            if 'trip_completed' not in cols:
                try: c.execute("ALTER TABLE groups ADD COLUMN trip_completed INTEGER DEFAULT 0")
                except Exception: pass

            cols = GroupOperations._get_columns(c, 'group_members')
            if 'role' not in cols:
                try: c.execute("ALTER TABLE group_members ADD COLUMN role TEXT")
                except Exception: pass
            if 'currency' not in cols:
                try: c.execute("ALTER TABLE group_members ADD COLUMN currency TEXT")
                except Exception: pass

            cols = GroupOperations._get_columns(c, 'group_expenses')
            if 'currency' not in cols:
                try: c.execute("ALTER TABLE group_expenses ADD COLUMN currency TEXT")
                except Exception: pass

            cols = GroupOperations._get_columns(c, 'group_activities')
            if 'currency' not in cols:
                try: c.execute("ALTER TABLE group_activities ADD COLUMN currency TEXT")
                except Exception: pass
        except Exception:
            # Non-fatal; queries may still work for fresh DBs
            pass

    @staticmethod
    def list_groups():
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            conn.row_factory = dict_factory
            c = conn.cursor()
            GroupOperations._ensure_schema(c)
            c.execute("SELECT id, name, total_budget, remaining_budget, total_spent, leader_id FROM groups ORDER BY id DESC")
            groups = c.fetchall()
            conn.close()
            return groups

    @staticmethod
    def _get_group_currency(conn, group_id: int) -> str:
        cur = conn.cursor()
        try:
            cur.execute("SELECT currency FROM groups WHERE id=?", (group_id,))
            row = cur.fetchone()
            return row[0] if row and row[0] else 'USD'
        except Exception:
            return 'USD'

    @staticmethod
    def create_group(name: str, total_budget: float, leader_id: str = None, currency: str = 'USD', notes: str = None, start_date: str = None, end_date: str = None, trip_completed: bool = False) -> int:
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            # Add columns if missing (best-effort)
            try:
                c.execute("ALTER TABLE groups ADD COLUMN currency TEXT")
            except Exception:
                pass
            try:
                c.execute("ALTER TABLE groups ADD COLUMN notes TEXT")
            except Exception:
                pass
            try:
                c.execute("ALTER TABLE groups ADD COLUMN start_date TEXT")
            except Exception:
                pass
            try:
                c.execute("ALTER TABLE groups ADD COLUMN end_date TEXT")
            except Exception:
                pass
            try:
                c.execute("ALTER TABLE groups ADD COLUMN trip_completed INTEGER DEFAULT 0")
            except Exception:
                pass

            c.execute("INSERT INTO groups (name, total_budget, remaining_budget, total_spent, leader_id, currency, notes, start_date, end_date, trip_completed) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
                      (name, total_budget, total_budget, leader_id, currency, notes, start_date, end_date, 1 if trip_completed else 0))
            group_id = c.lastrowid
            conn.commit()
            conn.close()
            return group_id

    @staticmethod
    def get_group_summary(group_id: int) -> dict:
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            conn.row_factory = dict_factory
            c = conn.cursor()
            GroupOperations._ensure_schema(c)
            # Group
            c.execute("SELECT id, name, total_budget, remaining_budget, total_spent, leader_id, currency, notes, start_date, end_date, COALESCE(trip_completed, 0) as trip_completed FROM groups WHERE id=?", (group_id,))
            group = c.fetchone()
            if not group:
                conn.close()
                return None

            # Members
            c.execute("SELECT id, name, personal_budget, remaining_budget, COALESCE(role,'Member') as role, currency FROM group_members WHERE group_id=? ORDER BY id", (group_id,))
            members = c.fetchall()

            # Expenses
            c.execute("SELECT id, description, amount, paid_by, category, date, status FROM group_expenses WHERE group_id=? ORDER BY id DESC", (group_id,))
            expenses = c.fetchall()
            expense_ids = [e['id'] for e in expenses]
            splits_map = {}
            if expense_ids:
                qmarks = ",".join(["?"] * len(expense_ids))
                c.execute(f"SELECT expense_id, member_id, share FROM group_expense_splits WHERE expense_id IN ({qmarks})", expense_ids)
                for row in c.fetchall():
                    splits_map.setdefault(row['expense_id'], {})[str(row['member_id'])] = row['share']
            for e in expenses:
                e['splits'] = splits_map.get(e['id'], {})

            # Activities
            c.execute("SELECT id, name, cost, activity_type, date, status FROM group_activities WHERE group_id=? ORDER BY id DESC", (group_id,))
            activities = c.fetchall()
            activity_ids = [a['id'] for a in activities]
            parts_map = {}
            if activity_ids:
                qmarks = ",".join(["?"] * len(activity_ids))
                c.execute(f"SELECT activity_id, member_id FROM group_activity_participants WHERE activity_id IN ({qmarks})", activity_ids)
                for row in c.fetchall():
                    parts_map.setdefault(row['activity_id'], []).append(str(row['member_id']))
            for a in activities:
                a['participants'] = parts_map.get(a['id'], [])

            conn.close()
            return {
                'id': group['id'],
                'name': group['name'],
                'total_budget': group['total_budget'],
                'remaining_budget': group['remaining_budget'],
                'total_spent': group['total_spent'],
                'leader_id': group['leader_id'],
                'currency': group.get('currency'),
                'notes': group.get('notes'),
                'start_date': group.get('start_date'),
                'end_date': group.get('end_date'),
                'trip_completed': bool(group.get('trip_completed', 0)),
                'members': members,
                'expenses': expenses,
                'activities': activities
            }

    @staticmethod
    def add_member(group_id: int, name: str, personal_budget: float, role: str = 'Member', currency: str = None) -> int:
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            GroupOperations._ensure_schema(c)
            # default currency from group
            if not currency:
                currency = GroupOperations._get_group_currency(conn, group_id)

            c.execute("INSERT INTO group_members (group_id, name, personal_budget, remaining_budget, role, currency) VALUES (?, ?, ?, ?, ?, ?)",
                      (group_id, name, personal_budget, personal_budget, role, currency))
            member_id = c.lastrowid
            conn.commit()
            conn.close()
            return member_id

    @staticmethod
    def add_expense(group_id: int, description: str, amount: float, split_type: str, paid_by: str, category: str = 'Misc', date: str = None, splits: dict = None, currency: str = None) -> int:
        with DB_LOCK:
            from datetime import datetime as dt
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            tx_date = date or dt.now().isoformat()
            GroupOperations._ensure_schema(c)
            if not currency:
                currency = GroupOperations._get_group_currency(conn, group_id)

            c.execute("INSERT INTO group_expenses (group_id, description, amount, paid_by, category, currency, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded')",
                      (group_id, description, amount, paid_by, category, currency, tx_date))
            expense_id = c.lastrowid

            # Get members for equal split
            c.execute("SELECT id, personal_budget, remaining_budget FROM group_members WHERE group_id=?", (group_id,))
            members = c.fetchall()
            if split_type == 'equal' and members:
                share = round(amount / len(members), 2)
                for m in members:
                    c.execute("INSERT INTO group_expense_splits (expense_id, member_id, share) VALUES (?, ?, ?)",
                              (expense_id, m[0], share))
                    # Decrease remaining budget for member
                    c.execute("UPDATE group_members SET remaining_budget = remaining_budget - ? WHERE id=?", (share, m[0]))
            elif split_type == 'custom' and splits:
                # splits is a dict of member_id -> share
                total = 0.0
                for mid, share in splits.items():
                    try:
                        s = float(share)
                    except Exception:
                        s = 0.0
                    total += s
                # write splits and adjust budgets; don't enforce exact sum to allow rounding
                for mid, share in splits.items():
                    s = float(share)
                    c.execute("INSERT INTO group_expense_splits (expense_id, member_id, share) VALUES (?, ?, ?)", (expense_id, mid, s))
                    c.execute("UPDATE group_members SET remaining_budget = remaining_budget - ? WHERE id=?", (s, mid))

            # Update group totals
            c.execute("UPDATE groups SET total_spent = total_spent + ?, remaining_budget = total_budget - total_spent WHERE id=?", (amount, group_id))

            conn.commit()
            conn.close()
            return expense_id

    @staticmethod
    def add_activity(group_id: int, name: str, cost: float, activity_type: str, participants: list, date: str = None, status: str = 'planned', currency: str = None) -> int:
        with DB_LOCK:
            from datetime import datetime as dt
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            act_date = date or dt.now().isoformat()
            GroupOperations._ensure_schema(c)
            if not currency:
                currency = GroupOperations._get_group_currency(conn, group_id)
            c.execute("INSERT INTO group_activities (group_id, name, cost, activity_type, currency, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (group_id, name, cost, activity_type, currency, act_date, status))
            activity_id = c.lastrowid
            for pid in participants or []:
                c.execute("INSERT INTO group_activity_participants (activity_id, member_id) VALUES (?, ?)", (activity_id, pid))
            conn.commit()
            conn.close()
            return activity_id

    @staticmethod
    def set_trip_completed(group_id: int, completed: bool):
        with DB_LOCK:
            conn = get_db_connection(Config.DB_PATH)
            c = conn.cursor()
            try:
                c.execute("ALTER TABLE groups ADD COLUMN trip_completed INTEGER DEFAULT 0")
            except Exception:
                pass
            c.execute("UPDATE groups SET trip_completed=? WHERE id=?", (1 if completed else 0, group_id))
            conn.commit()
            conn.close()

    @staticmethod
    def get_group_report_data(group_id: int) -> dict:
        summary = GroupOperations.get_group_summary(group_id)
        if not summary:
            return None
        # Compute totals per member
        member_totals = { str(m['id']): 0.0 for m in summary['members'] }
        for exp in summary['expenses']:
            for mid, share in exp.get('splits', {}).items():
                try:
                    member_totals[mid] = member_totals.get(mid, 0.0) + float(share)
                except Exception:
                    pass
        return {
            'group': summary,
            'member_totals': member_totals
        }