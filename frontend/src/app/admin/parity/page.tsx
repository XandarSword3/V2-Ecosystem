'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  Play,
  Shield,
  BarChart3,
  Globe,
  Bell,
  ChevronDown,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Activity,
  Zap,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProperty } from '@/context/PropertyContext';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParityDashboard {
  config: ParityConfig;
  recentAlerts: ParityAlert[];
  stats: {
    totalChecksToday: number;
    violationsToday: number;
    complianceRate: number;
    mostProblematicChannel: string | null;
  };
  recentChecks: ParityCheck[];
}

interface ParityConfig {
  id?: string;
  property_id?: string;
  is_enabled: boolean;
  check_frequency_hours: number;
  tolerance_percentage: number;
  tolerance_amount: number;
  channels_to_monitor: string[];
  alert_on_undercut: boolean;
  alert_on_overpriced: boolean;
  undercut_threshold_percentage: number;
  notification_emails: string[];
  slack_webhook_url?: string;
  last_check_at?: string;
  next_check_at?: string;
}

interface ParityAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channel_code: string;
  channel_name: string;
  room_type_id: string;
  check_date: string;
  our_rate?: number;
  channel_rate?: number;
  difference_percentage?: number;
  status: 'new' | 'acknowledged' | 'resolved' | 'ignored';
  created_at: string;
}

interface ParityCheck {
  id: string;
  check_date: string;
  status: 'pending' | 'compliant' | 'violation' | 'error';
  our_rate: number;
  our_currency: string;
  created_at: string;
  rate_parity_results?: ParityResult[];
}

interface ParityResult {
  id: string;
  channel_code: string;
  channel_name: string;
  channel_rate?: number;
  rate_difference?: number;
  difference_percentage?: number;
  is_parity: boolean;
  violation_type?: 'undercut' | 'overpriced' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const severityColor = (s: string) => {
  switch (s) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default: return 'bg-blue-50 text-blue-600 border-blue-200';
  }
};

const checkStatusColor = (s: string) => {
  switch (s) {
    case 'compliant': return 'text-green-600 bg-green-50';
    case 'violation': return 'text-red-600 bg-red-50';
    case 'error': return 'text-gray-500 bg-gray-50';
    default: return 'text-yellow-600 bg-yellow-50';
  }
};

const alertStatusColor = (s: string) => {
  switch (s) {
    case 'new': return 'bg-red-50 text-red-600';
    case 'acknowledged': return 'bg-yellow-50 text-yellow-600';
    case 'resolved': return 'bg-green-50 text-green-600';
    default: return 'bg-gray-50 text-gray-500';
  }
};

const formatDate = (iso: string) => new Date(iso).toLocaleString();
const fmtPct = (n?: number) => n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : '—';
const fmtRate = (n?: number, currency = 'USD') =>
  n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n) : '—';

type Tab = 'dashboard' | 'alerts' | 'history' | 'config';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParityPage() {
  const { activePropertyId } = useProperty();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [historyEnd, setHistoryEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Partial<ParityConfig> | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [channelInput, setChannelInput] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['parity-dashboard', activePropertyId],
    queryFn: async () => {
      const res = await api.get(`/parity/properties/${activePropertyId}/dashboard`);
      return res.data as ParityDashboard;
    },
    enabled: !!activePropertyId,
    refetchInterval: 60000,
  });

  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['parity-alerts', activePropertyId],
    queryFn: async () => {
      const res = await api.get(`/parity/properties/${activePropertyId}/alerts`);
      return (res.data?.alerts || res.data || []) as ParityAlert[];
    },
    enabled: !!activePropertyId && activeTab === 'alerts',
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['parity-history', activePropertyId, historyStart, historyEnd],
    queryFn: async () => {
      const res = await api.get(`/parity/properties/${activePropertyId}/history?start=${historyStart}&end=${historyEnd}`);
      return (res.data?.checks || res.data || []) as ParityCheck[];
    },
    enabled: !!activePropertyId && activeTab === 'history',
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['parity-config', activePropertyId],
    queryFn: async () => {
      const res = await api.get(`/parity/properties/${activePropertyId}/config`);
      return res.data as ParityConfig;
    },
    enabled: !!activePropertyId && activeTab === 'config',
    onSuccess: (data) => { if (!configDraft) setConfigDraft(data); },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/parity/properties/${activePropertyId}/check/full`, {});
    },
    onSuccess: () => {
      toast.success('Parity check started — results will appear shortly');
      setTimeout(() => { refetchDash(); refetchAlerts(); }, 3000);
    },
    onError: () => toast.error('Failed to run parity check'),
  });

  const alertActionMutation = useMutation({
    mutationFn: async ({ alertId, action }: { alertId: string; action: 'acknowledge' | 'resolve' | 'ignore' }) => {
      await api.post(`/parity/alerts/${alertId}/${action}`, {});
    },
    onSuccess: () => {
      toast.success('Alert updated');
      qc.invalidateQueries({ queryKey: ['parity-alerts', activePropertyId] });
      qc.invalidateQueries({ queryKey: ['parity-dashboard', activePropertyId] });
    },
    onError: () => toast.error('Failed to update alert'),
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/parity/properties/${activePropertyId}/config`, configDraft);
    },
    onSuccess: () => {
      toast.success('Configuration saved');
      qc.invalidateQueries({ queryKey: ['parity-config', activePropertyId] });
      qc.invalidateQueries({ queryKey: ['parity-dashboard', activePropertyId] });
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  const cfg = configDraft || config;

  if (!activePropertyId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Select a property to view rate parity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-semibold text-gray-900">Rate Parity</h1>
          {dashboard?.config?.is_enabled ? (
            <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-200 font-medium">Monitoring Active</span>
          ) : (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 font-medium">Monitoring Off</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runCheckMutation.mutate()}
            disabled={runCheckMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {runCheckMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Check Now
          </button>
          <button
            onClick={() => refetchDash()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {([
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'history', label: 'Check History', icon: History },
            { id: 'config', label: 'Configuration', icon: Settings },
          ] as { id: Tab; label: string; icon: any }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'alerts' && dashboard && dashboard.stats.violationsToday > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold">
                  {dashboard.stats.violationsToday}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* ── DASHBOARD ──────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {dashLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !dashboard ? (
              <div className="text-center py-16 text-gray-400">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No parity data yet. Run your first check to get started.</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Compliance Rate</p>
                    <p className={`text-3xl font-bold ${dashboard.stats.complianceRate >= 90 ? 'text-green-600' : dashboard.stats.complianceRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dashboard.stats.complianceRate.toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Today</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Checks Today</p>
                    <p className="text-3xl font-bold text-gray-900">{dashboard.stats.totalChecksToday}</p>
                    <p className="text-xs text-gray-400 mt-1">across all room types</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Violations Today</p>
                    <p className={`text-3xl font-bold ${dashboard.stats.violationsToday > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {dashboard.stats.violationsToday}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">price disparities detected</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">Problem Channel</p>
                    <p className="text-lg font-bold text-gray-900 truncate">
                      {dashboard.stats.mostProblematicChannel || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">most violations (30d)</p>
                  </div>
                </div>

                {/* Recent alerts */}
                {dashboard.recentAlerts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm">Recent Alerts</h3>
                      <button onClick={() => setActiveTab('alerts')} className="text-xs text-blue-500 hover:underline">
                        View all →
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {dashboard.recentAlerts.slice(0, 5).map(alert => (
                        <div key={alert.id} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{alert.channel_name}</p>
                              <p className="text-xs text-gray-500">
                                {alert.our_rate && alert.channel_rate
                                  ? `Our: ${fmtRate(alert.our_rate)} → Channel: ${fmtRate(alert.channel_rate)} (${fmtPct(alert.difference_percentage)})`
                                  : alert.alert_type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${alertStatusColor(alert.status)}`}>
                              {alert.status}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(alert.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent checks */}
                {dashboard.recentChecks.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900 text-sm">Recent Checks</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {dashboard.recentChecks.slice(0, 8).map(check => (
                        <div key={check.id} className="px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${checkStatusColor(check.status)}`}>
                              {check.status}
                            </span>
                            <span className="text-sm text-gray-700">{check.check_date}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {fmtRate(check.our_rate, check.our_currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dashboard.config?.next_check_at && (
                  <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    Next scheduled check: {formatDate(dashboard.config.next_check_at)}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ALERTS ─────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div className="max-w-4xl mx-auto">
            {alertsLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40 text-green-500" />
                <p className="font-medium text-gray-600">No active alerts</p>
                <p className="text-sm mt-1">Your rates are in parity across all monitored channels</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${alertStatusColor(alert.status)}`}>
                            {alert.status}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(alert.created_at)}</span>
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{alert.channel_name} — {alert.alert_type}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          {alert.our_rate != null && <span>Our rate: <strong>{fmtRate(alert.our_rate)}</strong></span>}
                          {alert.channel_rate != null && <span>Channel: <strong>{fmtRate(alert.channel_rate)}</strong></span>}
                          {alert.difference_percentage != null && (
                            <span className={alert.difference_percentage < 0 ? 'text-red-600' : 'text-orange-600'}>
                              {fmtPct(alert.difference_percentage)} difference
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Check date: {alert.check_date}</p>
                      </div>
                      {alert.status === 'new' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => alertActionMutation.mutate({ alertId: alert.id, action: 'acknowledge' })}
                            className="px-3 py-1.5 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors font-medium"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => alertActionMutation.mutate({ alertId: alert.id, action: 'resolve' })}
                            className="px-3 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-medium"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => alertActionMutation.mutate({ alertId: alert.id, action: 'ignore' })}
                            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                            title="Ignore this alert"
                          >
                            Ignore
                          </button>
                        </div>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => alertActionMutation.mutate({ alertId: alert.id, action: 'resolve' })}
                          className="px-3 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-medium flex-shrink-0"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY ────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-5">
              <input
                type="date"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={historyStart}
                onChange={e => setHistoryStart(e.target.value)}
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={historyEnd}
                onChange={e => setHistoryEnd(e.target.value)}
              />
            </div>

            {histLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No checks in this date range</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(check => (
                  <div key={check.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${checkStatusColor(check.status)}`}>
                          {check.status}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{check.check_date}</span>
                        <span className="text-sm text-gray-500">{fmtRate(check.our_rate, check.our_currency)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {check.rate_parity_results && (
                          <span className="text-xs text-gray-400">
                            {check.rate_parity_results.filter(r => !r.is_parity).length} violations
                            / {check.rate_parity_results.length} channels
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedCheck === check.id ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {expandedCheck === check.id && check.rate_parity_results && check.rate_parity_results.length > 0 && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500">
                            <tr>
                              <th className="text-left px-5 py-2">Channel</th>
                              <th className="text-right px-5 py-2">Channel Rate</th>
                              <th className="text-right px-5 py-2">Difference</th>
                              <th className="text-center px-5 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {check.rate_parity_results.map(result => (
                              <tr key={result.id} className={!result.is_parity ? 'bg-red-50/30' : ''}>
                                <td className="px-5 py-2 font-medium text-gray-800">{result.channel_name}</td>
                                <td className="px-5 py-2 text-right text-gray-700">{fmtRate(result.channel_rate)}</td>
                                <td className={`px-5 py-2 text-right font-medium ${
                                  result.difference_percentage == null ? 'text-gray-400'
                                  : result.difference_percentage < 0 ? 'text-red-600'
                                  : result.difference_percentage > 0 ? 'text-orange-600'
                                  : 'text-green-600'
                                }`}>
                                  {fmtPct(result.difference_percentage)}
                                </td>
                                <td className="px-5 py-2 text-center">
                                  {result.is_parity ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                                      {result.violation_type || 'violation'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONFIG ─────────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="max-w-2xl mx-auto">
            {configLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !cfg ? (
              <div className="text-center py-16 text-gray-400">
                <Settings className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No configuration found for this property</p>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Enabled toggle */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Rate Parity Monitoring</p>
                      <p className="text-sm text-gray-500 mt-0.5">Automatically check rates against OTA channels</p>
                    </div>
                    <button
                      onClick={() => setConfigDraft(p => ({ ...p!, is_enabled: !p!.is_enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${cfg.is_enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.is_enabled ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Check frequency */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <p className="font-semibold text-gray-900 text-sm">Check Settings</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Check Frequency (hours)</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cfg.check_frequency_hours}
                        onChange={e => setConfigDraft(p => ({ ...p!, check_frequency_hours: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tolerance (%)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cfg.tolerance_percentage}
                        onChange={e => setConfigDraft(p => ({ ...p!, tolerance_percentage: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tolerance (fixed amount)</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cfg.tolerance_amount}
                        onChange={e => setConfigDraft(p => ({ ...p!, tolerance_amount: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Undercut Threshold (%)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cfg.undercut_threshold_percentage}
                        onChange={e => setConfigDraft(p => ({ ...p!, undercut_threshold_percentage: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Alert toggles */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <p className="font-semibold text-gray-900 text-sm">Alert Triggers</p>
                  {[
                    { key: 'alert_on_undercut' as const, label: 'Alert when channel undercuts our rate' },
                    { key: 'alert_on_overpriced' as const, label: 'Alert when we are overpriced vs channel' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">{label}</p>
                      <button
                        onClick={() => setConfigDraft(p => ({ ...p!, [key]: !p![key] }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${cfg[key] ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg[key] ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Channels to monitor */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <p className="font-semibold text-gray-900 text-sm">Channels to Monitor</p>
                  <div className="flex flex-wrap gap-2">
                    {(cfg.channels_to_monitor || []).map(ch => (
                      <span key={ch} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                        {ch}
                        <button
                          onClick={() => setConfigDraft(p => ({ ...p!, channels_to_monitor: p!.channels_to_monitor.filter(c => c !== ch) }))}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add channel code (e.g. booking_com)"
                      value={channelInput}
                      onChange={e => setChannelInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && channelInput.trim()) {
                          setConfigDraft(p => ({ ...p!, channels_to_monitor: [...(p!.channels_to_monitor || []), channelInput.trim()] }));
                          setChannelInput('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (channelInput.trim()) {
                          setConfigDraft(p => ({ ...p!, channels_to_monitor: [...(p!.channels_to_monitor || []), channelInput.trim()] }));
                          setChannelInput('');
                        }
                      }}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Notification emails */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <p className="font-semibold text-gray-900 text-sm">Notification Emails</p>
                  <div className="flex flex-wrap gap-2">
                    {(cfg.notification_emails || []).map(email => (
                      <span key={email} className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">
                        {email}
                        <button
                          onClick={() => setConfigDraft(p => ({ ...p!, notification_emails: p!.notification_emails.filter(e => e !== email) }))}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add email address"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && emailInput.trim()) {
                          setConfigDraft(p => ({ ...p!, notification_emails: [...(p!.notification_emails || []), emailInput.trim()] }));
                          setEmailInput('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (emailInput.trim()) {
                          setConfigDraft(p => ({ ...p!, notification_emails: [...(p!.notification_emails || []), emailInput.trim()] }));
                          setEmailInput('');
                        }
                      }}
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Slack Webhook URL (optional)</label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://hooks.slack.com/…"
                      value={cfg.slack_webhook_url || ''}
                      onChange={e => setConfigDraft(p => ({ ...p!, slack_webhook_url: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <button
                    onClick={() => saveConfigMutation.mutate()}
                    disabled={saveConfigMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    {saveConfigMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Configuration
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
