const fs = require('fs');
const path = require('path');

const keys = {
  "last_7_days": "Last 7 days",
  "last_30_days": "Last 30 days",
  "last_90_days": "Last 90 days",
  "error_loading": "Error Loading Economics",
  "error_perms": "Failed to load economics data. Ensure you have the correct permissions.",
  "title": "Economics Core",
  "subtitle": "Real-time transaction and revenue analytics across all modules.",
  "gross_revenue": "Gross Revenue",
  "net_revenue": "Net Revenue",
  "after_discounts_refunds": "After discounts & refunds",
  "transactions": "Transactions",
  "avg_transaction_value": "Avg Transaction Value",
  "revenue_over_time": "Revenue Over Time",
  "revenue_by_module": "Revenue By Module",
  "no_data": "No data available",
  "module_perf_details": "Module Performance Details",
  "module": "Module",
  "revenue": "Revenue",
  "avg_value": "Avg Value",
  "refund_rate": "Refund Rate",
  "peak_hours": "Peak Hours (Avg Revenue)",
  "avg_hourly_revenue": "Average hourly revenue across selected period",
  "top_3_hours": "Top 3 Hours",
  "bottom_3_hours": "Bottom 3 Hours",
  "staff_performance": "Staff Performance",
  "staff_id": "Staff ID",
  "cancel_rate": "Cancel Rate",
  "no_staff_data": "No staff data",
  "top_customers": "Top Customers",
  "customer": "Customer",
  "spend": "Spend",
  "no_customer_data": "No customer data",
  "anonymous": "Anonymous",
  "repeat_vs_new": "Repeat vs New Customers",
  "repeat_customer_rate": "Repeat Customer Rate",
  "repeat": "Repeat",
  "new": "New",
  "strategic_insights": "Strategic Insights",
  "cross_module_behavior": "Cross-Module Behavior",
  "customer_retention": "Customer Retention",
  "slow_period_alert": "Slow Period Alert",
  "promo_effectiveness": "Promo Effectiveness",
  "insight_cross_1": "of active customers transacted in multiple engine types on the same day.",
  "insight_cross_2": "The most common pairing is",
  "insight_retention": "of customers from the previous equivalent period returned to transact in this period.",
  "insight_slow_1": "Revenue drops",
  "insight_slow_2": "below the daily average during",
  "insight_promo_1": "Promo codes",
  "insight_promo_2": "average transaction value by",
  "insight_promo_3": "compared to non-promotional transactions.",
  "increase": "increase",
  "decrease": "decrease"
};

const commonKeys = {
  "today": "Today",
  "yesterday": "Yesterday"
};

const dir = path.join('v2-resort', 'frontend', 'messages');
const files = ['ar.json', 'de.json', 'en.json', 'fr.json', 'it.json'];

files.forEach(f => {
    const file = path.join(dir, f);
    if (fs.existsSync(file)) {
        let content = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        // Admin
        if (!content.admin) content.admin = {};
        if (!content.admin.economics) content.admin.economics = {};
        
        for (const [k, v] of Object.entries(keys)) {
            if (!content.admin.economics[k]) {
                content.admin.economics[k] = v; // In a real app we'd translate this, but for now fallback to english text so keys exist
            }
        }
        
        // Common
        if (!content.common) content.common = {};
        for (const [k, v] of Object.entries(commonKeys)) {
            if (!content.common[k]) {
                content.common[k] = v;
            }
        }
        
        fs.writeFileSync(file, JSON.stringify(content, null, 2), 'utf8');
        console.log('Updated ' + f);
    }
});
