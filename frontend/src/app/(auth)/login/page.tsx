'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Helper function to determine redirect path based on user roles
const getRedirectPath = (roles: string[]): string => {
  // Check for admin roles first
  if (roles.includes('super_admin') || roles.includes('admin')) {
    return '/admin';
  }
  // Check for specific admin roles
  if (roles.includes('restaurant_admin') || roles.includes('chalet_admin') || roles.includes('pool_admin')) {
    return '/admin';
  }
  // Check for staff roles
  if (roles.includes('restaurant_staff')) {
    return '/staff/restaurant';
  }
  if (roles.includes('chalet_staff')) {
    return '/staff/chalets';
  }
  if (roles.includes('pool_staff')) {
    return '/staff/pool';
  }
  if (roles.includes('snack_staff')) {
    return '/staff/snack-bar';
  }
  // Default to home for customers
  return '/';
};

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await login(email, password);
      toast.success(t('welcomeBack'));
      
      // Redirect based on user role
      const redirectPath = getRedirectPath(user?.roles || []);
      
      // Use window.location for a full page navigation to ensure auth state is fresh
      window.location.href = redirectPath;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid credentials');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">V2</span>
            </div>
            <span className="text-2xl font-semibold text-slate-900 dark:text-white">Resort</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-6">{t('welcomeBack')}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{t('signInToAccount')}</p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">{t('login.email')}</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">{t('login.password')}</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" />
                  <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">{tCommon('rememberMe')}</span>
                </label>
                <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">
                  {t('login.forgotPassword')}
                </Link>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('login.signingIn')}
                  </>
                ) : (
                  t('login.title')
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-slate-600 dark:text-slate-400 mt-6">
          {t('login.noAccount')}{' '}
          <Link href="/register" className="text-primary-600 font-medium hover:underline">
            {t('login.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
