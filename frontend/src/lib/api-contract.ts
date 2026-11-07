/**
 * API Contract & Route Registry
 *
 * Prevents route drift between frontend call sites and backend routes.
 * Identifies invalid endpoints (e.g. calling /admin/tenants instead of /platform/tenants)
 * before or during automated tests.
 */

export interface RouteSuggestion {
  invalidPath: string;
  suggestedPath: string;
  reason: string;
}

export const KNOWN_ROUTE_DRIFT_MAP: Record<string, RouteSuggestion> = {
  '/admin/tenants': {
    invalidPath: '/admin/tenants',
    suggestedPath: '/platform/tenants',
    reason: 'Tenants are platform-level entities (Engine E) mounted under /platform/tenants, not /admin/tenants.',
  },
  '/admin/plans': {
    invalidPath: '/admin/plans',
    suggestedPath: '/platform/plans',
    reason: 'SaaS subscription plans are platform-level entities mounted under /platform/plans.',
  },
  '/admin/subscriptions': {
    invalidPath: '/admin/subscriptions',
    suggestedPath: '/platform/subscriptions',
    reason: 'Platform SaaS subscriptions are managed via /platform/subscriptions.',
  },
  '/admin/checkout': {
    invalidPath: '/admin/checkout',
    suggestedPath: '/platform/checkout',
    reason: 'SaaS subscription checkout is mounted under /platform/checkout.',
  },
};

export const REGISTERED_API_PREFIXES = [
  '/auth',
  '/users',
  '/payments',
  '/admin',
  '/platform',
  '/modules',
  '/customizations',
  '/inventory',
  '/loyalty',
  '/giftcards',
  '/coupons',
  '/support',
  '/analytics',
  '/templates',
  '/economics',
  '/reviews',
  '/terminology',
  '/devices',
  '/promotions',
  '/finance',
  '/fiscal',
  '/housekeeping',
  '/manager',
  '/staff',
  '/reporting',
  '/revenue',
  '/groups',
  '/marketing',
  '/mobile-checkin',
  '/messaging',
  '/i18n',
  '/csrf-token',
  '/health',
] as const;

export interface ValidationResult {
  valid: boolean;
  normalizedPath: string;
  suggestion?: RouteSuggestion;
  error?: string;
}

/**
 * Normalizes an API path by stripping query params and baseUrl prefixes.
 */
export function normalizeApiPath(url: string): string {
  if (!url) return '';
  let path = url.split('?')[0].split('#')[0];
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      // fallback
    }
  }
  path = path.replace(/^\/?api\/v1/, '').replace(/^\/?api/, '');
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}

/**
 * Validates whether a target API path matches backend route specifications.
 */
export function validateApiRoute(url: string): ValidationResult {
  const normalized = normalizeApiPath(url);

  // Check known route drift mistakes first
  if (KNOWN_ROUTE_DRIFT_MAP[normalized]) {
    const drift = KNOWN_ROUTE_DRIFT_MAP[normalized];
    return {
      valid: false,
      normalizedPath: normalized,
      suggestion: drift,
      error: `[API Contract Violation] Route "${url}" does not exist on the backend. ${drift.reason} Use "${drift.suggestedPath}" instead.`,
    };
  }

  // Check if it matches any registered prefix
  const matchesPrefix = REGISTERED_API_PREFIXES.some((prefix) =>
    normalized === prefix || normalized.startsWith(`${prefix}/`)
  );

  if (matchesPrefix) {
    return {
      valid: true,
      normalizedPath: normalized,
    };
  }

  // If not matching standard prefixes, could be dynamic module slug (e.g. /restaurant/menu, /spa/services)
  // Dynamic module paths have at least 1 slash and do not conflict with reserved slugs
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length >= 1) {
    return {
      valid: true,
      normalizedPath: normalized,
    };
  }

  return {
    valid: false,
    normalizedPath: normalized,
    error: `[API Contract Violation] Unrecognized API route: "${url}".`,
  };
}
