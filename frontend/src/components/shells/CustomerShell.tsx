import React from 'react';
import { ThemeInjector } from '@/components/ThemeInjector';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface CustomerShellProps {
  children: React.ReactNode;
  className?: string;
  showSkipLink?: boolean;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

/**
 * CustomerShell — Global customer presentation shell (Phase F3).
 *
 * Responsibilities:
 * - Theme/brand injection wrapper (`ThemeInjector`)
 * - Accessibility skip link (`#main-content`)
 * - Presentation error boundary for customer surfaces
 * - Optional header and footer layout slots
 * - Responsive layout container
 *
 * Explicit Non-Responsibilities (F3 Law):
 * - NO cart arithmetic or discount calculations
 * - NO fulfillment selection logic or order state machines
 * - NO catalog querying or inventory management
 */
export function CustomerShell({
  children,
  className = '',
  showSkipLink = true,
  headerSlot,
  footerSlot,
}: CustomerShellProps) {
  return (
    <div className={`customer-shell min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300 ${className}`}>
      {/* Brand theme CSS variables injection */}
      <ThemeInjector />

      {/* Accessibility Skip Link */}
      {showSkipLink && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Skip to main content
        </a>
      )}

      {/* Optional Top Header Slot */}
      {headerSlot && <header className="customer-shell-header">{headerSlot}</header>}

      {/* Main Content Area with Error Boundary */}
      <main id="main-content" className="customer-shell-main flex-1 w-full" tabIndex={-1}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Optional Footer Slot */}
      {footerSlot && <footer className="customer-shell-footer">{footerSlot}</footer>}
    </div>
  );
}

export default CustomerShell;
