'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, User, Mail, Lock, Building2,
  Eye, EyeOff, Loader2, CheckCircle2, AlertCircle,
  ShieldCheck, Cpu,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api/v1';
const BASE = API.replace('/api/v1', '');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/csrf-token`, { credentials: 'include' });
  const data = await res.json();
  return data.csrfToken ?? '';
}

async function checkStatus(): Promise<{ initialized: boolean; reason: string }> {
  const res = await fetch(`${BASE}/api/install/status`, { credentials: 'include' });
  const data = await res.json();
  return data.data ?? { initialized: false, reason: 'first_boot' };
}

// ---------------------------------------------------------------------------
// Password strength indicator
// ---------------------------------------------------------------------------

function strengthScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[a-z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  return score; // 0-5
}

const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InstallPage() {
  const router = useRouter();
  const t = useTranslations('install');

  const strengthLabel = (score: number): string => {
    const keys = ['', 'strengthVeryWeak', 'strengthWeak', 'strengthFair', 'strengthStrong', 'strengthVeryStrong'] as const;
    return score > 0 ? t(keys[score]) : '';
  };

  const [checking, setChecking]   = useState(true);
  const [reason, setReason]       = useState<string>('first_boot');
  const [step, setStep]           = useState<'form' | 'installing' | 'done'>('form');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');

  const [form, setForm] = useState({
    businessName:  '',
    adminFullName: '',
    adminEmail:    '',
    adminPassword: '',
    confirmPw:     '',
  });

  // On mount: verify this page should be shown.
  // Kill switch: NEXT_PUBLIC_INSTALL_ENABLED defaults to disabled. If it's
  // not explicitly 'true', bounce to /login immediately without even asking
  // the backend — this deployment provisions tenants via platform-admin,
  // not this first-boot wizard.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_INSTALL_ENABLED !== 'true') {
      router.replace('/login');
      return;
    }

    checkStatus().then((status) => {
      if (status.initialized) {
        // Already installed — bounce to login
        router.replace('/login');
      } else {
        setReason(status.reason);
        setChecking(false);
      }
    }).catch(() => {
      // Can't reach backend — bounce to login rather than silently showing
      // the form. The wizard should only ever be reachable when explicitly
      // enabled AND the backend confirms it's not yet initialized.
      router.replace('/login');
    });
  }, [router]);

  const pwScore = strengthScore(form.adminPassword);

  const handleChange = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError('');

    // Client-side guard
    if (form.adminPassword !== form.confirmPw) {
      setError(t('passwordMismatch'));
      return;
    }
    if (pwScore < 3) {
      setError(t('weakPassword'));
      return;
    }

    setStep('installing');

    try {
      const csrf = await getCsrfToken();

      const res = await fetch(`${BASE}/api/install`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify({
          businessName:  form.businessName,
          adminEmail:    form.adminEmail,
          adminPassword: form.adminPassword,
          adminFullName: form.adminFullName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Installation failed. Check server logs.');
      }

      // Persist JWT so the wizard's API calls are authenticated
      const { accessToken, refreshToken } = data.data.tokens;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      setStep('done');

      // Brief pause so the user sees the success screen, then enter wizard
      setTimeout(() => router.replace('/admin/setup'), 2200);

    } catch (err: any) {
      setError(err.message ?? 'Unexpected error during installation.');
      setStep('form');
    }
  };

  // ---------------------------------------------------------------------------
  // Render: loading check
  // ---------------------------------------------------------------------------

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: success
  // ---------------------------------------------------------------------------

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('done')}</h2>
          <p className="text-slate-500 dark:text-slate-400">{t('openingWizard')}</p>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: installing spinner
  // ---------------------------------------------------------------------------

  if (step === 'installing') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto" />
          <p className="text-slate-900 dark:text-white text-lg font-medium">{t('installing')}</p>
          <p className="text-slate-500 text-sm">{t('installingDetails')}</p>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: install form
  // ---------------------------------------------------------------------------

  const isMigration = reason === 'machine_mismatch';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <Server className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isMigration ? t('migrationTitle') : t('pageTitle')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm leading-relaxed">
            {isMigration ? t('migrationSubtitle') : t('pageSubtitle')}
          </p>
        </div>

        {/* Machine ID badge */}
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-lg bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400">
          <Cpu className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>{t('machineIdNote')}</span>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-8 shadow-2xl space-y-5">

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-red-600 dark:text-red-300 text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Business name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('businessName')}
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={form.businessName}
                onChange={handleChange('businessName')}
                placeholder={t('businessNamePlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-slate-500 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('ownerAccount')}
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('fullName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={form.adminFullName}
                onChange={handleChange('adminFullName')}
                placeholder={t('fullNamePlaceholder')}
                autoComplete="name"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('emailAddress')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="email"
                value={form.adminEmail}
                onChange={handleChange('adminEmail')}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type={showPw ? 'text' : 'password'}
                value={form.adminPassword}
                onChange={handleChange('adminPassword')}
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {form.adminPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors duration-200"
                      style={{ backgroundColor: i <= pwScore ? STRENGTH_COLORS[pwScore] : '#334155' }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: STRENGTH_COLORS[pwScore] || '#64748b' }}>
                  {strengthLabel(pwScore)}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('confirmPassword')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type={showPw ? 'text' : 'password'}
                value={form.confirmPw}
                onChange={handleChange('confirmPw')}
                placeholder={t('confirmPasswordPlaceholder')}
                autoComplete="new-password"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm ${
                  form.confirmPw && form.confirmPw !== form.adminPassword
                    ? 'border-red-600 focus:ring-red-500/50'
                    : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
                }`}
              />
            </div>
            {form.confirmPw && form.confirmPw !== form.adminPassword && (
              <p className="text-xs text-red-500 mt-1">{t('passwordMismatch')}</p>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={
              !form.businessName ||
              !form.adminFullName ||
              !form.adminEmail ||
              !form.adminPassword ||
              form.adminPassword !== form.confirmPw ||
              pwScore < 3
            }
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-150 text-sm"
          >
            {t('installButton')}
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          {t('footerNote')}
        </p>
      </motion.div>
    </div>
  );
}
