'use client';

import { useEffect } from 'react';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useAuthStore } from '@/stores/authStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { Timer, LogOut } from 'lucide-react';

interface SessionTimeoutMonitorProps {
  /** Warning timeout in minutes (default: 25) */
  warningTimeoutMinutes?: number;
  /** Logout timeout in minutes (default: 30) */
  logoutTimeoutMinutes?: number;
  /** Whether to show the component (useful for admin-only) */
  enabled?: boolean;
}

export function SessionTimeoutMonitor({
  warningTimeoutMinutes = 25,
  logoutTimeoutMinutes = 30,
  enabled = true
}: SessionTimeoutMonitorProps) {
  const { isAuthenticated } = useAuthStore();
  
  const {
    isWarningActive,
    remainingSeconds,
    extendSession,
    logout
  } = useIdleTimer({
    warningTimeoutMinutes,
    logoutTimeoutMinutes
  });

  // Don't render if not authenticated or not enabled
  if (!isAuthenticated || !enabled) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={isWarningActive}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <Timer className="h-6 w-6 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Session Timeout Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-4 text-base">
            Your session is about to expire due to inactivity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="text-5xl font-bold text-orange-600 tabular-nums">
            {formatTime(remainingSeconds)}
          </div>
          <p className="text-sm text-muted-foreground">
            You will be logged out automatically
          </p>
        </div>

        <AlertDialogFooter className="flex gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={extendSession}
            className="bg-primary"
          >
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SessionTimeoutMonitor;
