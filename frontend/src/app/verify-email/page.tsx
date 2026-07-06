'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing verification token');
      return;
    }

    const verifyToken = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        const data = response.data;

        if (data.success) {
          setSuccess(true);
          setTimeout(() => router.push('/login'), 3000);
        } else {
          setError(data.error || 'Failed to verify email');
        }
      } catch (err) {
        setError('Invalid or expired verification token');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token, router]);

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
            <span className="text-2xl font-bold text-white">Platform</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          {isLoading ? (
            /* Loading State */
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Verifying Your Email
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Please wait while we verify your email address...
              </p>
            </div>
          ) : success ? (
            /* Success State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Email Verified!
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Your email has been successfully verified.
                Redirecting you to login...
              </p>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" />
            </div>
          ) : (
            /* Error State */
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Verification Failed
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {error || 'An error occurred while verifying your email.'}
              </p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg shadow-primary-600/30 transition-all text-center"
                >
                  Go to Login
                </Link>
                <Link
                  href="/register"
                  className="block w-full py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold rounded-lg transition-all text-center"
                >
                  Register Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
