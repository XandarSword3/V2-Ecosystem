// Performance Optimization Utilities
// Sprint 15: UAT & Polish

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ==================== Image Optimization ====================

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

/**
 * Generate optimized image URLs for different screen sizes
 */
export function generateImageSrcSet(
  src: string,
  widths: number[] = [640, 750, 828, 1080, 1200, 1920]
): string {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  // Assuming we use a CDN with image transformation
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL || '';
  
  return widths
    .map(w => {
      const transformedUrl = cdnBase
        ? `${cdnBase}/image/${encodeURIComponent(src)}?w=${w}&q=75`
        : src;
      return `${transformedUrl} ${w}w`;
    })
    .join(', ');
}

/**
 * Generate blur placeholder for images
 */
export async function generateBlurPlaceholder(src: string): Promise<string> {
  // In production, this would call an API to generate the blur hash
  // For now, return a simple placeholder
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#e0e0e0"/>
    </svg>`
  ).toString('base64')}`;
}

// ==================== Lazy Loading ====================

/**
 * Intersection Observer hook for lazy loading
 */
export function useLazyLoad<T extends HTMLElement>(
  options?: IntersectionObserverInit
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px', ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options]);

  return [ref, isVisible];
}

/**
 * Lazy load component wrapper
 */
export function LazyComponent({
  children,
  fallback = null,
  threshold = 0.1,
  rootMargin = '100px'
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) {
  const [ref, isVisible] = useLazyLoad<HTMLDivElement>({ threshold, rootMargin });

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
}

// ==================== Debounce & Throttle ====================

/**
 * Debounce hook for search inputs, etc.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Throttle hook for scroll handlers, etc.
 */
export function useThrottle<T>(value: T, interval: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

// ==================== Virtual List ====================

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

/**
 * Simple virtual list for large datasets
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3
}: Pick<VirtualListProps<T>, 'items' | 'itemHeight' | 'containerHeight' | 'overscan'>) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  
  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  }, [scrollTop, itemHeight, overscan]);

  const endIndex = useMemo(() => {
    return Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
      style: {
        position: 'absolute' as const,
        top: (startIndex + i) * itemHeight,
        height: itemHeight,
        left: 0,
        right: 0
      }
    }));
  }, [items, startIndex, endIndex, itemHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    virtualItems: visibleItems,
    totalHeight,
    handleScroll,
    containerProps: {
      style: {
        height: containerHeight,
        overflow: 'auto' as const,
        position: 'relative' as const
      },
      onScroll: handleScroll
    },
    listProps: {
      style: {
        height: totalHeight,
        position: 'relative' as const
      }
    }
  };
}

// ==================== Memoization Helpers ====================

/**
 * Deep comparison for memoization
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Stable object reference hook
 */
export function useStableObject<T extends object>(obj: T): T {
  const ref = useRef<T>(obj);

  if (!deepEqual(ref.current, obj)) {
    ref.current = obj;
  }

  return ref.current;
}

// ==================== Resource Prefetching ====================

/**
 * Prefetch resources on hover/focus
 */
export function usePrefetch(url: string) {
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) return;
    prefetched.current = true;

    // Prefetch page data
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }, [url]);

  return {
    onMouseEnter: prefetch,
    onFocus: prefetch
  };
}

/**
 * Preload critical resources
 */
export function preloadResources(resources: Array<{ url: string; as: string }>) {
  if (typeof document === 'undefined') return;

  resources.forEach(({ url, as }) => {
    const existing = document.querySelector(`link[href="${url}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
  });
}

// ==================== Request Deduplication ====================

const requestCache = new Map<string, Promise<unknown>>();

/**
 * Deduplicate identical concurrent requests
 */
export async function deduplicatedFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const cacheKey = `${options?.method || 'GET'}:${url}:${JSON.stringify(options?.body || '')}`;

  const cachedRequest = requestCache.get(cacheKey);
  if (cachedRequest) {
    return cachedRequest as Promise<T>;
  }

  const request = fetch(url, options)
    .then(res => res.json())
    .finally(() => {
      // Remove from cache after request completes
      setTimeout(() => requestCache.delete(cacheKey), 0);
    });

  requestCache.set(cacheKey, request);
  return request;
}

// ==================== Memory Management ====================

/**
 * Cache with automatic eviction
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Hook to clean up resources on unmount
 */
export function useCleanup(cleanup: () => void) {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    return () => cleanupRef.current();
  }, []);
}

// ==================== Bundle Optimization ====================

/**
 * Dynamic import with loading state
 */
export function useDynamicImport<T>(
  importFn: () => Promise<{ default: T }>
) {
  const [component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    importFn()
      .then(module => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [importFn]);

  return { component, loading, error };
}

// ==================== Performance Monitoring ====================

/**
 * Measure component render time
 */
export function useRenderTime(componentName: string) {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - startTime.current;
    
    // Report to analytics if too slow
    if (renderTime > 100) {
      console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      
      // Could report to analytics
      // analytics.track('slow_render', { component: componentName, time: renderTime });
    }
  });

  // Reset on each render
  startTime.current = performance.now();
}

/**
 * Track Web Vitals
 */
export function reportWebVitals(metric: {
  name: string;
  value: number;
  id: string;
  label?: string;
}) {
  const { name, value, id, label } = metric;

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${name}: ${value.toFixed(2)}ms`);
  }

  // Report to analytics in production
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, {
      event_category: 'Web Vitals',
      event_label: label || id,
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      non_interaction: true
    });
  }
}

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      params: Record<string, unknown>
    ) => void;
  }
}

// ==================== Critical CSS ====================

/**
 * Inline critical CSS for above-the-fold content
 */
export const criticalCSS = `
  /* Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  /* Font loading optimization */
  @font-face {
    font-family: 'System';
    font-display: swap;
    src: local('system-ui'), local('-apple-system'), local('Segoe UI');
  }
  
  /* Prevent layout shift */
  img, video { max-width: 100%; height: auto; }
  
  /* Loading skeleton */
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton 1.5s infinite;
  }
  
  @keyframes skeleton {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// ==================== Service Worker Registration ====================

/**
 * Register service worker for caching
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available, prompt user to refresh
            if (confirm('New version available! Reload to update?')) {
              window.location.reload();
            }
          }
        });
      }
    });
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}
