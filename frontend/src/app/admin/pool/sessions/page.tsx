'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Waves,
  Search,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Users,
  DollarSign,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Ticket,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

interface PoolSession {
  id: string;
  name: string;
  name_ar?: string;
  start_time: string;
  end_time: string;
  adult_price: number;
  child_price: number;
  max_capacity: number;
  current_capacity?: number;
  is_active: boolean;
  day_of_week?: number[];
}

const daysOfWeek = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

const getSessionIcon = (startTime: string) => {
  const hour = parseInt(startTime.split(':')[0]);
  if (hour < 12) return Sun;
  if (hour < 17) return Sunset;
  return Moon;
};

export default function PoolSessionsManagementPage() {
  const t = useTranslations('admin');
  const [sessions, setSessions] = useState<PoolSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<PoolSession | null>(null);
  const [formData, setFormData] = useState<Partial<PoolSession>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pool/sessions');
      setSessions(response.data.sessions || []);
    } catch (error: any) {
      toast.error('Failed to fetch pool sessions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSession(null);
    setFormData({
      name: '',
      name_ar: '',
      start_time: '09:00',
      end_time: '12:00',
      adult_price: 15,
      child_price: 10,
      max_capacity: 50,
      is_active: true,
      day_of_week: [0, 1, 2, 3, 4, 5, 6],
    });
    setShowModal(true);
  };

  const openEditModal = (session: PoolSession) => {
    setEditingSession(session);
    setFormData({ ...session });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.start_time || !formData.end_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      if (editingSession) {
        await api.put(`/pool/admin/sessions/${editingSession.id}`, formData);
        toast.success('Session updated successfully');
      } else {
        await api.post('/pool/admin/sessions', formData);
        toast.success('Session created successfully');
      }
      fetchSessions();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await api.delete(`/pool/admin/sessions/${id}`);
      toast.success('Session deleted');
      fetchSessions();
    } catch (error: any) {
      toast.error('Failed to delete session');
    }
  };

  const toggleActive = async (session: PoolSession) => {
    try {
      await api.put(`/pool/admin/sessions/${session.id}`, {
        is_active: !session.is_active,
      });
      fetchSessions();
      toast.success(`Session ${session.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update session');
    }
  };

  const toggleDayOfWeek = (dayId: number) => {
    const current = formData.day_of_week || [];
    if (current.includes(dayId)) {
      setFormData({ ...formData, day_of_week: current.filter(d => d !== dayId) });
    } else {
      setFormData({ ...formData, day_of_week: [...current, dayId].sort() });
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.div variants={fadeInUp}>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Waves className="w-6 h-6 text-white" />
            </div>
            Pool Sessions
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage swimming pool sessions and capacity
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex gap-2">
          <Button variant="outline" onClick={fetchSessions} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Session
          </Button>
        </motion.div>
      </div>

      {/* Search */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Sessions</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{sessions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-emerald-600">
            {sessions.filter(s => s.is_active).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Capacity</p>
          <p className="text-2xl font-bold text-cyan-600">
            {sessions.reduce((acc, s) => acc + (s.max_capacity || 0), 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Avg Price</p>
          <p className="text-2xl font-bold text-blue-600">
            {sessions.length > 0
              ? formatCurrency(sessions.reduce((acc, s) => acc + s.adult_price, 0) / sessions.length)
              : '$0'}
          </p>
        </div>
      </motion.div>

      {/* Sessions Grid */}
      <motion.div variants={fadeInUp}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Waves className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">No pool sessions found</p>
              <Button onClick={openCreateModal} className="mt-4">
                Add your first session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredSessions.map((session, index) => {
                const TimeIcon = getSessionIcon(session.start_time);
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`overflow-hidden ${!session.is_active ? 'opacity-60' : ''}`}>
                      <div className="h-3 bg-gradient-to-r from-cyan-500 to-blue-600" />
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                              <TimeIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {session.name}
                              </h3>
                              <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                                <Clock className="w-3 h-3" />
                                {formatTime(session.start_time)} - {formatTime(session.end_time)}
                              </div>
                            </div>
                          </div>
                          {!session.is_active && (
                            <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full dark:bg-red-900/30">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Pricing */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Adult</p>
                            <p className="text-lg font-bold text-cyan-600">
                              {formatCurrency(session.adult_price)}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Child</p>
                            <p className="text-lg font-bold text-blue-600">
                              {formatCurrency(session.child_price)}
                            </p>
                          </div>
                        </div>

                        {/* Capacity */}
                        <div className="flex items-center justify-between mb-4 text-sm">
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Users className="w-4 h-4" />
                            Capacity
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {session.current_capacity || 0}/{session.max_capacity}
                          </span>
                        </div>

                        {/* Capacity bar */}
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all"
                            style={{
                              width: `${((session.current_capacity || 0) / session.max_capacity) * 100}%`,
                            }}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleActive(session)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors ${
                              session.is_active
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                                : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30'
                            }`}
                          >
                            {session.is_active ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                Activate
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(session)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm bg-cyan-100 text-cyan-600 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingSession ? 'Edit Session' : 'Add New Session'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name (English) *
                    </label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Morning Session"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name (Arabic)
                    </label>
                    <Input
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="الاسم بالعربية"
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Start Time *
                    </label>
                    <Input
                      type="time"
                      value={formData.start_time || ''}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      End Time *
                    </label>
                    <Input
                      type="time"
                      value={formData.end_time || ''}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Adult Price *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.adult_price || ''}
                        onChange={(e) => setFormData({ ...formData, adult_price: parseFloat(e.target.value) })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Child Price *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.child_price || ''}
                        onChange={(e) => setFormData({ ...formData, child_price: parseFloat(e.target.value) })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Max Capacity
                    </label>
                    <Input
                      type="number"
                      value={formData.max_capacity || ''}
                      onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Available Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => {
                      const isSelected = formData.day_of_week?.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDayOfWeek(day.id)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {day.label.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Session is active</span>
                </label>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingSession ? 'Update Session' : 'Create Session'}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
