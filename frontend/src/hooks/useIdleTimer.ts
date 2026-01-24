'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface IdleTimerConfig {
  /** Timeout in minutes before showing warning */
  warningTimeoutMinutes: number;
  /** Timeout in minutes before auto-logout */
  logoutTimeoutMinutes: number;
  /** Events that reset the idle timer */
  events: string[];
  /** Callback when warning is triggered */
  onWarning?: () => void;
  /** Callback when logout is triggered */
  onLogout?: () => void;
  /** Callback when activity resets the timer */
  onActivity?: () => void;
}

interface UseIdleTimerReturn {
  /** Whether the warning modal should be shown */
  isWarningActive: boolean;
  /** Remaining seconds until logout */
  remainingSeconds: number;
  /** Reset the idle timer */
  resetTimer: () => void;
  /** Manually logout */
  logout: () => void;
  /** Extend the session */
  extendSession: () => void;
}

const DEFAULT_CONFIG: IdleTimerConfig = {
  warningTimeoutMinutes: 25,
  logoutTimeoutMinutes: 30,
  events: [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click',
    'keydown'
  ]
};

export function useIdleTimer(
  config: Partial<IdleTimerConfig> = {}
): UseIdleTimerReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const router = useRouter();
  const { logout: authLogout, isAuthenticated } = useAuthStore();
  
  const [isWarningActive, setIsWarningActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const performLogout = useCallback(async () => {
    clearAllTimers();
    setIsWarningActive(false);
    
    try {
      await authLogout();
      toast.info('You have been logged out due to inactivity');
      router.push('/login');
      
      if (mergedConfig.onLogout) {
        mergedConfig.onLogout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  }, [clearAllTimers, authLogout, router, mergedConfig]);

  const showWarning = useCallback(() => {
    setIsWarningActive(true);
    
    const warningDurationSeconds = 
      (mergedConfig.logoutTimeoutMinutes - mergedConfig.warningTimeoutMinutes) * 60;
    setRemainingSeconds(warningDurationSeconds);
    
    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          performLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Set logout timeout
    logoutTimeoutRef.current = setTimeout(() => {
      performLogout();
    }, warningDurationSeconds * 1000);
    
    if (mergedConfig.onWarning) {
      mergedConfig.onWarning();
    }
  }, [mergedConfig, performLogout]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return;
    
    clearAllTimers();
    setIsWarningActive(false);
    lastActivityRef.current = Date.now();
    
    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      showWarning();
    }, mergedConfig.warningTimeoutMinutes * 60 * 1000);
    
    if (mergedConfig.onActivity) {
      mergedConfig.onActivity();
    }
  }, [clearAllTimers, isAuthenticated, mergedConfig, showWarning]);

  const extendSession = useCallback(() => {
    resetTimer();
    toast.success('Session extended');
  }, [resetTimer]);

  const handleActivity = useCallback(() => {
    // Don't reset if warning is active - user must explicitly extend
    if (isWarningActive) return;
    
    // Throttle activity detection to prevent excessive timer resets
    const now = Date.now();
    if (now - lastActivityRef.current > 5000) { // 5 second throttle
      resetTimer();
    }
  }, [isWarningActive, resetTimer]);

  // Set up event listeners
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      return;
    }

    // Initial timer setup
    resetTimer();

    // Add event listeners for activity detection
    mergedConfig.events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Listen for visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we should have logged out while tab was hidden
        const elapsed = Date.now() - lastActivityRef.current;
        const logoutThreshold = mergedConfig.logoutTimeoutMinutes * 60 * 1000;
        
        if (elapsed >= logoutThreshold) {
          performLogout();
        } else {
          handleActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for storage events (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'logout-event') {
        performLogout();
      }
      if (e.key === 'activity-event') {
        lastActivityRef.current = Date.now();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearAllTimers();
      mergedConfig.events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [
    isAuthenticated,
    clearAllTimers,
    handleActivity,
    mergedConfig,
    performLogout,
    resetTimer
  ]);

  // Broadcast activity to other tabs
  useEffect(() => {
    if (!isWarningActive && isAuthenticated) {
      localStorage.setItem('activity-event', Date.now().toString());
    }
  }, [isWarningActive, isAuthenticated]);

  return {
    isWarningActive,
    remainingSeconds,
    resetTimer,
    logout: performLogout,
    extendSession
  };
}

export default useIdleTimer;
