/**
 * Deep Linking Service
 * 
 * Handles:
 * - URL scheme (v2resort://)
 * - Universal links (https://v2resort.com/app/*)
 * - Navigation from external links
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// URL scheme
export const URL_SCHEME = 'v2resort';

// Universal link domain
export const UNIVERSAL_LINK_DOMAIN = 'v2resort.com';

/**
 * Linking configuration for expo-router
 */
export const linkingConfig = {
  prefixes: [
    Linking.createURL('/'),
    `${URL_SCHEME}://`,
    `https://${UNIVERSAL_LINK_DOMAIN}/app`,
    `https://www.${UNIVERSAL_LINK_DOMAIN}/app`,
  ],
};

/**
 * Route mapping for deep links
 */
const ROUTE_MAP: Record<string, string> = {
  // Auth routes
  'login': '/(auth)/login',
  'register': '/(auth)/register',
  'reset-password': '/(auth)/reset-password',
  
  // Main routes
  'home': '/(tabs)',
  'menu': '/(tabs)/restaurant',
  'restaurant': '/(tabs)/restaurant',
  'pool': '/(tabs)/pool',
  'chalets': '/(tabs)/chalets',
  'account': '/(tabs)/account',
  
  // Detail routes
  'order': '/orders/[id]',
  'booking': '/bookings/[id]',
  'payment': '/payment',
  'loyalty': '/loyalty',
  
  // Special routes
  'qr': '/qr-scan',
  'promo': '/promotions',
};

/**
 * Parse incoming URL and extract route info
 */
export function parseDeepLink(url: string): {
  route: string;
  params: Record<string, string>;
} | null {
  try {
    const parsed = Linking.parse(url);
    
    if (!parsed.path) {
      return null;
    }

    const pathParts = parsed.path.split('/').filter(Boolean);
    const params: Record<string, string> = { ...parsed.queryParams } as Record<string, string>;

    // Handle specific path patterns
    if (pathParts.length === 0) {
      return { route: '/(tabs)', params };
    }

    const basePath = pathParts[0];
    const mappedRoute = ROUTE_MAP[basePath];

    if (mappedRoute) {
      // Handle dynamic routes
      if (pathParts.length > 1) {
        params.id = pathParts[1];
      }
      
      return { route: mappedRoute, params };
    }

    // If no mapping, try direct route
    return { route: `/${parsed.path}`, params };
  } catch (error) {
    console.error('Failed to parse deep link:', error);
    return null;
  }
}

/**
 * Handle incoming deep link
 */
export function handleDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  
  if (!parsed) {
    return false;
  }

  try {
    // Replace dynamic params in route
    let route = parsed.route;
    if (parsed.params.id && route.includes('[id]')) {
      route = route.replace('[id]', parsed.params.id);
    }

    router.push(route as any);
    return true;
  } catch (error) {
    console.error('Failed to navigate from deep link:', error);
    return false;
  }
}

/**
 * Setup deep link listener
 */
export function setupDeepLinkListener(): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Get initial URL (if app was opened via deep link)
 */
export async function getInitialURL(): Promise<string | null> {
  const url = await Linking.getInitialURL();
  return url;
}

/**
 * Create a deep link URL
 */
export function createDeepLink(path: string, params?: Record<string, string>): string {
  let url = Linking.createURL(path);
  
  if (params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Create a universal link URL
 */
export function createUniversalLink(path: string, params?: Record<string, string>): string {
  let url = `https://${UNIVERSAL_LINK_DOMAIN}/app${path}`;
  
  if (params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Open external URL
 */
export async function openExternalURL(url: string): Promise<boolean> {
  const canOpen = await Linking.canOpenURL(url);
  
  if (canOpen) {
    await Linking.openURL(url);
    return true;
  }
  
  return false;
}

export default {
  URL_SCHEME,
  UNIVERSAL_LINK_DOMAIN,
  linkingConfig,
  parseDeepLink,
  handleDeepLink,
  setupDeepLinkListener,
  getInitialURL,
  createDeepLink,
  createUniversalLink,
  openExternalURL,
};
