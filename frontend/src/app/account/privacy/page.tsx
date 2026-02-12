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
import api from '@/lib/api';

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

export default function PrivacyCenterPage() {
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
        await fetchDashboard();
      }
    } catch (err) {
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
        alert('Export request submitted! You will be notified when it\'s ready.');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to request export');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestDeletion() {
    if (!deletionReason.trim()) {
      alert('Please provide a reason for the deletion request');
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
        alert('Deletion request submitted. Our team will review it within 30 days.');
      } else {
        setError(data.error);
      }
    } catch (err) {
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
        return <Clock className="w-5 h-5 text-gray-500" />;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading privacy settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-500" />
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => { setError(null); fetchDashboard(); }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Privacy Center</h1>
          </div>
          <p className="text-gray-600">
            Manage your privacy settings, data exports, and account deletion requests
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'consents', label: 'Consent Settings', icon: Bell },
            { id: 'export', label: 'Export Data', icon: Download },
            { id: 'deletion', label: 'Delete Account', icon: Trash2 },
            { id: 'sharing', label: 'Data Sharing', icon: Share2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Bell className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {dashboard.consents.filter(c => c.granted).length}
                    </p>
                    <p className="text-sm text-gray-600">Active Consents</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Download className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {dashboard.export_requests.filter(r => r.status === 'completed').length}
                    </p>
                    <p className="text-sm text-gray-600">Data Exports</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Share2 className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {dashboard.data_sharing.length}
                    </p>
                    <p className="text-sm text-gray-600">Third-Party Shares</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <Lock className="w-8 h-8 text-gray-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {dashboard.retention_policies.length}
                    </p>
                    <p className="text-sm text-gray-600">Data Categories</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Rights */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Your Privacy Rights (GDPR)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Right to Access (Article 15)</h3>
                  <p className="text-sm text-gray-600">
                    Request a copy of all personal data we hold about you.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Right to Rectification (Article 16)</h3>
                  <p className="text-sm text-gray-600">
                    Update or correct your personal information at any time.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Right to Erasure (Article 17)</h3>
                  <p className="text-sm text-gray-600">
                    Request deletion of your personal data ("right to be forgotten").
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Right to Portability (Article 20)</h3>
                  <p className="text-sm text-gray-600">
                    Export your data in a machine-readable format.
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              {dashboard.recent_activity.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recent_activity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{activity.description}</span>
                      <span className="text-gray-400 ml-auto">
                        {formatDate(activity.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No recent activity</p>
              )}
            </div>
          </div>
        )}

        {/* Consents Tab */}
        {activeTab === 'consents' && dashboard && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Manage Your Consent</h2>
            <p className="text-gray-600 mb-6">
              Control how we use your personal data. You can change these settings at any time.
            </p>
            
            <div className="space-y-4">
              {Object.entries(CONSENT_LABELS).map(([type, info]) => {
                const consent = dashboard.consents.find(c => c.consent_type === type);
                const isGranted = consent?.granted ?? false;
                
                return (
                  <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{info.label}</h3>
                      <p className="text-sm text-gray-600">{info.description}</p>
                      {consent?.granted_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Granted: {formatDate(consent.granted_at)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => updateConsent(type, !isGranted)}
                      disabled={submitting}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isGranted ? 'bg-blue-600' : 'bg-gray-200'
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Export Your Data</h2>
              <p className="text-gray-600 mb-4">
                Request a copy of all personal data we hold about you. The export will be 
                prepared as a ZIP file containing JSON files for each data category.
              </p>
              
              <button
                onClick={requestExport}
                disabled={submitting || dashboard.export_requests.some(r => 
                  r.status === 'pending' || r.status === 'processing'
                )}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Request Data Export
              </button>
            </div>

            {/* Export History */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold mb-4">Export History</h3>
              {dashboard.export_requests.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.export_requests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium capitalize">{request.status}</p>
                          <p className="text-sm text-gray-600">
                            Requested: {formatDate(request.requested_at)}
                          </p>
                        </div>
                      </div>
                      {request.status === 'completed' && (
                        <a
                          href={`/api/gdpr/export/download/${request.id}`}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No export requests yet</p>
              )}
            </div>

            {/* Retention Policies */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold mb-4">Data Retention Policies</h3>
              <p className="text-sm text-gray-600 mb-4">
                Here's how long we retain different types of your data:
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Category</th>
                      <th className="text-left py-2 px-4">Retention Period</th>
                      <th className="text-left py-2 px-4">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.retention_policies.map(policy => (
                      <tr key={policy.data_category} className="border-b">
                        <td className="py-2 px-4 capitalize">
                          {policy.data_category.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 px-4">
                          {Math.round(policy.retention_period_days / 365)} years
                        </td>
                        <td className="py-2 px-4 text-gray-600">
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-red-600 mb-2">
                    Request Account Deletion
                  </h2>
                  <p className="text-gray-600 mb-4">
                    This will permanently delete your account and most of your personal data. 
                    Some data may be retained for legal or regulatory requirements.
                  </p>
                  
                  {!showDeletionConfirm ? (
                    <button
                      onClick={() => setShowDeletionConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Request Account Deletion
                    </button>
                  ) : (
                    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <h3 className="font-medium text-red-800 mb-2">
                        Confirm Deletion Request
                      </h3>
                      <p className="text-sm text-red-700 mb-4">
                        Please provide a reason for your deletion request:
                      </p>
                      <textarea
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Why are you requesting account deletion?"
                        className="w-full p-3 border rounded-lg mb-4"
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={requestDeletion}
                          disabled={submitting || !deletionReason.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Confirm Deletion
                        </button>
                        <button
                          onClick={() => {
                            setShowDeletionConfirm(false);
                            setDeletionReason('');
                          }}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
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
            {dashboard.deletion_requests.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold mb-4">Deletion Requests</h3>
                <div className="space-y-3">
                  {dashboard.deletion_requests.map(request => (
                    <div key={request.id} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(request.status)}
                        <span className="font-medium capitalize">{request.status}</span>
                        <span className="text-sm text-gray-500 ml-auto">
                          {formatDate(request.requested_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Reason: {request.reason}</p>
                      {request.rejection_reason && (
                        <p className="text-sm text-red-600 mt-2">
                          Rejected: {request.rejection_reason}
                        </p>
                      )}
                      {request.retention_exceptions && request.retention_exceptions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">Data that must be retained:</p>
                          <ul className="text-xs text-gray-600 list-disc list-inside">
                            {request.retention_exceptions.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sharing Tab */}
        {activeTab === 'sharing' && dashboard && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Data Sharing Log</h2>
              <p className="text-gray-600 mb-4">
                A record of when your data has been shared with third parties.
              </p>
              
              {dashboard.data_sharing.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.data_sharing.map(entry => (
                    <div key={entry.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{entry.third_party}</span>
                        <span className="text-sm text-gray-500">
                          {formatDate(entry.shared_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Purpose: {entry.purpose}
                      </p>
                      <p className="text-xs text-gray-500">
                        Data shared: {entry.data_shared.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No data has been shared with third parties</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
