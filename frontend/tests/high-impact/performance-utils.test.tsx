import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  LRUCache,
  deepEqual,
  deduplicatedFetch,
  generateBlurPlaceholder,
  generateImageSrcSet,
  preloadResources,
  reportWebVitals,
  useDebounce,
  useDebouncedCallback,
  useDynamicImport,
  usePrefetch,
  useThrottle,
  useVirtualList,
} from '../../src/utils/performance';

describe('performance utilities', () => {
  it('builds image srcset with CDN and keeps data URLs untouched', () => {
    process.env.NEXT_PUBLIC_CDN_URL = 'https://cdn.example.com';

    const srcSet = generateImageSrcSet('/hero.jpg', [640, 1024]);
    expect(srcSet).toContain('https://cdn.example.com/image/%2Fhero.jpg?w=640&q=75 640w');
    expect(srcSet).toContain('https://cdn.example.com/image/%2Fhero.jpg?w=1024&q=75 1024w');

    expect(generateImageSrcSet('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('creates a blur placeholder data URL', async () => {
    const placeholder = await generateBlurPlaceholder('/image.jpg');
    expect(placeholder.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('performs deep equality checks correctly', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [2, 1] } })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('evicts least-recently-used entries in LRU cache', () => {
    const cache = new LRUCache<string, number>(2);

    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);

    cache.get('a');
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('deduplicates concurrent fetch calls for the same cache key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      deduplicatedFetch<{ ok: boolean }>('/api/test'),
      deduplicatedFetch<{ ok: boolean }>('/api/test'),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds preload links without duplicates', () => {
    preloadResources([
      { url: '/fonts/site.woff2', as: 'font' },
      { url: '/styles/critical.css', as: 'style' },
    ]);
    preloadResources([{ url: '/fonts/site.woff2', as: 'font' }]);

    const preloadLinks = Array.from(document.querySelectorAll('link[rel="preload"]'));
    const fontLinks = preloadLinks.filter(link => link.getAttribute('href') === '/fonts/site.woff2');

    expect(preloadLinks.length).toBeGreaterThanOrEqual(2);
    expect(fontLinks.length).toBe(1);
  });

  it('prefetches once when handlers fire repeatedly', () => {
    const { result } = renderHook(() => usePrefetch('/next-page'));

    act(() => {
      result.current.onMouseEnter();
      result.current.onFocus();
    });

    const prefetchLinks = Array.from(document.querySelectorAll('link[rel="prefetch"]'));
    expect(prefetchLinks.some(link => link.getAttribute('href') === '/next-page')).toBe(true);
  });

  it('debounces values and throttles updates', () => {
    vi.useFakeTimers();

    const { result: debounceResult, rerender: rerenderDebounce } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 'first' } }
    );

    rerenderDebounce({ value: 'second' });
    expect(debounceResult.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(debounceResult.current).toBe('second');

    const { result: throttleResult, rerender: rerenderThrottle } = renderHook(
      ({ value }) => useThrottle(value, 100),
      { initialProps: { value: 1 } }
    );

    rerenderThrottle({ value: 2 });
    expect(throttleResult.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(110);
    });
    expect(throttleResult.current).toBe(2);

    vi.useRealTimers();
  });

  it('debounces callback execution', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { result } = renderHook(() => useDebouncedCallback(callback, 150));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('c');

    vi.useRealTimers();
  });

  it('calculates virtual list bounds and handles scrolling', () => {
    const items = Array.from({ length: 100 }, (_, i) => `row-${i}`);

    const { result } = renderHook(() =>
      useVirtualList({
        items,
        itemHeight: 20,
        containerHeight: 100,
        overscan: 2,
      })
    );

    expect(result.current.totalHeight).toBe(2000);
    expect(result.current.virtualItems.length).toBeGreaterThan(0);

    act(() => {
      result.current.handleScroll({
        currentTarget: { scrollTop: 200 },
      } as UIEvent<HTMLElement>);
    });

    expect(result.current.virtualItems[0]?.index).toBeGreaterThanOrEqual(8);
  });

  it('resolves dynamic imports and reports loading state', async () => {
    const importFn = () => Promise.resolve({ default: 'Loaded component' });

    const { result } = renderHook(() =>
      useDynamicImport(importFn)
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.component).toBe('Loaded component');
    expect(result.current.error).toBeNull();
  });

  it('reports web vitals to gtag when available', () => {
    localStorage.setItem(
      'cookie-consent',
      JSON.stringify({
        categories: { analytics: true },
      })
    );

    const gtag = vi.fn();
    Object.defineProperty(window, 'gtag', {
      value: gtag,
      writable: true,
      configurable: true,
    });

    reportWebVitals({
      name: 'LCP',
      value: 1200,
      id: 'metric-1',
      label: 'main',
    });

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][0]).toBe('event');
    expect(gtag.mock.calls[0][1]).toBe('LCP');
  });
});
