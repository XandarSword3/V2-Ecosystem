'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Download, 
  Trash2, 
  Bell, 
  Eye, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Share2,
  Lock
} from 'lucide-react';
import api, { API_BASE_URL } from '@/lib/api';
import { toast } from 'sonner';

interface Consent {
  id: string;
  consent_type: string;
  granted: boolean;
  granted_at?: string;
  withdrawn_at?: string;
}

interface ExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'expired' | 'failed';
  requested_at: string;
  processed_at?: string;
  file_expires_at?: string;
}

interface DeletionRequest {
  id: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  reason: string;
  requested_at: string;
  rejection_reason?: string;
  retention_exceptions?: string[];
}

interface DataSharingEntry {
  id: string;
  third_party: string;
  purpose: string;
  data_shared: string[];
  shared_at: string;
}

interface RetentionPolicy {
  data_category: string;
  retention_period_days: number;
  legal_basis: string;
  description: string;
}

interface PrivacyDashboard {
  consents: Consent[];
  export_requests: ExportRequest[];
  deletion_requests: DeletionRequest[];
  data_sharing: DataSharingEntry[];
  recent_activity: any[];
  retention_policies: RetentionPolicy[];
}

const CONSENT_LABELS: Record<string, { label: string; description: string }> = {
  marketing_email: {
    label: 'Marketing Emails',
    description: 'Receive promotional emails about offers and news'
  },
  marketing_sms: {
    label: 'Marketing SMS',
    description: 'Receive promotional text messages'
  },
  analytics: {
    label: 'Analytics',
    description: 'Help us improve by allowing usage analytics'
  },
  third_party_sharing: {
    label: 'Partner Offers',
    description: 'Share data with trusted partners for relevant offers'
  }
};

export default function PrivacyCenter() {
  const [dashboard, setDashboard] = useState<PrivacyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'consents' | 'export' | 'deletion' | 'sharing'>('overview');
  const [submitting, setSubmitting] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await api.get('/gdpr/dashboard');
      const data = res.data;
      
      if (data.success) {
        setDashboard(data.dashboard);
      } else {
        setError(data.error || 'Failed to load privacy data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function updateConsent(consentType: string, granted: boolean) {
    setSubmitting(true);
    try {
      const res = await api.put('/gdpr/consents', { consent_type: consentType, granted });
      
      if (res.data?.success !== false) {
        toast.success(`Consent for ${CONSENT_LABELS[consentType]?.label || consentType} updated`);
        await fetchDashboard();
      }
    } catch (err) {
      toast.error('Failed to update consent');
      setError('Failed to update consent');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestExport() {
    setSubmitting(true);
    try {
      const res = await api.post('/gdpr/export/request');
      const data = res.data;
      
      if (data.success) {
        await fetchDashboard();
        toast.success('Export request submitted! You will be notified when ready.');
      } else {
        toast.error(data.error || 'Export request failed');
        setError(data.error);
      }
    } catch (err) {
      toast.error('Failed to request export');
      setError('Failed to request export');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestDeletion() {
    if (!deletionReason.trim()) {
      toast.error('Please provide a reason for the deletion request');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/gdpr/deletion/request', { reason: deletionReason });
      const data = res.data;
      
      if (data.success) {
        await fetchDashboard();
        setShowDeletionConfirm(false);
        setDeletionReason('');
        toast.success('Deletion request submitted. Our team will review it within 30 days.');
      } else {
        toast.error(data.error || 'Deletion request failed');
        setError(data.error);
      }
    } catch (err) {
      toast.error('Failed to request deletion');
      setError('Failed to request deletion');
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'expired':
        return <Clock className="w-5 h-5 text-slate-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">Loading GDPR Privacy Center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-500" />
          <p className="mt-2 text-slate-600 dark:text-slate-400">{error}</p>
          <button 
            onClick={() => { setError(null); fetchDashboard(); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GDPR Privacy & Data Center</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Exercise your GDPR rights: manage consents, request machine-readable data exports, view data sharing logs, and manage right-to-erasure requests.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Rights', icon: Eye },
          { id: 'consents', label: 'Consent Settings', icon: Bell },
          { id: 'export', label: 'Data Export (Art. 20)', icon: Download },
          { id: 'deletion', label: 'Right to Erasure (Art. 17)', icon: Trash2 },
          { id: 'sharing', label: 'Third-Party Sharing', icon: Share2 }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {dashboard.consents?.filter(c => c.granted).length ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Active Consents</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {dashboard.export_requests?.filter(r => r.status === 'completed').length ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Data Exports</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {dashboard.data_sharing?.length ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Third-Party Shares</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {dashboard.retention_policies?.length ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">Retention Rules</p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Rights */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Your Rights Under GDPR</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Right to Access (Article 15)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Request full access and a copy of all personal data held about you across all property modules.
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Right to Rectification (Article 16)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Update, modify, or correct your personal profile and contact information at any time.
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Right to Erasure (Article 17)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Request permanent account deletion and anonymization of financial logs per statutory limits.
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/40">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Right to Portability (Article 20)</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Export structured, machine-readable ZIP archives containing your entire activity history.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Privacy Audit Log</h2>
            {dashboard.recent_activity && dashboard.recent_activity.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recent_activity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 text-xs p-2.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{activity.description || 'Privacy event recorded'}</span>
                    <span className="text-slate-400 ml-auto font-mono">
                      {activity.created_at ? formatDate(activity.created_at) : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">No recent privacy logs</p>
            )}
          </div>
        </div>
      )}

      {/* Consents Tab */}
      {activeTab === 'consents' && dashboard && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Consent Preferences Management</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
            Manage granular marketing and analytics consents. Changes take effect instantly across all property channels.
          </p>
          
          <div className="space-y-4">
            {Object.entries(CONSENT_LABELS).map(([type, info]) => {
              const consent = dashboard.consents?.find(c => c.consent_type === type);
              const isGranted = consent?.granted ?? false;
              
              return (
                <div key={type} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{info.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{info.description}</p>
                    {consent?.granted_at && (
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        Granted: {formatDate(consent.granted_at)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => updateConsent(type, !isGranted)}
                    disabled={submitting}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isGranted ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isGranted ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && dashboard && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">Request Data Export (Article 20)</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Download a complete machine-readable archive containing your profile, bookings, orders, ticket passes, loyalty ledger, and consent history.
            </p>
            
            <button
              onClick={requestExport}
              disabled={submitting || dashboard.export_requests?.some(r => r.status === 'pending' || r.status === 'processing')}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Request New Data Export
            </button>
          </div>

          {/* Export History */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Export Request History</h3>
            {dashboard.export_requests && dashboard.export_requests.length > 0 ? (
              <div className="space-y-3">
                {dashboard.export_requests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white capitalize">{request.status}</p>
                        <p className="text-slate-500 text-[11px]">Requested: {formatDate(request.requested_at)}</p>
                      </div>
                    </div>
                    {request.status === 'completed' && (
                      <a
                        href={`${API_BASE_URL}/gdpr/export/download/${request.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Archive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">No export requests submitted yet</p>
            )}
          </div>

          {/* Retention Policies */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Statutory Retention Schedule</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="text-left py-2 px-3">Data Category</th>
                    <th className="text-left py-2 px-3">Retention Period</th>
                    <th className="text-left py-2 px-3">Legal Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {(dashboard.retention_policies || []).map((policy) => (
                    <tr key={policy.data_category}>
                      <td className="py-2.5 px-3 capitalize font-medium text-slate-900 dark:text-white">
                        {policy.data_category.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {Math.round(policy.retention_period_days / 365)} Year(s)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {policy.legal_basis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Tab */}
      {activeTab === 'deletion' && dashboard && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-red-600 dark:text-red-500 mb-1">
                  Right to Erasure / Account Deletion (Article 17)
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                  Permanently delete your personal profile and account credentials. Financial transactions are anonymized per statutory tax retention laws.
                </p>
                
                {!showDeletionConfirm ? (
                  <button
                    onClick={() => setShowDeletionConfirm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    Initiate Account Deletion Request
                  </button>
                ) : (
                  <div className="border border-red-200 dark:border-red-900/60 rounded-xl p-4 bg-red-50 dark:bg-red-950/20 space-y-3">
                    <h3 className="font-bold text-sm text-red-800 dark:text-red-300">
                      Confirm Right to Erasure Request
                    </h3>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Please state your reason for requesting complete account deletion:
                    </p>
                    <textarea
                      value={deletionReason}
                      onChange={(e) => setDeletionReason(e.target.value)}
                      placeholder="Please enter deletion reason for audit records..."
                      className="w-full p-3 border border-red-200 dark:border-red-900/60 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      rows={3}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={requestDeletion}
                        disabled={submitting || !deletionReason.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Submit Erasure Request
                      </button>
                      <button
                        onClick={() => {
                          setShowDeletionConfirm(false);
                          setDeletionReason('');
                        }}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deletion History */}
          {dashboard.deletion_requests && dashboard.deletion_requests.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Erasure Request Tracking</h3>
              <div className="space-y-3">
                {dashboard.deletion_requests.map((request) => (
                  <div key={request.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(request.status)}
                      <span className="font-bold text-slate-900 dark:text-white capitalize">{request.status}</span>
                      <span className="text-slate-400 ml-auto font-mono text-[11px]">
                        {formatDate(request.requested_at)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">Reason: {request.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sharing Tab */}
      {activeTab === 'sharing' && dashboard && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Third-Party Data Sharing Log</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
            Audited log of any data transmissions to third-party processors or partner services.
          </p>
          
          {dashboard.data_sharing && dashboard.data_sharing.length > 0 ? (
            <div className="space-y-3">
              {dashboard.data_sharing.map((entry) => (
                <div key={entry.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">{entry.third_party}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{formatDate(entry.shared_at)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">Purpose: {entry.purpose}</p>
                  <p className="text-slate-400 text-[11px]">Fields Shared: {entry.data_shared.join(', ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              <Share2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p>No third-party data sharing activity recorded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
