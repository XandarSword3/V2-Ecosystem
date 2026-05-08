'use client';

import { usePageTracking, updateSocketUserInfo } from '@/lib/socket';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import { useConsent } from '@/context/ConsentContext';

/**
 * Component that tracks page navigation and updates socket with user info.
 * This component doesn't render anything, it just sets up the tracking.
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

/**
 * GDPR-compliant wrapper that only enables PageTracker when the user has
 * granted functional cookie consent. Page tracking sends browsing behaviour
 * (current URL path) over the Socket.io connection, which constitutes
 * personal data processing when combined with session identifiers.
 *
 * Staff users who are authenticated always have tracking enabled because
 * the admin live-users dashboard depends on it (legitimate interest for
 * operational purposes).
 */
export function ConsentGatedPageTracker() {
  const { hasConsent } = useConsent();
  const { user } = useAuth();

  // Staff/admin users: always track (legitimate interest for operational monitoring)
  const isStaff = user?.roles?.some(r =>
    ['admin', 'super_admin', 'manager', 'staff'].includes(r)
  );

  if (isStaff || hasConsent('functional')) {
    return <PageTracker />;
  }

  return null;
}
