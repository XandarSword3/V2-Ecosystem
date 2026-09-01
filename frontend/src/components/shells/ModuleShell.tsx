'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Home } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { useModuleContext } from './ModuleContext';

export interface ModuleShellProps {
  children?: React.ReactNode;
  className?: string;
  breadcrumbsSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
}

/**
 * ModuleShell — Presentation & status framing shell for active module views (Phase F3).
 *
 * Responsibilities:
 * - Presentation framing for loading, inactive, 404, and active module states
 * - Consumes `ModuleContext` (does NOT duplicate module fetching or resolution)
 * - Renders breadcrumbs, title slots, and child views
 *
 * Explicit Non-Responsibilities:
 * - Does NOT fetch or resolve modules independently
 * - Does NOT make routing decisions on behalf of engines
 */
export function ModuleShell({
  children,
  className = '',
  breadcrumbsSlot,
  headerSlot,
}: ModuleShellProps) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { module, propertySlug, isLoading, isDisabled, isNotFound } = useModuleContext();

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="module-shell-loading min-h-[60vh] flex flex-col items-center justify-center bg-background p-6">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mb-4" />
        <p className="text-sm text-muted-foreground animate-pulse">{tCommon('loading') || 'Loading...'}</p>
      </div>
    );
  }

  // 2. Disabled / Inactive Module State
  if (isDisabled) {
    return (
      <div className="module-shell-disabled min-h-[60vh] flex items-center justify-center bg-background">
        <Container size="sm" className="w-full py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              {t('featureUnavailable')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('featureUnavailableDesc', { name: module?.name || 'This service' })}
            </p>
            <Button onClick={() => router.push(`/${propertySlug}`)} className="gap-2">
              <Home className="w-5 h-5" />
              {tCommon('returnHome')}
            </Button>
          </motion.div>
        </Container>
      </div>
    );
  }

  // 3. Module Not Found (404) State
  if (isNotFound || !module) {
    return (
      <div className="module-shell-not-found min-h-[60vh] flex items-center justify-center bg-background">
        <Container size="sm" className="w-full py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-muted-foreground mb-3">{t('pageNotFound')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('pageNotFoundDesc')}
            </p>
            <Button onClick={() => router.push(`/${propertySlug}`)} className="gap-2">
              <Home className="w-5 h-5" />
              {tCommon('returnHome')}
            </Button>
          </motion.div>
        </Container>
      </div>
    );
  }

  // 4. Active Module Framing
  return (
    <div className={`module-shell w-full ${className}`}>
      {/* Optional Breadcrumbs */}
      {breadcrumbsSlot && (
        <nav aria-label="Breadcrumbs" className="module-shell-breadcrumbs py-3 px-4 sm:px-6 max-w-7xl mx-auto">
          {breadcrumbsSlot}
        </nav>
      )}

      {/* Optional Module Header Slot */}
      {headerSlot && (
        <div className="module-shell-header border-b border-border/40 bg-card/50 backdrop-blur-sm">
          <Container size="lg" className="py-6">
            {headerSlot}
          </Container>
        </div>
      )}

      {/* Main Module Content */}
      <div className="module-shell-content w-full">
        {children}
      </div>
    </div>
  );
}

export default ModuleShell;
