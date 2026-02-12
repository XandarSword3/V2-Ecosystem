-- =============================================
-- Phase 4.3: Guest Messaging
-- Database Migration
-- =============================================

-- Messaging Channels Configuration
CREATE TABLE IF NOT EXISTS messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel_type VARCHAR(30) NOT NULL, -- sms, whatsapp, email, in_app, web_chat
  
  -- Provider config
  provider VARCHAR(50) NOT NULL, -- twilio, messagebird, vonage, internal
  account_id VARCHAR(255),
  api_key_encrypted TEXT, -- Encrypted API credentials
  phone_number VARCHAR(20), -- For SMS/WhatsApp
  webhook_url TEXT,
  
  -- Settings
  config JSONB DEFAULT '{}',
  daily_limit INTEGER,
  monthly_limit INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, channel_type)
);

-- Guest Messaging Preferences
CREATE TABLE IF NOT EXISTS guest_messaging_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Opt-in status per channel
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  
  -- Contact info
  preferred_phone VARCHAR(20),
  preferred_email VARCHAR(255),
  whatsapp_phone VARCHAR(20),
  
  -- Preferences
  preferred_channel VARCHAR(30) DEFAULT 'email',
  preferred_language VARCHAR(5) DEFAULT 'en',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Consent tracking
  sms_consent_date TIMESTAMPTZ,
  whatsapp_consent_date TIMESTAMPTZ,
  marketing_consent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(guest_id, property_id)
);

-- Conversations (Thread Container)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Channel info
  channel_type VARCHAR(30) NOT NULL,
  external_id VARCHAR(255), -- Provider's conversation ID
  guest_identifier VARCHAR(255), -- Phone, email, etc.
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, resolved, archived
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  
  -- Assignment
  assigned_to UUID, -- Staff member
  department VARCHAR(50), -- front_desk, concierge, housekeeping, etc.
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  
  -- Metrics
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  response_time_seconds INTEGER, -- Time to first response
  
  -- Context
  subject VARCHAR(255),
  tags VARCHAR(50)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Direction
  direction VARCHAR(10) NOT NULL, -- inbound, outbound
  sender_type VARCHAR(20) NOT NULL, -- guest, staff, system, bot
  sender_id UUID, -- Guest or staff ID
  sender_name VARCHAR(100),
  
  -- Content
  message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, image, file, location, template
  content TEXT,
  media_url TEXT,
  media_type VARCHAR(50),
  media_size INTEGER,
  
  -- Template (for WhatsApp)
  template_id VARCHAR(100),
  template_params JSONB,
  
  -- Delivery status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, delivered, read, failed
  external_id VARCHAR(255), -- Provider's message ID
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- AI/Bot
  is_automated BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(5,4),
  requires_human_review BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Templates (WhatsApp, SMS)
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Template info
  name VARCHAR(100) NOT NULL,
  channel_type VARCHAR(30) NOT NULL,
  category VARCHAR(50), -- booking_confirmation, reminder, promotion, etc.
  
  -- Content
  content TEXT NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  variables VARCHAR(50)[] DEFAULT '{}', -- {{guest_name}}, {{room_number}}, etc.
  
  -- WhatsApp specific
  whatsapp_template_id VARCHAR(100),
  whatsapp_status VARCHAR(20), -- pending, approved, rejected
  header_type VARCHAR(20), -- text, image, document
  header_content TEXT,
  footer_content VARCHAR(60),
  buttons JSONB, -- Quick reply or CTA buttons
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, name, language)
);

-- Canned Responses (Quick Replies for Staff)
CREATE TABLE IF NOT EXISTS canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Response info
  name VARCHAR(100) NOT NULL,
  shortcut VARCHAR(20), -- /checkin, /wifi, etc.
  category VARCHAR(50),
  
  -- Content
  content TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'en',
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, shortcut)
);

-- Chat Bot Intents
CREATE TABLE IF NOT EXISTS chatbot_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- NULL = global
  
  -- Intent info
  intent_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Training phrases
  training_phrases TEXT[] NOT NULL,
  
  -- Response
  response_type VARCHAR(20) NOT NULL, -- text, template, handoff, action
  response_content TEXT,
  response_template_id UUID REFERENCES message_templates(id),
  action_type VARCHAR(50), -- create_request, check_booking, etc.
  
  -- Matching
  confidence_threshold DECIMAL(5,4) DEFAULT 0.7,
  priority INTEGER DEFAULT 100,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot Conversation Context (for multi-turn)
CREATE TABLE IF NOT EXISTS chatbot_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Context
  current_intent VARCHAR(100),
  slot_values JSONB DEFAULT '{}', -- Collected entities
  expected_slots VARCHAR(50)[] DEFAULT '{}', -- What we're waiting for
  
  -- State
  state VARCHAR(30) DEFAULT 'idle', -- idle, collecting, confirming, processing
  last_intent_at TIMESTAMPTZ,
  
  -- Handoff
  handoff_requested BOOLEAN DEFAULT false,
  handoff_reason TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messaging Analytics
CREATE TABLE IF NOT EXISTS messaging_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel_type VARCHAR(30) NOT NULL,
  
  -- Volume
  conversations_started INTEGER DEFAULT 0,
  conversations_resolved INTEGER DEFAULT 0,
  messages_inbound INTEGER DEFAULT 0,
  messages_outbound INTEGER DEFAULT 0,
  
  -- Delivery
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  
  -- Response metrics
  avg_response_time_seconds INTEGER,
  avg_resolution_time_seconds INTEGER,
  
  -- Bot metrics
  bot_handled_conversations INTEGER DEFAULT 0,
  bot_handoff_count INTEGER DEFAULT 0,
  
  -- Satisfaction
  satisfaction_responses INTEGER DEFAULT 0,
  satisfaction_positive INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(property_id, date, channel_type)
);

-- Webhook Events (for provider callbacks)
CREATE TABLE IF NOT EXISTS messaging_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES messaging_channels(id) ON DELETE SET NULL,
  
  -- Event
  event_type VARCHAR(50) NOT NULL, -- message.received, status.update, etc.
  external_id VARCHAR(255),
  payload JSONB NOT NULL,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_messaging_channels_property ON messaging_channels(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_messaging_prefs_guest ON guest_messaging_preferences(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_guest ON conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_booking ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_templates_property ON message_templates(property_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_property ON canned_responses(property_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_intents_property ON chatbot_intents(property_id);
CREATE INDEX IF NOT EXISTS idx_messaging_analytics_date ON messaging_analytics(property_id, date);
CREATE INDEX IF NOT EXISTS idx_messaging_webhooks_processed ON messaging_webhooks(processed);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update conversation stats after new message
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.direction = 'inbound' THEN unread_count + 1 
      ELSE unread_count 
    END,
    first_response_at = CASE 
      WHEN first_response_at IS NULL AND NEW.direction = 'outbound' AND NEW.sender_type = 'staff' 
      THEN NEW.created_at 
      ELSE first_response_at 
    END,
    response_time_seconds = CASE
      WHEN first_response_at IS NULL AND NEW.direction = 'outbound' AND NEW.sender_type = 'staff'
      THEN EXTRACT(EPOCH FROM (NEW.created_at - started_at))::INTEGER
      ELSE response_time_seconds
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_message_stats
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_stats();

-- Mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id UUID,
  p_reader_type VARCHAR DEFAULT 'staff'
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE messages
  SET 
    status = 'read',
    read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND status IN ('delivered', 'sent')
    AND direction = CASE WHEN p_reader_type = 'staff' THEN 'inbound' ELSE 'outbound' END;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Reset unread count
  IF p_reader_type = 'staff' THEN
    UPDATE conversations SET unread_count = 0 WHERE id = p_conversation_id;
  END IF;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Aggregate daily messaging analytics
CREATE OR REPLACE FUNCTION aggregate_messaging_analytics(
  p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT property_id, channel_type 
    FROM conversations 
    WHERE DATE(started_at) = p_date OR DATE(last_message_at) = p_date
  LOOP
    INSERT INTO messaging_analytics (
      property_id, date, channel_type,
      conversations_started, conversations_resolved,
      messages_inbound, messages_outbound,
      avg_response_time_seconds
    )
    SELECT
      r.property_id,
      p_date,
      r.channel_type,
      COUNT(*) FILTER (WHERE DATE(c.started_at) = p_date),
      COUNT(*) FILTER (WHERE DATE(c.resolved_at) = p_date),
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = ANY(ARRAY_AGG(c.id)) 
       AND DATE(m.created_at) = p_date AND m.direction = 'inbound'),
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = ANY(ARRAY_AGG(c.id)) 
       AND DATE(m.created_at) = p_date AND m.direction = 'outbound'),
      AVG(c.response_time_seconds)::INTEGER
    FROM conversations c
    WHERE c.property_id = r.property_id
      AND c.channel_type = r.channel_type
      AND (DATE(c.started_at) = p_date OR DATE(c.last_message_at) = p_date)
    ON CONFLICT (property_id, date, channel_type) 
    DO UPDATE SET
      conversations_started = EXCLUDED.conversations_started,
      conversations_resolved = EXCLUDED.conversations_resolved,
      messages_inbound = EXCLUDED.messages_inbound,
      messages_outbound = EXCLUDED.messages_outbound,
      avg_response_time_seconds = EXCLUDED.avg_response_time_seconds,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE messaging_channels IS 'Configuration for SMS, WhatsApp, and other messaging channels';
COMMENT ON TABLE guest_messaging_preferences IS 'Guest opt-in status and communication preferences';
COMMENT ON TABLE conversations IS 'Message threads between guests and property';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE message_templates IS 'Pre-approved templates for WhatsApp and SMS';
COMMENT ON TABLE canned_responses IS 'Quick reply templates for staff';
COMMENT ON TABLE chatbot_intents IS 'AI chatbot intent recognition and responses';
COMMENT ON TABLE chatbot_context IS 'Multi-turn conversation state for chatbot';
COMMENT ON TABLE messaging_analytics IS 'Aggregated messaging performance metrics';
