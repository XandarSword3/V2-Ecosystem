'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Users,
  AlertTriangle,
  Save,
  RefreshCw,
  Waves,
  Clock,
} from 'lucide-react';

interface PoolSettings {
  max_capacity: number;
  current_occupancy: number;
  opening_time: string;
  closing_time: string;
  maintenance_mode: boolean;
}

export default function AdminPoolCapacityPage() {
  const t = useTranslations('adminPool');
  const tc = useTranslations('adminCommon');
  
  const [settings, setSettings] = useState<PoolSettings>({
    max_capacity: 100,
    current_occupancy: 0,
    opening_time: '09:00',
    closing_time: '18:00',
    maintenance_mode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/pool/staff/capacity');
      if (response.data.data) {
        setSettings(prev => ({
          ...prev,
          current_occupancy: response.data.data.current || 0,
          max_capacity: response.data.data.max || 100,
        }));
      }
    } catch (error) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put('/pool/admin/settings', settings);
      toast.success(t('capacity.settingsSaved'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const resetOccupancy = async () => {
    if (!confirm(tc('confirmAction'))) return;
    
    try {
      await api.post('/pool/admin/reset-occupancy');
      setSettings((prev) => ({ ...prev, current_occupancy: 0 }));
      toast.success(t('capacity.occupancyReset'));
    } catch (error) {
      toast.error(tc('errors.failedToUpdate'));
    }
  };

  const capacityPercentage = (settings.current_occupancy / settings.max_capacity) * 100;
  const isNearCapacity = capacityPercentage > 80;
  const isAtCapacity = capacityPercentage >= 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('capacity.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t('title')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? tc('saving') : tc('saveChanges')}
          </Button>
        </div>
      </div>

      {/* Current Status */}
      <motion.div variants={fadeInUp}>
        <Card className={isAtCapacity ? 'border-red-500' : isNearCapacity ? 'border-yellow-500' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-500" />
              {tc('status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-slate-900 dark:text-white mb-2">
                  {settings.current_occupancy}
                  <span className="text-2xl text-slate-400">/{settings.max_capacity}</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">{t('capacity.currentOccupancy')}</p>
              </div>

              <div className="flex flex-col justify-center">
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-2">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      isAtCapacity ? 'bg-red-500' : isNearCapacity ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, capacityPercentage)}%` }}
                  />
                </div>
                <p className="text-center text-sm text-slate-500">
                  {Math.round(capacityPercentage)}% capacity
                </p>
              </div>

              <div className="flex flex-col items-center justify-center">
                {isAtCapacity ? (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-6 h-6" />
                    <span className="font-semibold">{t('capacity.title')}!</span>
                  </div>
                ) : isNearCapacity ? (
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="w-6 h-6" />
                    <span className="font-semibold">{t('capacity.nearCapacity')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Users className="w-6 h-6" />
                    <span className="font-semibold">{tc('active')}</span>
                  </div>
                )}
                <Button variant="outline" className="mt-3" onClick={resetOccupancy}>
                  {t('capacity.occupancyReset')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                {t('capacity.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('sessions.maxCapacity')}
                </label>
                <input
                  type="number"
                  value={settings.max_capacity}
                  onChange={(e) => setSettings({ ...settings, max_capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-400 mt-1">Maximum number of guests allowed in the pool</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{t('capacity.maintenanceMode')}</p>
                  <p className="text-sm text-slate-500">{t('title')}</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.maintenance_mode ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                {tc('time')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {tc('time')}
                </label>
                <input
                  type="time"
                  value={settings.opening_time}
                  onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={settings.closing_time}
                  onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
