-- Wave 6: Add all missing columns identified by DB column audit (June 27, 2026)

ALTER TABLE public.modules
    ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}';

ALTER TABLE public.site_settings
    ADD COLUMN IF NOT EXISTS id bigint DEFAULT 1;

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS product_id uuid;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS processed_at timestamptz;

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS service_type text;

ALTER TABLE public.marketing_campaigns
    ADD COLUMN IF NOT EXISTS clicked_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unsubscribed_count integer DEFAULT 0;

ALTER TABLE public.journey_steps
    ADD COLUMN IF NOT EXISTS clicks_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opens_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sends_count integer DEFAULT 0;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

ALTER TABLE public.loyalty_fraud_flags
    ADD COLUMN IF NOT EXISTS flagged_by uuid,
    ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.loyalty_point_batches
    ADD COLUMN IF NOT EXISTS points_remaining integer;

ALTER TABLE public.accommodation_units
    ADD COLUMN IF NOT EXISTS unit_number text;

ALTER TABLE public.coupon_usage
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.gift_card_ledger
    ADD COLUMN IF NOT EXISTS transaction_type text;

ALTER TABLE public.marketing_email_templates
    ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

ALTER TABLE public.menu_item_ingredients
    ADD COLUMN IF NOT EXISTS quantity_needed numeric;

ALTER TABLE public.competitor_rates
    ADD COLUMN IF NOT EXISTS date date;

ALTER TABLE public.pre_arrival_registrations
    ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS unit_id uuid;
