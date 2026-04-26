'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Send,
  Mail,
  CalendarClock,
  FileText,
  CheckCircle,
  XCircle,
  X,
  Save,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  template_id: string;
  template?: { name?: string; category?: string };
  recipients: Array<{ type: string; address?: string }>;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status?: string | null;
  export_format?: string;
  created_at: string;
}

type ScheduleType = 'daily' | 'weekly' | 'monthly';

const SCHEDULE_TYPES: { value: ScheduleType; label: string; icon: string }[] = [
  { value: 'daily', label: 'Daily', icon: '📅' },
  { value: 'weekly', label: 'Weekly', icon: '📆' },
  { value: 'monthly', label: 'Monthly', icon: '🗓️' },
];

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    frequency: 'daily' as ScheduleType,
    templateId: '',
    exportFormat: 'pdf',
    hour: 8,
    minute: 0,
    recipients: '',
    enabled: true,
  });

  const fetchReports = useCallback(async () => {
    try {
      const [reportsRes, templatesRes] = await Promise.all([
        api.get('/reporting/scheduled'),
        api.get('/reporting/templates'),
      ]);
      setReports((reportsRes.data?.reports || []) as ScheduledReport[]);
      setTemplates((templatesRes.data?.templates || []) as Array<{ id: string; name: string; category?: string }>);
    } catch (error) {
      toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openCreateModal = () => {
    setEditingReport(null);
    setFormData({
      name: '',
      frequency: 'daily',
      templateId: templates[0]?.id || '',
      exportFormat: 'pdf',
      hour: 8,
      minute: 0,
      recipients: '',
      enabled: true,
    });
    setShowModal(true);
  };

  const openEditModal = (report: ScheduledReport) => {
    setEditingReport(report);
    setFormData({
      name: report.name,
      frequency: report.frequency,
      templateId: report.template_id,
      exportFormat: report.export_format || 'pdf',
      hour: 8,
      minute: 0,
      recipients: report.recipients.map((r) => r.address).filter(Boolean).join(', '),
      enabled: report.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    
    const recipientsList = formData.recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email.includes('@'));
    
    if (recipientsList.length === 0) {
      toast.error('Please enter at least one valid email recipient');
      return;
    }
    
    setSaving(true);
    try {
      if (editingReport) {
        await api.put(`/reporting/scheduled/${editingReport.id}`, {
          name: formData.name,
          frequency: formData.frequency,
          templateId: formData.templateId,
          exportFormat: formData.exportFormat,
          hour: formData.hour,
          minute: formData.minute,
          recipients: recipientsList.map((address) => ({ type: 'email', address })),
          isActive: formData.enabled,
        });
        toast.success('Report updated successfully');
      } else {
        await api.post('/reporting/scheduled', {
          name: formData.name,
          frequency: formData.frequency,
          templateId: formData.templateId,
          params: {},
          exportFormat: formData.exportFormat,
          hour: formData.hour,
          minute: formData.minute,
          recipients: recipientsList.map((address) => ({ type: 'email', address })),
        });
        toast.success('Report created successfully');
      }
      setShowModal(false);
      fetchReports();
    } catch (error) {
      toast.error(editingReport ? 'Failed to update report' : 'Failed to create report');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }
    
    try {
      await api.delete(`/reporting/scheduled/${id}`);
      toast.success('Report deleted');
      fetchReports();
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const handleToggleEnabled = async (report: ScheduledReport) => {
    try {
      await api.put(`/reporting/scheduled/${report.id}`, {
        isActive: !report.is_active,
      });
      toast.success(report.is_active ? 'Report disabled' : 'Report enabled');
      fetchReports();
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const handleSendNow = async (id: string) => {
    setSendingId(id);
    try {
      await api.post(`/reporting/scheduled/${id}/run`);
      toast.success('Report sent successfully');
      fetchReports();
    } catch (error) {
      toast.error('Failed to send report');
    } finally {
      setSendingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6 p-6 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-primary" />
              Scheduled Reports
            </h1>
            <p className="text-muted-foreground">
              Configure automated email reports sent on a schedule
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </motion.div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <motion.div variants={fadeInUp}>
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scheduled Reports</h3>
            <p className="text-muted-foreground mb-6">
              Create your first scheduled report to automatically receive business insights via email.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Report
            </Button>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp} className="grid gap-4">
          {reports.map((report) => {
            return (
              <Card key={report.id} className={`transition-opacity ${!report.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{report.name}</h3>
                        {report.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {SCHEDULE_TYPES.find(st => st.value === report.frequency)?.icon} {report.frequency}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {report.template?.name || 'Template'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="flex gap-6 text-xs text-muted-foreground">
                        <span>
                          <strong>Last run:</strong> {formatDate(report.last_run_at)}
                        </span>
                        <span>
                          <strong>Next run:</strong> {formatDate(report.next_run_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendNow(report.id)}
                        disabled={sendingId === report.id}
                      >
                        {sendingId === report.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Send Now
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleEnabled(report)}
                      >
                        {report.is_active ? (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(report)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(report.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5" />
                  {editingReport ? 'Edit Report' : 'New Scheduled Report'}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Configure when and what report to send automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Report Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">Report Name</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Weekly Revenue Summary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              {/* Template */}
              <div>
                <label className="text-sm font-medium mb-2 block">Template</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Schedule Type */}
              <div>
                <label className="text-sm font-medium mb-2 block">Schedule</label>
                <div className="grid grid-cols-3 gap-2">
                  {SCHEDULE_TYPES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, frequency: st.value })}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        formData.frequency === st.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-xl mb-1">{st.icon}</div>
                      <div className="text-sm font-medium">{st.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Recipients */}
              <div>
                <label className="text-sm font-medium mb-1 block">Recipients</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="email@example.com, another@example.com"
                  rows={2}
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separate multiple email addresses with commas
                </p>
              </div>
              
              {/* Enabled Toggle */}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm font-medium">Enabled</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    formData.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      formData.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingReport ? 'Save Changes' : 'Create Report'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
