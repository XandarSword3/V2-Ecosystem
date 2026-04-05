-- File: supabase/migrations/00000000000000_init_users.sql
-- UP Migration
BEGIN;

-- Baseline users table required by the earliest schema migrations.
-- Keep this table lean but compatible with later ALTER TABLE and RLS/policy logic.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
	CREATE TYPE business_unit AS ENUM ('restaurant', 'snack_bar', 'chalets', 'pool', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE payment_method AS ENUM ('cash', 'card', 'whish', 'online');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE ticket_status AS ENUM ('valid', 'used', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE snack_category AS ENUM ('sandwich', 'drink', 'snack', 'ice_cream');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE TYPE price_type AS ENUM ('per_night', 'one_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email VARCHAR(255) UNIQUE,
	phone VARCHAR(20),
	password_hash VARCHAR(255),
	full_name VARCHAR(255),
	profile_image_url TEXT,
	preferred_language VARCHAR(10) DEFAULT 'en',
	role VARCHAR(50) DEFAULT 'customer',
	roles TEXT[] DEFAULT ARRAY['customer']::TEXT[],
	token_version INTEGER NOT NULL DEFAULT 0,
	email_verified BOOLEAN DEFAULT false,
	phone_verified BOOLEAN DEFAULT false,
	is_active BOOLEAN DEFAULT true,
	last_login_at TIMESTAMPTZ,
	oauth_provider VARCHAR(50),
	oauth_provider_id VARCHAR(255),
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS roles (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name VARCHAR(50) NOT NULL UNIQUE,
	display_name VARCHAR(100),
	description TEXT,
	business_unit VARCHAR(50),
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
	role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
	granted_by UUID REFERENCES users(id),
	granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	expires_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	slug VARCHAR(100) NOT NULL UNIQUE,
	name VARCHAR(100) NOT NULL UNIQUE,
	description TEXT,
	resource VARCHAR(100),
	action VARCHAR(100),
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
	role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
	permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS sessions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
	token VARCHAR(500) UNIQUE,
	refresh_token VARCHAR(500),
	expires_at TIMESTAMPTZ,
	ip_address VARCHAR(45),
	user_agent TEXT,
	is_active BOOLEAN DEFAULT true,
	last_activity TIMESTAMPTZ DEFAULT NOW(),
	created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMIT;
