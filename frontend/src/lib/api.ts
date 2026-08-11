import axios from 'axios';
import { getStoredPropertyId } from './property-id';

// ---------------------------------------------------------------------------
// In-memory access token store.
// SECURITY: Access tokens must NEVER be persisted to localStorage — doing so
// exposes them to any XSS payload that runs on the page. Keeping the token in
// a module-scope variable means it lives only in JS heap and is wiped on page
// reload (forcing a silent refresh via the httpOnly refresh-token cookie).
// The refresh token is stored in an httpOnly; Secure; SameSite=Strict cookie
// set by the backend at login — JS cannot read or steal it.
// ---------------------------------------------------------------------------
let _accessToken: string | null = null;

export const memoryTokenStore = {
  get: (): string | null => _accessToken,
  set: (token: string | null): void => { _accessToken = token; },
  clear: (): void => { _accessToken = null; },
};

// Legacy localStorage helpers — kept as no-ops so callers don't break at
// compile-time while we migrate call sites. Remove once all pages updated.
/** @deprecated Use memoryTokenStore instead */
export const legacyLocalStorage = {
  getAccessToken: (): string | null => memoryTokenStore.get(),
  setAccessToken: (t: string) => memoryTokenStore.set(t),
  setRefreshToken: (_t: string) => { /* refresh token is now an httpOnly cookie */ },
  clearTokens: () => memoryTokenStore.clear(),
};
export interface HostSegments {
  tenant: string | null;
  property: string | null;
}

// Root-level route segments that are NOT property slugs.
// Mirrors the same set in proxy.ts.
const GLOBAL_ROUTE_SEGMENTS = new Set([
  'login', 'register', 'forgot-password', 'reset-password',
  'install', 'platform-admin', 'cookie-policy', 'terms', 'privacy',
  'offline', 'error', 'global-error', 'api', 'nexus',
]);

/**
 * Extract a property slug from the current URL pathname.
 * Used for path-based property routing ([tenant].localhost/[property]/...)
 * where the property is the first path segment, not a subdomain.
 */
export function extractPropertyFromPath(pathname: string): string | null {
  const segment = pathname.split('/')[1];
  if (!segment || GLOBAL_ROUTE_SEGMENTS.has(segment)) return null;
  return segment;
}

export function extractHostSegments(host: string | null | undefined): HostSegments {
  const none: HostSegments = { tenant: null, property: null };
  if (!host) return none;

  const hostname = host.split(':')[0]; // strip port

  if (hostname.endsWith('.vercel.app')) return none;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return none;

  // Dev: acme.localhost or resort-a.acme.localhost
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.lastIndexOf('.localhost'));
    if (!sub) return none;
    const parts = sub.split('.');
    if (parts.length === 1) return { tenant: parts[0], property: null };
    return { tenant: parts[1], property: parts[0] };
  }

  // tenant.v2platform.com, property.tenant.v2platform.com (or .local in dev)
  const parts = hostname.split('.');
  if (parts.length <= 2) return none; // bare domain, no subdomain
  if (parts.length === 3) return { tenant: parts[0], property: null };
  return { tenant: parts[1], property: parts[0] };
}

// Types for API requests
interface CreateOrderData {
  customerName?: string;
  customerPhone?: string;
  items: Array<{ catalogItemId: string; quantity: number; notes?: string }>;
  orderType?: string;
  paymentMethod?: string;
  specialInstructions?: string;
  tableNumber?: string;
  unitNumber?: string;
  // Discount integration fields
  couponCode?: string;
  giftCardRedemptions?: Array<{ code: string; amount: number }>;
  loyaltyPointsToRedeem?: number;
  loyaltyPointsDollarValue?: number;
}

interface CreateMembershipData {
  type: 'INDIVIDUAL' | 'FAMILY' | 'CORPORATE' | 'VIP';
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  memberEmails?: string[];
  corporateName?: string;
  paymentMethodId?: string;
}

interface CreateModuleData {
  engine_type: string;
  name: string;
  slug?: string;
  description?: string;
  settings?: Record<string, unknown>;
  settings_version?: number;
}

// API_URL should NOT include /api - we add it in baseURL
const getApiUrl = (): string => {
  const defaultUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isDev = hostname.endsWith('.localhost') || 
                  hostname === 'localhost' || 
                  hostname.endsWith('.v2platform.local');
    if (isDev) {
      return `${window.location.protocol}//${hostname}:3005`;
    }
  }
  return defaultUrl;
};

// Ensure we don't double up on /api
const cleanUrl = getApiUrl().replace(/\/api\/?$/, '');

// Export the base API URL for use in other files
export const API_BASE_URL = `${cleanUrl}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Send cookies (CSRF token) with requests
  timeout: 30000, // 30 second timeout
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'], // Idempotent methods
};

// Calculate delay with exponential backoff and jitter
const getRetryDelay = (retryCount: number): number => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
    RETRY_CONFIG.maxDelay
  );
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

// Check if request should be retried
const shouldRetry = (error: any, retryCount: number): boolean => {
  if (retryCount >= RETRY_CONFIG.maxRetries) return false;

  // Network errors (no response)
  if (!error.response) return true;

  const status = error.response.status;
  const method = error.config?.method?.toUpperCase() || 'GET';

  // Only retry idempotent methods on server errors
  if (RETRY_CONFIG.retryableStatuses.includes(status)) {
    return RETRY_CONFIG.retryableMethods.includes(method);
  }

  return false;
};

// Sleep helper
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// CSRF token management
let csrfTokenPromise: Promise<string | null> | null = null;

/**
 * Ensure we have a valid CSRF token before making mutation requests
 * This fetches a token from the server if we don't have one in cookies
 */
async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Check if we already have a token in cookies
  const existingToken = getCookie('csrf-token');
  if (existingToken) return existingToken;
  
  // If we're already fetching, wait for that promise
  if (csrfTokenPromise) return csrfTokenPromise;
  
  // Fetch a new token
  csrfTokenPromise = (async () => {
    try {
      const response = await axios.get(`${API_BASE_URL.replace('/api/v1', '')}/api/csrf-token`, {
        withCredentials: true,
      });
      return response.data?.csrfToken || null;
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error);
      return null;
    } finally {
      // Reset promise after a short delay so we can try again if needed
      setTimeout(() => { csrfTokenPromise = null; }, 1000);
    }
  })();
  
  return csrfTokenPromise;
}

// Single-flight refresh: any concurrent caller (the proactive request-
// interceptor check, the reactive 401 handler, or an explicit call from
// auth-context's validateSession()) shares the same in-flight promise
// instead of firing separate POST /auth/refresh calls. This matters
// because the refresh-token cookie rotates on every successful refresh —
// a second concurrent call presenting the now-stale cookie gets 401'd,
// which previously surfaced as (and caused) a spurious logout, especially
// under React StrictMode's double-effect-invocation in dev.
let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      // Response shape is { success, data: { user, tokens: { accessToken } } } —
      // see backend/src/modules/auth/auth.controller.ts refreshToken().
      const accessToken = response.data?.data?.tokens?.accessToken;
      if (!accessToken) throw new Error('Refresh response missing accessToken');
      memoryTokenStore.set(accessToken);
      return accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Helper to check if token is close to expiring
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferMs = 60000; // 1 minute buffer
    return exp - now < bufferMs;
  } catch {
    return true; // If we can't parse, assume it's expiring
  }
};

// Helper to get cookie value by name
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : undefined;
};

// Request interceptor to add auth token, CSRF token, and check expiration
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      let token = memoryTokenStore.get();

      // Check if token is close to expiring and proactively refresh
      if (token && isTokenExpiringSoon(token)) {
        try {
          token = await refreshAccessToken();
        } catch {
          // Refresh failed, continue with old token
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Inject X-Tenant-Slug / X-Property-Slug on every request so the
      // backend's tenantAccess/propertyResolution middleware can resolve
      // context. Tenant always comes from the subdomain. Property may come
      // from the subdomain (resort-a.acme.localhost) OR from the URL path
      // ([tenant].localhost/[property]/admin/...) — path takes precedence
      // when subdomain carries no property segment.
      const { tenant: tenantSlug, property: subdomainProperty } = extractHostSegments(window.location.host);
      const propertySlug = subdomainProperty ?? extractPropertyFromPath(window.location.pathname);
      if (tenantSlug) {
        config.headers['X-Tenant-Slug'] = tenantSlug;
      }
      if (propertySlug) {
        config.headers['X-Property-Slug'] = propertySlug;
      }

      // Only send x-property-id when localStorage holds a valid UUID, AND
      // only on admin/staff routes. This header drives authenticated
      // multi-property switching (validatePropertyAccess checks ownership
      // before honoring it) — it has no legitimate use on the public
      // storefront. The guard is route-topology-based rather than relying
      // solely on PropertyProvider/PropertySwitcher never being mounted on
      // public routes, since api.ts is imported broadly and a future public
      // page could otherwise pick up a stale admin-set value by accident.
      // See CONTEXT.md "Public/Admin Property Context Contamination"
      // (session 7-9).
      // With path-based property routing, admin/staff live at
      // /{property}/admin and /{property}/staff — not directly at /admin or
      // /staff. The regex matches both the new nested form and the legacy
      // direct form for backward compat.
      const isAdminOrStaffRoute =
        typeof window !== 'undefined' &&
        (/\/(?:admin|staff)(\/?$|\/)/.test(window.location.pathname) ||
          window.location.pathname.startsWith('/platform-admin'));

      if (isAdminOrStaffRoute) {
        const activePropertyId = getStoredPropertyId();
        if (activePropertyId) {
          config.headers['x-property-id'] = activePropertyId;
        }
      }

      // Add CSRF token for non-GET requests (Double Submit Cookie pattern)
      const method = config.method?.toUpperCase();
      if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        // First try to get from cookie
        let csrfToken = getCookie('csrf-token');
        
        // If no cookie, fetch a token first
        if (!csrfToken) {
          csrfToken = await ensureCsrfToken() || undefined;
        }
        
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh with queue and retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Initialize retry count
    originalRequest._retryCount = originalRequest._retryCount || 0;

    // Handle CSRF token errors (403 with csrfToken in response)
    if (error.response?.status === 403 && error.response?.data?.csrfToken && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      // The server provided a new CSRF token, retry the request
      originalRequest.headers['X-CSRF-Token'] = error.response.data.csrfToken;
      return api(originalRequest);
    }

    // Handle retry logic for network errors and server errors (not 401)
    if (error.response?.status !== 401 && shouldRetry(error, originalRequest._retryCount)) {
      originalRequest._retryCount += 1;
      const delay = getRetryDelay(originalRequest._retryCount - 1);
      console.log(`Retrying request (${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries}) after ${delay}ms...`);
      await sleep(delay);
      return api(originalRequest);
    }

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Shared single-flight refresh — if another caller (proactive check,
        // another queued 401, or auth-context) already kicked one off, this
        // just awaits that same in-flight promise instead of racing it.
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        memoryTokenStore.clear();
        // Genuine refresh rejection (401/403 from /auth/refresh) means the
        // refresh token is actually invalid — clear the stale 'user' marker
        // too, otherwise auth-context's mount-time validateSession() will
        // keep trying to refresh on every future load using a dead session.
        const refreshStatus = refreshError?.response?.status;
        if (typeof window !== 'undefined' && (refreshStatus === 401 || refreshStatus === 403)) {
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: { email: string; password: string; fullName: string; phone?: string }) =>
    api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  // FIX Iter-12: backend expects 'newPassword', not 'password'
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  getProfile: () => api.get('/auth/me'),

  // Two-Factor Authentication
  get2FAStatus: () => api.get('/auth/2fa/status'),

  setup2FA: () => api.post('/auth/2fa/setup'),

  enable2FA: (code: string) => api.post('/auth/2fa/enable', { code }),

  // Mandatory-enrollment variants: called with the short-lived
  // twoFactorSetupToken issued by login() (403 TWO_FACTOR_SETUP_REQUIRED),
  // not the normal session token. The account has no session yet, so the
  // Authorization header must be set explicitly here rather than relying
  // on the request interceptor's memoryTokenStore token (which is empty/
  // irrelevant at this point in the flow).
  setup2FAWithToken: (setupToken: string) =>
    api.post('/auth/2fa/setup', undefined, {
      headers: { Authorization: `Bearer ${setupToken}` },
    }),

  enable2FAWithToken: (setupToken: string, code: string) =>
    api.post('/auth/2fa/enable', { code }, {
      headers: { Authorization: `Bearer ${setupToken}` },
    }),

  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),

  verify2FA: (userId: string, code: string, isBackupCode?: boolean) =>
    api.post('/auth/2fa/verify', { userId, code, isBackupCode }),

  regenerateBackupCodes: (code: string) =>
    api.post('/auth/2fa/backup-codes', { code }),
};

// Modules API
export const modulesApi = {
  getAll: (activeOnly = false) => api.get(`/admin/modules${activeOnly ? '?activeOnly=true' : ''}`),
  getById: (id: string) => api.get(`/admin/modules/${id}`),
  create: (data: CreateModuleData) => api.post('/admin/modules', data),
  update: (id: string, data: Partial<CreateModuleData>) => api.put(`/admin/modules/${id}`, data),
  delete: (id: string, force = false) => api.delete(`/admin/modules/${id}${force ? '?force=true' : ''}`),
};

// Inventory API
export const inventoryApi = {
  getItems: (params?: any) => api.get('/inventory/items', { params }),
};

// Payments API
export const paymentsApi = {
  createPaymentIntent: (data: { amount: number; referenceType: string; referenceId: string }) =>
    api.post('/payments/create-intent', data),
};

// Support API
export const supportApi = {
  submitContact: (data: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    api.post('/support/contact', data),
};

export default api;
