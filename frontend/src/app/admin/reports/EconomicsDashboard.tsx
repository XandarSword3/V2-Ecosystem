'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, LineChart, Line,
} from 'recharts';
import {
  TrendingUp, Calendar, Activity, XCircle, ChevronRight, Download, FileText,
} from 'lucide-react';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { useProperty } from '@/context/PropertyContext';

interface DateRange {
  from: string;
  to: string;
  label: string;
}

/** Safely read `.data.data` from an axios response, returning `fallback` on any miss. */
function safeData<T>(res: any, fallback: T): T {
  try {
    const d = res?.data?.data;
    if (d === null || d === undefined) return fallback;
    return d as T;
  } catch {
    return fallback;
  }
}

export default function EconomicsDashboard() {
  const t = useTranslations('admin.economics');
  const tCommon = useTranslations('common');
  const { activePropertyId } = useProperty();

  const PRESETS: DateRange[] = [
    { label: tCommon('today', { defaultValue: 'Today' }), from: startOfDay(new Date()).toISOString(), to: endOfDay(new Date()).toISOString() },
    { label: tCommon('yesterday', { defaultValue: 'Yesterday' }), from: startOfDay(subDays(new Date(), 1)).toISOString(), to: endOfDay(subDays(new Date(), 1)).toISOString() },
    { label: t('last_7_days', { defaultValue: 'Last 7 days' }), from: startOfDay(subDays(new Date(), 7)).toISOString(), to: endOfDay(new Date()).toISOString() },
    { label: t('last_30_days', { defaultValue: 'Last 30 days' }), from: startOfDay(subDays(new Date(), 30)).toISOString(), to: endOfDay(new Date()).toISOString() },
    { label: t('last_90_days', { defaultValue: 'Last 90 days' }), from: startOfDay(subDays(new Date(), 90)).toISOString(), to: endOfDay(new Date()).toISOString() },
  ];

  const [range, setRange] = useState<DateRange>(PRESETS[3]);
  const [loading, setLoading] = useState(true);

  // Per-section error flags — a failure in one section does not blank the whole dashboard
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data states — all initialised to safe empties so renders never crash on null
  const [revenueTime, setRevenueTime]       = useState<any[]>([]);
  const [revenueModule, setRevenueModule]   = useState<any[]>([]);
  const [peakHours, setPeakHours]           = useState<any[]>([]);
  const [staffPerf, setStaffPerf]           = useState<any[]>([]);
  const [grossNet, setGrossNet]             = useState<any>({ gross: 0, net: 0, discounts: 0, refunds: 0 });
  const [volume, setVolume]                 = useState<{ overall: number }>({ overall: 0 });
  const [retention, setRetention]           = useState<any>({ retentionRate: 0 });
  const [topCustomers, setTopCustomers]     = useState<any[]>([]);
  const [repeatNew, setRepeatNew]           = useState<any>({ repeat: 0, newCust: 0, total: 0 });
  const [crossModule, setCrossModule]       = useState<any>(null);
  const [slowPeriods, setSlowPeriods]       = useState<any[]>([]);
  const [cancelPatterns, setCancelPatterns] = useState<any>(null);
  const [promoEffect, setPromoEffect]       = useState<any>(null);

  const [staffDrillDown, setStaffDrillDown] = useState<any>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // fetchData — split into independent groups so one 403/500 doesn't abort all.
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setErrors({});

    const p = { from: range.from, to: range.to, propertyId: activePropertyId };

    // Helper: fire a request, never throw — returns the axios response or null
    const safe = async (fn: () => Promise<any>): Promise<any | null> => {
      try { return await fn(); } catch { return null; }
    };

    // Group A — core revenue (most important; shown even if groups B/C fail)
    const [resRevTime, resRevMod, resGross, resVol] = await Promise.all([
      safe(() => api.get('/economics/revenue', { params: { ...p, interval: 'day' } })),
      safe(() => api.get('/economics/by-module', { params: p })),
      safe(() => api.get('/economics/gross-vs-net', { params: p })),
      safe(() => api.get('/economics/volume', { params: { ...p, interval: 'day' } })),
    ]);

    // Group B — operational detail
    const [resPeak, resStaff, resRet, resTop, resRep] = await Promise.all([
      safe(() => api.get('/economics/peak-hours', { params: p })),
      safe(() => api.get('/economics/staff-performance', { params: p })),
      safe(() => api.get('/economics/retention', { params: p })),
      safe(() => api.get('/economics/top-customers', { params: { ...p, limit: 5 } })),
      safe(() => api.get('/economics/repeat-vs-new', { params: p })),
    ]);

    // Group C — insights (non-critical; graceful if missing)
    const [resCross, resSlow, resPromo, resCancel] = await Promise.all([
      safe(() => api.get('/economics/cross-module-patterns', { params: p })),
      safe(() => api.get('/economics/slow-periods', { params: p })),
      safe(() => api.get('/economics/promo-effectiveness', { params: p })),
      safe(() => api.get('/economics/cancellation-patterns', { params: p })),
    ]);

    // Apply results — each setter uses safeData so null responses are harmless
    const rawRevTime = safeData<any[]>(resRevTime, []);
    // Ensure it is actually an array before passing to state (guards flatMap below)
    setRevenueTime(Array.isArray(rawRevTime) ? rawRevTime : []);

    setRevenueModule(safeData<any[]>(resRevMod, []));
    setGrossNet(safeData<any>(resGross, { gross: 0, net: 0, discounts: 0, refunds: 0 }));

    const volRows = safeData<any[]>(resVol, []);
    setVolume({ overall: Array.isArray(volRows) ? volRows.reduce((acc: number, cur: any) => acc + (Number(cur.count) || 0), 0) : 0 });

    setPeakHours(safeData<any[]>(resPeak, []));
    setStaffPerf(safeData<any[]>(resStaff, []));
    setRetention(safeData<any>(resRet, { retentionRate: 0 }));
    setTopCustomers(safeData<any[]>(resTop, []));
    setRepeatNew(safeData<any>(resRep, { repeat: 0, newCust: 0, total: 0 }));
    setCrossModule(safeData<any>(resCross, null));
    setSlowPeriods(safeData<any[]>(resSlow, []));
    setPromoEffect(safeData<any>(resPromo, null));
    setCancelPatterns(safeData<any>(resCancel, null));

    // Surface a non-blocking warning if the entire core group failed
    if (!resRevTime && !resRevMod && !resGross) {
      setErrors({ core: t('error_perms', { defaultValue: 'Could not load revenue data. Check your permissions or try refreshing.' }) });
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, activePropertyId]);

  const formatCurrency = (val: number) => `$${(val || 0).toFixed(2)}`;

  // ─── engines derived safely — no crash if revenueTime is empty or has odd shape
  const engines: string[] = React.useMemo(() => {
    if (!Array.isArray(revenueTime) || revenueTime.length === 0) return [];
    return Array.from(
      new Set(
        revenueTime.flatMap((row) =>
          typeof row === 'object' && row !== null
            ? Object.keys(row).filter((k) => k !== 'time')
            : []
        )
      )
    );
  }, [revenueTime]);

  const colors = ['#0891b2', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

  // ─── CSV export ────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const sections: string[] = [];
    sections.push('=== Revenue Overview ===');
    sections.push('Metric,Value');
    sections.push(`Gross Revenue,${grossNet.gross}`);
    sections.push(`Net Revenue,${grossNet.net}`);
    sections.push(`Discounts,${grossNet.discounts}`);
    sections.push(`Refunds,${grossNet.refunds}`);
    sections.push(`Total Transactions,${volume.overall}`);
    sections.push(`Average Transaction Value,${volume.overall > 0 ? (grossNet.net / volume.overall).toFixed(2) : 0}`);
    sections.push('');
    if (revenueModule.length > 0) {
      sections.push('=== Revenue By Module ===');
      sections.push('Module,Transactions,Revenue,Average Value,Refund Rate %');
      revenueModule.forEach(m => sections.push(`"${m.moduleName}",${m.count},${m.revenue},${m.averageValue.toFixed(2)},${m.refundRate.toFixed(1)}`));
      sections.push('');
    }
    if (staffPerf.length > 0) {
      sections.push('=== Staff Performance ===');
      sections.push('Staff ID,Staff Name,Transactions,Revenue,Cancellation Rate %');
      staffPerf.forEach(s => sections.push(`${s.staff_id},"${s.staff_name || ''}",${s.transactions},${s.revenue},${s.cancellationRate.toFixed(1)}`));
      sections.push('');
    }
    if (topCustomers.length > 0) {
      sections.push('=== Top Customers ===');
      sections.push('Customer Name,Transactions,Total Spend');
      topCustomers.forEach(c => sections.push(`"${c.customer_name || 'Anonymous'}",${c.transactions},${c.spend}`));
      sections.push('');
    }
    if (peakHours.length > 0) {
      sections.push('=== Peak Hours ===');
      sections.push('Hour,Average Revenue,Transaction Count');
      peakHours.forEach(h => sections.push(`${h.hour}:00,${h.averageRevenue.toFixed(2)},${h.transactionCount}`));
      sections.push('');
    }
    sections.push('=== Customer Metrics ===');
    sections.push(`Repeat Customers,${repeatNew.repeat}`);
    sections.push(`New Customers,${repeatNew.newCust}`);
    sections.push(`Retention Rate,${retention.retentionRate?.toFixed(1) || 0}%`);

    const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `economics_report_${range.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // ─── PDF export ────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const dateLabel = range.label.replace(/\s+/g, ' ');
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const netRevenue   = (grossNet.net       || 0).toFixed(2);
    const grossRevenue = (grossNet.gross     || 0).toFixed(2);
    const discounts    = (grossNet.discounts || 0).toFixed(2);
    const refunds      = (grossNet.refunds   || 0).toFixed(2);
    const avgTx = volume.overall > 0 ? (grossNet.net / volume.overall).toFixed(2) : '0.00';

    const moduleRows = revenueModule.map(m => `<tr>
      <td>${m.moduleName}</td><td>${m.count}</td>
      <td>$${Number(m.revenue).toFixed(2)}</td>
      <td>$${Number(m.averageValue).toFixed(2)}</td>
      <td>${Number(m.refundRate).toFixed(1)}%</td>
    </tr>`).join('');

    const staffRows = staffPerf.map(s => `<tr>
      <td>${s.staff_name || s.staff_id || '—'}</td><td>${s.transactions}</td>
      <td>$${Number(s.revenue).toFixed(2)}</td>
      <td>${Number(s.cancellationRate).toFixed(1)}%</td>
    </tr>`).join('');

    const customerRows = topCustomers.slice(0, 10).map(c => `<tr>
      <td>${c.customer_name || 'Anonymous'}</td><td>${c.transactions}</td>
      <td>$${Number(c.spend).toFixed(2)}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>Economics Report — ${dateLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#0f172a;background:#fff;padding:40px}
    .header{border-bottom:2px solid #4f46e5;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-end}
    .header h1{font-size:24px;font-weight:800;color:#4f46e5;letter-spacing:-0.02em}
    .header .meta{text-align:right;color:#64748b;font-size:10px;line-height:1.5}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px}
    .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
    .kpi .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px}
    .kpi .value{font-size:22px;font-weight:800;color:#0f172a}
    .kpi .sub{font-size:9px;color:#94a3b8;margin-top:4px}
    section{margin-bottom:30px;page-break-inside:avoid}
    section h2{font-size:12px;font-weight:700;color:#4f46e5;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{background:#f8fafc;text-align:left;padding:10px 12px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#475569;font-weight:700;border-bottom:1px solid #e2e8f0}
    td{padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155}
    tr:nth-child(even) td{background:#fcfdfe}
    tr:last-child td{border-bottom:none}
    .footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:9px;color:#94a3b8;text-align:center}
    @media print{body{padding:20px 0}@page{margin:1.5cm}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Economics Core Report</div>
      <h1>Revenue &amp; Transaction Analytics</h1>
    </div>
    <div class="meta">
      <div><strong>Period:</strong> ${dateLabel}</div>
      <div><strong>Generated:</strong> ${today}</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="label">Net Revenue</div><div class="value">$${netRevenue}</div><div class="sub">After discounts &amp; refunds</div></div>
    <div class="kpi"><div class="label">Gross Revenue</div><div class="value">$${grossRevenue}</div><div class="sub">Before adjustments</div></div>
    <div class="kpi"><div class="label">Total Transactions</div><div class="value">${volume.overall || 0}</div><div class="sub">Avg $${avgTx} / tx</div></div>
    <div class="kpi"><div class="label">Discounts &amp; Refunds</div><div class="value">$${(parseFloat(discounts) + parseFloat(refunds)).toFixed(2)}</div><div class="sub">$${discounts} disc · $${refunds} ref</div></div>
  </div>
  ${moduleRows ? `<section><h2>Revenue by Module</h2><table><thead><tr><th>Module</th><th>Transactions</th><th>Revenue</th><th>Avg Value</th><th>Refund Rate</th></tr></thead><tbody>${moduleRows}</tbody></table></section>` : ''}
  ${staffRows ? `<section><h2>Staff Performance</h2><table><thead><tr><th>Staff Member</th><th>Transactions</th><th>Revenue</th><th>Cancellation Rate</th></tr></thead><tbody>${staffRows}</tbody></table></section>` : ''}
  ${customerRows ? `<section><h2>Top Customers</h2><table><thead><tr><th>Customer</th><th>Transactions</th><th>Total Spend</th></tr></thead><tbody>${customerRows}</tbody></table></section>` : ''}
  <section><h2>Customer Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
    <tr><td>Repeat Customers</td><td>${repeatNew.repeat || 0}</td></tr>
    <tr><td>New Customers</td><td>${repeatNew.newCust || 0}</td></tr>
    <tr><td>Retention Rate</td><td>${retention.retentionRate?.toFixed(1) || 0}%</td></tr>
  </tbody></table></section>
  <div class="footer">Confidential — Generated by the Platform Management Platform · ${today}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.setTimeout(() => win.print(), 500);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-cyan-600" />
            {t('title', { defaultValue: 'Economics Core' })}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('subtitle', { defaultValue: 'Real-time transaction and revenue analytics across all modules.' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 ms-2" />
            <select
              className="border-0 bg-transparent text-sm font-medium focus:ring-0 cursor-pointer ps-1 pe-8 py-2"
              value={range.label}
              onChange={(e) => {
                const selected = PRESETS.find(pr => pr.label === e.target.value);
                if (selected) setRange(selected);
              }}
            >
              {PRESETS.map(pr => <option key={pr.label} value={pr.label}>{pr.label}</option>)}
            </select>
          </div>
          <button
            onClick={exportToCSV}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Non-blocking error banner — only shown when core revenue data is unavailable */}
      {errors.core && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errors.core}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600" />
        </div>
      ) : (
        <>
          {/* Section 1 — Revenue Overview KPIs */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('gross_revenue', { defaultValue: 'Gross Revenue' }), value: formatCurrency(grossNet.gross) },
              { label: t('net_revenue',   { defaultValue: 'Net Revenue' }),   value: formatCurrency(grossNet.net),   sub: t('after_discounts_refunds', { defaultValue: 'After discounts & refunds' }), accent: true },
              { label: t('transactions',  { defaultValue: 'Transactions' }),  value: String(volume.overall) },
              { label: t('avg_transaction_value', { defaultValue: 'Avg Transaction Value' }), value: formatCurrency(volume.overall > 0 ? grossNet.net / volume.overall : 0) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={`bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm ${kpi.accent ? 'border-l-4 border-l-cyan-500 border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{kpi.value}</h3>
                {kpi.sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{kpi.sub}</p>}
              </div>
            ))}
          </section>

          {/* Revenue Area Chart */}
          {revenueTime.length > 0 && (
            <section className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-96">
              <h3 className="text-lg font-semibold mb-6">{t('revenue_over_time', { defaultValue: 'Revenue Over Time' })}</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {engines.map((engine, i) => (
                      <linearGradient key={engine} id={`color${engine}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={colors[i % colors.length]} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="time" tickFormatter={(v) => format(new Date(v), 'MMM d')} />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <Tooltip labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')} formatter={(value: any) => formatCurrency(Number(value))} />
                  <Legend />
                  {engines.map((engine, i) => (
                    <Area key={engine} type="monotone" dataKey={engine} stackId="1" stroke={colors[i % colors.length]} fill={`url(#color${engine})`} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Section 2 — Module Breakdown */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-96">
              <h3 className="text-lg font-semibold mb-6">{t('revenue_by_module', { defaultValue: 'Revenue By Module' })}</h3>
              {revenueModule.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueModule} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="moduleName" type="category" width={100} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="revenue" fill="#0891b2" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                  {t('no_data', { defaultValue: 'No data' })}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold">{t('module_perf_details', { defaultValue: 'Module Performance Details' })}</h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-start text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-4 font-medium">{t('module', { defaultValue: 'Module' })}</th>
                      <th className="p-4 font-medium text-end">{t('transactions', { defaultValue: 'Transactions' })}</th>
                      <th className="p-4 font-medium text-end">{t('revenue', { defaultValue: 'Revenue' })}</th>
                      <th className="p-4 font-medium text-end">{t('avg_value', { defaultValue: 'Avg Value' })}</th>
                      <th className="p-4 font-medium text-end">{t('refund_rate', { defaultValue: 'Refund Rate' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {revenueModule.length > 0 ? revenueModule.map((m) => (
                      <tr key={m.moduleName} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <td className="p-4 font-medium">{m.moduleName}</td>
                        <td className="p-4 text-end">{m.count}</td>
                        <td className="p-4 text-end font-medium">{formatCurrency(m.revenue)}</td>
                        <td className="p-4 text-end">{formatCurrency(m.averageValue)}</td>
                        <td className="p-4 text-end">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${m.refundRate > 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                            {m.refundRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400 dark:text-slate-500">{t('no_data', { defaultValue: 'No data available' })}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 3 — Peak Hours & Staff Performance */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-2">{t('peak_hours', { defaultValue: 'Peak Hours (Avg Revenue)' })}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('avg_hourly_revenue', { defaultValue: 'Average hourly revenue across selected period' })}</p>
              <div className="h-64">
                {peakHours.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                      <YAxis />
                      <Tooltip labelFormatter={(h) => `${h}:00 - ${Number(h) + 1}:00`} formatter={(value: any) => formatCurrency(Number(value))} />
                      <Bar dataKey="averageRevenue">
                        {peakHours.map((entry, index) => {
                          const sorted = [...peakHours].sort((a, b) => b.averageRevenue - a.averageRevenue);
                          const isTop3    = sorted.slice(0, 3).includes(entry);
                          const isBottom3 = sorted.slice(-3).includes(entry);
                          return <Cell key={`cell-${index}`} fill={isTop3 ? '#10b981' : isBottom3 ? '#f43f5e' : '#cbd5e1'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">{t('no_data', { defaultValue: 'No data' })}</div>
                )}
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full" /> {t('top_3_hours', { defaultValue: 'Top 3 Hours' })}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full" /> {t('bottom_3_hours', { defaultValue: 'Bottom 3 Hours' })}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold">{t('staff_performance', { defaultValue: 'Staff Performance' })}</h3>
              </div>
              <div className="overflow-x-auto flex-1 max-h-96">
                <table className="w-full text-start text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-4 font-medium">{t('staff_id', { defaultValue: 'Staff ID' })}</th>
                      <th className="p-4 font-medium text-end">{t('transactions', { defaultValue: 'Transactions' })}</th>
                      <th className="p-4 font-medium text-end">{t('revenue', { defaultValue: 'Revenue' })}</th>
                      <th className="p-4 font-medium text-end">{t('cancel_rate', { defaultValue: 'Cancel Rate' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffPerf.length > 0 ? staffPerf.map((s) => (
                      <tr
                        key={s.staff_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer group"
                        onClick={() => setStaffDrillDown(s)}
                      >
                        <td className="p-4 font-mono text-xs flex items-center gap-2">
                          {s.staff_name || s.staff_id.split('-')[0]}
                          <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="p-4 text-end">{s.transactions}</td>
                        <td className="p-4 text-end font-medium">{formatCurrency(s.revenue)}</td>
                        <td className="p-4 text-end">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${s.cancellationRate > 10 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {s.cancellationRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400 dark:text-slate-500">{t('no_staff_data', { defaultValue: 'No staff data' })}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 4 — Customer Insights */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold">{t('top_customers', { defaultValue: 'Top Customers' })}</h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-start text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-4 font-medium">{t('customer', { defaultValue: 'Customer' })}</th>
                      <th className="p-4 font-medium text-end">{t('transactions', { defaultValue: 'Transactions' })}</th>
                      <th className="p-4 font-medium text-end">{t('spend', { defaultValue: 'Spend' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {topCustomers.length > 0 ? topCustomers.map((c) => (
                      <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <td className="p-4 font-medium">{c.customer_name || t('anonymous', { defaultValue: 'Anonymous' })}</td>
                        <td className="p-4 text-end">{c.transactions}</td>
                        <td className="p-4 text-end font-medium">{formatCurrency(c.spend)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="p-4 text-center text-slate-400 dark:text-slate-500">{t('no_customer_data', { defaultValue: 'No customer data' })}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">{t('repeat_vs_new', { defaultValue: 'Repeat vs New Customers' })}</h3>
              {repeatNew.total > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold text-emerald-600">{((repeatNew.repeat / repeatNew.total) * 100).toFixed(1)}%</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('repeat_customer_rate', { defaultValue: 'Repeat Customer Rate' })}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{repeatNew.repeat} {t('repeat', { defaultValue: 'Repeat' })}</p>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{repeatNew.newCust} {t('new', { defaultValue: 'New' })}</p>
                    </div>
                  </div>
                  <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${(repeatNew.repeat / repeatNew.total) * 100}%` }} />
                    <div className="h-full bg-blue-400"   style={{ width: `${(repeatNew.newCust / repeatNew.total) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">{t('no_data', { defaultValue: 'No data' })}</div>
              )}
            </div>
          </section>

          {/* Staff Drill-Down Modal */}
          {staffDrillDown && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setStaffDrillDown(null)}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 border border-slate-200 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Staff Detail: {staffDrillDown.staff_name || 'Unknown'}</h3>
                  <button onClick={() => setStaffDrillDown(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <XCircle className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Transactions', value: staffDrillDown.transactions, color: 'text-slate-900 dark:text-white' },
                    { label: 'Revenue', value: formatCurrency(staffDrillDown.revenue), color: 'text-emerald-600' },
                    { label: 'Avg per Transaction', value: formatCurrency(staffDrillDown.transactions > 0 ? staffDrillDown.revenue / staffDrillDown.transactions : 0), color: 'text-cyan-600' },
                    { label: 'Cancellation Rate', value: `${staffDrillDown.cancellationRate?.toFixed(1) || 0}%`, color: staffDrillDown.cancellationRate > 10 ? 'text-red-500' : staffDrillDown.cancellationRate > 5 ? 'text-amber-500' : 'text-emerald-500' },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{item.label}</p>
                      <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-500">Staff ID: <span className="font-mono text-xs">{staffDrillDown.staff_id}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Section 5 — Cancellation Patterns */}
          {cancelPatterns && cancelPatterns.totalCancelled > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <XCircle className="h-6 w-6 text-red-500" />
                Cancellation Patterns
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Total Cancellations</p>
                  <p className="text-3xl font-bold text-red-500">{cancelPatterns.totalCancelled}</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Lost revenue: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(cancelPatterns.totalLostRevenue)}</span>
                  </p>
                </div>
                {Array.isArray(cancelPatterns.byReason) && cancelPatterns.byReason.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">By Reason</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={cancelPatterns.byReason.slice(0, 6)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="reason" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {Array.isArray(cancelPatterns.byDay) && cancelPatterns.byDay.length > 1 && (
                <div className="mt-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Daily Cancellation Trend</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cancelPatterns.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}

          {/* Section 6 — Strategic Insights */}
          {(crossModule?.topPairs?.length > 0 || retention?.prevPeriodTotal > 0 || slowPeriods?.length > 0 || promoEffect?.withPromo?.volume > 0) && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="h-6 w-6 text-cyan-600" />
                Strategic Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {crossModule?.topPairs?.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 p-6 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                    <h4 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 mb-2 uppercase tracking-wide">{t('cross_module_behavior', { defaultValue: 'Cross-Module Behavior' })}</h4>
                    <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                      <span className="font-bold text-indigo-600">{crossModule.crossModuleDayPercentage.toFixed(1)}%</span> {t('insight_cross_1', { defaultValue: 'of active customers transacted in multiple engine types on the same day.' })} {t('insight_cross_2', { defaultValue: 'The most common pairing is' })} <span className="font-bold">{crossModule.topPairs[0].pair}</span>.
                    </p>
                  </div>
                )}
                {retention?.prevPeriodTotal > 0 && (
                  <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 p-6 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wide">{t('customer_retention', { defaultValue: 'Customer Retention' })}</h4>
                    <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                      <span className="font-bold text-emerald-600">{retention.retentionRate.toFixed(1)}%</span> {t('insight_retention', { defaultValue: 'of customers from the previous equivalent period returned to transact in this period.' })}
                    </p>
                  </div>
                )}
                {slowPeriods?.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 p-6 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase tracking-wide">{t('slow_period_alert', { defaultValue: 'Slow Period Alert' })}</h4>
                    <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                      {t('insight_slow_1', { defaultValue: 'Revenue drops' })} <span className="font-bold text-amber-600">{slowPeriods[0].percentageBelowAverage.toFixed(1)}%</span> {t('insight_slow_2', { defaultValue: 'below the daily average during' })} <span className="font-bold">{slowPeriods[0].hour}:00</span>.
                    </p>
                  </div>
                )}
                {promoEffect?.withPromo?.volume > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 p-6 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-400 mb-2 uppercase tracking-wide">{t('promo_effectiveness', { defaultValue: 'Promo Effectiveness' })}</h4>
                    <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">
                      {t('insight_promo_1', { defaultValue: 'Promo codes' })} {promoEffect.valueDifferencePercentage >= 0 ? t('increase', { defaultValue: 'increase' }) : t('decrease', { defaultValue: 'decrease' })} {t('insight_promo_2', { defaultValue: 'average transaction value by' })} <span className="font-bold text-blue-600">{Math.abs(promoEffect.valueDifferencePercentage).toFixed(1)}%</span> {t('insight_promo_3', { defaultValue: 'compared to non-promotional transactions.' })}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
