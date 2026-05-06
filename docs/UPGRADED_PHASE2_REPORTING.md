# Upgraded Phase 2 — Advanced Reporting & Analytics Layer

## Overview
Transform basic reporting into a comprehensive Business Intelligence (BI) platform with real-time analytics, predictive insights, and actionable alerting.

## Core Components

### 1. Real-Time Analytics Engine
**Purpose:** Sub-second dashboard updates without page refreshes

**Architecture:**
- WebSocket pub/sub for live metrics
- In-memory caching layer (Redis-compatible)
- Event-driven updates from database triggers
- Incremental data refresh (only changed values)

**Key Features:**
- Live occupancy counters
- Real-time revenue tracking
- Active staff/session monitoring
- Instant KPI threshold alerts

### 2. Intelligent Alert System
**Purpose:** Proactive notification when metrics deviate from targets

**Alert Types:**
- **Threshold:** Value crosses static boundary (occupancy > 90%)
- **Deviation:** Variance from expected range (revenue -20% vs forecast)
- **Anomaly:** ML-detected unusual patterns (sudden cancellation spike)
- **Trend:** Sustained directional change (ADR declining 3+ days)

**Delivery Channels:**
- In-app notifications
- Email with context
- SMS for critical alerts
- Slack/Teams webhooks
- Dashboard banner alerts

### 3. Advanced Query Builder
**Purpose:** Self-service analytics without SQL knowledge

**Features:**
- Visual drag-and-drop interface
- Nested filters (AND/OR groups)
- Date range presets + custom
- Group by multiple dimensions
- Calculated fields (formulas)
- Saved query library

**Drill-Down Capabilities:**
- Click chart → filter data
- Row expansion for details
- Hierarchical navigation (Year → Month → Day)
- Cross-report linking

### 4. Comparative Analytics
**Purpose:** Context through benchmarking

**Comparison Types:**
- **Temporal:** YoY, MoM, WoW, DoD
- **Segment:** Room type vs room type, Channel vs channel
- **Benchmark:** Property vs property (multi-property)
- **Target:** Actual vs goal vs stretch
- **Industry:** External benchmark data (if available)

**Visualizations:**
- Sparklines with % change
- Waterfall charts for variance
- Heatmaps for pattern detection
- Cohort retention curves

### 5. Guest Analytics & Segmentation
**Purpose:** Understanding customer behavior for personalization

**RFM Segmentation:**
- Recency: Days since last booking
- Frequency: Total bookings
- Monetary: Lifetime value

**Segments:** Champions, Loyal, Potential, New, At Risk, Lost

**Cohort Analysis:**
- Booking month cohorts
- Retention by acquisition channel
- Lifetime value curves

### 6. Data Warehouse Layer
**Purpose:** Fast analytics on large datasets

**Materialized Views:**
- `mv_daily_metrics` - Pre-aggregated daily stats
- `mv_monthly_financials` - Monthly P&L ready
- `mv_guest_segments` - Pre-computed RFM scores

**Refresh Strategy:**
- Real-time: Critical KPIs (incremental)
- Near-real-time: 5-minute lag for operational reports
- Hourly: Financial summaries
- Daily: Full analytics refresh

### 7. Natural Language Queries (NLP)
**Purpose:** "Ask" questions about your data

**Supported Queries:**
- "What was revenue last month?"
- "Compare occupancy this week vs last week"
- "Show me top 5 performing room types"
- "Alert me when ADR drops below $150"

**Implementation:**
- Intent classification (LLM-based)
- Entity extraction (dates, metrics, filters)
- Query generation (SQL builder)
- Response formatting (tables, charts, summaries)

## Implementation Priority

### Phase 2A — Foundation (Week 1-2)
1. Real-time analytics WebSocket service
2. Alert system core + database schema
3. Materialized views for common queries

### Phase 2B — Advanced Features (Week 3-4)
4. Drill-down query builder
5. Comparative analytics engine
6. Guest segmentation service

### Phase 2C — Intelligence (Week 5-6)
7. NLP query parser
8. Anomaly detection on metrics
9. Predictive forecasting integration

### Phase 2D — Polish (Week 7-8)
10. Mobile-optimized UI
11. Report sharing & collaboration
12. External BI tool integrations

## Database Schema Additions

### Alert Definitions
```sql
CREATE TABLE alert_definitions (
  id UUID PRIMARY KEY,
  property_id UUID,
  name TEXT,
  alert_type TEXT, -- threshold, deviation, anomaly, trend
  kpi_code TEXT,
  condition JSONB, -- { operator: '>', value: 90 }
  schedule JSONB, -- { frequency: 'realtime' | 'hourly' | 'daily' }
  notification_channels JSONB,
  is_active BOOLEAN DEFAULT true
);
```

### Alert History
```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY,
  alert_definition_id UUID,
  triggered_at TIMESTAMP,
  resolved_at TIMESTAMP,
  metric_value DECIMAL,
  threshold_value DECIMAL,
  context JSONB -- snapshot of relevant data
);
```

### Materialized Views
```sql
CREATE MATERIALIZED VIEW mv_daily_metrics AS
SELECT 
  property_id,
  DATE(created_at) as date,
  COUNT(*) as booking_count,
  SUM(total_amount) as revenue,
  AVG(room_rate) as adr
FROM bookings
GROUP BY property_id, DATE(created_at);

CREATE INDEX idx_mv_daily_metrics_date ON mv_daily_metrics(property_id, date);
```

## API Endpoints

### Real-Time
```
WS /api/v1/analytics/stream?propertyId={id}&metrics=kpi1,kpi2
GET /api/v1/analytics/snapshot?propertyId={id}
```

### Alerts
```
POST /api/v1/alerts
GET /api/v1/alerts/active
PUT /api/v1/alerts/{id}/acknowledge
GET /api/v1/alerts/history
```

### Query Builder
```
POST /api/v1/reports/query
Body: {
  filters: [...],
  groupBy: [...],
  aggregates: [...],
  sort: [...]
}
```

### Comparative
```
GET /api/v1/reports/compare?type=yoy&metric=revenue&period=last_month
GET /api/v1/reports/benchmark?property_ids=1,2,3&metric=occupancy
```

## Success Metrics

- Dashboard load time: < 2 seconds
- Real-time latency: < 500ms
- Alert delivery: < 30 seconds from trigger
- Query builder: Non-technical users create reports in < 5 minutes
- Report export: < 10 seconds for 10k rows
