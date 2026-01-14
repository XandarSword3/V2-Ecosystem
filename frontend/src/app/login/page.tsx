'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Mail, Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSiteSettings } from '@/lib/settings-context';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user, isAuthenticated, login } = useAuth();
  const { settings } = useSiteSettings();
  
  // Dynamic branding
  const resortName = settings.resortName || 'V2 Resort';
  const logoText = resortName.substring(0, 2).toUpperCase();
  const displayName = resortName.length > 2 ? resortName.substring(2).trim() : 'Resort';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const roles = user.roles || [];
      if (roles.includes('super_admin') || roles.includes('admin')) {
        router.replace('/admin');
      } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
        router.replace('/staff');
      } else {
        router.replace('/');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Use auth context login which updates state immediately
      const userData = await login(email, password);

      // Determine redirect based on roles
      const roles = userData.roles || [];

      // Use replace instead of push for cleaner navigation
      if (roles.includes('super_admin') || roles.includes('admin')) {
        window.location.href = '/admin'; // Force full page navigation
      } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
        window.location.href = '/staff';
      } else {
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || t('loginFailed'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-primary-600 font-bold text-xl">{logoText}</span>
            </div>
            <span className="text-2xl font-bold text-white">{displayName || 'Resort'}</span>
          </Link>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {tAuth('welcomeBack')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {tAuth('signInToAccount')}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="admin@v2resort.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('password')}
                </label>
                <Link href="#" className="text-xs text-primary-600 hover:text-primary-700">
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg shadow-primary-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('signingIn')}
                </>
              ) : (
                t('title')
              )}
            </button>
          </form>

          {/* Quick Login Hints */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-semibold uppercase tracking-wider">{t('demoCredentials')}</p>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="flex justify-between items-center group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 p-1 rounded" onClick={() => { setEmail('admin@v2resort.com'); setPassword('admin123'); }}>
                <span className="font-medium text-primary-600">{t('superAdmin')}:</span>
                <span className="font-mono">admin@v2resort.com / admin123</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 text-center">
            <span className="text-slate-600 dark:text-slate-400 text-sm">
              {t('noAccount')}{' '}
            </span>
            <Link
              href="/register"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {t('signUp')}
            </Link>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-white/80 hover:text-white text-sm">
            ← {tCommon('backToHome')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
