'use client';

/**
 * Platform Admin layout — auth guard.
 *
 * Checks is_platform_admin on the current user token before rendering.
 * This is a client-side guard only; the backend enforces is_platform_admin
 * on every /api/platform/* route independently.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    // The auth context must expose is_platform_admin from the JWT payload.
    // If it doesn't, redirect to login.
    if (!user || !(user as any).is_platform_admin) {
      router.replace('/login');
      return;
    }
    setAllowed(true);
  }, [user, isLoading, router]);

  if (isLoading || !allowed) {
    return (
      <div style={{
        background: '#0B0F14', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif', color: '#5B6B7F',
        fontSize: 13,
      }}>
        Authenticating…
      </div>
    );
  }

  return <>{children}</>;
}
