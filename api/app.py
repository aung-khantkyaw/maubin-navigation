from flask import Flask, request, jsonify, send_from_directory, url_for
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    verify_jwt_in_request,
)
import psycopg2
import psycopg2.extras
from geopy.distance import great_circle
import os
import uuid
import math
import json
from dotenv import load_dotenv
import datetime
from functools import wraps
import re
from werkzeug.utils import secure_filename
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

psycopg2.extras.register_uuid()

# Load environment variables
load_dotenv()


def env_value(name: str, default: str | None = None) -> str | None:
    """Fetch environment variables with safe stripping and fallback."""
    value = os.environ.get(name, None)
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            value = None
    return value if value is not None else default

# Initialize Flask app
app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.environ.get('JWT_SECRET')
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(days=7)

# Initialize extensions
origins = os.environ.get('ORIGIN', '').split(",")

CORS(app, 
     origins=origins,
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
jwt = JWTManager(app)

# Database connection function
def get_db_connection():
    host = env_value('DB_HOST')
    database = env_value('DB_NAME')
    user = env_value('DB_USER')
    password = env_value('DB_PASSWORD')
    port_value = env_value('DB_PORT', '5432')
    sslmode = env_value('DB_SSLMODE', 'require')

    try:
        conn = psycopg2.connect(
            host=host,
            database=database,
            user=user,
            password=password,
            port=int(port_value) if port_value else None,
            sslmode=sslmode,
            connect_timeout=10,
        )
        return conn
    except psycopg2.OperationalError as exc:
        error_msg = str(exc)
        app.logger.error(
            f"Database connection failed to {host}:{port_value}",
            extra={
                "host": host,
                "port": port_value,
                "database": database,
                "user": user,
                "sslmode": sslmode,
                "error": error_msg,
            },
        )
        
        # Provide helpful error messages
        if "Connection refused" in error_msg:
            app.logger.error(
                "Connection refused - Possible causes:\n"
                "1. Supabase pooler (port 6543) may be disabled or restricted\n"
                "2. Try direct connection: Update DB_HOST to use .connect.aws.neon.tech and DB_PORT=5432\n"
                "3. Check Supabase Network Restrictions in Settings → Database\n"
                "4. Ensure Supabase project is not paused"
            )
        elif "timeout" in error_msg.lower():
            app.logger.error("Connection timeout - Check network connectivity and firewall rules")
        elif "password authentication failed" in error_msg.lower():
            app.logger.error("Invalid credentials - Verify DB_USER and DB_PASSWORD")
        
        raise
    except Exception as exc:
        app.logger.error(f"Unexpected database error: {exc}")
        raise

# File upload configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

print("Upload folder set to:", UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_image(file_storage):
    """Persist an uploaded image and return its public URL."""
    if not file_storage or not file_storage.filename:
        return None

    if not allowed_file(file_storage.filename):
        raise ValueError("Unsupported file type. Allowed types: png, jpg, jpeg, gif")

    safe_name = secure_filename(file_storage.filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
    file_storage.save(file_path)
    return f"/uploads/{unique_name}"


def save_uploaded_images_from_request():
    """Persist all uploaded images from the current request and return their URLs."""
    files = request.files.getlist('image_files[]')
    if not files:
        files = request.files.getlist('image_files')

    if not files:
        fallback = request.files.get('image_file') or request.files.get('image')
        files = [fallback] if fallback else []

    uploaded_urls = []
    for file_storage in files:
        if not file_storage or not file_storage.filename:
            continue
        url = save_uploaded_image(file_storage)
        if url:
            uploaded_urls.append(url)

    return uploaded_urls


@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def extract_normalized_payload():
    """Return incoming data as a normalized dict and flag for multipart payloads."""
    content_type = request.content_type or ""
    is_multipart = content_type.startswith("multipart/form-data")

    if is_multipart:
        form_dict = request.form.to_dict(flat=True)
        data = {}
        for key, value in form_dict.items():
            if isinstance(value, str):
                stripped = value.strip()
                data[key] = stripped if stripped else None
            else:
                data[key] = value

        if 'image_urls' in request.form:
            url_values = request.form.getlist('image_urls')
            if len(url_values) > 1:
                data['image_urls'] = [item.strip() for item in url_values if item.strip()]
        return data, True

    raw_json = request.get_json(silent=True) or {}
    normalized = {}
    for key, value in raw_json.items():
        if isinstance(value, str):
            stripped = value.strip()
            normalized[key] = stripped if stripped else None
        else:
            normalized[key] = value
    return normalized, False

# Helper functions
def calculate_distance(point1, point2):
    return great_circle((point1[1], point1[0]), (point2[1], point2[0])).meters

def extract_coordinates_from_wkt(wkt_string):
    """Extract coordinates from a WKT point string"""
    if not wkt_string:
        return None
    
    point_match = re.search(r'POINT\(([^)]+)\)', wkt_string)
    if point_match:
        coords = point_match.group(1).split()
        if len(coords) >= 2:
            return (float(coords[0]), float(coords[1]))
    
    return None

def safe_extract_coordinates(item, prefix):
    """Safely extract coordinates from database result"""
    lon_key = f"{prefix}_lon"
    lat_key = f"{prefix}_lat"
    
    if lon_key in item and lat_key in item and item[lon_key] is not None and item[lat_key] is not None:
        return (float(item[lon_key]), float(item[lat_key]))
    return None

def prepare_image_urls_for_db(value):
    """Normalize image URL payload into a database-friendly representation."""
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass
        return [segment.strip() for segment in cleaned.split(',') if segment.strip()]

    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]

    return [str(value).strip()]


def coerce_multilingual_payload(data, field, legacy_keys=None):
    """Build a JSON object with "mm" and "en" keys from mixed payloads."""
    legacy_keys = legacy_keys or (None, None)
    raw = data.get(field)

    mm_value = None
    en_value = None

    if isinstance(raw, dict):
        mm_value = raw.get("mm") or raw.get("my") or raw.get("mm_MM")
        en_value = raw.get("en")

    alt_mm_keys = [f"{field}_mm", f"{field}_my", f"{field}_mm_MM"]
    if legacy_keys[0]:
        alt_mm_keys.append(legacy_keys[0])
    if field == "name":
        alt_mm_keys.append("burmese_name")

    alt_en_keys = [f"{field}_en"]
    if legacy_keys[1]:
        alt_en_keys.append(legacy_keys[1])
    if field == "name":
        alt_en_keys.append("english_name")

    if not mm_value:
        for key in alt_mm_keys:
            if key and isinstance(data.get(key), str) and data[key].strip():
                mm_value = data[key].strip()
                break

    if not en_value:
        for key in alt_en_keys:
            if key and isinstance(data.get(key), str) and data[key].strip():
                en_value = data[key].strip()
                break

    payload = {}
    if mm_value:
        payload["mm"] = mm_value
    if en_value:
        payload["en"] = en_value

    return payload or None


def normalize_json_field(value):
    """Ensure optional JSONB fields are stored with consistent structure."""
    if value is None:
        return None
    if isinstance(value, dict):
        return {k: v for k, v in value.items() if v not in (None, "")}
    if isinstance(value, str):
        stripped = value.strip()
        return {"en": stripped} if stripped else None
    return None


def has_jsonb_payload(data, field, legacy_keys=None):
    """Detect whether the request provides data intended for a JSONB column."""
    legacy_keys = [key for key in (legacy_keys or []) if key]
    variants = {
        field,
        f"{field}_mm",
        f"{field}_my",
        f"{field}_en",
        f"{field}_mm_MM",
    }
    for legacy_key in legacy_keys:
        variants.update({
            legacy_key,
            f"{legacy_key}_mm",
            f"{legacy_key}_my",
            f"{legacy_key}_en",
            f"{legacy_key}_mm_MM",
        })
    return any(key in data for key in variants)


def build_name_response(name_obj):
    """Construct a response payload for multilingual name objects with legacy aliases."""
    if isinstance(name_obj, dict):
        mm_value = name_obj.get("mm")
        en_value = name_obj.get("en")
    else:
        mm_value = None
        en_value = None

    return {
        "name_mm": mm_value,
        "name_en": en_value,
    }


def build_address_response(address_obj):
    """Construct a response payload for multilingual address objects."""
    if isinstance(address_obj, dict):
        mm_value = address_obj.get("mm")
        en_value = address_obj.get("en")
        return {
            "address_mm": mm_value,
            "address_en": en_value,
        }
    return {
        "address_mm": None,
        "address_en": address_obj if isinstance(address_obj, str) else None,
    }


def build_description_response(description_obj):
    """Construct a response payload for multilingual description objects."""
    if isinstance(description_obj, dict):
        mm_value = description_obj.get("mm")
        en_value = description_obj.get("en")
        return {
            "description_mm": mm_value,
            "description_en": en_value,
        }
    return {
        "description_mm": None,
        "description_en": description_obj if isinstance(description_obj, str) else None,
    }


def coerce_boolean(value):
    """Convert string representations of booleans into actual bool values when possible."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ('true', '1', 'yes', 'on'):
            return True
        if lowered in ('false', '0', 'no', 'off'):
            return False
    return value

def parse_point_geometry(payload):
    """Extract a POINT geometry from the payload supporting GeoJSON, WKT, or lon/lat fields."""
    if not isinstance(payload, dict):
        return None

    lon = payload.get('lon')
    lat = payload.get('lat')
    if lon is not None and lat is not None:
        try:
            return f"SRID=4326;POINT({float(lon)} {float(lat)})"
        except (TypeError, ValueError):
            pass

    geometry = payload.get('geometry')
    if isinstance(geometry, dict):
        if geometry.get('type') == 'Point':
            coords = geometry.get('coordinates')
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                try:
                    return f"SRID=4326;POINT({float(coords[0])} {float(coords[1])})"
                except (TypeError, ValueError):
                    pass
    elif isinstance(geometry, str):
        cleaned = geometry.strip()
        if not cleaned:
            return None
        if cleaned.upper().startswith('SRID='):
            return cleaned
        if cleaned.upper().startswith('POINT'):
            return f"SRID=4326;{cleaned}"

    return None

def parse_linestring_coordinates(raw_coordinates):
    """Parse coordinate payload into a list of (lon, lat) tuples."""
    if raw_coordinates is None:
        return []

    coords: list[tuple[float, float]] = []

    if isinstance(raw_coordinates, str):
        text = raw_coordinates.replace(';', '\n')
        for line in text.splitlines():
            cleaned = line.strip()
            if not cleaned:
                continue
            parts = [segment.strip() for segment in cleaned.split(',') if segment.strip()]
            if len(parts) < 2:
                continue
            try:
                lon = float(parts[0])
                lat = float(parts[1])
            except (TypeError, ValueError):
                continue
            coords.append((lon, lat))
        return coords

    if isinstance(raw_coordinates, (list, tuple)):
        for item in raw_coordinates:
            if isinstance(item, dict):
                lon = item.get('lon') if 'lon' in item else item.get('longitude')
                lat = item.get('lat') if 'lat' in item else item.get('latitude')
                if lon is None or lat is None:
                    continue
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                lon, lat = item[:2]
            else:
                continue

            try:
                coords.append((float(lon), float(lat)))
            except (TypeError, ValueError):
                continue

    return coords

def build_linestring_wkt(coords):
    if len(coords) < 2:
        return None
    wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in coords])
    return f"SRID=4326;LINESTRING({wkt_coords})"

def compute_segment_lengths(coords):
    if len(coords) < 2:
        return []
    lengths = []
    for i in range(len(coords) - 1):
        lengths.append(calculate_distance(coords[i], coords[i + 1]))
    return lengths

def send_email(to_email, subject, body):
    """Send email notification to user"""
    try:
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        smtp_user = os.environ.get('SMTP_USER')
        smtp_password = os.environ.get('SMTP_PASSWORD')
        from_email = os.environ.get('FROM_EMAIL', smtp_user)
        
        if not smtp_user or not smtp_password:
            app.logger.warning("SMTP credentials not configured. Email not sent.")
            return False
        
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        
        app.logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as exc:
        app.logger.error(f"Failed to send email to {to_email}: {str(exc)}")
        return False

def admin_required(fn):
    """Decorator to require admin privileges"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT user_type FROM users WHERE id = %s;", (user_id,))
            user = cur.fetchone()
            if not user:
                return jsonify({"is_success": False, "msg": "Admin access required"}), 403

            user_type = user[0]
            is_admin = isinstance(user_type, str) and user_type.lower() == "admin"

            if not is_admin:
                return jsonify({"is_success": False, "msg": "Admin access required"}), 403
        finally:
            cur.close()
            conn.close()
        return fn(*args, **kwargs)
    return wrapper

def collaborator_required(fn):
    """Decorator to require collaborator or admin privileges"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT user_type FROM users WHERE id = %s;", (user_id,))
            user = cur.fetchone()
            if not user:
                return jsonify({"is_success": False, "msg": "Collaborator access required"}), 403

            user_type = user[0]
            is_collaborator_or_admin = isinstance(user_type, str) and user_type.lower() in ["collaborator", "admin"]

            if not is_collaborator_or_admin:
                return jsonify({"is_success": False, "msg": "Collaborator access required"}), 403
        finally:
            cur.close()
            conn.close()
        return fn(*args, **kwargs)
    return wrapper

## City
def get_all_cities():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT 
                id,
                user_id,
                name,
                address,
                image_urls,
                description,
                ST_AsText(geom) AS geometry,
                is_active
            FROM cities;
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_all_cities_by_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT 
                id,
                user_id,
                name,
                address,
                image_urls,
                description,
                ST_AsText(geom) AS geometry,
                is_active
            FROM cities WHERE user_id = %s;
        """, (str(user_id),))
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_city_by_id(city_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT 
                id,
                user_id,
                name,
                address,
                image_urls,
                description,
                ST_AsText(geom) AS geometry,
                is_active
            FROM cities WHERE id = %s;
        """, (str(city_id),))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()

## City Details
def get_all_city_details():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT 
                id,
                city_id,
                user_id,
                predefined_title,
                subtitle,
                body,
                image_urls,
                is_active,
                created_at,
                updated_at
            FROM city_details
            ORDER BY created_at DESC
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

## Location
def get_all_locations():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(""" 
            SELECT 
                id,
                city_id,
                user_id,
                name,
                address,
                image_urls,
                description,
                location_type,
                ST_AsText(geom) AS geometry,
                is_active
            FROM locations;
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_locations_by_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """SELECT 
                id,
                city_id,
                user_id,
                name,
                address,
                image_urls,
                description,
                location_type,
                ST_AsText(geom) AS geometry,
                is_active
            FROM locations WHERE user_id = %s;""",
            (str(user_id),)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_locations_by_city(city_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """SELECT 
                id,
                city_id,
                user_id,
                name,
                address,
                image_urls,
                description,
                location_type,
                ST_AsText(geom) AS geometry,
                is_active
            FROM locations WHERE city_id = %s;""",
            (str(city_id),)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

## Road
def get_all_roads():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT
                id,
                city_id,
                user_id,
                name,
                road_type,
                is_oneway,
                length_m,
                ST_AsText(geom) AS geometry,
                is_active
            FROM roads
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_roads_by_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT
                id,
                city_id,
                user_id,
                name,
                road_type,
                is_oneway,
                length_m,
                ST_AsText(geom) AS geometry,
                is_active
            FROM roads WHERE user_id = %s;""",
            (str(user_id),)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_roads_by_city(city_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT
                id,
                city_id,
                user_id,
                name,
                road_type,
                is_oneway,
                length_m,
                ST_AsText(geom) AS geometry,
                is_active
            FROM roads WHERE city_id = %s;""",
            (str(city_id),)
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_all_users():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                SELECT
                    id,
                    username,
                    email,
                    user_type,
                    created_at,
                    last_login
                FROM users
                ORDER BY created_at DESC;
            """
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_all_collaborators():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                SELECT
                    id,
                    username,
                    email,
                    user_type,
                    created_at,
                    last_login
                FROM users
                WHERE user_type = 'collaborator'
                ORDER BY created_at DESC;
            """
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

def get_all_collaborator_requests():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                SELECT
                    id,
                    user_id,
                    organization,
                    position,
                    reason,
                    status,
                    admin_notes,
                    created_at,
                    updated_at
                FROM collaborator_requests
                WHERE status = 'pending'
                ORDER BY created_at DESC;
            """
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

# Graph class for route planning
class RoadGraph:
    def __init__(self):
        self.nodes = {}
        self.edges = {}
        self.build_graph()
        
    def build_graph(self):
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        def get_or_create_node(coord, node_map, threshold=1): 
            for existing in node_map:
                if calculate_distance(coord, existing) < threshold:
                    return existing
            return coord

        self.nodes = {}
        self.edges = {}

        cur.execute("SELECT id, ST_AsText(geom) AS wkt, length_m, is_oneway FROM roads;")
        roads = cur.fetchall()

        for road in roads:
            road_id = road['id']
            wkt = road['wkt']
            segment_lengths = road['length_m']  
            is_oneway = road['is_oneway']

            coords_str = wkt.replace('LINESTRING(', '').replace(')', '')
            coords_list = [tuple(map(float, c.split())) for c in coords_str.split(',')]

            snapped_coords = []
            for coord in coords_list:
                snapped = get_or_create_node(coord, self.nodes)
                if snapped not in self.nodes:
                    self.nodes[snapped] = []
                snapped_coords.append(snapped)

            for i in range(len(snapped_coords) - 1):
                start_node = snapped_coords[i]
                end_node = snapped_coords[i + 1]

                segment_length = segment_lengths[i] if segment_lengths and i < len(segment_lengths) else calculate_distance(start_node, end_node)

                self.nodes[start_node].append(end_node)
                self.edges[(start_node, end_node)] = {
                    'id': road_id,
                    'length': segment_length,
                    'geometry': [start_node, end_node]
                }

                if not is_oneway:
                    self.nodes[end_node].append(start_node)
                    self.edges[(end_node, start_node)] = {
                        'id': road_id,
                        'length': segment_length,
                        'geometry': [end_node, start_node]
                    }

        app.logger.info(f"Road graph built with {len(self.nodes)} nodes and {len(self.edges)} edges")
        cur.close()
        conn.close()

    def find_nearest_node(self, point):
        max_distance = 500  
        nearest_node = None
        min_distance = float('inf')
        
        for node in self.nodes.keys():
            distance = calculate_distance(point, node)
            if distance < min_distance:
                min_distance = distance
                nearest_node = node
                
        if min_distance > max_distance:
            app.logger.warning(f"No nearby node found within {max_distance}m for point {point}")
            return None

        app.logger.info(f"Found nearest node at {min_distance:.2f}m for point {point}")
        return nearest_node
    
    def dijkstra(self, start, end):        
        start_node = self.find_nearest_node(start)
        end_node = self.find_nearest_node(end)
        
        if start_node is None or end_node is None:
            app.logger.warning(f"Couldn't find nearest node: start={start}, end={end}")
            return None, 0, []
        
        # Dijkstra algorithm implementation
        distances = {node: float('inf') for node in self.nodes}
        previous_nodes = {node: None for node in self.nodes}
        distances[start_node] = 0
        
        unvisited = set(self.nodes.keys())
        
        while unvisited:
            current = min(unvisited, key=lambda node: distances[node], default=None)
            if current is None or distances[current] == float('inf'):
                break
            unvisited.remove(current)
            
            if current == end_node:
                break
                
            for neighbor in self.nodes[current]:
                if neighbor not in unvisited:
                    continue
                    
                edge_key = (current, neighbor)
                if edge_key in self.edges:
                    edge_length = self.edges[edge_key]['length']
                    new_distance = distances[current] + edge_length
                    
                    if new_distance < distances[neighbor]:
                        distances[neighbor] = new_distance
                        previous_nodes[neighbor] = current
        
        if previous_nodes.get(end_node) is None:
            app.logger.warning(f"No path found: start={start} end={end}")
            return None, 0, []
        
        # Reconstruct path
        path = []
        current = end_node
        while current:
            path.insert(0, current)
            current = previous_nodes.get(current)
        
        # Build coordinates and segments
        line_coords = []
        road_segments = []
        
        line_coords.append(start)
        
        start_to_first_node_distance = calculate_distance(start, start_node)
        
        if start != start_node and start_to_first_node_distance > 0:
            road_segments.append({
                'road_id': 'user_to_road',
                'length': start_to_first_node_distance,
                'type': 'user_segment',
                'from': start,
                'to': start_node
            })
        
        if start != start_node:
            line_coords.append(start_node)
        
        for i in range(len(path) - 1):
            edge_key = (path[i], path[i+1])
            if edge_key in self.edges:
                edge = self.edges[edge_key]
                line_coords.append(edge['geometry'][1])
                
                road_segments.append({
                    'road_id': edge['id'],
                    'length': edge['length']
                })
            else:
                segment_distance = calculate_distance(path[i], path[i+1])
                line_coords.append(path[i+1])
                
                road_segments.append({
                    'road_id': 'unknown_road',
                    'length': segment_distance,
                    'type': 'unknown_segment',
                    'from': path[i],
                    'to': path[i+1]
                })
        
        end_node_to_end_distance = calculate_distance(end_node, end)
        
        if end != end_node and end_node_to_end_distance > 0:
            road_segments.append({
                'road_id': 'road_to_user',
                'length': end_node_to_end_distance,
                'type': 'user_segment',
                'from': end_node,
                'to': end
            })
        
        if not line_coords or line_coords[-1] != end:
            line_coords.append(end)
        
        total_distance = start_to_first_node_distance + distances[end_node] + end_node_to_end_distance
        
        return line_coords, total_distance, road_segments

# Initialize road graph
road_graph = RoadGraph()

@app.route('/', methods=['GET'])
def main():
    return jsonify({
        "is_success": True,
        "msg": "API is running smoothly",
        "database": "Connected" if get_db_connection() else "Not Connected",
    })

@app.route('/cities', methods=['GET'])
def get_cities():
    user_id = request.args.get('user_id')
    if user_id:
        cities = get_all_cities_by_user(user_id)
    else:
        cities = get_all_cities()

    cities_list = [serialize_city_record(city) for city in cities]
    return jsonify({"is_success": True, "data": cities_list}), 200

@app.route('/cities/<uuid:city_id>', methods=['GET'])
def get_city(city_id):
    city = get_city_by_id(city_id)
    if not city:
        return jsonify({"is_success": False, "msg": "City not found"}), 404

    return jsonify({"is_success": True, "data": serialize_city_record(city)}), 200

@app.route('/locations', methods=['GET'])
def get_locations():
    user_id = request.args.get('user_id')
    city_id = request.args.get('city_id')
    if user_id:
        locations = get_locations_by_user(user_id)
    elif city_id:
        locations = get_locations_by_city(city_id)
    else:
        locations = get_all_locations()

    locations_list = [serialize_location_record(loc) for loc in locations]
    return jsonify({"is_success": True, "data": locations_list}), 200

@app.route('/city-details', methods=['GET'])
def get_city_details():
    """Public endpoint to fetch city details by city_id and predefined_title"""
    city_id = request.args.get('city_id')
    predefined_title = request.args.get('predefined_title')
    
    if not city_id:
        return jsonify({"is_success": False, "msg": "city_id is required"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        if predefined_title:
            cur.execute(
                "SELECT * FROM city_details WHERE city_id = %s AND predefined_title = %s ORDER BY created_at DESC LIMIT 1",
                (city_id, predefined_title)
            )
            detail = cur.fetchone()
            if not detail:
                return jsonify({"is_success": False, "msg": "City detail not found"}), 404
            return jsonify({"is_success": True, "data": serialize_city_detail_record(detail)}), 200
        else:
            cur.execute(
                "SELECT * FROM city_details WHERE city_id = %s ORDER BY created_at DESC",
                (city_id,)
            )
            details = cur.fetchall()
            return jsonify({"is_success": True, "data": [serialize_city_detail_record(d) for d in details]}), 200
    except Exception as exc:
        app.logger.error(f"Error fetching city details: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to fetch city details", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/roads', methods=['GET'])
def get_roads():
    user_id = request.args.get('user_id')
    city_id = request.args.get('city_id')
    if user_id:
        roads = get_roads_by_user(user_id)
    elif city_id:
        roads = get_roads_by_city(city_id)
    else:
        roads = get_all_roads()

    roads_list = [serialize_road_record(road) for road in roads]
    return jsonify({"is_success": True, "data": roads_list}), 200


def ensure_mapping(record):
    """Return a plain dict for serialization helpers."""
    if record is None:
        return {}
    if isinstance(record, dict):
        return record
    if hasattr(record, "keys"):
        return {key: record[key] for key in record.keys()}
    try:
        return dict(record)
    except Exception:
        return {}


def serialize_city_record(city):
    city = ensure_mapping(city)
    name_obj = city.get("name")
    address_obj = city.get("address")
    description_obj = city.get("description")
    name_payload = build_name_response(name_obj)
    address_payload = build_address_response(address_obj)
    description_payload = build_description_response(description_obj)
    return {
        "id": str(city["id"]),
        "user_id": str(city["user_id"]) if city["user_id"] is not None else None,
        **name_payload,
        **address_payload,
        "image_urls": city["image_urls"],
        **description_payload,
        "geometry": city["geometry"],
        "is_active": city.get("is_active")
    }


def serialize_location_record(location):
    location = ensure_mapping(location)
    name_obj = location.get("name")
    address_obj = location.get("address")
    description_obj = location.get("description")
    name_payload = build_name_response(name_obj)
    address_payload = build_address_response(address_obj)
    description_payload = build_description_response(description_obj)
    return {
        "id": str(location["id"]),
        "city_id": str(location["city_id"]) if location["city_id"] is not None else None,
        "user_id": str(location["user_id"]) if location["user_id"] is not None else None,
        **name_payload,
        **address_payload,
        "image_urls": location["image_urls"],
        **description_payload,
        "location_type": location["location_type"],
        "geometry": location["geometry"],
        "is_active": location.get("is_active")
    }


def serialize_road_record(road):
    road = ensure_mapping(road)
    name_obj = road.get("name")
    name_payload = build_name_response(name_obj)
    return {
        "id": str(road["id"]),
        "city_id": str(road["city_id"]) if road["city_id"] is not None else None,
        "user_id": str(road["user_id"]) if road["user_id"] is not None else None,
        **name_payload,
        "road_type": road["road_type"],
        "is_oneway": road["is_oneway"],
        "length_m": road["length_m"],
        "geometry": road["geometry"],
        "is_active": road.get("is_active")
    }


def serialize_user_record(user):
    return {
        "id": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "user_type": user.get("user_type"),
        "is_admin": user.get("is_admin"),
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
        "last_login": user["last_login"].isoformat() if user.get("last_login") else None,
    }


@app.route('/admin/dashboard', methods=['GET'])
@admin_required
def admin_dashboard_summary():
    cities = [serialize_city_record(city) for city in get_all_cities()]
    city_details = [serialize_city_detail_record(detail) for detail in get_all_city_details()]
    locations = [serialize_location_record(loc) for loc in get_all_locations()]
    roads = [serialize_road_record(road) for road in get_all_roads()]
    users = [serialize_user_record(user) for user in get_all_users()]
    collaborators = [serialize_user_record(user) for user in get_all_collaborators()]
    
    # Get all collaborator requests with user info
    collaborator_requests = []
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                SELECT
                    cr.id,
                    cr.user_id,
                    u.username,
                    u.email,
                    cr.organization,
                    cr.position,
                    cr.reason,
                    cr.status,
                    cr.admin_notes,
                    cr.created_at,
                    cr.updated_at
                FROM collaborator_requests cr
                JOIN users u ON cr.user_id = u.id
                WHERE cr.status = 'pending'
                ORDER BY cr.created_at DESC;
            """
        )
        requests = cur.fetchall()
        for req in requests:
            collaborator_requests.append({
                "id": str(req["id"]),
                "user_id": str(req["user_id"]),
                "username": req["username"],
                "email": req["email"],
                "organization": req["organization"],
                "position": req["position"],
                "reason": req["reason"],
                "status": req["status"],
                "admin_notes": req["admin_notes"],
                "created_at": req["created_at"].isoformat() if req.get("created_at") else None,
                "updated_at": req["updated_at"].isoformat() if req.get("updated_at") else None,
            })
    finally:
        cur.close()
        conn.close()

    return jsonify({
        "is_success": True,
        "data": {
            "cities": cities,
            "city_details": city_details,
            "locations": locations,
            "roads": roads,
            "users": users,
            "collaborators": collaborators,
            "collaborator_requests": collaborator_requests,
        },
    }), 200


@app.route('/collaborator/dashboard', methods=['GET'])
@collaborator_required
def collaborator_dashboard_summary():
    """Dashboard endpoint for collaborators - returns all content (for reference) and their own network data"""
    # Return all cities and city details (for reference in dropdowns, etc.)
    cities = [serialize_city_record(city) for city in get_all_cities()]
    city_details = [serialize_city_detail_record(detail) for detail in get_all_city_details()]
    
    # But only return locations and roads that the collaborator created
    current_user_id = get_jwt_identity()
    locations = [serialize_location_record(loc) for loc in get_all_locations()]
    roads = [serialize_road_record(road) for road in get_all_roads()]

    return jsonify({
        "is_success": True,
        "data": {
            "cities": cities,
            "city_details": city_details,
            "locations": locations,
            "roads": roads,
        },
    }), 200


# ===== Collaborator CRUD Endpoints =====

@app.route('/collaborator/cities', methods=['GET'])
@collaborator_required
def collaborator_list_cities():
    """Collaborators can only read cities they created"""
    current_user_id = get_jwt_identity()
    cities = [serialize_city_record(city) for city in get_all_cities_by_user(current_user_id)]
    return jsonify({"is_success": True, "data": cities}), 200


@app.route('/collaborator/cities', methods=['POST'])
@collaborator_required
def collaborator_create_city():
    """Collaborators can create cities (with their user_id)"""
    current_user_id = get_jwt_identity()
    data, is_multipart = extract_normalized_payload()
    
    # Force user_id to be the current collaborator
    data['user_id'] = current_user_id
    
    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
    if not address_payload and 'address' in data:
        address_payload = normalize_json_field(data.get('address'))

    description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
    if not description_payload and 'description' in data:
        description_payload = normalize_json_field(data.get('description'))

    geometry_wkt = parse_point_geometry(data)
    if not geometry_wkt:
        return jsonify({"is_success": False, "msg": "Valid geometry is required"}), 400

    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))

    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls

    is_active_value = coerce_boolean(data.get('is_active'))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO cities (user_id, name, address, description, image_urls, geom, is_active)
                VALUES (%s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
                RETURNING id,
                          user_id,
                          name,
                          address,
                          description,
                          image_urls,
                          ST_AsText(geom) AS geometry,
                          is_active;
            """,
            (
                str(current_user_id),
                psycopg2.extras.Json(name_payload),
                psycopg2.extras.Json(address_payload) if address_payload is not None else None,
                psycopg2.extras.Json(description_payload) if description_payload is not None else None,
                image_urls_value,
                geometry_wkt,
                is_active_value,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_city_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating city: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/cities/<uuid:city_id>', methods=['PUT'])
@collaborator_required
def collaborator_update_city(city_id):
    """Collaborators can only update cities they created"""
    current_user_id = get_jwt_identity()
    
    # First check if the city belongs to this user
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT user_id FROM cities WHERE id = %s;", (str(city_id),))
        city = cur.fetchone()
        if not city:
            return jsonify({"is_success": False, "msg": "City not found"}), 404
        if str(city['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only edit cities you created"}), 403
    finally:
        cur.close()
        conn.close()
    
    # Proceed with update
    data, is_multipart = extract_normalized_payload()
    updates = []
    params = []

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "City name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "City name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    if has_jsonb_payload(data, 'address', legacy_keys=('burmese_address', 'english_address')):
        address_payload = None
        if data.get('address') is not None or any(data.get(key) for key in ('address_mm', 'address_en', 'address_my', 'address_mm_MM', 'burmese_address', 'english_address')):
            address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
            if not address_payload:
                address_payload = normalize_json_field(data.get('address'))
        updates.append("address = %s")
        params.append(psycopg2.extras.Json(address_payload) if address_payload is not None else None)

    if has_jsonb_payload(data, 'description', legacy_keys=('burmese_description', 'english_description')):
        description_payload = None
        if data.get('description') is not None or any(data.get(key) for key in ('description_mm', 'description_en', 'description_my', 'description_mm_MM', 'burmese_description', 'english_description')):
            description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
            if not description_payload:
                description_payload = normalize_json_field(data.get('description'))
        updates.append("description = %s")
        params.append(psycopg2.extras.Json(description_payload) if description_payload is not None else None)

    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None

    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400

    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True

    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)

    geometry_wkt = parse_point_geometry(data)
    if geometry_wkt:
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(geometry_wkt)
    elif 'geometry' in data and data.get('geometry') in (None, ""):
        updates.append("geom = %s")
        params.append(None)

    if 'is_active' in data:
        is_active_value = coerce_boolean(data.get('is_active'))
        updates.append("is_active = %s")
        params.append(is_active_value)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(city_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(f"UPDATE cities SET {update_clause} WHERE id = %s RETURNING id, user_id, name, address, description, image_urls, ST_AsText(geom) AS geometry, is_active;", tuple(params))
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "City not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_city_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating city {city_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/cities/<uuid:city_id>', methods=['DELETE'])
@collaborator_required
def collaborator_delete_city(city_id):
    """Collaborators can only delete cities they created"""
    current_user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # Check ownership
        cur.execute("SELECT user_id FROM cities WHERE id = %s;", (str(city_id),))
        city = cur.fetchone()
        if not city:
            return jsonify({"is_success": False, "msg": "City not found"}), 404
        if str(city['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only delete cities you created"}), 403
        
        # Delete
        cur.execute("DELETE FROM cities WHERE id = %s RETURNING id;", (str(city_id),))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"is_success": True, "msg": "City deleted"}), 200
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return jsonify({
            "is_success": False,
            "msg": "Cannot delete city referenced by other records",
            "solution": "Remove dependent records first"
        }), 400
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting city {city_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# Collaborator City Details CRUD
@app.route('/collaborator/city-details', methods=['GET'])
@collaborator_required
def collaborator_list_city_details():
    """Collaborators can only read city details they created"""
    current_user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT 
                id,
                city_id,
                user_id,
                predefined_title,
                subtitle,
                body,
                image_urls,
                created_at,
                updated_at
            FROM city_details
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (str(current_user_id),))
        city_details = [serialize_city_detail_record(detail) for detail in cur.fetchall()]
        return jsonify({"is_success": True, "data": city_details}), 200
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/city-details', methods=['POST'])
@collaborator_required
def collaborator_create_city_detail():
    """Collaborators can create city details (with their user_id)"""
    current_user_id = get_jwt_identity()
    data, is_multipart = extract_normalized_payload()
    
    # Force user_id to be the current collaborator
    data['user_id'] = current_user_id
    
    city_id = data.get('city_id')
    if not city_id:
        return jsonify({"is_success": False, "msg": "city_id is required"}), 400
    
    predefined_title = data.get('predefined_title')
    if not predefined_title:
        return jsonify({"is_success": False, "msg": "predefined_title is required"}), 400
    
    subtitle_payload = coerce_multilingual_payload(data, 'subtitle')
    body_payload = coerce_multilingual_payload(data, 'body')
    
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))
    
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO city_details (city_id, user_id, predefined_title, subtitle, body, image_urls)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, city_id, user_id, predefined_title, subtitle, body, image_urls, created_at, updated_at;
            """,
            (
                str(city_id),
                str(current_user_id),
                predefined_title,
                psycopg2.extras.Json(subtitle_payload) if subtitle_payload is not None else None,
                psycopg2.extras.Json(body_payload) if body_payload is not None else None,
                image_urls_value,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_city_detail_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating city detail: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/city-details/<uuid:detail_id>', methods=['PUT'])
@collaborator_required
def collaborator_update_city_detail(detail_id):
    """Collaborators can only update city details they created"""
    current_user_id = get_jwt_identity()
    
    # Check ownership
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT user_id FROM city_details WHERE id = %s;", (str(detail_id),))
        detail = cur.fetchone()
        if not detail:
            return jsonify({"is_success": False, "msg": "City detail not found"}), 404
        if str(detail['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only edit city details you created"}), 403
    finally:
        cur.close()
        conn.close()
    
    data, is_multipart = extract_normalized_payload()
    updates = []
    params = []
    
    if 'city_id' in data:
        updates.append("city_id = %s")
        params.append(data.get('city_id'))
    
    if 'predefined_title' in data:
        updates.append("predefined_title = %s")
        params.append(data.get('predefined_title'))
    
    if has_jsonb_payload(data, 'subtitle'):
        subtitle_payload = coerce_multilingual_payload(data, 'subtitle')
        updates.append("subtitle = %s")
        params.append(psycopg2.extras.Json(subtitle_payload) if subtitle_payload is not None else None)
    
    if has_jsonb_payload(data, 'body'):
        body_payload = coerce_multilingual_payload(data, 'body')
        updates.append("body = %s")
        params.append(psycopg2.extras.Json(body_payload) if body_payload is not None else None)
    
    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None
    
    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
    
    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True
    
    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)
    
    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(str(detail_id))
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(
            f"UPDATE city_details SET {update_clause} WHERE id = %s RETURNING id, city_id, user_id, predefined_title, subtitle, body, image_urls, created_at, updated_at;",
            tuple(params)
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "City detail not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_city_detail_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating city detail {detail_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/city-details/<uuid:detail_id>', methods=['DELETE'])
@collaborator_required
def collaborator_delete_city_detail(detail_id):
    """Collaborators can only delete city details they created"""
    current_user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # Check ownership
        cur.execute("SELECT user_id FROM city_details WHERE id = %s;", (str(detail_id),))
        detail = cur.fetchone()
        if not detail:
            return jsonify({"is_success": False, "msg": "City detail not found"}), 404
        if str(detail['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only delete city details you created"}), 403
        
        # Delete
        cur.execute("DELETE FROM city_details WHERE id = %s RETURNING id;", (str(detail_id),))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"is_success": True, "msg": "City detail deleted"}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting city detail {detail_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# Collaborator Locations CRUD
@app.route('/collaborator/locations', methods=['GET'])
@collaborator_required
def collaborator_list_locations():
    """Collaborators can only read locations they created"""
    current_user_id = get_jwt_identity()
    locations = [serialize_location_record(loc) for loc in get_locations_by_user(current_user_id)]
    return jsonify({"is_success": True, "data": locations}), 200


@app.route('/collaborator/locations', methods=['POST'])
@collaborator_required
def collaborator_create_location():
    """Collaborators can create locations (with their user_id)"""
    current_user_id = get_jwt_identity()
    data, is_multipart = extract_normalized_payload()
    
    # Force user_id to be the current collaborator
    data['user_id'] = current_user_id
    
    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
    if not address_payload and 'address' in data:
        address_payload = normalize_json_field(data.get('address'))

    description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
    if not description_payload and 'description' in data:
        description_payload = normalize_json_field(data.get('description'))

    geometry_wkt = parse_point_geometry(data)
    if not geometry_wkt:
        return jsonify({"is_success": False, "msg": "Valid geometry is required"}), 400

    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))

    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO locations (city_id, user_id, name, address, description, image_urls, location_type, geom)
                VALUES (%s, %s, %s, %s, %s, %s, %s, ST_GeogFromText(%s))
                RETURNING id,
                          city_id,
                          user_id,
                          name,
                          address,
                          description,
                          image_urls,
                          location_type,
                          ST_AsText(geom) AS geometry;
            """,
            (
                data.get('city_id'),
                str(current_user_id),
                psycopg2.extras.Json(name_payload),
                psycopg2.extras.Json(address_payload) if address_payload is not None else None,
                psycopg2.extras.Json(description_payload) if description_payload is not None else None,
                image_urls_value,
                data.get('location_type'),
                geometry_wkt,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_location_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating location: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/locations/<uuid:location_id>', methods=['PUT'])
@collaborator_required
def collaborator_update_location(location_id):
    """Collaborators can only update locations they created"""
    current_user_id = get_jwt_identity()
    
    # Check ownership
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT user_id FROM locations WHERE id = %s;", (str(location_id),))
        location = cur.fetchone()
        if not location:
            return jsonify({"is_success": False, "msg": "Location not found"}), 404
        if str(location['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only edit locations you created"}), 403
    finally:
        cur.close()
        conn.close()
    
    data, is_multipart = extract_normalized_payload()
    updates = []
    params = []

    for field in ['city_id', 'location_type']:
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data.get(field))

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "Location name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "Location name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    if has_jsonb_payload(data, 'address', legacy_keys=('burmese_address', 'english_address')):
        address_payload = None
        if data.get('address') is not None or any(data.get(key) for key in ('address_mm', 'address_en', 'address_my', 'address_mm_MM', 'burmese_address', 'english_address')):
            address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
            if not address_payload:
                address_payload = normalize_json_field(data.get('address'))
        updates.append("address = %s")
        params.append(psycopg2.extras.Json(address_payload) if address_payload is not None else None)

    if has_jsonb_payload(data, 'description', legacy_keys=('burmese_description', 'english_description')):
        description_payload = None
        if data.get('description') is not None or any(data.get(key) for key in ('description_mm', 'description_en', 'description_my', 'description_mm_MM', 'burmese_description', 'english_description')):
            description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
            if not description_payload:
                description_payload = normalize_json_field(data.get('description'))
        updates.append("description = %s")
        params.append(psycopg2.extras.Json(description_payload) if description_payload is not None else None)

    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None

    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400

    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True

    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)

    geometry_wkt = parse_point_geometry(data)
    if geometry_wkt:
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(geometry_wkt)
    elif 'geometry' in data and data.get('geometry') in (None, ""):
        updates.append("geom = %s")
        params.append(None)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(location_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(
            f"UPDATE locations SET {update_clause} WHERE id = %s RETURNING id, city_id, user_id, name, address, description, image_urls, location_type, ST_AsText(geom) AS geometry;",
            tuple(params)
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "Location not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_location_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating location {location_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/locations/<uuid:location_id>', methods=['DELETE'])
@collaborator_required
def collaborator_delete_location(location_id):
    """Collaborators can only delete locations they created"""
    current_user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # Check ownership
        cur.execute("SELECT user_id FROM locations WHERE id = %s;", (str(location_id),))
        location = cur.fetchone()
        if not location:
            return jsonify({"is_success": False, "msg": "Location not found"}), 404
        if str(location['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only delete locations you created"}), 403
        
        # Delete
        cur.execute("DELETE FROM locations WHERE id = %s RETURNING id;", (str(location_id),))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"is_success": True, "msg": "Location deleted"}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting location {location_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# Collaborator Roads CRUD
@app.route('/collaborator/roads', methods=['GET'])
@collaborator_required
def collaborator_list_roads():
    """Collaborators can only read roads they created"""
    current_user_id = get_jwt_identity()
    roads = [serialize_road_record(road) for road in get_roads_by_user(current_user_id)]
    return jsonify({"is_success": True, "data": roads}), 200


@app.route('/collaborator/roads', methods=['POST'])
@collaborator_required
def collaborator_create_road():
    """Collaborators can create roads (with their user_id)"""
    current_user_id = get_jwt_identity()
    data, _ = extract_normalized_payload()
    
    # Force user_id to be the current collaborator
    data['user_id'] = current_user_id
    
    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    coordinates = parse_linestring_coordinates(data.get('coordinates'))
    if len(coordinates) < 2:
        return jsonify({"is_success": False, "msg": "At least 2 coordinates are required"}), 400

    linestring_wkt = build_linestring_wkt(coordinates)
    segment_lengths = compute_segment_lengths(coordinates)

    is_oneway = coerce_boolean(data.get('is_oneway', False))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO roads (city_id, user_id, name, road_type, is_oneway, length_m, geom)
                VALUES (%s, %s, %s, %s, %s, %s, ST_GeogFromText(%s))
                RETURNING id,
                          city_id,
                          user_id,
                          name,
                          road_type,
                          is_oneway,
                          length_m,
                          ST_AsText(geom) AS geometry;
            """,
            (
                data.get('city_id'),
                str(current_user_id),
                psycopg2.extras.Json(name_payload),
                data.get('road_type'),
                is_oneway,
                segment_lengths,
                linestring_wkt,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_road_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating road: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/roads/<uuid:road_id>', methods=['PUT'])
@collaborator_required
def collaborator_update_road(road_id):
    """Collaborators can only update roads they created"""
    current_user_id = get_jwt_identity()
    
    # Check ownership
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT user_id FROM roads WHERE id = %s;", (str(road_id),))
        road = cur.fetchone()
        if not road:
            return jsonify({"is_success": False, "msg": "Road not found"}), 404
        if str(road['user_id']) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only edit roads you created"}), 403
    finally:
        cur.close()
        conn.close()
    
    data, _ = extract_normalized_payload()
    updates = []
    params = []

    for field in ['city_id', 'road_type']:
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data.get(field))

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "Road name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "Road name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    if 'is_oneway' in data:
        is_oneway_value = coerce_boolean(data.get('is_oneway'))
        updates.append("is_oneway = %s")
        params.append(is_oneway_value)

    if 'coordinates' in data:
        coordinates = parse_linestring_coordinates(data.get('coordinates'))
        if len(coordinates) < 2:
            return jsonify({"is_success": False, "msg": "At least 2 coordinates are required"}), 400
        linestring_wkt = build_linestring_wkt(coordinates)
        segment_lengths = compute_segment_lengths(coordinates)
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(linestring_wkt)
        updates.append("length_m = %s")
        params.append(segment_lengths)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(road_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(
            f"UPDATE roads SET {update_clause} WHERE id = %s RETURNING id, city_id, user_id, name, road_type, is_oneway, length_m, ST_AsText(geom) AS geometry;",
            tuple(params)
        )
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "Road not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_road_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating road {road_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator/roads/<uuid:road_id>', methods=['DELETE'])
@collaborator_required
def collaborator_delete_road(road_id):
    """Collaborators can only delete roads they created"""
    current_user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check ownership
        cur.execute("SELECT user_id FROM roads WHERE id = %s;", (str(road_id),))
        road = cur.fetchone()
        if not road:
            return jsonify({"is_success": False, "msg": "Road not found"}), 404
        if str(road[0]) != str(current_user_id):
            return jsonify({"is_success": False, "msg": "You can only delete roads you created"}), 403
        
        # Delete
        cur.execute("DELETE FROM roads WHERE id = %s RETURNING id;", (str(road_id),))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"is_success": True, "msg": "Road deleted"}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting road {road_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/cities', methods=['GET'])
@admin_required
def admin_list_cities():
    cities = [serialize_city_record(city) for city in get_all_cities()]
    return jsonify({"is_success": True, "data": cities}), 200


@app.route('/admin/cities', methods=['POST'])
@admin_required
def admin_create_city():
    data, is_multipart = extract_normalized_payload()
    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
    if not address_payload and 'address' in data:
        address_payload = normalize_json_field(data.get('address'))

    description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
    if not description_payload and 'description' in data:
        description_payload = normalize_json_field(data.get('description'))

    geometry_wkt = parse_point_geometry(data)
    if not geometry_wkt:
        return jsonify({"is_success": False, "msg": "Valid geometry is required"}), 400

    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))

    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls

    is_active_value = True

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            f"""
                INSERT INTO cities (user_id, name, address, description, image_urls, geom, is_active)
                VALUES (%s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
                RETURNING id,
                          user_id,
                          name,
                          address,
                          description,
                          image_urls,
                          ST_AsText(geom) AS geometry,
                          is_active;
            """,
            (
                data.get('user_id'),
                psycopg2.extras.Json(name_payload),
                psycopg2.extras.Json(address_payload) if address_payload is not None else None,
                psycopg2.extras.Json(description_payload) if description_payload is not None else None,
                image_urls_value,
                geometry_wkt,
                is_active_value,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_city_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating city: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/cities/<uuid:city_id>', methods=['PUT'])
@admin_required
def admin_update_city(city_id):
    data, is_multipart = extract_normalized_payload()

    updates = []
    params = []

    if 'user_id' in data:
        updates.append("user_id = %s")
        params.append(data.get('user_id'))

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "City name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "City name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    if has_jsonb_payload(data, 'address', legacy_keys=('burmese_address', 'english_address')):
        address_payload = None
        if data.get('address') is not None or any(data.get(key) for key in ('address_mm', 'address_en', 'address_my', 'address_mm_MM', 'burmese_address', 'english_address')):
            address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
            if not address_payload:
                address_payload = normalize_json_field(data.get('address'))
        updates.append("address = %s")
        params.append(psycopg2.extras.Json(address_payload) if address_payload is not None else None)

    if has_jsonb_payload(data, 'description', legacy_keys=('burmese_description', 'english_description')):
        description_payload = None
        if data.get('description') is not None or any(data.get(key) for key in ('description_mm', 'description_en', 'description_my', 'description_mm_MM', 'burmese_description', 'english_description')):
            description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
            if not description_payload:
                description_payload = normalize_json_field(data.get('description'))
        updates.append("description = %s")
        params.append(psycopg2.extras.Json(description_payload) if description_payload is not None else None)

    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None

    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400

    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True

    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)

    geometry_wkt = parse_point_geometry(data)
    if geometry_wkt:
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(geometry_wkt)
    elif 'geometry' in data and data.get('geometry') in (None, ""):
        updates.append("geom = %s")
        params.append(None)

    if 'is_active' in data:
        is_active_value = coerce_boolean(data.get('is_active'))
        updates.append("is_active = %s")
        params.append(is_active_value)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(city_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(f"UPDATE cities SET {update_clause} WHERE id = %s RETURNING id, user_id, name, address, description, image_urls, ST_AsText(geom) AS geometry, is_active;", tuple(params))
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "City not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_city_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating city {city_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/cities/<uuid:city_id>', methods=['DELETE'])
@admin_required
def admin_delete_city(city_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM cities WHERE id = %s RETURNING id;", (str(city_id),))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"is_success": False, "msg": "City not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "msg": "City deleted"}), 200
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return jsonify({
            "is_success": False,
            "msg": "Cannot delete city referenced by other records",
            "solution": "Remove dependent records first"
        }), 400
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting city {city_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete city", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


# ===== City Details CRUD =====
def serialize_city_detail_record(detail):
    """Serialize city_detail record for JSON response."""
    detail = ensure_mapping(detail)
    subtitle_obj = detail.get("subtitle")
    body_obj = detail.get("body")
    
    subtitle_payload = {}
    body_payload = {}
    
    if isinstance(subtitle_obj, dict):
        subtitle_payload = {
            "subtitle_mm": subtitle_obj.get("mm"),
            "subtitle_en": subtitle_obj.get("en"),
        }
    
    if isinstance(body_obj, dict):
        body_payload = {
            "body_mm": body_obj.get("mm"),
            "body_en": body_obj.get("en"),
        }
    
    return {
        "id": str(detail["id"]),
        "city_id": str(detail["city_id"]) if detail["city_id"] is not None else None,
        "user_id": str(detail["user_id"]) if detail["user_id"] is not None else None,
        "predefined_title": detail.get("predefined_title"),
        **subtitle_payload,
        **body_payload,
        "image_urls": detail["image_urls"],
        "created_at": detail["created_at"].isoformat() if detail.get("created_at") else None,
        "updated_at": detail["updated_at"].isoformat() if detail.get("updated_at") else None,
    }


@app.route('/admin/city-details', methods=['GET'])
@admin_required
def admin_list_city_details():
    city_id = request.args.get('city_id')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        if city_id:
            cur.execute("SELECT * FROM city_details WHERE city_id = %s ORDER BY created_at DESC", (city_id,))
        else:
            cur.execute("SELECT * FROM city_details ORDER BY created_at DESC")
        details = cur.fetchall()
        return jsonify({"is_success": True, "data": [serialize_city_detail_record(d) for d in details]}), 200
    except Exception as exc:
        app.logger.error(f"Error listing city details: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to list city details", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/city-details', methods=['POST'])
@admin_required
def admin_create_city_detail():
    data, is_multipart = extract_normalized_payload()
    
    city_id = data.get('city_id')
    if not city_id:
        return jsonify({"is_success": False, "msg": "city_id is required"}), 400
    
    predefined_title = data.get('predefined_title')
    if not predefined_title:
        return jsonify({"is_success": False, "msg": "predefined_title is required"}), 400
    
    allowed_titles = [
        'introduction_and_history',
        'geography',
        'climate_and_environment',
        'demographics',
        'administrative_info',
        'economic_info',
        'social_info',
        'religious_info',
        'development_info',
        'general'
    ]
    
    if predefined_title not in allowed_titles:
        return jsonify({"is_success": False, "msg": f"Invalid predefined_title. Must be one of: {', '.join(allowed_titles)}"}), 400
    
    subtitle_payload = coerce_multilingual_payload(data, 'subtitle')
    if not subtitle_payload:
        subtitle_payload = normalize_json_field(data.get('subtitle'))
    
    body_payload = coerce_multilingual_payload(data, 'body')
    if not body_payload:
        body_payload = normalize_json_field(data.get('body'))
    if not body_payload:
        return jsonify({"is_success": False, "msg": "At least one of body_mm or body_en is required"}), 400
    
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))
    
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO city_details (city_id, user_id, predefined_title, subtitle, body, image_urls, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
            """,
            (
                city_id,
                data.get('user_id'),
                predefined_title,
                psycopg2.extras.Json(subtitle_payload) if subtitle_payload else None,
                psycopg2.extras.Json(body_payload),
                image_urls_value,
                True,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_city_detail_record(created)}), 201
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({"is_success": False, "msg": "A detail with this predefined title already exists for this city"}), 409
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating city detail: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/city-details/<uuid:detail_id>', methods=['PUT'])
@admin_required
def admin_update_city_detail(detail_id):
    data, is_multipart = extract_normalized_payload()
    
    updates = []
    params = []
    
    if 'city_id' in data:
        updates.append("city_id = %s")
        params.append(data.get('city_id'))
    
    if 'user_id' in data:
        updates.append("user_id = %s")
        params.append(data.get('user_id'))
    
    if 'predefined_title' in data:
        predefined_title = data.get('predefined_title')
        allowed_titles = [
            'introduction_and_history',
            'geography',
            'climate_and_environment',
            'demographics',
            'administrative_info',
            'economic_info',
            'social_info',
            'religious_info',
            'development_info',
            'general'
        ]
        if predefined_title not in allowed_titles:
            return jsonify({"is_success": False, "msg": f"Invalid predefined_title. Must be one of: {', '.join(allowed_titles)}"}), 400
        updates.append("predefined_title = %s")
        params.append(predefined_title)
    
    if has_jsonb_payload(data, 'subtitle'):
        subtitle_payload = coerce_multilingual_payload(data, 'subtitle')
        if not subtitle_payload:
            subtitle_payload = normalize_json_field(data.get('subtitle'))
        updates.append("subtitle = %s")
        params.append(psycopg2.extras.Json(subtitle_payload) if subtitle_payload else None)
    
    if has_jsonb_payload(data, 'body'):
        body_payload = coerce_multilingual_payload(data, 'body')
        if not body_payload:
            body_payload = normalize_json_field(data.get('body'))
        if not body_payload:
            return jsonify({"is_success": False, "msg": "Body cannot be empty"}), 400
        updates.append("body = %s")
        params.append(psycopg2.extras.Json(body_payload))
    
    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None
    
    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
    
    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True
    
    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)
    
    if 'is_active' in data:
        is_active_value = coerce_boolean(data.get('is_active'))
        updates.append("is_active = %s")
        params.append(is_active_value)
    
    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400
    
    params.append(str(detail_id))
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(f"UPDATE city_details SET {update_clause} WHERE id = %s RETURNING *;", tuple(params))
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "City detail not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_city_detail_record(updated)}), 200
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({"is_success": False, "msg": "A detail with this title already exists for this city"}), 409
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating city detail {detail_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/city-details/<uuid:detail_id>', methods=['DELETE'])
@admin_required
def admin_delete_city_detail(detail_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM city_details WHERE id = %s RETURNING id;", (str(detail_id),))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"is_success": False, "msg": "City detail not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "msg": "City detail deleted"}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting city detail {detail_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete city detail", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/locations', methods=['GET'])
@admin_required
def admin_list_locations():
    locations = [serialize_location_record(loc) for loc in get_all_locations()]
    return jsonify({"is_success": True, "data": locations}), 200


@app.route('/admin/locations', methods=['POST'])
@admin_required
def admin_create_location():
    data, is_multipart = extract_normalized_payload()
    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
    if not address_payload and 'address' in data:
        address_payload = normalize_json_field(data.get('address'))

    description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
    if not description_payload and 'description' in data:
        description_payload = normalize_json_field(data.get('description'))

    geometry_wkt = parse_point_geometry(data)
    if not geometry_wkt:
        return jsonify({"is_success": False, "msg": "Valid geometry is required"}), 400
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls'))

    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400
        else:
            if uploaded_urls:
                image_urls_value = (image_urls_value or []) + uploaded_urls

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            f"""
                INSERT INTO locations (city_id, user_id, name, address, description, image_urls, location_type, geom, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
                RETURNING id,
                          city_id,
                          user_id,
                          name,
                          address,
                          description,
                          image_urls,
                          location_type,
                          ST_AsText(geom) AS geometry,
                          is_active;
            """,
            (
                data.get('city_id'),
                data.get('user_id'),
                psycopg2.extras.Json(name_payload),
                psycopg2.extras.Json(address_payload) if address_payload is not None else None,
                psycopg2.extras.Json(description_payload) if description_payload is not None else None,
                image_urls_value,
                data.get('location_type'),
                geometry_wkt,
                True,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        return jsonify({"is_success": True, "data": serialize_location_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating location: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/locations/<uuid:location_id>', methods=['PUT'])
@admin_required
def admin_update_location(location_id):
    data, is_multipart = extract_normalized_payload()

    updates = []
    params = []

    for field in ['city_id', 'user_id', 'location_type']:
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data.get(field))

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "Location name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "Location name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    if has_jsonb_payload(data, 'address', legacy_keys=('burmese_address', 'english_address')):
        address_payload = None
        if data.get('address') is not None or any(data.get(key) for key in ('address_mm', 'address_en', 'address_my', 'address_mm_MM', 'burmese_address', 'english_address')):
            address_payload = coerce_multilingual_payload(data, 'address', legacy_keys=('burmese_address', 'english_address'))
            if not address_payload:
                address_payload = normalize_json_field(data.get('address'))
        updates.append("address = %s")
        params.append(psycopg2.extras.Json(address_payload) if address_payload is not None else None)

    if has_jsonb_payload(data, 'description', legacy_keys=('burmese_description', 'english_description')):
        description_payload = None
        if data.get('description') is not None or any(data.get(key) for key in ('description_mm', 'description_en', 'description_my', 'description_mm_MM', 'burmese_description', 'english_description')):
            description_payload = coerce_multilingual_payload(data, 'description', legacy_keys=('burmese_description', 'english_description'))
            if not description_payload:
                description_payload = normalize_json_field(data.get('description'))
        updates.append("description = %s")
        params.append(psycopg2.extras.Json(description_payload) if description_payload is not None else None)

    image_urls_present = 'image_urls' in data
    image_urls_value = prepare_image_urls_for_db(data.get('image_urls')) if image_urls_present else None

    uploaded_urls = []
    if is_multipart:
        try:
            uploaded_urls = save_uploaded_images_from_request()
        except ValueError as exc:
            return jsonify({"is_success": False, "msg": str(exc)}), 400

    if uploaded_urls:
        image_urls_value = (image_urls_value or []) + uploaded_urls
        image_urls_present = True

    if image_urls_present:
        updates.append("image_urls = %s")
        params.append(image_urls_value)

    geometry_wkt = parse_point_geometry(data)
    if geometry_wkt:
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(geometry_wkt)
    elif 'geometry' in data and data.get('geometry') in (None, ""):
        updates.append("geom = %s")
        params.append(None)

    if 'is_active' in data:
        is_active_value = coerce_boolean(data.get('is_active'))
        updates.append("is_active = %s")
        params.append(is_active_value)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(location_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(f"UPDATE locations SET {update_clause} WHERE id = %s RETURNING id, city_id, user_id, name, address, description, image_urls, location_type, ST_AsText(geom) AS geometry, is_active;", tuple(params))
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "Location not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "data": serialize_location_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating location {location_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/locations/<uuid:location_id>', methods=['DELETE'])
@admin_required
def admin_delete_location(location_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM locations WHERE id = %s RETURNING id;", (str(location_id),))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"is_success": False, "msg": "Location not found"}), 404
        conn.commit()
        return jsonify({"is_success": True, "msg": "Location deleted"}), 200
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return jsonify({
            "is_success": False,
            "msg": "Cannot delete location referenced by other records",
            "solution": "Remove dependent records first"
        }), 400
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting location {location_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete location", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/roads', methods=['GET'])
@admin_required
def admin_list_roads():
    roads = [serialize_road_record(road) for road in get_all_roads()]
    return jsonify({"is_success": True, "data": roads}), 200


@app.route('/admin/roads', methods=['POST'])
@admin_required
def admin_create_road():
    data = request.get_json() or {}

    name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
    if not name_payload:
        name_payload = normalize_json_field(data.get('name'))
    if not name_payload:
        return jsonify({"is_success": False, "msg": "At least one of name_mm or name_en is required"}), 400

    raw_coords = parse_linestring_coordinates(data.get('coordinates'))
    if len(raw_coords) < 2:
        return jsonify({"is_success": False, "msg": "At least two coordinates are required to create a road"}), 400

    geometry_wkt = build_linestring_wkt(raw_coords)
    segment_lengths = compute_segment_lengths(raw_coords)

    is_oneway_value = coerce_boolean(data.get('is_oneway', False))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            """
                INSERT INTO roads (
                    city_id,
                    user_id,
                    name,
                    road_type,
                    is_oneway,
                    length_m,
                    geom,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, ST_GeogFromText(%s), %s)
                RETURNING id,
                          city_id,
                          user_id,
                          name,
                          road_type,
                          is_oneway,
                          length_m,
                          ST_AsText(geom) AS geometry,
                          is_active
            """,
            (
                data.get('city_id'),
                data.get('user_id'),
                psycopg2.extras.Json(name_payload),
                data.get('road_type'),
                is_oneway_value,
                segment_lengths,
                geometry_wkt,
                True,
            ),
        )
        conn.commit()
        created = cur.fetchone()
        road_graph.build_graph()
        return jsonify({"is_success": True, "data": serialize_road_record(created)}), 201
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating road: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to create road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/roads/<uuid:road_id>', methods=['PUT'])
@admin_required
def admin_update_road(road_id):
    data = request.get_json() or {}

    updates = []
    params = []

    for field in ['city_id', 'user_id', 'road_type', 'is_oneway', 'is_active']:
        if field in data:
            updates.append(f"{field} = %s")
            if field == 'is_oneway' or field == 'is_active':
                value = coerce_boolean(data.get(field))
            else:
                value = data.get(field)
            params.append(value)

    if has_jsonb_payload(data, 'name', legacy_keys=('burmese_name', 'english_name')):
        if data.get('name') is None and data.get('burmese_name') is None and data.get('english_name') is None and not any(data.get(key) for key in ('name_mm', 'name_en', 'name_my', 'name_mm_MM')):
            return jsonify({"is_success": False, "msg": "Road name cannot be empty"}), 400
        name_payload = coerce_multilingual_payload(data, 'name', legacy_keys=('burmese_name', 'english_name'))
        if not name_payload:
            name_payload = normalize_json_field(data.get('name'))
        if not name_payload:
            return jsonify({"is_success": False, "msg": "Road name cannot be empty"}), 400
        updates.append("name = %s")
        params.append(psycopg2.extras.Json(name_payload))

    coords = parse_linestring_coordinates(data.get('coordinates')) if 'coordinates' in data else []
    lengths_override = data.get('length_m')

    if coords:
        lengths = compute_segment_lengths(coords)
        updates.append("geom = ST_GeogFromText(%s)")
        params.append(build_linestring_wkt(coords))
        updates.append("length_m = %s")
        params.append(lengths)
    elif lengths_override is not None:
        updates.append("length_m = %s")
        params.append(lengths_override)

    if not updates:
        return jsonify({"is_success": False, "msg": "No valid fields provided"}), 400

    params.append(str(road_id))

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        update_clause = ", ".join(updates)
        cur.execute(f"UPDATE roads SET {update_clause} WHERE id = %s RETURNING id, city_id, user_id, name, road_type, is_oneway, length_m, ST_AsText(geom) AS geometry, is_active;", tuple(params))
        updated = cur.fetchone()
        if not updated:
            return jsonify({"is_success": False, "msg": "Road not found"}), 404
        conn.commit()
        road_graph.build_graph()
        return jsonify({"is_success": True, "data": serialize_road_record(updated)}), 200
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating road {road_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to update road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/roads/<uuid:road_id>', methods=['DELETE'])
@admin_required
def admin_delete_road(road_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM roads WHERE id = %s RETURNING id;", (str(road_id),))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"is_success": False, "msg": "Road not found"}), 404
        conn.commit()
        road_graph.build_graph()
        return jsonify({"is_success": True, "msg": "Road deleted"}), 200
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        return jsonify({
            "is_success": False,
            "msg": "Cannot delete road referenced by other records",
            "solution": "Remove dependent records first"
        }), 400
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error deleting road {road_id}: {exc}")
        return jsonify({"is_success": False, "msg": "Failed to delete road", "error": str(exc)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/routes', methods=['POST'])
def plan_route():
    # Route planning implementation
    auth_header = request.headers.get("Authorization", "").strip()
    user_id = None

    if auth_header:
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
        except Exception as exc:
            app.logger.warning(f"Failed to verify JWT for route planning: {exc}")
            return jsonify({
                "is_success": False,
                "msg": "Invalid or expired session. Please sign in again.",
                "requires_auth": True,
            }), 401

    data = request.get_json()
    
    start_lon = data.get('start_lon')
    start_lat = data.get('start_lat')
    end_lon = data.get('end_lon')
    end_lat = data.get('end_lat')
    optimization = data.get('optimization', 'shortest')
    
    if None in (start_lon, start_lat, end_lon, end_lat):
        return jsonify({"is_success": False, "msg": "Missing coordinates"}), 400

    try:
        start_point = (float(start_lon), float(start_lat))
        end_point = (float(end_lon), float(end_lat))
    except ValueError:
        return jsonify({"is_success": False, "msg": "Invalid coordinates"}), 400
    
    path_coords, total_distance, road_segments = road_graph.dijkstra(start_point, end_point)

    if not path_coords or len(path_coords) < 2:
        return jsonify({
            "is_success": False,
            "msg": "No valid route found between the points",
            "suggestion": "Try closer points or check road network data"
        }), 404

    estimated_time = total_distance / 1.4  # Assuming 1.4 m/s average speed

    # Process road names and locations
    road_names = []
    start_location = None
    end_location = None
    step_locations = []
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # Process road segments
        user_segment_labels = {
            'user_to_road': {
                'mm': 'စတင်သည့်နေရာမှအနီးဆုံးသတ်မှတ်နေရာသို့',
                'en': 'From Start Location to Nearest Defined Location'
            },
            'road_to_user': {
                'mm': 'အနီးဆုံးသတ်မှတ်နေရာမှပြီးဆုံးနေရာသို့',
                'en': 'From Nearest Defined Location to End Location'
            }
        }

        for segment in road_segments:
            road_id = str(segment['road_id'])
            length_text = f"{segment['length']} meters"

            if segment['road_id'] in user_segment_labels:
                name_payload = build_name_response(user_segment_labels[segment['road_id']])
                road_names.append({
                    'road_id': road_id,
                    **name_payload,
                    'length': length_text,
                    'type': 'user_segment'
                })
            elif segment['road_id'] == 'unknown_road':
                unknown_name = {'mm': 'အမည်မသိလမ်း', 'en': 'Unknown Road Segment'}
                road_names.append({
                    'road_id': road_id,
                    **build_name_response(unknown_name),
                    'length': length_text,
                    'type': 'unknown_segment'
                })
            else:
                cur.execute(
                    "SELECT id, name FROM roads WHERE id::text = %s;",
                    (road_id,)
                )
                road_data = cur.fetchone()
                if road_data:
                    road_names.append({
                        'road_id': road_id,
                        **build_name_response(road_data['name']),
                        'length': length_text
                    })
                else:
                    fallback_name = {'mm': 'အမည်မသိလမ်း', 'en': 'Unknown Road'}
                    road_names.append({
                        'road_id': road_id,
                        **build_name_response(fallback_name),
                        'length': length_text
                    })

        # Get all locations for proximity checks
        cur.execute(
            "SELECT name, address, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat "
            "FROM locations;"
        )
        locations = cur.fetchall()

        def find_nearest_location(point, locations, max_dist=500):
            min_dist = float('inf')
            nearest = None
            for loc in locations:
                dist = calculate_distance(point, (loc['lon'], loc['lat']))
                if dist < min_dist and dist <= max_dist:
                    min_dist = dist
                    nearest = loc
            return nearest

        def format_defined_location(loc, location_type="defined_location"):
            payload = {
                **build_name_response(loc['name']),
                **build_address_response(loc['address']),
                "longitude": loc['lon'],
                "latitude": loc['lat'],
                "type": location_type
            }
            return payload
            
        # Find nearest locations
        nearest_start_location = find_nearest_location(start_point, locations)
        nearest_end_location = find_nearest_location(end_point, locations)
        
        close_start_location = find_nearest_location(start_point, locations, max_dist=50)
        close_end_location = find_nearest_location(end_point, locations, max_dist=50)
        
        # Set start and end locations
        start_location = format_defined_location(close_start_location) if close_start_location else {
            "longitude": start_point[0],
            "latitude": start_point[1],
            "coordinates": f"{start_point[0]}, {start_point[1]}",
            "type": "user_input"
        }
        
        end_location = format_defined_location(close_end_location) if close_end_location else {
            "longitude": end_point[0],
            "latitude": end_point[1],
            "coordinates": f"{end_point[0]}, {end_point[1]}",
            "type": "user_input"
        }
        
        start_name_payload = None
        if nearest_start_location and isinstance(nearest_start_location.get('name'), dict):
            start_name_payload = {
                key: value
                for key, value in nearest_start_location['name'].items()
                if value not in (None, "")
            }
        if start_name_payload is None:
            start_name_payload = normalize_json_field(data.get('start_name'))
        if isinstance(start_name_payload, dict) and not start_name_payload:
            start_name_payload = None
        if start_name_payload is None:
            start_name_payload = {"en": data.get('start_name') or "Start"}

        end_name_payload = None
        if nearest_end_location and isinstance(nearest_end_location.get('name'), dict):
            end_name_payload = {
                key: value
                for key, value in nearest_end_location['name'].items()
                if value not in (None, "")
            }
        if end_name_payload is None:
            end_name_payload = normalize_json_field(data.get('end_name'))
        if isinstance(end_name_payload, dict) and not end_name_payload:
            end_name_payload = None
        if end_name_payload is None:
            end_name_payload = {"en": data.get('end_name') or "End"}

        # Process step locations
        added_locations = set()
        
        for i, coord in enumerate(path_coords):
            if i > 0 and coord == path_coords[i-1]:
                continue
            
            coord_key = f"{coord[0]:.7f},{coord[1]:.7f}"
            if coord_key in added_locations:
                continue
                
            if i == 0:
                if close_start_location:
                    step_locations.append(format_defined_location(close_start_location))
                    added_locations.add(f"{close_start_location['lon']:.7f},{close_start_location['lat']:.7f}")
                else:
                    step_locations.append({
                        "longitude": coord[0],
                        "latitude": coord[1],
                        "coordinates": f"{coord[0]}, {coord[1]}",
                        "type": "user_input_start"
                    })
                    added_locations.add(coord_key)
            elif i == len(path_coords) - 1:
                if close_end_location:
                    close_coord_key = f"{close_end_location['lon']:.7f},{close_end_location['lat']:.7f}"
                    if close_coord_key not in added_locations:
                        step_locations.append(format_defined_location(close_end_location))
                        added_locations.add(close_coord_key)
                else:
                    if coord_key not in added_locations:
                        step_locations.append({
                            "longitude": coord[0],
                            "latitude": coord[1], 
                            "coordinates": f"{coord[0]}, {coord[1]}",
                            "type": "user_input_end"
                        })
                        added_locations.add(coord_key)
            else:
                loc = find_nearest_location(coord, locations)
                if loc:
                    loc_coord_key = f"{loc['lon']:.7f},{loc['lat']:.7f}"
                    if loc_coord_key not in added_locations:
                        step_locations.append(format_defined_location(loc))
                        added_locations.add(loc_coord_key)
                else:
                    if coord_key not in added_locations:
                        step_locations.append({
                            "longitude": coord[0],
                            "latitude": coord[1],
                            "coordinates": f"{coord[0]}, {coord[1]}",
                            "type": "road_point"
                        })
                        added_locations.add(coord_key)
    finally:
        cur.close()
        conn.close()

    # Create GeoJSON route
    geojson_route = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "LineString",
            "coordinates": [[lon, lat] for lon, lat in path_coords] 
        }
    }

    response_payload = {
        "route_id": None,
        "history_id": None,
        "distance": total_distance,
        "estimated_time": estimated_time,
        "route": geojson_route,
        "road_names": road_names,
        "step_locations": step_locations,
        "start_location": start_location,
        "end_location": end_location,
        "saved_to_history": False,
    }

    if not user_id:
        return jsonify({"is_success": True, "data": response_payload}), 200

    # Save route to database for authenticated users
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # IMPORTANT: path_coords stores (lon, lat). Do not swap when writing WKT.
        wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in path_coords])
        wkt_linestring = f"LINESTRING({wkt_coords})"

        cur.execute(
            "INSERT INTO routes (user_id, start_loc, end_loc, "
            "total_distance_m, estimated_time_s, geom) "
            "VALUES (%s, ST_GeogFromText(%s), ST_GeogFromText(%s), "
            "%s, %s, ST_GeogFromText(%s)) "
            "RETURNING id;",
            (
                user_id,
                f"SRID=4326;POINT({start_lon} {start_lat})",
                f"SRID=4326;POINT({end_lon} {end_lat})",
                total_distance,
                estimated_time,
                f"SRID=4326;{wkt_linestring}"
            )
        )
        route_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO user_route_history (user_id, route_id, "
            "start_name, end_name, total_distance_m, duration_min) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING history_id;",
            (
                user_id,
                route_id,
                psycopg2.extras.Json(start_name_payload) if start_name_payload is not None else None,
                psycopg2.extras.Json(end_name_payload) if end_name_payload is not None else None,
                total_distance,
                estimated_time / 60
            )
        )
        history_id = cur.fetchone()[0]

        conn.commit()

        response_payload.update({
            "route_id": route_id,
            "history_id": history_id,
            "saved_to_history": True,
        })

        return jsonify({"is_success": True, "data": response_payload}), 200

    except Exception as e:
        conn.rollback()
        app.logger.error(f"Database error: {str(e)}")
        return jsonify({"is_success": False, "msg": "Error saving route", "error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# === AUTHENTICATION ===
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({"is_success": False ,"msg": "Missing required fields"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute(
            "INSERT INTO users (username, email, password_hash) "
            "VALUES (%s, %s, crypt(%s, gen_salt('bf'))) RETURNING id;",
            (username, email, password)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"id": user_id, "is_success": True, "msg": "User created successfully"}), 201
    except psycopg2.errors.UniqueViolation:
        return jsonify({"is_success": False, "msg": "Username or email already exists"}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cur.execute(
        "SELECT * FROM users "
        "WHERE email = %s AND password_hash = crypt(%s, password_hash);",
        (email, password)
    )
    user = cur.fetchone()
    
    if user:
        cur.execute(
            "UPDATE users SET last_login = NOW() WHERE id = %s;",
            (user['id'],)
        )
        conn.commit()
    else:
        app.logger.warning(f"Login failed for user: {email}")

    if user:
        access_token = create_access_token(identity=str(user['id']))
        
        cur.close()
        conn.close()
        
        user_dict = dict(user)
        user_dict.pop('password_hash', None)
        return jsonify({"is_success": True, "access_token": access_token, "user": user_dict}), 200

    cur.close()
    conn.close()
    return jsonify({"is_success": False, "msg": "Invalid credentials"}), 401

@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({"is_success": True, "msg": "Successfully logged out"}), 200


@app.route('/routes/history', methods=['GET'])
@jwt_required()
def get_route_history():
    """Return the recent route history records for the authenticated user."""
    raw_user_id = get_jwt_identity()

    if raw_user_id is None:
        app.logger.warning("Missing user id in JWT when fetching history")
        return jsonify({"is_success": False, "msg": "Invalid user token"}), 401

    user_id = raw_user_id

    if isinstance(raw_user_id, str):
        user_id = raw_user_id.strip()
        if not user_id:
            app.logger.warning("Empty user id in JWT when fetching history")
            return jsonify({"is_success": False, "msg": "Invalid user token"}), 401

        try:
            user_id = str(uuid.UUID(user_id))
        except ValueError:
            # Leave non-UUID string ids as-is (e.g., numeric strings)
            pass
    elif isinstance(raw_user_id, (bytes, bytearray)):
        user_id = raw_user_id.decode(errors='ignore').strip()
        if not user_id:
            app.logger.warning("Empty byte user id in JWT when fetching history")
            return jsonify({"is_success": False, "msg": "Invalid user token"}), 401

        try:
            user_id = str(uuid.UUID(user_id))
        except ValueError:
            pass

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute(
            "SELECT history_id, route_id, start_name, end_name, total_distance_m, duration_min, accessed_at "
            "FROM user_route_history "
            "WHERE user_id = %s "
            "ORDER BY accessed_at DESC NULLS LAST, history_id DESC "
            "LIMIT 50;",
            (user_id,)
        )

        rows = cur.fetchall()

        history = []
        for row in rows:
            raw_start_name = row.get('start_name')
            if isinstance(raw_start_name, dict):
                start_name_text = raw_start_name.get('mm') or raw_start_name.get('en')
                start_name_mm = raw_start_name.get('mm')
                start_name_en = raw_start_name.get('en')
                start_name_json = raw_start_name
            else:
                start_name_text = raw_start_name
                start_name_mm = None
                start_name_en = None
                start_name_json = None

            raw_end_name = row.get('end_name')
            if isinstance(raw_end_name, dict):
                end_name_text = raw_end_name.get('mm') or raw_end_name.get('en')
                end_name_mm = raw_end_name.get('mm')
                end_name_en = raw_end_name.get('en')
                end_name_json = raw_end_name
            else:
                end_name_text = raw_end_name
                end_name_mm = None
                end_name_en = None
                end_name_json = None

            history.append({
                "id": str(row['history_id']) if row['history_id'] is not None else None,
                "route_id": row['route_id'],
                "start_name": start_name_text,
                "start_name_mm": start_name_mm,
                "start_name_en": start_name_en,
                "start_name_json": start_name_json,
                "end_name": end_name_text,
                "end_name_mm": end_name_mm,
                "end_name_en": end_name_en,
                "end_name_json": end_name_json,
                "distance": float(row['total_distance_m']) if row.get('total_distance_m') is not None else None,
                "duration_min": float(row['duration_min']) if row.get('duration_min') is not None else None,
                "created_at": row['accessed_at'].isoformat() if row.get('accessed_at') else None,
            })

        return jsonify({"is_success": True, "data": history}), 200

    except Exception as exc:
        app.logger.error("Error fetching route history for user %s: %s", user_id, str(exc))
        return jsonify({"is_success": False, "msg": "Failed to load route history"}), 500
    finally:
        cur.close()
        conn.close()


# ================== Collaborator Request Endpoints ==================

@app.route('/collaborator-requests', methods=['POST'])
@jwt_required()
def create_collaborator_request():
    """Create a new collaborator access request"""
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data:
        return jsonify({"is_success": False, "msg": "Request body required"}), 400

    organization = data.get('organization', '').strip()
    position = data.get('position', '').strip()
    reason = data.get('reason', '').strip()

    if not organization or not position or not reason:
        return jsonify({
            "is_success": False,
            "msg": "Organization, position, and reason are required"
        }), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Check if user already has a pending or approved request
        cur.execute("""
            SELECT id, status FROM collaborator_requests
            WHERE user_id = %s AND status IN ('pending', 'approved')
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        
        existing = cur.fetchone()
        if existing:
            status = existing['status']
            if status == 'approved':
                return jsonify({
                    "is_success": False,
                    "msg": "You already have an approved collaborator request"
                }), 400
            elif status == 'pending':
                return jsonify({
                    "is_success": False,
                    "msg": "You already have a pending collaborator request"
                }), 400

        # Create new request
        request_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO collaborator_requests 
            (id, user_id, organization, position, reason, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'pending', NOW(), NOW())
            RETURNING id, user_id, organization, position, reason, status, 
                      created_at, updated_at, admin_notes
        """, (request_id, user_id, organization, position, reason))
        
        new_request = cur.fetchone()
        conn.commit()

        return jsonify({
            "is_success": True,
            "data": {
                "id": str(new_request['id']),
                "user_id": str(new_request['user_id']),
                "organization": new_request['organization'],
                "position": new_request['position'],
                "reason": new_request['reason'],
                "status": new_request['status'],
                "created_at": new_request['created_at'].isoformat(),
                "updated_at": new_request['updated_at'].isoformat(),
                "admin_notes": new_request['admin_notes']
            }
        }), 201

    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error creating collaborator request: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to create request"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/collaborator-requests/my-request', methods=['GET'])
@jwt_required()
def get_my_collaborator_request():
    """Get the current user's collaborator request"""
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute("""
            SELECT id, user_id, organization, position, reason, status,
                   created_at, updated_at, admin_notes
            FROM collaborator_requests
            WHERE user_id = %s
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        
        request_data = cur.fetchone()
        
        if not request_data:
            return jsonify({"is_success": True, "data": None}), 200

        return jsonify({
            "is_success": True,
            "data": {
                "id": str(request_data['id']),
                "user_id": str(request_data['user_id']),
                "organization": request_data['organization'],
                "position": request_data['position'],
                "reason": request_data['reason'],
                "status": request_data['status'],
                "created_at": request_data['created_at'].isoformat(),
                "updated_at": request_data['updated_at'].isoformat(),
                "admin_notes": request_data['admin_notes']
            }
        }), 200

    except Exception as exc:
        app.logger.error(f"Error fetching collaborator request: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to fetch request"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/collaborator-requests', methods=['GET'])
@admin_required
def get_all_collaborator_requests():
    """Get all collaborator requests (admin only)"""
    status_filter = request.args.get('status')
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        query = """
            SELECT cr.id, cr.user_id, cr.organization, cr.position, cr.reason, 
                   cr.status, cr.created_at, cr.updated_at, cr.admin_notes,
                   u.username, u.email
            FROM collaborator_requests cr
            LEFT JOIN users u ON cr.user_id = u.id
        """
        
        params = []
        if status_filter:
            query += " WHERE cr.status = %s"
            params.append(status_filter)
        
        query += " ORDER BY cr.created_at DESC"
        
        cur.execute(query, params if params else None)
        requests = cur.fetchall()

        results = []
        for req in requests:
            results.append({
                "id": str(req['id']),
                "user_id": str(req['user_id']),
                "username": req['username'],
                "email": req['email'],
                "organization": req['organization'],
                "position": req['position'],
                "reason": req['reason'],
                "status": req['status'],
                "created_at": req['created_at'].isoformat(),
                "updated_at": req['updated_at'].isoformat(),
                "admin_notes": req['admin_notes']
            })

        return jsonify({"is_success": True, "data": results}), 200

    except Exception as exc:
        app.logger.error(f"Error fetching collaborator requests: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to fetch requests"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/collaborator-requests/<uuid:request_id>', methods=['PUT'])
@admin_required
def update_collaborator_request(request_id):
    """Approve or reject a collaborator request (admin only)"""
    data = request.get_json()
    
    if not data:
        return jsonify({"is_success": False, "msg": "Request body required"}), 400

    status = data.get('status', '').lower()
    admin_notes = data.get('admin_notes', '')

    if status not in ['approved', 'rejected']:
        return jsonify({
            "is_success": False,
            "msg": "Status must be 'approved' or 'rejected'"
        }), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Get the request and user info
        cur.execute("""
            SELECT cr.user_id, u.username, u.email 
            FROM collaborator_requests cr
            JOIN users u ON cr.user_id = u.id
            WHERE cr.id = %s
        """, (str(request_id),))
        
        request_data = cur.fetchone()
        if not request_data:
            return jsonify({"is_success": False, "msg": "Request not found"}), 404

        user_id = request_data['user_id']
        username = request_data['username']
        user_email = request_data['email']

        # Update the request status
        cur.execute("""
            UPDATE collaborator_requests
            SET status = %s, admin_notes = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, user_id, organization, position, reason, status,
                      created_at, updated_at, admin_notes
        """, (status, admin_notes, str(request_id)))
        
        updated_request = cur.fetchone()

        # If approved, update user's role to collaborator
        if status == 'approved':
            cur.execute("""
                UPDATE users SET user_type = 'collaborator' WHERE id = %s
            """, (str(user_id),))
            
            # Send approval email
            subject = "Collaborator Request Approved"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #10b981;">Congratulations, {username}!</h2>
                        <p>Your collaborator request has been <strong>approved</strong>.</p>
                        <p>You now have collaborator access to the Maubin Navigation platform.</p>
                        <p>You can now contribute to the platform by adding and managing content.</p>
                        {f'<div style="background-color: #f0f9ff; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;"><strong>Admin Note:</strong><br>{admin_notes}</div>' if admin_notes else ''}
                        <p style="margin-top: 30px;">Best regards,<br>Maubin Navigation Team</p>
                    </div>
                </body>
            </html>
            """
            send_email(user_email, subject, body)

        conn.commit()

        return jsonify({
            "is_success": True,
            "data": {
                "id": str(updated_request['id']),
                "user_id": str(updated_request['user_id']),
                "organization": updated_request['organization'],
                "position": updated_request['position'],
                "reason": updated_request['reason'],
                "status": updated_request['status'],
                "created_at": updated_request['created_at'].isoformat(),
                "updated_at": updated_request['updated_at'].isoformat(),
                "admin_notes": updated_request['admin_notes']
            }
        }), 200

    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating collaborator request: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to update request"}), 500
    finally:
        cur.close()
        conn.close()


# ================== Collaborator Management Endpoints ==================

@app.route('/admin/collaborators', methods=['GET'])
@admin_required
def get_collaborators_list():
    """Get all collaborators (admin only)"""
    collaborators = [serialize_user_record(user) for user in get_all_collaborators()]
    return jsonify({"is_success": True, "data": collaborators}), 200


@app.route('/admin/collaborators/<uuid:user_id>', methods=['GET'])
@admin_required
def get_collaborator_details(user_id):
    """Get details of a specific collaborator (admin only)"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        cur.execute("""
            SELECT
                id,
                username,
                email,
                user_type,
                is_admin,
                created_at,
                last_login
            FROM users
            WHERE id = %s AND user_type = 'collaborator'
        """, (str(user_id),))
        
        user = cur.fetchone()
        if not user:
            return jsonify({"is_success": False, "msg": "Collaborator not found"}), 404
        
        return jsonify({"is_success": True, "data": serialize_user_record(user)}), 200
    finally:
        cur.close()
        conn.close()


@app.route('/admin/collaborators/<uuid:user_id>', methods=['PUT'])
@admin_required
def update_collaborator(user_id):
    """Update collaborator details (admin only)"""
    data = request.get_json()
    
    if not data:
        return jsonify({"is_success": False, "msg": "Request body required"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Verify the user is a collaborator
        cur.execute("""
            SELECT id FROM users WHERE id = %s AND user_type = 'collaborator'
        """, (str(user_id),))
        
        if not cur.fetchone():
            return jsonify({"is_success": False, "msg": "Collaborator not found"}), 404
        
        # Build update query dynamically based on provided fields
        update_fields = []
        params = []
        
        if 'username' in data:
            update_fields.append("username = %s")
            params.append(data['username'])
        
        if 'email' in data:
            update_fields.append("email = %s")
            params.append(data['email'])
        
        if 'password' in data and data['password']:
            from werkzeug.security import generate_password_hash
            update_fields.append("password_hash = %s")
            params.append(generate_password_hash(data['password']))
        
        if not update_fields:
            return jsonify({"is_success": False, "msg": "No fields to update"}), 400
        
        params.append(str(user_id))
        
        query = f"""
            UPDATE users
            SET {', '.join(update_fields)}
            WHERE id = %s
            RETURNING id, username, email, user_type, is_admin, created_at, last_login
        """
        
        cur.execute(query, params)
        updated_user = cur.fetchone()
        conn.commit()
        
        return jsonify({
            "is_success": True,
            "data": serialize_user_record(updated_user)
        }), 200
        
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error updating collaborator: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to update collaborator"}), 500
    finally:
        cur.close()
        conn.close()


@app.route('/admin/collaborators/<uuid:user_id>', methods=['DELETE'])
@admin_required
def delete_collaborator(user_id):
    """Revoke collaborator status or delete collaborator (admin only)"""
    data = request.get_json() or {}
    admin_notes = data.get('admin_notes', '')
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Verify the user is a collaborator and get user info
        cur.execute("""
            SELECT id, username, email FROM users WHERE id = %s AND user_type = 'collaborator'
        """, (str(user_id),))
        
        user = cur.fetchone()
        if not user:
            return jsonify({"is_success": False, "msg": "Collaborator not found"}), 404
        
        username = user['username']
        user_email = user['email']
        
        # Option 1: Revoke collaborator status (change back to normal_user)
        # Option 2: Delete the user entirely
        # Let's use Option 1 by default - revoke collaborator status
        
        cur.execute("""
            UPDATE users
            SET user_type = 'normal_user'
            WHERE id = %s
        """, (str(user_id),))
        
        # Soft delete from collaborator_requests table by setting status to 'revoked'
        cur.execute("""
            UPDATE collaborator_requests
            SET status = 'revoked', admin_notes = %s, updated_at = NOW()
            WHERE user_id = %s AND status = 'approved'
        """, (admin_notes, str(user_id),))
        
        conn.commit()
        
        # Send revocation email
        subject = "Collaborator Access Revoked"
        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #ef4444;">Collaborator Access Revoked</h2>
                    <p>Dear {username},</p>
                    <p>Your collaborator access to the Maubin Navigation platform has been <strong>revoked</strong>.</p>
                    <p>Your account will be reverted to regular user status.</p>
                    {f'<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;"><strong>Reason:</strong><br>{admin_notes}</div>' if admin_notes else ''}
                    <p>If you believe this is a mistake or have any questions, please contact the administrator.</p>
                    <p style="margin-top: 30px;">Best regards,<br>Maubin Navigation Team</p>
                </div>
            </body>
        </html>
        """
        send_email(user_email, subject, body)
        
        return jsonify({
            "is_success": True,
            "msg": "Collaborator status revoked successfully"
        }), 200
        
    except Exception as exc:
        conn.rollback()
        app.logger.error(f"Error revoking collaborator status: {str(exc)}")
        return jsonify({"is_success": False, "msg": "Failed to revoke collaborator status"}), 500
    finally:
        cur.close()
        conn.close()


# Health check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "nodes": len(road_graph.nodes)})

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"is_success": False,"msg": "Resource not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Server error: {str(error)}")
    return jsonify({"is_success": False,"msg": "Internal server error"}), 500
    
if __name__ == '__main__':
    # Development mode - only use for local testing
    # For production, use: gunicorn -c gunicorn.conf.py app:app
    port = int(os.environ.get('PORT', 4000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)