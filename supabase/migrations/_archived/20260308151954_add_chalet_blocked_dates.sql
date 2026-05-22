-- Manual blocked dates for chalets (admin can block specific dates)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalets'
  ) THEN
    CREATE TABLE IF NOT EXISTS chalet_blocked_dates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chalet_id UUID NOT NULL REFERENCES chalets(id) ON DELETE CASCADE,
      blocked_date DATE NOT NULL,
      reason TEXT,
      blocked_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(chalet_id, blocked_date)
    );
  ELSE
    CREATE TABLE IF NOT EXISTS chalet_blocked_dates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chalet_id UUID NOT NULL,
      blocked_date DATE NOT NULL,
      reason TEXT,
      blocked_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(chalet_id, blocked_date)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chalet_blocked_dates_chalet ON chalet_blocked_dates(chalet_id);
CREATE INDEX IF NOT EXISTS idx_chalet_blocked_dates_date ON chalet_blocked_dates(blocked_date);
