'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  Bell,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  Users,
  MessageSquare,
  AlertCircle,
  Info,
  CheckCheck,
  Megaphone,
  Plus,
  Trash2,
  Filter,
  Calendar,
  Zap,
  FileText,
  Settings,
  ExternalLink,
  Edit,
  Copy,
  X,
} from 'lucide-react';

// Types
interface NotificationAction {
  label: string;
  url: string;
  style?: 'primary' | 'secondary' | 'danger';
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  target_type: 'all' | 'customer' | 'staff' | 'admin';
  target_id?: string;
  is_read: boolean;
  actions?: NotificationAction[];
  scheduled_for?: string;
  sent_at?: string;
  created_at: string;
  read_at?: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  target_type: 'all' | 'customer' | 'staff' | 'admin';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actions?: NotificationAction[];
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type TabType = 'notifications' | 'templates' | 'broadcasts';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  success: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  warning: { icon: AlertCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  error: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-700' },
  normal: { label: 'Normal', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  high: { label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  urgent: { label: 'Urgent', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export default function AdminNotificationsPage() {
  const t = useTranslations('adminSettings');
  const tc = useTranslations('adminCommon');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  
  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [broadcasts, setBroadcasts] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  const { socket } = useSocket();

  // Form states for new notification
  const [newNotification, setNewNotification] = useState<{
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    target_type: 'all' | 'customer' | 'staff' | 'admin';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    scheduled_for: string;
    actions: NotificationAction[];
  }>({
    title: '',
    message: '',
    type: 'info',
    target_type: 'all',
    priority: 'normal',
    scheduled_for: '',
    actions: [],
  });
  
  // Form states for template
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    target_type: 'all' | 'customer' | 'staff' | 'admin';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    variables: string[];
    actions: NotificationAction[];
    is_active: boolean;
  }>({
    name: '',
    title: '',
    message: '',
    type: 'info',
    target_type: 'all',
    priority: 'normal',
    variables: [],
    actions: [],
    is_active: true,
  });
  
  const [sending, setSending] = useState(false);

  // Fetch data
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notifRes, broadcastRes, templateRes] = await Promise.all([
        api.get('/admin/notifications'),
        api.get('/admin/notifications/broadcasts').catch(() => ({ data: { data: [] } })),
        api.get('/admin/notifications/templates').catch(() => ({ data: { data: [] } })),
      ]);
      setNotifications(notifRes.data.data || []);
      setBroadcasts(broadcastRes.data.data || []);
      setTemplates(templateRes.data.data || []);
    } catch {
      setNotifications([]);
      setBroadcasts([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time updates
  useEffect(() => {
    if (socket) {
      socket.on('notification:new', (notification: Notification) => {
        setNotifications((prev) => [notification, ...prev]);
      });
      return () => {
        socket.off('notification:new');
      };
    }
  }, [socket]);

  // Actions
  const sendNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      toast.error(tc('errors.required'));
      return;
    }

    try {
      setSending(true);
      await api.post('/admin/notifications/broadcast', {
        ...newNotification,
        scheduled_for: newNotification.scheduled_for || undefined,
      });
      toast.success(t('notifications.sent'));
      setShowCreateModal(false);
      resetNotificationForm();
      fetchNotifications();
    } catch {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setSending(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/admin/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      toast.success(tc('success.deleted'));
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      await api.post('/admin/notifications/delete-multiple', { ids: selectedIds });
      setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
      setBroadcasts((prev) => prev.filter((b) => !selectedIds.includes(b.id)));
      setSelectedIds([]);
      toast.success(`${selectedIds.length} notifications deleted`);
    } catch {
      toast.error('Failed to delete notifications');
    }
  };

  // Template actions
  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.title || !templateForm.message) {
      toast.error('Name, title and message are required');
      return;
    }

    try {
      setSending(true);
      if (editingTemplate) {
        await api.put(`/admin/notifications/templates/${editingTemplate.id}`, templateForm);
        toast.success('Template updated');
      } else {
        await api.post('/admin/notifications/templates', templateForm);
        toast.success('Template created');
      }
      setShowTemplateModal(false);
      resetTemplateForm();
      fetchNotifications();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSending(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.delete(`/admin/notifications/templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const sendFromTemplate = async (template: NotificationTemplate) => {
    try {
      await api.post(`/admin/notifications/templates/${template.id}/send`, {});
      toast.success('Notification sent from template');
      fetchNotifications();
    } catch {
      toast.error('Failed to send from template');
    }
  };

  const useTemplateForNotification = (template: NotificationTemplate) => {
    setNewNotification({
      title: template.title,
      message: template.message,
      type: template.type as 'info' | 'success' | 'warning' | 'error',
      target_type: template.target_type as 'all' | 'customer' | 'staff' | 'admin',
      priority: template.priority as 'low' | 'normal' | 'high' | 'urgent',
      scheduled_for: '',
      actions: template.actions || [],
    });
    setShowCreateModal(true);
  };

  // Form helpers
  const resetNotificationForm = () => {
    setNewNotification({
      title: '',
      message: '',
      type: 'info',
      target_type: 'all',
      priority: 'normal',
      scheduled_for: '',
      actions: [],
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      title: '',
      message: '',
      type: 'info',
      target_type: 'all',
      priority: 'normal',
      variables: [],
      actions: [],
      is_active: true,
    });
    setEditingTemplate(null);
  };

  const openEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      title: template.title,
      message: template.message,
      type: template.type as 'info' | 'success' | 'warning' | 'error',
      target_type: template.target_type as 'all' | 'customer' | 'staff' | 'admin',
      priority: template.priority as 'low' | 'normal' | 'high' | 'urgent',
      variables: template.variables,
      actions: template.actions || [],
      is_active: template.is_active,
    });
    setShowTemplateModal(true);
  };

  const addAction = (form: 'notification' | 'template') => {
    const newAction: NotificationAction = { label: '', url: '', style: 'primary' };
    if (form === 'notification') {
      setNewNotification((prev) => ({ ...prev, actions: [...prev.actions, newAction] }));
    } else {
      setTemplateForm((prev) => ({ ...prev, actions: [...prev.actions, newAction] }));
    }
  };

  const updateAction = (form: 'notification' | 'template', index: number, field: keyof NotificationAction, value: string) => {
    if (form === 'notification') {
      setNewNotification((prev) => ({
        ...prev,
        actions: prev.actions.map((a, i) => i === index ? { ...a, [field]: value } : a),
      }));
    } else {
      setTemplateForm((prev) => ({
        ...prev,
        actions: prev.actions.map((a, i) => i === index ? { ...a, [field]: value } : a),
      }));
    }
  };

  const removeAction = (form: 'notification' | 'template', index: number) => {
    if (form === 'notification') {
      setNewNotification((prev) => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
    } else {
      setTemplateForm((prev) => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }));
    }
  };

  // Filtering
  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
    return true;
  });

  const filteredBroadcasts = broadcasts.filter((b) => {
    if (typeFilter !== 'all' && b.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && b.priority !== priorityFilter) return false;
    return true;
  });

  // Stats
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const todayCount = notifications.filter(
    (n) => n.created_at?.startsWith(new Date().toISOString().split('T')[0])
  ).length;
  const scheduledCount = broadcasts.filter((b) => b.scheduled_for && !b.sent_at).length;

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentList = activeTab === 'broadcasts' ? filteredBroadcasts : filteredNotifications;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map((n) => n.id));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('notifications.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage notifications, templates, and broadcasts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchNotifications}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button variant="outline" onClick={() => { resetTemplateForm(); setShowTemplateModal(true); }}>
            <FileText className="w-4 h-4 mr-2" />
            New Template
          </Button>
          <Button onClick={() => { resetNotificationForm(); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('notifications.sendNotification')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{t('notifications.totalSent')}</p>
                  <p className="text-3xl font-bold mt-1">{notifications.length}</p>
                </div>
                <Bell className="w-10 h-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">{t('notifications.sentToday')}</p>
                  <p className="text-3xl font-bold mt-1">{todayCount}</p>
                </div>
                <Megaphone className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Unread</p>
                  <p className="text-3xl font-bold mt-1">{unreadCount}</p>
                </div>
                <MessageSquare className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Scheduled</p>
                  <p className="text-3xl font-bold mt-1">{scheduledCount}</p>
                </div>
                <Calendar className="w-10 h-10 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(['notifications', 'broadcasts', 'templates'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedIds([]); }}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            {tab === 'notifications' && <Bell className="w-4 h-4 inline mr-2" />}
            {tab === 'broadcasts' && <Megaphone className="w-4 h-4 inline mr-2" />}
            {tab === 'templates' && <FileText className="w-4 h-4 inline mr-2" />}
            {tab}
            {tab === 'templates' && ` (${templates.length})`}
            {tab === 'broadcasts' && ` (${broadcasts.length})`}
          </button>
        ))}
      </div>

      {/* Filters & Bulk Actions */}
      {activeTab !== 'templates' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              
              {selectedIds.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-slate-500">{selectedIds.length} selected</span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                  <Button variant="danger" size="sm" onClick={deleteSelected}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {templates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-12"
              >
                <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No templates yet</p>
                <Button className="mt-4" onClick={() => { resetTemplateForm(); setShowTemplateModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </motion.div>
            ) : (
              templates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card className={`h-full ${!template.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${typeConfig[template.type]?.bgColor || 'bg-blue-100'}`}>
                            {(() => {
                              const TypeIcon = typeConfig[template.type]?.icon || Info;
                              return <TypeIcon className={`w-4 h-4 ${typeConfig[template.type]?.color || 'text-blue-500'}`} />;
                            })()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded ${priorityConfig[template.priority]?.bgColor} ${priorityConfig[template.priority]?.color}`}>
                              {priorityConfig[template.priority]?.label}
                            </span>
                          </div>
                        </div>
                        {!template.is_active && (
                          <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{template.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{template.message}</p>
                      
                      {template.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.variables.map((v) => (
                            <span key={v} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <Button size="sm" onClick={() => sendFromTemplate(template)}>
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => useTemplateForNotification(template)}>
                          <Copy className="w-3 h-3 mr-1" />
                          Use
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditTemplate(template)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplate(template.id)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Notifications/Broadcasts List */}
      {activeTab !== 'templates' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={selectedIds.length === (activeTab === 'broadcasts' ? filteredBroadcasts : filteredNotifications).length && selectedIds.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-500">Select all</span>
          </div>
          
          <AnimatePresence mode="popLayout">
            {(activeTab === 'broadcasts' ? filteredBroadcasts : filteredNotifications).length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No {activeTab} yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Click "Send Notification" to broadcast a message
                </p>
              </motion.div>
            ) : (
              (activeTab === 'broadcasts' ? filteredBroadcasts : filteredNotifications).map((notification, index) => {
                const TypeIcon = typeConfig[notification.type]?.icon || Info;
                const typeColor = typeConfig[notification.type]?.color || 'text-blue-500';
                const typeBg = typeConfig[notification.type]?.bgColor || 'bg-blue-100';

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.03 }}
                    layout
                  >
                    <Card className={selectedIds.includes(notification.id) ? 'ring-2 ring-blue-500' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(notification.id)}
                            onChange={() => toggleSelect(notification.id)}
                            className="mt-2 w-4 h-4 rounded border-slate-300"
                          />
                          <div className={`p-2 rounded-lg ${typeBg}`}>
                            <TypeIcon className={`w-5 h-5 ${typeColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {notification.title}
                              </h3>
                              <span className={`px-2 py-0.5 rounded text-xs ${typeBg} ${typeColor}`}>
                                {notification.type}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${priorityConfig[notification.priority || 'normal']?.bgColor} ${priorityConfig[notification.priority || 'normal']?.color}`}>
                                {priorityConfig[notification.priority || 'normal']?.label}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <Users className="w-3 h-3 inline mr-1" />
                                {notification.target_type === 'all' ? 'All Users' : notification.target_type}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                              {notification.message}
                            </p>
                            
                            {/* Action buttons */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {notification.actions.map((action, i) => (
                                  <a
                                    key={i}
                                    href={action.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 px-3 py-1 text-xs rounded ${
                                      action.style === 'danger' 
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : action.style === 'secondary'
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}
                                  >
                                    {action.label}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {notification.created_at ? formatDate(notification.created_at) : 'Just now'}
                              </span>
                              {notification.scheduled_for && !notification.sent_at && (
                                <span className="flex items-center gap-1 text-purple-500">
                                  <Calendar className="w-3 h-3" />
                                  Scheduled: {formatDate(notification.scheduled_for)}
                                </span>
                              )}
                              {notification.is_read && (
                                <span className="flex items-center gap-1 text-green-500">
                                  <CheckCheck className="w-3 h-3" />
                                  Read
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Notification Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4 overflow-y-auto"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('notifications.sendNotification')}
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newNotification.title}
                    onChange={(e) => setNewNotification((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Notification title..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    value={newNotification.message}
                    onChange={(e) => setNewNotification((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Enter your message..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select
                      value={newNotification.type}
                      onChange={(e) => setNewNotification((prev) => ({ ...prev, type: e.target.value as typeof newNotification.type }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      value={newNotification.priority}
                      onChange={(e) => setNewNotification((prev) => ({ ...prev, priority: e.target.value as typeof newNotification.priority }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target</label>
                    <select
                      value={newNotification.target_type}
                      onChange={(e) => setNewNotification((prev) => ({ ...prev, target_type: e.target.value as typeof newNotification.target_type }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="all">All Users</option>
                      <option value="customer">Customers</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admins</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Schedule</label>
                    <input
                      type="datetime-local"
                      value={newNotification.scheduled_for}
                      onChange={(e) => setNewNotification((prev) => ({ ...prev, scheduled_for: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Action Buttons Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Action Buttons
                    </label>
                    <Button size="sm" variant="outline" onClick={() => addAction('notification')}>
                      <Plus className="w-3 h-3 mr-1" /> Add Action
                    </Button>
                  </div>
                  {newNotification.actions.map((action, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Label"
                        value={action.label}
                        onChange={(e) => updateAction('notification', index, 'label', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="URL"
                        value={action.url}
                        onChange={(e) => updateAction('notification', index, 'url', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      />
                      <select
                        value={action.style || 'primary'}
                        onChange={(e) => updateAction('notification', index, 'style', e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="danger">Danger</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => removeAction('notification', index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                    {tc('cancel')}
                  </Button>
                  <Button onClick={sendNotification} disabled={sending}>
                    {sending ? 'Sending...' : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {newNotification.scheduled_for ? 'Schedule' : 'Send Now'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4 overflow-y-auto"
            onClick={() => { setShowTemplateModal(false); resetTemplateForm(); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h2>
                <button onClick={() => { setShowTemplateModal(false); resetTemplateForm(); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Welcome Message, Payment Reminder..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Title * <span className="text-slate-400 text-xs">(use {`{{variable}}`} for placeholders)</span>
                  </label>
                  <input
                    type="text"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Welcome {{name}}!"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    value={templateForm.message}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Hello {{name}}, your booking #{{bookingId}} has been confirmed..."
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Variables <span className="text-slate-400 text-xs">(comma separated)</span>
                  </label>
                  <input
                    type="text"
                    value={templateForm.variables.join(', ')}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))}
                    placeholder="name, bookingId, amount"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select
                      value={templateForm.type}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, type: e.target.value as typeof templateForm.type }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      value={templateForm.priority}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, priority: e.target.value as typeof templateForm.priority }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target</label>
                    <select
                      value={templateForm.target_type}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, target_type: e.target.value as typeof templateForm.target_type }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="all">All Users</option>
                      <option value="customer">Customers</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admins</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateForm.is_active}
                        onChange={(e) => setTemplateForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</span>
                    </label>
                  </div>
                </div>

                {/* Template Actions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Action Buttons
                    </label>
                    <Button size="sm" variant="outline" onClick={() => addAction('template')}>
                      <Plus className="w-3 h-3 mr-1" /> Add Action
                    </Button>
                  </div>
                  {templateForm.actions.map((action, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Label"
                        value={action.label}
                        onChange={(e) => updateAction('template', index, 'label', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      />
                      <input
                        type="text"
                        placeholder="URL"
                        value={action.url}
                        onChange={(e) => updateAction('template', index, 'url', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      />
                      <select
                        value={action.style || 'primary'}
                        onChange={(e) => updateAction('template', index, 'style', e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="danger">Danger</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => removeAction('template', index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="outline" onClick={() => { setShowTemplateModal(false); resetTemplateForm(); }}>
                    {tc('cancel')}
                  </Button>
                  <Button onClick={saveTemplate} disabled={sending}>
                    {sending ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
