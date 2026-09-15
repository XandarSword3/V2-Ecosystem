'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
import PrivacyCenter from '@/components/PrivacyCenter';
import {
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Save,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ProfileHubProps {
  propertySlug?: string;
  className?: string;
}

export function ProfileHub({ propertySlug = '', className = '' }: ProfileHubProps) {
  const tCommon = useTranslations('common');
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    preferredLanguage: user?.preferredLanguage || 'en',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        preferredLanguage: user.preferredLanguage || 'en',
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        fullName: formData.fullName,
        phone: formData.phone,
        preferredLanguage: formData.preferredLanguage,
      });
      toast.success('Profile updated successfully');
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="profile-hub">
      {/* Personal Information */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <User className="w-5 h-5 text-primary-600" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="pl-10 text-xs"
                    data-testid="profile-name-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    disabled
                    value={formData.email}
                    className="pl-10 text-xs bg-slate-50 dark:bg-slate-800"
                    data-testid="profile-email-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10 text-xs"
                    data-testid="profile-phone-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Preferred Language
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={formData.preferredLanguage}
                    onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-foreground focus:ring-2 focus:ring-primary-500"
                    data-testid="profile-lang-select"
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="fr">Français (French)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="text-xs"
                data-testid="profile-save-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication Settings */}
      <TwoFactorSettings />

      {/* Privacy and Data Management */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary-600" />
            Privacy & Data Rights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PrivacyCenter />
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfileHub;
