-- Create backups table to track database snapshots
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT,
    type TEXT NOT NULL CHECK (type IN ('manual', 'scheduled')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    checksum TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for faster history retrieval
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Note: Ensure a 'backups' bucket is created in Supabase Storage
