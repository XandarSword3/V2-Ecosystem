'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useOfflineSync } from '@/lib/offline';

export function OfflineStatusIndicator() {
  const t = useTranslations('adminCommon.offline');
  const { isOnline, isSyncing, pendingCount, lastSyncAt, error } = useOfflineSync();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount === 0 && !isSyncing && !error) {
      setShowSyncSuccess(true);
      const timer = setTimeout(() => setShowSyncSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, isSyncing, error]);

  const getStalenessColor = (date: Date) => {
    if (!now) return 'bg-green-600 text-white';
    const minutes = (now.getTime() - new Date(date).getTime()) / 60000;
    if (minutes < 15) return 'bg-green-600 text-white';
    if (minutes < 60) return 'bg-yellow-500 text-white';
    return 'bg-red-600 text-white';
  };

  const getTimeAgo = (date: Date) => {
    if (!now) return 'just now';
    const minutes = Math.floor((now.getTime() - new Date(date).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };


  // Prevent hydration mismatch - don't render until client-side
  if (!mounted) {
    return <div className="fixed bottom-4 right-4 z-50 pointer-events-none" />;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {/* Offline Warning */}
        {!isOnline && (
          <motion.div
            key="offline-warning"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <WifiOff className="w-4 h-4" />
            {t('showingCached')}
          </motion.div>
        )}

        {/* Syncing Indicator */}
        {isSyncing && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            {t('syncing')}
          </motion.div>
        )}

        {/* Staleness / Last Updated Indicator */}
        {lastSyncAt && isOnline && !isSyncing && (
          <motion.div
            key="last-updated"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              getStalenessColor(lastSyncAt)
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              {t('lastUpdated')} {getTimeAgo(lastSyncAt)}
            </span>
          </motion.div>
        )}

        {/* Pending Actions Count */}
        {pendingCount > 0 && !isSyncing && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            {pendingCount} {t('actionsPending')}
          </motion.div>
        )}

        {/* Success Indicator */}
        {showSyncSuccess && isOnline && (
          <motion.div
            key="sync-success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('syncSuccess')}
          </motion.div>
        )}

        {/* Error Indicator */}
        {error && (
          <motion.div
            key="sync-error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4" />
            {t('syncError')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
