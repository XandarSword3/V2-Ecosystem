'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Mail, Lock, Loader2, Eye, EyeOff, AlertCircle, Shield, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user, isAuthenticated, login, verify2FA } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

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
      const result = await login(email, password);

      // Check if 2FA is required
      if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        setPending2FAUserId(result.userId);
        setShow2FA(true);
        setIsLoading(false);
        return;
      }

      // Normal login success - result is a User at this point
      const userData = result as { id: string; email: string; fullName: string; roles: string[] };

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
      setError(error.message || 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FAUserId) return;
    
    setError('');
    setIsLoading(true);

    try {
      const userData = await verify2FA(pending2FAUserId, twoFactorCode);

      // Determine redirect based on roles
      const roles = userData.roles || [];

      if (roles.includes('super_admin') || roles.includes('admin')) {
        window.location.href = '/admin';
      } else if (roles.some((r: string) => r.includes('staff') || r.includes('manager'))) {
        window.location.href = '/staff';
      } else {
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || '2FA verification failed. Please try again.');
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
              <span className="text-primary-600 font-bold text-xl">V2</span>
            </div>
            <span className="text-2xl font-bold text-white">Resort</span>
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

          {show2FA ? (
            /* 2FA Verification Form */
            <form onSubmit={handle2FASubmit} className="space-y-5">
              <div className="text-center mb-4">
                {useBackupCode ? (
                  <KeyRound className="w-12 h-12 text-primary-600 mx-auto mb-2" />
                ) : (
                  <Shield className="w-12 h-12 text-primary-600 mx-auto mb-2" />
                )}
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Two-Factor Authentication
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {useBackupCode 
                    ? 'Enter one of your backup codes (format: XXXX-XXXX)'
                    : 'Enter the 6-digit code from your authenticator app'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {useBackupCode ? 'Backup Code' : 'Verification Code'}
                </label>
                {useBackupCode ? (
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => {
                      // Format as XXXX-XXXX (alphanumeric)
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                      if (val.length <= 9) {
                        // Auto-insert hyphen after 4 chars
                        if (val.length === 4 && !val.includes('-')) {
                          setTwoFactorCode(val + '-');
                        } else {
                          setTwoFactorCode(val);
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-xl tracking-widest font-mono"
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    required
                    autoFocus
                  />
                ) : (
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoFocus
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || (useBackupCode ? twoFactorCode.length !== 9 : twoFactorCode.length !== 6)}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg shadow-primary-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setUseBackupCode(!useBackupCode); setTwoFactorCode(''); setError(''); }}
                className="w-full py-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                {useBackupCode ? '← Use authenticator code instead' : 'Use backup code instead →'}
              </button>

              <button
                type="button"
                onClick={() => { setShow2FA(false); setPending2FAUserId(null); setTwoFactorCode(''); setError(''); setUseBackupCode(false); }}
                className="w-full py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm"
              >
                ← Back to login
              </button>
            </form>
          ) : (
            /* Normal Login Form */
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

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="space-y-3">
                <a
                  href={`${API_URL}/api/auth/google`}
                  className="w-full py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">Continue with Google</span>
                </a>
                
                {/* Facebook - placeholder for now */}
                <button
                  type="button"
                  disabled
                  className="w-full py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700/50 opacity-50 cursor-not-allowed transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Facebook (Coming Soon)</span>
                </button>
              </div>
            </form>
          )}

          {/* Quick Login Hints */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-semibold uppercase tracking-wider">Demo Credentials</p>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="flex justify-between items-center group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 p-1 rounded" onClick={() => { setEmail('admin@v2resort.com'); setPassword('admin123'); }}>
                <span className="font-medium text-primary-600">Super Admin:</span>
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
