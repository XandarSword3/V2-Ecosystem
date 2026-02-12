-- =============================================
-- MIGRATION: 007_revenue_management.sql
-- PHASE 3.2: Revenue Management System
-- Created: 2025-01-XX
-- =============================================

-- =============================================
-- DEMAND FORECAST DATA
-- =============================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    forecast_date DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL, -- NULL = all room types
    
    -- Forecasted Values
    forecasted_demand DECIMAL(10, 2) NOT NULL, -- Expected rooms needed
    forecasted_occupancy DECIMAL(5, 2), -- 0-100 percentage
    forecasted_adr DECIMAL(10, 2), -- Average daily rate
    forecasted_revenue DECIMAL(15, 2),
    
    -- Confidence Intervals
    demand_low DECIMAL(10, 2),
    demand_high DECIMAL(10, 2),
    confidence_level DECIMAL(5, 2) DEFAULT 95.00,
    
    -- Influencing Factors
    factors JSONB DEFAULT '{}', -- {day_of_week: 1.2, seasonality: 1.1, event: 'Conference', ...}
    
    -- Model Info
    model_version VARCHAR(50),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Actual Values (filled in after the date passes)
    actual_demand INTEGER,
    actual_occupancy DECIMAL(5, 2),
    actual_adr DECIMAL(10, 2),
    actual_revenue DECIMAL(15, 2),
    
    -- Accuracy Metrics
    forecast_accuracy DECIMAL(5, 2), -- MAPE or similar
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, forecast_date, room_type_id)
);

-- =============================================
-- PRICING RULES
-- =============================================
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Rule Type
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'base', -- Base rate rule
        'occupancy', -- Adjust based on occupancy thresholds
        'demand', -- Adjust based on forecasted demand
        'day_of_week', -- Day-specific adjustments
        'length_of_stay', -- LOS-based adjustments
        'advance_purchase', -- Book-ahead discounts
        'last_minute', -- Last-minute pricing
        'event', -- Event-based pricing
        'competitor', -- Competitor rate-based
        'custom' -- Custom formula
    )),
    
    -- Applicability
    room_type_ids UUID[], -- Empty = all room types
    rate_plan_ids UUID[], -- Empty = all rate plans
    channel_ids UUID[], -- Empty = all channels
    
    -- Conditions
    conditions JSONB NOT NULL DEFAULT '{}', -- {min_occupancy: 80, days_before: 7, ...}
    
    -- Adjustment
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN (
        'percentage', -- +/- X%
        'fixed', -- +/- $X
        'multiplier', -- X times base
        'absolute' -- Set to $X
    )),
    adjustment_value DECIMAL(10, 2) NOT NULL,
    
    -- Limits
    min_rate DECIMAL(10, 2),
    max_rate DECIMAL(10, 2),
    max_adjustment_percent DECIMAL(5, 2), -- Max change from base
    
    -- Priority (higher = applied later)
    priority INTEGER DEFAULT 100,
    
    -- Validity
    start_date DATE,
    end_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRICING CALENDAR (Override/Lock Rates)
-- =============================================
CREATE TABLE IF NOT EXISTS pricing_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    
    -- Rate Values
    base_rate DECIMAL(10, 2) NOT NULL,
    recommended_rate DECIMAL(10, 2), -- System recommendation
    final_rate DECIMAL(10, 2), -- After all adjustments
    
    -- Rate Components (audit trail)
    rate_breakdown JSONB DEFAULT '{}', -- {base: 100, occupancy_adj: +10, event_adj: +20, ...}
    
    -- Manual Override
    is_override BOOLEAN DEFAULT false,
    override_rate DECIMAL(10, 2),
    override_reason TEXT,
    override_by UUID REFERENCES users(id),
    override_at TIMESTAMPTZ,
    
    -- Lock
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    
    -- Inventory Controls
    min_stay INTEGER DEFAULT 1,
    max_stay INTEGER,
    closed_to_arrival BOOLEAN DEFAULT false,
    closed_to_departure BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'sold_out')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, date, room_type_id)
);

-- =============================================
-- RATE RECOMMENDATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS rate_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
    
    -- Current vs Recommended
    current_rate DECIMAL(10, 2) NOT NULL,
    recommended_rate DECIMAL(10, 2) NOT NULL,
    rate_change DECIMAL(10, 2), -- Difference
    rate_change_percent DECIMAL(5, 2),
    
    -- Reasoning
    reason_code VARCHAR(50) NOT NULL CHECK (reason_code IN (
        'low_occupancy', 'high_occupancy', 'competitor_rates',
        'demand_forecast', 'event_impact', 'day_of_week',
        'seasonal', 'last_minute', 'advance_booking'
    )),
    reasoning TEXT,
    
    -- Supporting Data
    supporting_data JSONB DEFAULT '{}', -- {occupancy: 45, forecast: 60, competitors: [...]}
    
    -- Impact Estimate
    estimated_revenue_impact DECIMAL(15, 2),
    estimated_bookings_impact INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'auto_applied')),
    
    -- Response
    responded_by UUID REFERENCES users(id),
    responded_at TIMESTAMPTZ,
    response_notes TEXT,
    
    -- Validity
    valid_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPETITOR RATES (from rate parity + additional sources)
-- =============================================
CREATE TABLE IF NOT EXISTS competitor_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    competitor_id UUID, -- Link to competitor definition if exists
    competitor_name VARCHAR(200) NOT NULL,
    competitor_source VARCHAR(100), -- booking.com, expedia, direct_scrape
    
    date DATE NOT NULL,
    room_type_name VARCHAR(200),
    
    rate DECIMAL(10, 2) NOT NULL,
    rate_type VARCHAR(50) DEFAULT 'room_only', -- room_only, breakfast_included, all_inclusive
    cancellation_policy VARCHAR(100),
    
    -- Rate Context
    is_available BOOLEAN DEFAULT true,
    is_promotion BOOLEAN DEFAULT false,
    promotion_details TEXT,
    
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(property_id, competitor_name, date, room_type_name, rate_type)
);

-- =============================================
-- MARKET EVENTS (Conferences, Holidays, etc.)
-- =============================================
CREATE TABLE IF NOT EXISTS market_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE, -- NULL = global event
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'conference', 'trade_show', 'sports', 'concert', 'festival',
        'holiday', 'school_break', 'corporate', 'wedding', 'other'
    )),
    
    -- Date Range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Impact Assessment
    expected_demand_impact DECIMAL(5, 2), -- Multiplier (1.5 = 50% increase)
    expected_rate_impact DECIMAL(5, 2), -- Suggested rate multiplier
    
    -- Location
    location VARCHAR(200),
    distance_km DECIMAL(10, 2), -- Distance from property
    
    -- Attendance
    expected_attendance INTEGER,
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT, -- iCal RRULE format
    
    -- Source
    source VARCHAR(100), -- manual, calendar_api, scraped
    external_id VARCHAR(200),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SEASONALITY PATTERNS
-- =============================================
CREATE TABLE IF NOT EXISTS seasonality_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    
    -- Pattern Type
    pattern_type VARCHAR(30) NOT NULL CHECK (pattern_type IN (
        'day_of_week', 'month', 'season', 'custom_period'
    )),
    
    -- For day_of_week: {0: 0.8, 1: 0.9, ..., 6: 1.2} (0=Sunday)
    -- For month: {1: 0.7, 2: 0.8, ..., 12: 1.3}
    -- For season/custom: periods defined separately
    multipliers JSONB NOT NULL DEFAULT '{}',
    
    -- Custom Periods (for season/custom_period types)
    periods JSONB DEFAULT '[]', -- [{name: 'High Season', start: 'MM-DD', end: 'MM-DD', multiplier: 1.3}]
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- YIELD MANAGEMENT LOG (Decision Audit)
-- =============================================
CREATE TABLE IF NOT EXISTS yield_management_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    
    date DATE NOT NULL,
    room_type_id UUID REFERENCES room_types(id),
    
    -- Action
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'rate_change', 'restriction_change', 'inventory_change',
        'recommendation_accepted', 'recommendation_rejected',
        'auto_adjustment', 'manual_override'
    )),
    
    -- Before/After
    previous_value JSONB,
    new_value JSONB,
    
    -- Reason
    reason_code VARCHAR(50),
    reason_text TEXT,
    
    -- Attribution
    triggered_by VARCHAR(50) NOT NULL CHECK (triggered_by IN ('system', 'user', 'rule', 'api')),
    user_id UUID REFERENCES users(id),
    rule_id UUID REFERENCES pricing_rules(id),
    
    -- Impact (filled later)
    bookings_before INTEGER,
    bookings_after INTEGER,
    revenue_impact DECIMAL(15, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_property_date ON demand_forecasts(property_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_property ON pricing_rules(property_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON pricing_rules(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_pricing_calendar_property_date ON pricing_calendar(property_id, date);
CREATE INDEX IF NOT EXISTS idx_pricing_calendar_room_date ON pricing_calendar(room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_rate_recommendations_property ON rate_recommendations(property_id);
CREATE INDEX IF NOT EXISTS idx_rate_recommendations_pending ON rate_recommendations(status, valid_until) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_competitor_rates_property_date ON competitor_rates(property_id, date);
CREATE INDEX IF NOT EXISTS idx_market_events_property_date ON market_events(property_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_market_events_dates ON market_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_yield_management_log_property ON yield_management_log(property_id, date);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonality_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_management_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_forecasts_access ON demand_forecasts
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY pricing_rules_access ON pricing_rules
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY pricing_calendar_access ON pricing_calendar
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY rate_recommendations_access ON rate_recommendations
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY competitor_rates_access ON competitor_rates
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY market_events_access ON market_events
    FOR ALL USING (property_id IS NULL OR user_has_property_access(auth.uid(), property_id));

CREATE POLICY seasonality_patterns_access ON seasonality_patterns
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

CREATE POLICY yield_management_log_access ON yield_management_log
    FOR ALL USING (user_has_property_access(auth.uid(), property_id));

-- =============================================
-- FUNCTIONS
-- =============================================

-- Calculate recommended rate based on all factors
CREATE OR REPLACE FUNCTION calculate_dynamic_rate(
    p_property_id UUID,
    p_room_type_id UUID,
    p_date DATE
) RETURNS TABLE (
    base_rate DECIMAL(10, 2),
    final_rate DECIMAL(10, 2),
    breakdown JSONB
) AS $$
DECLARE
    v_base_rate DECIMAL(10, 2);
    v_final_rate DECIMAL(10, 2);
    v_breakdown JSONB := '{}';
    v_rule RECORD;
    v_seasonality RECORD;
    v_event RECORD;
    v_forecast RECORD;
    v_occupancy DECIMAL(5, 2);
BEGIN
    -- Get base rate from room type
    SELECT rt.base_rate INTO v_base_rate
    FROM room_types rt
    WHERE rt.id = p_room_type_id;
    
    v_final_rate := v_base_rate;
    v_breakdown := jsonb_build_object('base', v_base_rate);
    
    -- Apply seasonality patterns
    FOR v_seasonality IN (
        SELECT * FROM seasonality_patterns
        WHERE property_id = p_property_id AND is_active = true
    ) LOOP
        DECLARE
            v_multiplier DECIMAL(5, 2);
        BEGIN
            IF v_seasonality.pattern_type = 'day_of_week' THEN
                v_multiplier := (v_seasonality.multipliers->>EXTRACT(DOW FROM p_date)::text)::decimal;
            ELSIF v_seasonality.pattern_type = 'month' THEN
                v_multiplier := (v_seasonality.multipliers->>EXTRACT(MONTH FROM p_date)::text)::decimal;
            END IF;
            
            IF v_multiplier IS NOT NULL AND v_multiplier != 1 THEN
                v_final_rate := v_final_rate * v_multiplier;
                v_breakdown := v_breakdown || jsonb_build_object(
                    'seasonality_' || v_seasonality.pattern_type, 
                    round((v_multiplier - 1) * 100, 2)
                );
            END IF;
        END;
    END LOOP;
    
    -- Check for market events
    FOR v_event IN (
        SELECT * FROM market_events
        WHERE (property_id IS NULL OR property_id = p_property_id)
          AND p_date BETWEEN start_date AND end_date
        ORDER BY expected_rate_impact DESC NULLS LAST
        LIMIT 1
    ) LOOP
        IF v_event.expected_rate_impact IS NOT NULL THEN
            v_final_rate := v_final_rate * v_event.expected_rate_impact;
            v_breakdown := v_breakdown || jsonb_build_object(
                'event_' || v_event.name, 
                round((v_event.expected_rate_impact - 1) * 100, 2)
            );
        END IF;
    END LOOP;
    
    -- Apply pricing rules
    FOR v_rule IN (
        SELECT * FROM pricing_rules
        WHERE property_id = p_property_id
          AND is_active = true
          AND (start_date IS NULL OR start_date <= p_date)
          AND (end_date IS NULL OR end_date >= p_date)
          AND (room_type_ids IS NULL OR room_type_ids = '{}' OR p_room_type_id = ANY(room_type_ids))
        ORDER BY priority
    ) LOOP
        DECLARE
            v_condition_met BOOLEAN := true;
            v_adjustment DECIMAL(10, 2);
        BEGIN
            -- Check conditions based on rule type
            CASE v_rule.rule_type
                WHEN 'occupancy' THEN
                    -- Get current occupancy for date
                    SELECT COALESCE(
                        COUNT(*) FILTER (WHERE b.id IS NOT NULL)::decimal / 
                        NULLIF(COUNT(*), 0) * 100, 0
                    ) INTO v_occupancy
                    FROM rooms r
                    LEFT JOIN bookings b ON b.room_id = r.id 
                        AND p_date >= b.check_in AND p_date < b.check_out
                        AND b.status NOT IN ('cancelled', 'no_show')
                    WHERE r.property_id = p_property_id
                      AND (r.room_type_id = p_room_type_id OR p_room_type_id IS NULL);
                    
                    v_condition_met := (
                        (v_rule.conditions->>'min_occupancy' IS NULL OR v_occupancy >= (v_rule.conditions->>'min_occupancy')::decimal)
                        AND (v_rule.conditions->>'max_occupancy' IS NULL OR v_occupancy <= (v_rule.conditions->>'max_occupancy')::decimal)
                    );
                    
                WHEN 'advance_purchase' THEN
                    v_condition_met := (
                        v_rule.conditions->>'min_days_advance' IS NULL 
                        OR (p_date - CURRENT_DATE) >= (v_rule.conditions->>'min_days_advance')::integer
                    );
                    
                WHEN 'last_minute' THEN
                    v_condition_met := (
                        v_rule.conditions->>'max_days_advance' IS NULL 
                        OR (p_date - CURRENT_DATE) <= (v_rule.conditions->>'max_days_advance')::integer
                    );
                    
                WHEN 'day_of_week' THEN
                    v_condition_met := (
                        v_rule.conditions->>'days' IS NULL 
                        OR EXTRACT(DOW FROM p_date)::text = ANY(
                            ARRAY(SELECT jsonb_array_elements_text(v_rule.conditions->'days'))
                        )
                    );
                    
                ELSE
                    v_condition_met := true;
            END CASE;
            
            IF v_condition_met THEN
                -- Apply adjustment
                CASE v_rule.adjustment_type
                    WHEN 'percentage' THEN
                        v_adjustment := v_final_rate * (v_rule.adjustment_value / 100);
                        v_final_rate := v_final_rate + v_adjustment;
                    WHEN 'fixed' THEN
                        v_final_rate := v_final_rate + v_rule.adjustment_value;
                    WHEN 'multiplier' THEN
                        v_final_rate := v_final_rate * v_rule.adjustment_value;
                    WHEN 'absolute' THEN
                        v_final_rate := v_rule.adjustment_value;
                END CASE;
                
                -- Apply limits
                IF v_rule.min_rate IS NOT NULL AND v_final_rate < v_rule.min_rate THEN
                    v_final_rate := v_rule.min_rate;
                END IF;
                IF v_rule.max_rate IS NOT NULL AND v_final_rate > v_rule.max_rate THEN
                    v_final_rate := v_rule.max_rate;
                END IF;
                
                v_breakdown := v_breakdown || jsonb_build_object(
                    'rule_' || v_rule.name, 
                    v_rule.adjustment_value
                );
            END IF;
        END;
    END LOOP;
    
    -- Round to 2 decimal places
    v_final_rate := round(v_final_rate, 2);
    
    RETURN QUERY SELECT v_base_rate, v_final_rate, v_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Generate forecasts using simple moving average + adjustments
CREATE OR REPLACE FUNCTION generate_demand_forecast(
    p_property_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
    v_date DATE;
    v_room_type RECORD;
    v_historical_avg DECIMAL(10, 2);
    v_dow_factor DECIMAL(5, 2);
    v_seasonal_factor DECIMAL(5, 2);
    v_event_factor DECIMAL(5, 2);
    v_forecasted_demand DECIMAL(10, 2);
    v_forecast_count INTEGER := 0;
BEGIN
    -- Loop through each date
    FOR v_date IN SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date LOOP
        -- Loop through room types
        FOR v_room_type IN (SELECT id FROM room_types WHERE property_id = p_property_id) LOOP
            -- Calculate historical average (last 90 days same day of week)
            SELECT AVG(rooms_sold) INTO v_historical_avg
            FROM (
                SELECT COUNT(*) as rooms_sold
                FROM bookings b
                JOIN rooms r ON b.room_id = r.id
                WHERE b.property_id = p_property_id
                  AND r.room_type_id = v_room_type.id
                  AND EXTRACT(DOW FROM b.check_in) = EXTRACT(DOW FROM v_date)
                  AND b.check_in >= v_date - INTERVAL '90 days'
                  AND b.check_in < v_date
                  AND b.status NOT IN ('cancelled', 'no_show')
                GROUP BY b.check_in::date
            ) daily;
            
            v_historical_avg := COALESCE(v_historical_avg, 0);
            
            -- Get seasonality factor
            SELECT COALESCE((multipliers->>EXTRACT(MONTH FROM v_date)::text)::decimal, 1)
            INTO v_seasonal_factor
            FROM seasonality_patterns
            WHERE property_id = p_property_id 
              AND pattern_type = 'month' 
              AND is_active = true
            LIMIT 1;
            
            v_seasonal_factor := COALESCE(v_seasonal_factor, 1);
            
            -- Get event factor
            SELECT COALESCE(MAX(expected_demand_impact), 1)
            INTO v_event_factor
            FROM market_events
            WHERE (property_id IS NULL OR property_id = p_property_id)
              AND v_date BETWEEN start_date AND end_date;
            
            v_event_factor := COALESCE(v_event_factor, 1);
            
            -- Calculate final forecast
            v_forecasted_demand := v_historical_avg * v_seasonal_factor * v_event_factor;
            
            -- Insert or update forecast
            INSERT INTO demand_forecasts (
                property_id, forecast_date, room_type_id,
                forecasted_demand, forecasted_occupancy,
                factors, model_version
            ) VALUES (
                p_property_id, v_date, v_room_type.id,
                v_forecasted_demand,
                LEAST(v_forecasted_demand / NULLIF((
                    SELECT COUNT(*) FROM rooms 
                    WHERE property_id = p_property_id AND room_type_id = v_room_type.id
                ), 0) * 100, 100),
                jsonb_build_object(
                    'historical_avg', v_historical_avg,
                    'seasonal_factor', v_seasonal_factor,
                    'event_factor', v_event_factor
                ),
                'v1.0-sma'
            )
            ON CONFLICT (property_id, forecast_date, room_type_id)
            DO UPDATE SET
                forecasted_demand = EXCLUDED.forecasted_demand,
                forecasted_occupancy = EXCLUDED.forecasted_occupancy,
                factors = EXCLUDED.factors,
                generated_at = NOW();
            
            v_forecast_count := v_forecast_count + 1;
        END LOOP;
    END LOOP;
    
    RETURN v_forecast_count;
END;
$$ LANGUAGE plpgsql;
