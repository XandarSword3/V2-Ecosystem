/**
 * Property Layout — app/[property]/layout.tsx
 *
 * This layout wraps every route that lives under a specific property slug:
 *   [tenant].localhost/[property]/admin/...
 *   [tenant].localhost/[property]/staff/...
 *   [tenant].localhost/[property]/[moduleSlug]/...
 *   etc.
 *
 * Responsibilities:
 *  1. Extract the property slug from URL params (source of truth — supersedes
 *     the old localStorage/PropertySwitcher model for route identity).
 *  2. Forward the slug to child layouts via useParams() — no additional context
 *     provider needed; Next.js App Router makes params available everywhere
 *     inside a segment via useParams().
 *  3. Middleware has already written x-property-slug into the response headers
 *     before this layout runs, so backend API calls made by RSCs in this tree
 *     will carry the correct scope automatically.
 *
 * Property validation (404 on unknown slugs) is handled naturally:
 *  - Backend API calls inside child pages fail with 404/403 if the property
 *    doesn't exist for this tenant, and pages surface that error accordingly.
 *  - A more aggressive early-exit (fetch + notFound()) can be added here later
 *    if needed, but it adds an extra round-trip on every navigation.
 *
 * NOTE: platform-admin lives at true root (app/platform-admin/) and is never
 * wrapped by this layout. Auth pages (/login, /register, etc.) also stay at
 * root and are exempt.
 */

import { notFound } from 'next/navigation';

interface PropertyLayoutProps {
  children: React.ReactNode;
  params: Promise<{ property: string }>;
}

export default async function PropertyLayout({ children, params }: PropertyLayoutProps) {
  const { property } = await params;

  // Guard: empty or obviously invalid segment → 404.
  // Real property existence is validated by the backend on every API call.
  if (!property || property.trim() === '') {
    notFound();
  }

  // Property slug is now available to every child via useParams().property.
  // Middleware has already injected x-property-slug for backend API calls.
  return <>{children}</>;
}
