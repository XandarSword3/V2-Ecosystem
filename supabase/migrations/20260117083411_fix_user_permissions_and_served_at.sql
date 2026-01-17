-- Migration: fix_user_permissions_and_served_at
-- Created: 2026-01-17
-- Purpose: Fix bugs discovered during E2E testing

-- FIX 1: Create user_permissions table for permission overrides
-- This table allows granting/revoking specific permissions per user
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  is_granted BOOLEAN DEFAULT TRUE NOT NULL,
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

-- Index for fast permission lookups by user
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- FIX 2: Add served_at column for order completion tracking
-- Required for KDS "Mark Served" functionality
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;
