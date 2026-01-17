'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Bell, BellOff, RefreshCw } from 'lucide-react';
import { usePWA } from '@/lib/usePWA';

export function PWAPrompt() {
  const {
    isSupported,
    isInstalled,
    canInstall,
    isUpdateAvailable,
    notificationPermission,
    install,
    requestNotifications,
    refresh,
  } = usePWA();

  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed the prompt
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    // Show install prompt after a delay if not installed and not dismissed
    if (canInstall && !isInstalled && !dismissed) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled, dismissed]);

  useEffect(() => {
    if (isUpdateAvailable) {
      setShowUpdateBanner(true);
    }
  }, [isUpdateAvailable]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleEnableNotifications = async () => {
    await requestNotifications();
  };

  if (!isSupported) return null;

  return (
    <>
      {/* Update Available Banner */}
      <AnimatePresence>
        {showUpdateBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-primary-600 text-white px-4 py-3"
          >
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5" />
                <span className="text-sm font-medium">
                  A new version is available!
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refresh}
                  className="px-4 py-1.5 bg-white text-primary-600 text-sm font-semibold rounded-lg hover:bg-primary-50 transition-colors"
                >
                  Update Now
                </button>
                <button
                  onClick={() => setShowUpdateBanner(false)}
                  className="p-1.5 hover:bg-primary-500 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Prompt */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Download className="w-7 h-7 text-primary-600" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Install V2 Resort
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Add to your home screen for faster access and offline support.
                </p>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleInstall}
                    className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    Install App
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors text-sm"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>

            {/* Notification prompt */}
            {notificationPermission === 'default' && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleEnableNotifications}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  Enable notifications for booking updates
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
