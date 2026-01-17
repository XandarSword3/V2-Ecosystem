'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Save, Clock, CreditCard } from 'lucide-react';

interface ChaletSettings {
  deposit_percentage: number;
  check_in_time: string;
  check_out_time: string;
  [key: string]: string | number | boolean;
}

export default function ChaletSettingsPage() {
  const t = useTranslations('adminChalets');
  const tc = useTranslations('adminCommon');
  const [settings, setSettings] = useState<ChaletSettings>({
    deposit_percentage: 30,
    check_in_time: '14:00',
    check_out_time: '11:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/chalets/admin/settings');
      if (response.data.data) {
        setSettings(prev => ({
          ...prev,
          ...response.data.data,
          deposit_percentage: Number(response.data.data.deposit_percentage) || 30,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error(tc('errors.failedToLoad'));
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
      await api.put('/chalets/admin/settings', settings);
      toast.success(t('settings.saved'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.configuration')}</h1>
        <p className="text-muted-foreground">
          {t('settings.title')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <CardTitle>Payment Settings</CardTitle>
          </div>
          <CardDescription>Configure payment rules and deposits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="deposit" className="text-sm font-medium">Deposit Percentage (%)</label>
            <div className="relative">
              <Input
                id="deposit"
                type="number"
                min="0"
                max="100"
                value={settings.deposit_percentage}
                onChange={(e) => handleChange('deposit_percentage', parseFloat(e.target.value))}
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Percentage of total booking amount required as upfront deposit.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle>Schedule Settings</CardTitle>
          </div>
          <CardDescription>Default check-in and check-out times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="checkIn" className="text-sm font-medium">Check-in Time</label>
              <Input
                id="checkIn"
                type="time"
                value={settings.check_in_time}
                onChange={(e) => handleChange('check_in_time', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="checkOut" className="text-sm font-medium">Check-out Time</label>
              <Input
                id="checkOut"
                type="time"
                value={settings.check_out_time}
                onChange={(e) => handleChange('check_out_time', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saving ? tc('saving') : tc('saveChanges')}
        </Button>
      </div>
    </div>
  );
}
