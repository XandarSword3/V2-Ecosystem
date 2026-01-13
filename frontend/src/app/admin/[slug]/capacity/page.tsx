'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Users,
  RefreshCw,
  Save,
  TrendingUp,
} from 'lucide-react';

interface CapacitySetting {
  id?: string;
  max_capacity: number;
  current_capacity: number;
  warning_threshold: number;
  module_id?: string;
}

export default function DynamicCapacityPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [capacity, setCapacity] = useState<CapacitySetting>({
    max_capacity: 100,
    current_capacity: 0,
    warning_threshold: 80,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCapacity = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get('/pool/capacity', { params: { moduleId: currentModule.id } });
      if (response.data.data) {
        setCapacity(response.data.data);
      }
    } catch (error) {
      // Capacity settings may not exist yet
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchCapacity();
    }
  }, [currentModule, fetchCapacity]);

  const handleSave = async () => {
    if (!currentModule) return;
    try {
      setSaving(true);
      await api.post('/pool/admin/capacity', { ...capacity, module_id: currentModule.id });
      toast.success(tc('success.saved'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const resetCurrent = async () => {
    if (!currentModule) return;
    try {
      await api.post('/pool/admin/capacity/reset', { module_id: currentModule.id });
      setCapacity({ ...capacity, current_capacity: 0 });
      toast.success(tc('capacity.resetSuccess'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const usagePercentage = capacity.max_capacity > 0 
    ? (capacity.current_capacity / capacity.max_capacity) * 100 
    : 0;

  const isWarning = usagePercentage >= capacity.warning_threshold;
  const isFull = usagePercentage >= 100;

  if (!currentModule) return null;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('capacity.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{tc('capacity.manageSettings')}</p>
        </div>
        <Button variant="outline" onClick={fetchCapacity}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tc('refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
        </div>
      ) : (
        <>
          {/* Current Status */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tc('capacity.currentStatus')}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isFull 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : isWarning 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {isFull ? tc('capacity.full') : isWarning ? tc('capacity.nearCapacity') : tc('capacity.available')}
                  </span>
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{tc('capacity.currentOccupancy')}</span>
                      <span className="text-sm font-medium">{Math.round(usagePercentage)}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull 
                            ? 'bg-red-500'
                            : isWarning 
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{capacity.current_capacity}</p>
                    <p className="text-sm text-slate-500">/ {capacity.max_capacity}</p>
                  </div>
                </div>

                <Button variant="outline" onClick={resetCurrent} className="w-full">
                  {tc('capacity.resetCurrentCount')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Settings */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">{tc('capacity.capacitySettings')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {tc('capacity.maximumCapacity')}
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        value={capacity.max_capacity}
                        onChange={(e) => setCapacity({ ...capacity, max_capacity: parseInt(e.target.value) || 0 })}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{tc('capacity.totalAllowedGuests')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {tc('capacity.currentCapacity')}
                    </label>
                    <div className="relative">
                      <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        value={capacity.current_capacity}
                        onChange={(e) => setCapacity({ ...capacity, current_capacity: parseInt(e.target.value) || 0 })}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{tc('capacity.currentNumberOfGuests')}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {tc('capacity.warningThreshold')}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={capacity.warning_threshold}
                      onChange={(e) => setCapacity({ ...capacity, warning_threshold: parseInt(e.target.value) || 80 })}
                    />
                    <p className="text-xs text-slate-500 mt-1">{tc('capacity.showWarningAt')}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-primary-500 to-secondary-600 text-white">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {tc('saveSettings')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
