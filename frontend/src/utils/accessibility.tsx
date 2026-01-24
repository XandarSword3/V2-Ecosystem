/**
 * V2 Resort - Accessibility Utilities
 * Helpers for ensuring WCAG 2.1 AA compliance
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Keyboard navigation keys
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Hook for managing focus trap within a container
 * Essential for modals, dialogs, and dropdowns
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Store the element that had focus before opening
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus first element
    firstElement.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== KEYS.TAB) return;

      // Shift + Tab from first element -> go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab from last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus when unmounting
      previouslyFocused?.focus?.();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for roving tabindex in lists (menus, tabs, etc.)
 */
export function useRovingTabindex<T extends HTMLElement>(
  items: T[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
  } = {}
) {
  const { orientation = 'vertical', loop = true } = options;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      let newIndex = currentIndex;

      if (
        (isVertical && e.key === KEYS.ARROW_DOWN) ||
        (isHorizontal && e.key === KEYS.ARROW_RIGHT)
      ) {
        e.preventDefault();
        newIndex = loop
          ? (currentIndex + 1) % items.length
          : Math.min(currentIndex + 1, items.length - 1);
      } else if (
        (isVertical && e.key === KEYS.ARROW_UP) ||
        (isHorizontal && e.key === KEYS.ARROW_LEFT)
      ) {
        e.preventDefault();
        newIndex = loop
          ? (currentIndex - 1 + items.length) % items.length
          : Math.max(currentIndex - 1, 0);
      } else if (e.key === KEYS.HOME) {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === KEYS.END) {
        e.preventDefault();
        newIndex = items.length - 1;
      }

      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        items[newIndex]?.focus();
      }
    },
    [currentIndex, items, loop, orientation]
  );

  useEffect(() => {
    items.forEach((item, index) => {
      item.tabIndex = index === currentIndex ? 0 : -1;
    });
  }, [items, currentIndex]);

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === currentIndex ? 0 : -1),
  };
}

/**
 * Hook for announcements to screen readers
 */
export function useAnnouncer() {
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      const announcer = document.getElementById(`aria-announcer-${priority}`);
      if (announcer) {
        announcer.textContent = '';
        // Small delay ensures the change is announced
        setTimeout(() => {
          announcer.textContent = message;
        }, 50);
      }
    },
    []
  );

  return { announce };
}

/**
 * Component: Live region announcer
 * Add this once in your app root
 */
export function AriaAnnouncer() {
  return (
    <>
      <div
        id="aria-announcer-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="aria-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}

/**
 * Hook for skip link functionality
 */
export function useSkipLink() {
  const skipToContent = useCallback(() => {
    const main = document.querySelector('main') || document.getElementById('main-content');
    if (main) {
      main.tabIndex = -1;
      main.focus();
      main.addEventListener(
        'blur',
        () => {
          main.removeAttribute('tabindex');
        },
        { once: true }
      );
    }
  }, []);

  return { skipToContent };
}

/**
 * Component: Skip to main content link
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {children}
    </a>
  );
}

/**
 * Hook for reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for high contrast preference
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    setPrefersHighContrast(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersHighContrast;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => {
      // Filter out elements that are not visible
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );
}

/**
 * Generate unique IDs for accessibility attributes
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Hook for unique IDs
 */
export function useId(prefix: string = 'a11y'): string {
  const [id] = useState(() => generateId(prefix));
  return id;
}

/**
 * Format text for screen readers (visually hidden)
 */
export function visuallyHidden(text: string): string {
  return text;
}

/**
 * Check if an element is visible to assistive technology
 */
export function isAccessiblyHidden(element: HTMLElement): boolean {
  if (element.getAttribute('aria-hidden') === 'true') return true;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return true;

  // Check if it has sr-only class
  if (element.classList.contains('sr-only')) return false; // sr-only is for visual hiding only

  return false;
}

/**
 * Color contrast checker
 * Returns contrast ratio (WCAG requires 4.5:1 for normal text, 3:1 for large text)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    // Apply gamma correction
    const adjust = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG requirements
 */
export function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);

  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }

  // AA level
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * CSS classes for screen reader only content
 */
export const srOnlyStyles = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

/**
 * Tailwind class for screen reader only
 */
export const srOnlyClass = 'sr-only';

/**
 * Tailwind class for screen reader only but focusable
 */
export const srOnlyFocusableClass = 'sr-only focus:not-sr-only';
