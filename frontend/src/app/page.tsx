import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import HomePage from './page-client';

async function validateTenant(tenantSlug: string | null): Promise<boolean> {
  if (!tenantSlug) return true; // Platform tier - no tenant validation needed

  try {
    // NEXT_PUBLIC_API_URL is for browser-side fetches (routes through api.v2platform.local).
    // Server components run in Node.js and must call the backend directly at localhost
    // — using the public URL causes the tenantGate to extract 'api' as a subdomain
    // and 404 before the request reaches getTenantBySlug.
    const apiUrl = 'http://localhost:3005';
    const res = await fetch(`${apiUrl}/api/v1/platform/tenants/by-slug/${tenantSlug}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    // Backend unreachable — fail closed. Returning true here would let any
    // subdomain render during outages, which is a mild security bypass.
    // During outages legitimate tenants will see a 404; that is preferable
    // to serving content to unregistered subdomains.
    return false;
  }
}

export default async function PageWrapper() {
  const headersList = await headers();
  const tenantSlug = headersList.get('X-Tenant-Slug');
  const platformTier = headersList.get('X-Platform-Tier');

  // Only validate tenant if we're on a tenant tier
  if (platformTier === 'tenant' && tenantSlug) {
    const isValid = await validateTenant(tenantSlug);
    if (!isValid) {
      notFound();
    }
  }

  return <HomePage />;
}
