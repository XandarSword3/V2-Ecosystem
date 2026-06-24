/**
 * Server-side API utilities for SSR
 * These functions fetch data on the server for initial page render
 * Bots and crawlers (GPTBot, Claude, Perplexity, Google) get fully rendered HTML
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
const cleanUrl = API_URL.replace(/\/api\/?$/, '');
const API_BASE_URL = `${cleanUrl}/api`;

interface FetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

async function serverFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T | null> {
  // If we are running a Next.js build and the API is hitting a local missing server, skip it.
  if (process.env.npm_lifecycle_event === 'build' && API_BASE_URL.includes('localhost')) {
    console.warn(`[Build Bypass] Skipping server fetch to ${endpoint} during static generation`);
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: options.revalidate ?? 300, // Default: revalidate every 5 minutes
        tags: options.tags,
      },
    });

    if (!response.ok) {
      console.error(`[Server API] Failed to fetch ${endpoint}: ${response.status}`);
      return null;
    }

    const json = await response.json();
    return json.data ?? json;
  } catch (error) {
    console.error(`[Server API] Error fetching ${endpoint}:`, error);
    return null;
  }
}

// ============================================
// Settings API (Server-side)
// ============================================
export interface SiteSettings {
  siteName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  theme?: string;
  logo?: string;
  openingHours?: Record<string, { open: string; close: string }>;
  socialLinks?: Record<string, string>;
  dpaAgreements?: Record<string, { status: boolean; dateCompleted: string; reference: string; }>;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const data = await serverFetch<SiteSettings>(
    '/admin/settings',
    { tags: ['settings'], revalidate: 600 } // 10 minutes
  );
  return data ?? {};
}

// ============================================
// Catalog (Menu) Items
// ============================================
export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category?: { id: string; name: string } | string;
  [key: string]: unknown;
}

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const data = await serverFetch<CatalogItem[] | { items: CatalogItem[] }>(
    '/menu',
    { tags: ['menu'], revalidate: 300 }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (data as { items?: CatalogItem[] }).items ?? [];
}

// ============================================
// Accommodation Units
// ============================================
export interface AccommodationUnit {
  id: string;
  name: string;
  capacity?: number;
  [key: string]: unknown;
}

export async function getAccommodationUnits(): Promise<AccommodationUnit[]> {
  const data = await serverFetch<AccommodationUnit[] | { units: AccommodationUnit[] }>(
    '/accommodation_units',
    { tags: ['accommodation_units'], revalidate: 300 }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (data as { units?: AccommodationUnit[] }).units ?? [];
}

export async function getAccommodationUnitById(id: string): Promise<AccommodationUnit | null> {
  return serverFetch<AccommodationUnit>(`/accommodation_units/${id}`, { tags: ['accommodation_units'] });
}

// ============================================
// Capacity Windows (Sessions)
// ============================================
export interface CapacityWindow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity?: number;
  [key: string]: unknown;
}

export async function getCapacityWindows(): Promise<CapacityWindow[]> {
  const data = await serverFetch<CapacityWindow[] | { sessions: CapacityWindow[] }>(
    '/capacity',
    { tags: ['capacity'], revalidate: 300 }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (data as { sessions?: CapacityWindow[] }).sessions ?? [];
}

// ============================================
// Kiosk Items
// ============================================
export interface KioskItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  [key: string]: unknown;
}

export async function getKioskItems(): Promise<KioskItem[]> {
  const data = await serverFetch<KioskItem[] | { items: KioskItem[] }>(
    '/kiosk/items',
    { tags: ['kiosk'], revalidate: 300 }
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (data as { items?: KioskItem[] }).items ?? [];
}
