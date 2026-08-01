'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Mail, Lock, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  searchParams: URLSearchParams;
}

export function AuthModal({ isOpen, onClose, currentPath, searchParams }: AuthModalProps) {
  const { login } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Build the redirect URL for signup/login pages
  const buildRedirectUrl = () => {
    const queryString = searchParams.toString();
    const fullPath = queryString ? `${currentPath}?${queryString}` : currentPath;
    return encodeURIComponent(fullPath);
  };

  const redirectUrl = buildRedirectUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);

      // Check if 2FA is required
      if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        // Redirect to full login page for 2FA with explanation
        toast.info('Two-factor authentication required. Redirecting to login page...');
        router.push(`/login?redirect=${redirectUrl}`);
        onClose();
        return;
      }

      // Check if mandatory 2FA enrollment is required
      if ('requiresTwoFactorSetup' in result && result.requiresTwoFactorSetup) {
        // Redirect to full login page for 2FA setup with explanation
        toast.info('Two-factor authentication setup required. Redirecting to login page...');
        router.push(`/login?redirect=${redirectUrl}`);
        onClose();
        return;
      }

      // Normal login success
      toast.success('Login successful!');
      onClose();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupRedirect = () => {
    router.push(`/register?redirect=${redirectUrl}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">
            Login Required
          </DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Please log in to place your order. Your cart will be preserved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400 pr-12"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Log In
              </>
            )}
          </Button>

          <div className="text-center pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={handleSignupRedirect}
                className="text-orange-600 dark:text-orange-400 font-medium hover:underline flex items-center gap-1 mx-auto"
                disabled={isLoading}
              >
                <UserPlus className="w-4 h-4" />
                Sign up
              </button>
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
