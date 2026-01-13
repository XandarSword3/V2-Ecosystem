'use client';

import { usePageTracking, updateSocketUserInfo } from '@/lib/socket';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';

/**
 * Component that tracks page navigation and updates socket with user info
 * This component doesn't render anything, it just sets up the tracking
 */
export function PageTracker() {
  const { user } = useAuth();
  
  // Track page navigation
  usePageTracking();
  
  // Update socket with user info when user changes (login/logout)
  useEffect(() => {
    if (user) {
      updateSocketUserInfo({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles || [],
      });
    }
  }, [user]);
  
  return null;
}
