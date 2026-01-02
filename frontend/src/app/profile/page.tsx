'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Save,
  LogOut,
  Camera,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'en',
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

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/users/profile', {
        full_name: formData.fullName,
        phone: formData.phone,
        preferred_language: formData.preferredLanguage,
      });
      refreshUser();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <CardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Please log in to view your profile</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <motion.div variants={fadeInUp}>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your account settings</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                    {user.fullName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Camera className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      value={formData.email}
                      disabled
                      className="pl-10 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-10"
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Language
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={formData.preferredLanguage}
                      onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="ar">العربية (Arabic)</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Roles Card */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Your Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.roles?.length > 0 ? (
                  user.roles.map((role) => (
                    <span
                      key={role}
                      className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">No roles assigned</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Logout */}
        <motion.div variants={fadeInUp}>
          <Button variant="danger" onClick={handleLogout} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
