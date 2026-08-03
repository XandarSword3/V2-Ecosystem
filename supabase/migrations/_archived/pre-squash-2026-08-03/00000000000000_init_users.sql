-- File: supabase/migrations/00000000000000_init_users.sql
-- UP Migration
BEGIN;

-- Baseline users table required by the earliest schema migrations.
-- Keep this table lean but compatible with later ALTER TABLE and RLS/policy logic.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Supabase compatibility shim for plain Postgres CI runs.
-- Many later migrations reference auth.users/auth.uid()/auth.role()/auth.jwt().
DO $$
DECLARE
	can_manage_auth BOOLEAN := true;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
		BEGIN
			CREATE SCHEMA auth;
		EXCEPTION WHEN insufficient_privilege THEN
			can_manage_auth := false;
		END;
	END IF;

	IF can_manage_auth THEN
		BEGIN
			CREATE TABLE IF NOT EXISTS auth.users (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				email TEXT,
				created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
				updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
			);
		EXCEPTION WHEN insufficient_privilege THEN
			can_manage_auth := false;
		END;
	END IF;

	IF can_manage_auth THEN
		BEGIN
			CREATE OR REPLACE FUNCTION auth.jwt()
			RETURNS jsonb
			LANGUAGE sql
			STABLE
			AS $auth_jwt$
				SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
			$auth_jwt$;

			CREATE OR REPLACE FUNCTION auth.uid()
			RETURNS uuid
			LANGUAGE sql
			STABLE
			AS $auth_uid$
				SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid
			$auth_uid$;

			CREATE OR REPLACE FUNCTION auth.role()
			RETURNS text
			LANGUAGE sql
			STABLE
			AS $auth_role$
				SELECT COALESCE(NULLIF(auth.jwt() ->> 'role', ''), 'anon')
			$auth_role$;
		EXCEPTION WHEN insufficient_privilege THEN
			NULL;
		END;
	END IF;
END $$;

DO $$ BEGIN
	CREATE TYPE business_unit AS ENUM ('menu_service', 'kiosk', 'accommodation', 'shared_capacity', 'admin');
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
	CREATE TYPE kiosk_item_category AS ENUM ('sandwich', 'drink', 'savory', 'ice_cream');
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
