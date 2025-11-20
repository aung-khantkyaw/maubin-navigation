-- ============================================================
-- Database Schema for Maubin Navigation
-- Production-ready version for Render PostgreSQL
-- Date: 2025-10-18
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    user_type VARCHAR(20) CHECK (
        user_type IN (
            'admin',
            'collaborator',
            'normal_user'
        )
    ) DEFAULT 'normal_user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- 2. CITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    name JSONB NOT NULL CHECK (jsonb_typeof(name) = 'object'),
    address JSONB CHECK (
        address IS NULL
        OR jsonb_typeof(address) = 'object'
    ),
    description JSONB CHECK (
        description IS NULL
        OR jsonb_typeof(description) = 'object'
    ),
    image_urls TEXT [],
    geom GEOGRAPHY (POINT, 4326) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2a. CITY DETAILS (rich content blocks)
-- ============================================================
CREATE TABLE IF NOT EXISTS city_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    city_id UUID NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE SET NULL,
    predefined_title VARCHAR(100) NOT NULL CHECK (
        predefined_title IN (
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
        )
    ),
    subtitle JSONB CHECK (
        subtitle IS NULL
        OR jsonb_typeof(subtitle) = 'object'
    ),
    body JSONB NOT NULL CHECK (jsonb_typeof(body) = 'object'),
    image_urls TEXT [],
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_city_detail_predefined_title UNIQUE (city_id, predefined_title)
);

-- ============================================================
-- 3. LOCATIONS (Points of Interest)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    city_id UUID REFERENCES cities (id) ON DELETE SET NULL,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    name JSONB NOT NULL CHECK (jsonb_typeof(name) = 'object'),
    address JSONB CHECK (
        address IS NULL
        OR jsonb_typeof(address) = 'object'
    ),
    description JSONB CHECK (
        description IS NULL
        OR jsonb_typeof(description) = 'object'
    ),
    image_urls TEXT [],
    geom GEOGRAPHY (POINT, 4326) NOT NULL,
    location_type VARCHAR(30) CHECK (
        location_type IN (
            'hospital',
            'police_station',
            'fire_station',
            'post_office',
            'government_office',
            'embassy',
            'bus_stop',
            'train_station',
            'airport',
            'parking_lot',
            'gas_station',
            'harbor',
            'restaurant',
            'cafe',
            'bar',
            'cinema',
            'stadium',
            'sports_center',
            'park',
            'zoo',
            'amusement_park',
            'store',
            'market',
            'mall',
            'supermarket',
            'bank',
            'hotel',
            'pharmacy',
            'beauty_salon',
            'laundry',
            'school',
            'university',
            'library',
            'museum',
            'pagoda',
            'temple',
            'church',
            'mosque',
            'apartment',
            'residential_area',
            'factory',
            'warehouse',
            'farm',
            'cemetery',
            'landmark',
            'intersection',
            'office',
            'monastery',
            'other'
        )
    ),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Removed UNIQUE constraint on geom because it's not supported for GEOGRAPHY type
-- Application should handle duplicate location validation

-- ============================================================
-- 4. ROADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS roads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    city_id UUID REFERENCES cities (id) ON DELETE SET NULL,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    name JSONB NOT NULL CHECK (jsonb_typeof(name) = 'object'),
    geom GEOGRAPHY (LINESTRING, 4326) NOT NULL,
    length_m DOUBLE PRECISION[] NOT NULL,
    road_type VARCHAR(20) CHECK (
        road_type IN (
            'highway',
            'local_road',
            'residential_road',
            'bridge',
            'tunnel'
        )
    ),
    is_oneway BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_linestring CHECK (
        ST_GeometryType (geom::geometry) = 'ST_LineString'
    )
);

-- ============================================================
-- 5. ROUTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    start_loc GEOGRAPHY (POINT, 4326) NOT NULL,
    end_loc GEOGRAPHY (POINT, 4326) NOT NULL,
    total_distance_m FLOAT CHECK (total_distance_m > 0),
    estimated_time_s FLOAT CHECK (estimated_time_s > 0),
    geom GEOGRAPHY (LINESTRING, 4326),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_route_linestring CHECK (
        geom IS NULL
        OR ST_GeometryType (geom::geometry) = 'ST_LineString'
    )
);

-- ============================================================
-- 6. USER ROUTE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS user_route_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
    accessed_at TIMESTAMP DEFAULT NOW(),
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    notes JSONB CHECK (
        notes IS NULL
        OR jsonb_typeof(notes) = 'object'
    ),
    start_name JSONB CHECK (
        start_name IS NULL
        OR jsonb_typeof(start_name) = 'object'
    ),
    end_name JSONB CHECK (
        end_name IS NULL
        OR jsonb_typeof(end_name) = 'object'
    ),
    total_distance_m FLOAT,
    duration_min FLOAT
);

-- ============================================================
-- 7. COLLABORATOR REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS collaborator_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    organization VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'approved',
            'rejected',
            'revoked'
        )
    ),
    admin_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_preferences_gin ON users USING GIN (preferences jsonb_path_ops);

-- City indexes
CREATE INDEX IF NOT EXISTS idx_cities_geom ON cities USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_cities_name_gin ON cities USING GIN (name jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_cities_active ON cities (is_active);

-- City details indexes
CREATE INDEX IF NOT EXISTS idx_city_details_city ON city_details (city_id);

CREATE INDEX IF NOT EXISTS idx_city_details_predefined_title ON city_details (predefined_title);

CREATE INDEX IF NOT EXISTS idx_city_details_body_gin ON city_details USING GIN (body jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_city_details_active ON city_details (is_active);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_locations_name_gin ON locations USING GIN (name jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_locations_type ON locations (location_type);

CREATE INDEX IF NOT EXISTS idx_locations_active ON locations (is_active);

-- Road indexes
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_roads_name_gin ON roads USING GIN (name jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_roads_type ON roads (road_type);

CREATE INDEX IF NOT EXISTS idx_roads_active ON roads (is_active);

-- Route indexes
CREATE INDEX IF NOT EXISTS idx_routes_geom ON routes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_routes_start ON routes USING GIST (start_loc);

CREATE INDEX IF NOT EXISTS idx_routes_end ON routes USING GIST (end_loc);

-- Route history indexes
CREATE INDEX IF NOT EXISTS idx_history_user ON user_route_history (user_id);

CREATE INDEX IF NOT EXISTS idx_history_route ON user_route_history (route_id);

CREATE INDEX IF NOT EXISTS idx_history_start_name_gin ON user_route_history USING GIN (start_name jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_history_end_name_gin ON user_route_history USING GIN (end_name jsonb_path_ops);

-- Collaborator request indexes
CREATE INDEX IF NOT EXISTS idx_collaborator_requests_user_id ON collaborator_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_collaborator_requests_status ON collaborator_requests (status);

-- ============================================================
-- TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Users trigger
DROP TRIGGER IF EXISTS trg_users_touch ON users;

CREATE TRIGGER trg_users_touch
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Cities trigger
DROP TRIGGER IF EXISTS trg_cities_touch ON cities;

CREATE TRIGGER trg_cities_touch
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- City details trigger
DROP TRIGGER IF EXISTS trg_city_details_touch ON city_details;

CREATE TRIGGER trg_city_details_touch
  BEFORE UPDATE ON city_details
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Locations trigger
DROP TRIGGER IF EXISTS trg_locations_touch ON locations;

CREATE TRIGGER trg_locations_touch
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Roads trigger
DROP TRIGGER IF EXISTS trg_roads_touch ON roads;

CREATE TRIGGER trg_roads_touch
  BEFORE UPDATE ON roads
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Routes trigger
DROP TRIGGER IF EXISTS trg_routes_touch ON routes;

CREATE TRIGGER trg_routes_touch
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Collaborator requests trigger
DROP TRIGGER IF EXISTS trg_collaborator_requests_touch ON collaborator_requests;

CREATE TRIGGER trg_collaborator_requests_touch
  BEFORE UPDATE ON collaborator_requests
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- TABLE COMMENTS
-- ============================================================
COMMENT ON TABLE collaborator_requests IS 'Stores requests from normal users to become collaborators';

COMMENT ON COLUMN collaborator_requests.status IS 'Request status: pending, approved, rejected, or revoked';

COMMENT ON COLUMN collaborator_requests.admin_notes IS 'Notes from admin when approving/rejecting the request';

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - users';
    RAISE NOTICE '  - cities';
    RAISE NOTICE '  - city_details';
    RAISE NOTICE '  - locations';
    RAISE NOTICE '  - roads';
    RAISE NOTICE '  - routes';
    RAISE NOTICE '  - user_route_history';
    RAISE NOTICE '  - collaborator_requests';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'All tables have is_active column for moderation';
    RAISE NOTICE 'All indexes and triggers created successfully';
    RAISE NOTICE '================================================';
END $$;