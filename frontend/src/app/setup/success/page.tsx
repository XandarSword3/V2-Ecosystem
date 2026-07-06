'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Auto-redirect to login after 5 seconds
    const timer = setTimeout(() => {
      router.push('/login');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
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

        {/* Success Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Payment Successful!
          </h1>

          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Your subscription has been set up successfully. You'll receive a welcome email with your login credentials shortly.
          </p>

          {sessionId && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Session ID</p>
              <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">
                {sessionId}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
            >
              Go to Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to login in 10 seconds...</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function SetupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
