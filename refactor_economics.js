const fs = require('fs');
const path = require('path');

const file = path.join('v2-resort', 'frontend', 'src', 'app', 'admin', 'economics', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add useTranslations import
if (!content.includes('useTranslations')) {
    content = content.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect } from 'react';\nimport { useTranslations } from 'next-intl';"
    );
}

// 2. Add translation hook
if (!content.includes('const t = useTranslations')) {
    content = content.replace(
        "export default function EconomicsPage() {",
        "export default function EconomicsPage() {\n  const t = useTranslations('admin.economics');\n  const tCommon = useTranslations('common');"
    );
}

// 3. Replace strings with t('...') inside the component
// We will do some manual exact replacements to avoid breaking code.
const replacements = {
  // Strings
  "label: 'Today'": "label: tCommon('today', { defaultValue: 'Today' })",
  "label: 'Yesterday'": "label: tCommon('yesterday', { defaultValue: 'Yesterday' })",
  "label: 'Last 7 days'": "label: t('last_7_days', { defaultValue: 'Last 7 days' })",
  "label: 'Last 30 days'": "label: t('last_30_days', { defaultValue: 'Last 30 days' })",
  "label: 'Last 90 days'": "label: t('last_90_days', { defaultValue: 'Last 90 days' })",
  "Error Loading Economics": "{t('error_loading', { defaultValue: 'Error Loading Economics' })}",
  "Failed to load economics data. Ensure you have the correct permissions.": "t('error_perms', { defaultValue: 'Failed to load economics data. Ensure you have the correct permissions.' })",
  "Economics Core": "{t('title', { defaultValue: 'Economics Core' })}",
  "Real-time transaction and revenue analytics across all modules.": "{t('subtitle', { defaultValue: 'Real-time transaction and revenue analytics across all modules.' })}",
  "Gross Revenue": "{t('gross_revenue', { defaultValue: 'Gross Revenue' })}",
  "Net Revenue": "{t('net_revenue', { defaultValue: 'Net Revenue' })}",
  "After discounts & refunds": "{t('after_discounts_refunds', { defaultValue: 'After discounts & refunds' })}",
  ">Transactions<": ">{t('transactions', { defaultValue: 'Transactions' })}<",
  "Avg Transaction Value": "{t('avg_transaction_value', { defaultValue: 'Avg Transaction Value' })}",
  "Revenue Over Time": "{t('revenue_over_time', { defaultValue: 'Revenue Over Time' })}",
  "Revenue By Module": "{t('revenue_by_module', { defaultValue: 'Revenue By Module' })}",
  "No data available": "{t('no_data', { defaultValue: 'No data available' })}",
  ">No data<": ">{t('no_data', { defaultValue: 'No data' })}<",
  "Module Performance Details": "{t('module_perf_details', { defaultValue: 'Module Performance Details' })}",
  ">Module<": ">{t('module', { defaultValue: 'Module' })}<",
  ">Revenue<": ">{t('revenue', { defaultValue: 'Revenue' })}<",
  ">Avg Value<": ">{t('avg_value', { defaultValue: 'Avg Value' })}<",
  ">Refund Rate<": ">{t('refund_rate', { defaultValue: 'Refund Rate' })}<",
  "Peak Hours (Avg Revenue)": "{t('peak_hours', { defaultValue: 'Peak Hours (Avg Revenue)' })}",
  "Average hourly revenue across selected period": "{t('avg_hourly_revenue', { defaultValue: 'Average hourly revenue across selected period' })}",
  "Top 3 Hours": "{t('top_3_hours', { defaultValue: 'Top 3 Hours' })}",
  "Bottom 3 Hours": "{t('bottom_3_hours', { defaultValue: 'Bottom 3 Hours' })}",
  ">Staff Performance<": ">{t('staff_performance', { defaultValue: 'Staff Performance' })}<",
  ">Staff ID<": ">{t('staff_id', { defaultValue: 'Staff ID' })}<",
  ">Cancel Rate<": ">{t('cancel_rate', { defaultValue: 'Cancel Rate' })}<",
  ">No staff data<": ">{t('no_staff_data', { defaultValue: 'No staff data' })}<",
  ">Top Customers<": ">{t('top_customers', { defaultValue: 'Top Customers' })}<",
  ">Customer<": ">{t('customer', { defaultValue: 'Customer' })}<",
  ">Spend<": ">{t('spend', { defaultValue: 'Spend' })}<",
  ">No customer data<": ">{t('no_customer_data', { defaultValue: 'No customer data' })}<",
  "|| 'Anonymous'": "|| t('anonymous', { defaultValue: 'Anonymous' })",
  ">Repeat vs New Customers<": ">{t('repeat_vs_new', { defaultValue: 'Repeat vs New Customers' })}<",
  "Repeat Customer Rate": "{t('repeat_customer_rate', { defaultValue: 'Repeat Customer Rate' })}",
  "} Repeat<": "} {t('repeat', { defaultValue: 'Repeat' })}<",
  "} New<": "} {t('new', { defaultValue: 'New' })}<",
  ">Strategic Insights<": ">{t('strategic_insights', { defaultValue: 'Strategic Insights' })}<",
  ">Cross-Module Behavior<": ">{t('cross_module_behavior', { defaultValue: 'Cross-Module Behavior' })}<",
  ">Customer Retention<": ">{t('customer_retention', { defaultValue: 'Customer Retention' })}<",
  ">Slow Period Alert<": ">{t('slow_period_alert', { defaultValue: 'Slow Period Alert' })}<",
  ">Promo Effectiveness<": ">{t('promo_effectiveness', { defaultValue: 'Promo Effectiveness' })}<",

  // Directional
  "ml-2": "ms-2", "mr-2": "me-2", "pl-1": "ps-1", "pr-8": "pe-8",
  "border-l-4": "border-s-4", "text-left": "text-start", "text-right": "text-end",
  "left: 0": "left: 0 /* RTL note: Recharts handles its own positioning */",
  "right: 30": "right: 30",

  // Dark Mode
  "bg-white": "bg-white dark:bg-slate-900",
  "text-slate-900": "text-slate-900 dark:text-white",
  "text-slate-800": "text-slate-800 dark:text-slate-100",
  "text-slate-700": "text-slate-700 dark:text-slate-200",
  "text-slate-600": "text-slate-600 dark:text-slate-300",
  "text-slate-500": "text-slate-500 dark:text-slate-400",
  "text-slate-400": "text-slate-400 dark:text-slate-500",
  "bg-slate-50": "bg-slate-50 dark:bg-slate-800/50",
  "border ": "border border-slate-200 dark:border-slate-800 ",
  "border-b": "border-b border-slate-200 dark:border-slate-800",
  "hover:bg-slate-50": "hover:bg-slate-50 dark:hover:bg-slate-800/80",
  "bg-slate-100 text-slate-700": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "bg-red-100 text-red-700": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "bg-green-100 text-green-700": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-slate-100 rounded-full": "bg-slate-100 dark:bg-slate-800 rounded-full",
  
  // Specific complex strings
  "of active customers transacted in multiple engine types on the same day.": " {t('insight_cross_1', { defaultValue: 'of active customers transacted in multiple engine types on the same day.' })}",
  "The most common pairing is": "{t('insight_cross_2', { defaultValue: 'The most common pairing is' })}",
  "of customers from the previous equivalent period returned to transact in this period.": " {t('insight_retention', { defaultValue: 'of customers from the previous equivalent period returned to transact in this period.' })}",
  "Revenue drops": "{t('insight_slow_1', { defaultValue: 'Revenue drops' })}",
  "below the daily average during": "{t('insight_slow_2', { defaultValue: 'below the daily average during' })}",
  "Promo codes": "{t('insight_promo_1', { defaultValue: 'Promo codes' })}",
  "average transaction value by": "{t('insight_promo_2', { defaultValue: 'average transaction value by' })}",
  "compared to non-promotional transactions.": " {t('insight_promo_3', { defaultValue: 'compared to non-promotional transactions.' })}",
  "increase": "{t('increase', { defaultValue: 'increase' })}",
  "decrease": "{t('decrease', { defaultValue: 'decrease' })}"
};

for (const [key, val] of Object.entries(replacements)) {
    content = content.split(key).join(val);
}

// Re-fix some accidental border duplicates
content = content.replace(/border border-slate-200 dark:border-slate-800-b/g, 'border-b');
content = content.replace(/border border-slate-200 dark:border-slate-800-l-4/g, 'border-s-4');

fs.writeFileSync(file, content, 'utf8');
console.log('Refactored page.tsx');
