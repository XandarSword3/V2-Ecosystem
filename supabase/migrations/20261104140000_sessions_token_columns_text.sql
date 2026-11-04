-- Migration: Alter sessions table token and refresh_token columns to TEXT
--
-- Why:
-- The sessions table defined `token` and `refresh_token` as VARCHAR(500).
-- When JWT payloads contain tenant_id, scope, roles, jti, and user metadata,
-- the encoded JWT string often exceeds 450-500 characters (e.g. 500-600 characters).
-- Postgres throws error 22001: "value too long for type character varying(500)",
-- causing login session creation to fail. This prevents session persistence,
-- session tracking, token refresh, and single-session logout.
--
-- Changing these columns to TEXT removes the arbitrary length ceiling.

ALTER TABLE "public"."sessions"
  ALTER COLUMN "token" TYPE TEXT,
  ALTER COLUMN "refresh_token" TYPE TEXT;
