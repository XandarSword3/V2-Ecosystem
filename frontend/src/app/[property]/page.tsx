/**
 * Property Home — app/[property]/page.tsx
 *
 * Resolves the /{propertySlug} route that guest-facing pages link to as
 * "Back to Home" (cancellation, cart, loyalty, reserve, waitlist, etc.).
 *
 * In path-based routing the canonical homepage lives at the tenant root ("/"),
 * so we redirect there. Middleware has already set x-property-slug on the
 * response headers, so the homepage renders with the correct property context.
 */

import { redirect } from 'next/navigation';

interface PropertyHomeProps {
  params: Promise<{ property: string }>;
}

export default async function PropertyHome({ params }: PropertyHomeProps) {
  // Params are unused — we simply redirect to the tenant root homepage.
  await params;
  redirect('/');
}
