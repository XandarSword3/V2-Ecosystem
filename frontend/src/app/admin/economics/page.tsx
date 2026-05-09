'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { 
  TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, 
  DollarSign, Activity, Users, Clock, AlertCircle 
} from 'lucide-react';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface DateRange {
  from: string;
  to: string;
  label: string;
}

const PRESETS: DateRange[] = [
  { label: 'Today', from: startOfDay(new Date()).toISOString(), to: endOfDay(new Date()).toISOString() },
  { label: 'Yesterday', from: startOfDay(subDays(new Date(), 1)).toISOString(), to: endOfDay(subDays(new Date(), 1)).toISOString() },
  { label: 'Last 7 days', from: startOfDay(subDays(new Date(), 7)).toISOString(), to: endOfDay(new Date()).toISOString() },
  { label: 'Last 30 days', from: startOfDay(subDays(new Date(), 30)).toISOString(), to: endOfDay(new Date()).toISOString() },
  { label: 'Last 90 days', from: startOfDay(subDays(new Date(), 90)).toISOString(), to: endOfDay(new Date()).toISOString() },
];

export default function EconomicsPage() {
  const [range, setRange] = useState<DateRange>(PRESETS[3]); // Last 30 days default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [revenueTime, setRevenueTime] = useState<any[]>([]);
  const [revenueModule, setRevenueModule] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [staffPerf, setStaffPerf] = useState<any[]>([]);
  const [grossNet, setGrossNet] = useState<any>({ gross: 0, net: 0, discounts: 0, refunds: 0 });
  const [volume, setVolume] = useState<{ overall: number }>({ overall: 0 });
  const [retention, setRetention] = useState<any>({ retentionRate: 0 });
  
  // Insights
  const [crossModule, setCrossModule] = useState<any>(null);
  const [slowPeriods, setSlowPeriods] = useState<any[]>([]);
  const [promoEffect, setPromoEffect] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = { params: { from: range.from, to: range.to } };
      
      const [
        resRevTime, resRevMod, resPeak, resStaff, resGross, resVol, resAvg,
        resRet, resCross, resSlow, resPromo
      ] = await Promise.all([
        api.get('/economics/revenue', { params: { ...p.params, interval: 'day' } }),
        api.get('/economics/by-module', p),
        api.get('/economics/peak-hours', p),
        api.get('/economics/staff-performance', p),
        api.get('/economics/gross-vs-net', p),
        api.get('/economics/volume', { params: { ...p.params, interval: 'day' } }),
        api.get('/economics/average-transaction-value', p).catch(() => ({ data: { data: { overall: 0 } } })), // graceful fallback if not perfectly matched
        api.get('/economics/retention', p),
        api.get('/economics/cross-module-patterns', p),
        api.get('/economics/slow-periods', p),
        api.get('/economics/promo-effectiveness', p),
      ]);

      setRevenueTime(resRevTime.data.data);
      setRevenueModule(resRevMod.data.data);
      setPeakHours(resPeak.data.data);
      setStaffPerf(resStaff.data.data);
      setGrossNet(resGross.data.data);
      
      const totalVol = resVol.data.data.reduce((acc: number, cur: any) => acc + cur.count, 0);
      setVolume({ overall: totalVol });
      
      setRetention(resRet.data.data);
      setCrossModule(resCross.data.data);
      setSlowPeriods(resSlow.data.data);
      setPromoEffect(resPromo.data.data);

    } catch (err: any) {
      console.error(err);
      setError('Failed to load economics data. Ensure you have the correct permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range]);

  const formatCurrency = (val: number) => `$${(val || 0).toFixed(2)}`;

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Error Loading Economics</h2>
        <p className="text-slate-600 mt-2">{error}</p>
      </div>
    );
  }

  // Calculate unique engines for stacked chart
  const engines = Array.from(new Set(revenueTime.flatMap(Object.keys).filter(k => k !== 'time')));
  const colors = ['#0891b2', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-cyan-600" />
            Economics Core
          </h1>
          <p className="text-slate-500 mt-1">Real-time transaction and revenue analytics across all modules.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
          <Calendar className="h-4 w-4 text-slate-500 ml-2" />
          <select 
            className="border-0 bg-transparent text-sm font-medium focus:ring-0 cursor-pointer pl-1 pr-8 py-2"
            value={range.label}
            onChange={(e) => {
              const selected = PRESETS.find(p => p.label === e.target.value);
              if (selected) setRange(selected);
            }}
          >
            {PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      ) : (
        <>
          {/* Section 1: Revenue Overview */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Gross Revenue</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(grossNet.gross)}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm border-l-4 border-l-cyan-500">
              <p className="text-sm font-medium text-slate-500">Net Revenue</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(grossNet.net)}</h3>
              <p className="text-xs text-slate-400 mt-1">After discounts & refunds</p>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Transactions</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">{volume.overall}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <p className="text-sm font-medium text-slate-500">Avg Transaction Value</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {formatCurrency(volume.overall > 0 ? grossNet.net / volume.overall : 0)}
              </h3>
            </div>
          </section>

          {/* Revenue Area Chart */}
          <section className="bg-white p-6 rounded-xl border shadow-sm h-96">
            <h3 className="text-lg font-semibold mb-6">Revenue Over Time</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  {engines.map((engine, i) => (
                    <linearGradient key={engine} id={`color${engine}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0}/>
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

          {/* Section 2: Module Breakdown */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
              <h3 className="text-lg font-semibold mb-6">Revenue By Module</h3>
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
                <div className="h-full flex items-center justify-center text-slate-400">No data</div>
              )}
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Module Performance Details</h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4 font-medium">Module</th>
                      <th className="p-4 font-medium text-right">Transactions</th>
                      <th className="p-4 font-medium text-right">Revenue</th>
                      <th className="p-4 font-medium text-right">Avg Value</th>
                      <th className="p-4 font-medium text-right">Refund Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {revenueModule.length > 0 ? revenueModule.map((m) => (
                      <tr key={m.moduleName} className="hover:bg-slate-50">
                        <td className="p-4 font-medium">{m.moduleName}</td>
                        <td className="p-4 text-right">{m.count}</td>
                        <td className="p-4 text-right font-medium">{formatCurrency(m.revenue)}</td>
                        <td className="p-4 text-right">{formatCurrency(m.averageValue)}</td>
                        <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${m.refundRate > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {m.refundRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 3: Peak Hours & Staff Performance */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Peak Hours (Avg Revenue)</h3>
              <p className="text-sm text-slate-500 mb-6">Average hourly revenue across selected period</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                    <YAxis />
                    <Tooltip labelFormatter={(h) => `${h}:00 - ${Number(h)+1}:00`} formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="averageRevenue">
                      {peakHours.map((entry, index) => {
                        const sorted = [...peakHours].sort((a,b) => b.averageRevenue - a.averageRevenue);
                        const isTop3 = sorted.slice(0,3).includes(entry);
                        const isBottom3 = sorted.slice(-3).includes(entry);
                        return <Cell key={`cell-${index}`} fill={isTop3 ? '#10b981' : isBottom3 ? '#f43f5e' : '#cbd5e1'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Top 3 Hours</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full"></div> Bottom 3 Hours</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Staff Performance</h3>
              </div>
              <div className="overflow-x-auto flex-1 max-h-96">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-4 font-medium">Staff ID</th>
                      <th className="p-4 font-medium text-right">Transactions</th>
                      <th className="p-4 font-medium text-right">Revenue</th>
                      <th className="p-4 font-medium text-right">Cancel Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {staffPerf.length > 0 ? staffPerf.map((s) => (
                      <tr key={s.staff_id} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-xs">{s.staff_id.split('-')[0]}</td>
                        <td className="p-4 text-right">{s.transactions}</td>
                        <td className="p-4 text-right font-medium">{formatCurrency(s.revenue)}</td>
                        <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${s.cancellationRate > 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                            {s.cancellationRate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400">No staff data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 5: Insights Panel */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="h-6 w-6 text-cyan-600" />
              Strategic Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Cross Module Pattern */}
              {crossModule?.topPairs?.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm">
                  <h4 className="text-sm font-bold text-indigo-800 mb-2 uppercase tracking-wide">Cross-Module Behavior</h4>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-bold text-indigo-600">{crossModule.crossModuleDayPercentage.toFixed(1)}%</span> of active customers transacted in multiple engine types on the same day. 
                    The most common pairing is <span className="font-bold">{crossModule.topPairs[0].pair}</span>.
                  </p>
                </div>
              )}

              {/* Retention */}
              {retention?.prevPeriodTotal > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-sm">
                  <h4 className="text-sm font-bold text-emerald-800 mb-2 uppercase tracking-wide">Customer Retention</h4>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    <span className="font-bold text-emerald-600">{retention.retentionRate.toFixed(1)}%</span> of customers from the previous equivalent period returned to transact in this period.
                  </p>
                </div>
              )}

              {/* Slow Periods */}
              {slowPeriods?.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-xl border border-amber-100 shadow-sm">
                  <h4 className="text-sm font-bold text-amber-800 mb-2 uppercase tracking-wide">Slow Period Alert</h4>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    Revenue drops <span className="font-bold text-amber-600">{slowPeriods[0].percentageBelowAverage.toFixed(1)}%</span> below the daily average during <span className="font-bold">{slowPeriods[0].hour}:00</span>.
                  </p>
                </div>
              )}

              {/* Promo Effectiveness */}
              {promoEffect && promoEffect.withPromo.volume > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100 shadow-sm">
                  <h4 className="text-sm font-bold text-blue-800 mb-2 uppercase tracking-wide">Promo Effectiveness</h4>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    Promo codes {promoEffect.valueDifferencePercentage >= 0 ? 'increase' : 'decrease'} average transaction value by <span className="font-bold text-blue-600">{Math.abs(promoEffect.valueDifferencePercentage).toFixed(1)}%</span> compared to non-promotional transactions.
                  </p>
                </div>
              )}

            </div>
          </section>

        </>
      )}
    </div>
  );
}
