import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  AriaAnnouncer,
  KEYS,
  SkipLink,
  generateId,
  getContrastRatio,
  getFocusableElements,
  isAccessiblyHidden,
  meetsContrastRequirements,
  srOnlyClass,
  srOnlyFocusableClass,
  srOnlyStyles,
  useAnnouncer,
  useId,
  usePrefersHighContrast,
  usePrefersReducedMotion,
  useRovingTabindex,
  useSkipLink,
  visuallyHidden,
} from '../../src/utils/accessibility';

describe('accessibility utilities', () => {
  it('exposes keyboard constants and utility class names', () => {
    expect(KEYS.ENTER).toBe('Enter');
    expect(KEYS.TAB).toBe('Tab');
    expect(srOnlyClass).toBe('sr-only');
    expect(srOnlyFocusableClass).toContain('focus:not-sr-only');
    expect(srOnlyStyles).toContain('position: absolute');
  });

  it('finds focusable elements and skips hidden elements', () => {
    render(
      <div>
        <button>Primary</button>
        <a href="/test">Link</a>
        <input aria-label="name" />
        <button style={{ display: 'none' }}>Hidden</button>
      </div>
    );

    const focusable = getFocusableElements(document.body as HTMLElement);
    const labels = focusable.map(el => el.textContent || el.getAttribute('aria-label'));

    expect(labels).toContain('Primary');
    expect(labels).toContain('Link');
    expect(labels).toContain('name');
    expect(labels).not.toContain('Hidden');
  });

  it('checks accessible hidden state correctly', () => {
    const visible = document.createElement('div');
    document.body.appendChild(visible);

    const hiddenByAria = document.createElement('div');
    hiddenByAria.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hiddenByAria);

    const srOnly = document.createElement('span');
    srOnly.classList.add('sr-only');
    document.body.appendChild(srOnly);

    expect(isAccessiblyHidden(visible)).toBe(false);
    expect(isAccessiblyHidden(hiddenByAria)).toBe(true);
    expect(isAccessiblyHidden(srOnly)).toBe(false);
  });

  it('calculates contrast ratio and WCAG thresholds', () => {
    const ratio = getContrastRatio('#000000', '#ffffff');
    expect(ratio).toBeGreaterThan(20);

    expect(meetsContrastRequirements('#000000', '#ffffff', 'AA', false)).toBe(true);
    expect(meetsContrastRequirements('#777777', '#888888', 'AA', false)).toBe(false);
  });

  it('generates deterministic IDs and hook IDs', () => {
    const idOne = generateId('region');
    const idTwo = generateId('region');

    expect(idOne).not.toBe(idTwo);
    expect(idOne.startsWith('region-')).toBe(true);

    const { result } = renderHook(() => useId('section'));
    expect(result.current.startsWith('section-')).toBe(true);
  });

  it('announces messages through live regions', async () => {
    render(
      <>
        <AriaAnnouncer />
        <span>ready</span>
      </>
    );

    const { result } = renderHook(() => useAnnouncer());

    vi.useFakeTimers();
    act(() => {
      result.current.announce('Update complete', 'polite');
      vi.advanceTimersByTime(60);
    });

    const politeRegion = document.getElementById('aria-announcer-polite');
    expect(politeRegion?.textContent).toBe('Update complete');
    vi.useRealTimers();
  });

  it('provides skip link behavior and focuses main content', () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">Main area</main>
      </>
    );

    const { result } = renderHook(() => useSkipLink());
    act(() => {
      result.current.skipToContent();
    });

    expect(document.activeElement?.id).toBe('main-content');
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content');
  });

  it('tracks roving tabindex and keyboard navigation', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    const third = document.createElement('button');
    document.body.append(first, second, third);

    const focusSpy = vi.spyOn(second, 'focus');

    const { result } = renderHook(() => useRovingTabindex([first, second, third]));

    act(() => {
      result.current.handleKeyDown(
        new KeyboardEvent('keydown', { key: KEYS.ARROW_DOWN })
      );
    });

    expect(result.current.currentIndex).toBe(1);
    expect(focusSpy).toHaveBeenCalled();
    expect(result.current.getTabIndex(1)).toBe(0);
  });

  it('reads reduced motion and high contrast preferences', () => {
    const matchMediaMock = vi.fn((query: string) => ({
      matches: query.includes('reduced-motion') || query.includes('contrast'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    vi.stubGlobal('matchMedia', matchMediaMock);

    const { result: reducedMotion } = renderHook(() => usePrefersReducedMotion());
    const { result: highContrast } = renderHook(() => usePrefersHighContrast());

    expect(reducedMotion.current).toBe(true);
    expect(highContrast.current).toBe(true);
  });

  it('returns visually hidden content unchanged for screen readers', () => {
    expect(visuallyHidden('Accessible label')).toBe('Accessible label');
  });
});
