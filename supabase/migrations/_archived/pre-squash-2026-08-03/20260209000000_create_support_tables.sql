-- Create support_inquiries table for contact form
CREATE TABLE IF NOT EXISTS support_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new',
  admin_notes TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies for support_inquiries
ALTER TABLE support_inquiries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_support_inquiries" ON support_inquiries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RLS policies for faqs
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_faqs" ON faqs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
