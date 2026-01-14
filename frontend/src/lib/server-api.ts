/**
 * Server-side API utilities for SSR
 * These functions fetch data on the server for initial page render
 * Bots and crawlers (GPTBot, Claude, Perplexity, Google) get fully rendered HTML
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const cleanUrl = API_URL.replace(/\/api\/?$/, '');
const API_BASE_URL = `${cleanUrl}/api`;

interface FetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

async function serverFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T | null> {
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
// Restaurant API (Server-side)
// ============================================
export interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  category: {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
  };
  preparation_time_minutes?: number;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_spicy?: boolean;
  discount_price?: number;
  image_url?: string;
  is_available?: boolean;
  is_featured?: boolean;
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const data = await serverFetch<{ items?: MenuItem[]; menuItems?: MenuItem[] } | MenuItem[]>(
    '/restaurant/menu',
    { tags: ['menu'], revalidate: 300 }
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? data?.menuItems ?? [];
}

// ============================================
// Chalets API (Server-side)
// ============================================
export interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  capacity: number;
  bedroom_count?: number;
  bathroom_count?: number;
  amenities?: string[];
  images?: string[];
  base_price?: number;
  weekend_price?: number;
  is_active?: boolean;
  is_featured?: boolean;
}

export async function getChalets(): Promise<Chalet[]> {
  const data = await serverFetch<{ chalets?: Chalet[] } | Chalet[]>(
    '/chalets',
    { tags: ['chalets'], revalidate: 300 }
  );
  if (Array.isArray(data)) return data;
  return data?.chalets ?? [];
}

export async function getChaletById(id: string): Promise<Chalet | null> {
  return serverFetch<Chalet>(`/chalets/${id}`, { tags: ['chalets', `chalet-${id}`] });
}

// ============================================
// Pool API (Server-side)
// ============================================
export interface PoolSession {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  adult_price?: number;
  child_price?: number;
  is_active?: boolean;
}

export async function getPoolSessions(): Promise<PoolSession[]> {
  const data = await serverFetch<{ sessions?: PoolSession[] } | PoolSession[]>(
    '/pool/sessions',
    { tags: ['pool'], revalidate: 300 }
  );
  if (Array.isArray(data)) return data;
  return data?.sessions ?? [];
}

// ============================================
// Snack Bar API (Server-side)
// ============================================
export interface SnackItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  category: string;
  image_url?: string;
  is_available?: boolean;
}

export async function getSnackItems(): Promise<SnackItem[]> {
  const data = await serverFetch<{ items?: SnackItem[] } | SnackItem[]>(
    '/snack/items',
    { tags: ['snacks'], revalidate: 300 }
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

// ============================================
// Settings API (Server-side)
// ============================================
export interface SiteSettings {
  resortName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  theme?: string;
  logo?: string;
  openingHours?: Record<string, { open: string; close: string }>;
  socialLinks?: Record<string, string>;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const data = await serverFetch<SiteSettings>(
    '/admin/settings',
    { tags: ['settings'], revalidate: 600 } // 10 minutes
  );
  return data ?? {};
}
