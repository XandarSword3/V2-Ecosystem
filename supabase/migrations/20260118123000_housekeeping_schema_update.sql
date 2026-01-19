-- Migration: 20260118121500_housekeeping_schema.sql
-- Description: Add housekeeping task management and inventory tracking
-- Source: backend/src/database/migrations/007_housekeeping_inventory.sql
-- Date: 2026-01-18

-- ============================================
-- HOUSEKEEPING SYSTEM
-- ============================================

-- CLEANUP (Dev Mode: Ensure fresh schema)
DROP TABLE IF EXISTS housekeeping_schedules CASCADE;
DROP TABLE IF EXISTS housekeeping_logs CASCADE;
DROP TABLE IF EXISTS housekeeping_tasks CASCADE;
DROP TABLE IF EXISTS housekeeping_task_types CASCADE;

-- Housekeeping task types/templates
CREATE TABLE IF NOT EXISTS housekeeping_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    estimated_duration INTEGER DEFAULT 30,
    checklist JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    applies_to VARCHAR(50) DEFAULT 'chalet' CHECK (applies_to IN ('chalet', 'pool', 'restaurant', 'common_area', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping tasks
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type_id UUID REFERENCES housekeeping_task_types(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    chalet_id UUID REFERENCES chalets(id),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'verified', 'cancelled')),
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    checklist_completed JSONB DEFAULT '[]',
    notes TEXT,
    photos JSONB DEFAULT '[]',
    booking_id UUID, -- Related booking if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping schedules (recurring tasks)
CREATE TABLE IF NOT EXISTS housekeeping_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type_id UUID REFERENCES housekeeping_task_types(id),
    chalet_id UUID REFERENCES chalets(id),
    repeat_pattern VARCHAR(30) NOT NULL CHECK (repeat_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'on_checkout', 'inventory_check', 'checkout')),
    day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc.
    time_slot VARCHAR(10) DEFAULT '09:00',
    assigned_to UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    last_generated TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Housekeeping logs (audit trail)
CREATE TABLE IF NOT EXISTS housekeeping_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES housekeeping_tasks(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    notes TEXT,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVENTORY SYSTEM - REMOVED TO PREVENT CONFLICTS
-- ============================================

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_scheduled ON housekeeping_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_chalet ON housekeeping_tasks(chalet_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_logs_task ON housekeeping_logs(task_id);

-- Inventory Section Removed to avoid conflicts

