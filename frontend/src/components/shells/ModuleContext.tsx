'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { Module } from '@/lib/settings-context';
import type { EngineACapabilities, FulfillmentOption } from '@/lib/engine-a/types';

export interface ModuleWithLayout extends Module {
  settings?: Module['settings'] & {
    layout?: any[];
    fulfillment?: {
      required?: boolean;
      options?: FulfillmentOption[];
    };
  };
}

export interface ModuleContextValue {
  /** The resolved module object from settings/API (or null if loading / not found) */
  module: ModuleWithLayout | null;
  /** Normalized module slug */
  slug: string;
  /** Property slug from the route parameter */
  propertySlug: string;
  /** True while module or layout resolution is in flight */
  isLoading: boolean;
  /** True if module was found in system but is marked inactive (`is_active: false`) */
  isDisabled: boolean;
  /** True if module could not be found anywhere in the catalog */
  isNotFound: boolean;
  /** Canonical Engine A capability projection (derived from module definition & settings) */
  capabilities: EngineACapabilities | null;
  /** Custom visual builder layout blocks if present */
  layout: any[] | null;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

/**
 * Derives canonical Engine A capabilities from module metadata without hardcoding vertical rules.
 */
export function resolveEngineACapabilities(module: ModuleWithLayout | null): EngineACapabilities | null {
  if (!module) return null;

  // Only project Engine A capabilities for instant_transaction engines
  if (module.engine_type !== 'instant_transaction') {
    return null;
  }

  const customFulfillment = module.settings?.fulfillment;
  if (customFulfillment && Array.isArray(customFulfillment.options) && customFulfillment.options.length > 0) {
    return {
      fulfillment: {
        required: customFulfillment.required ?? true,
        options: customFulfillment.options,
      },
    };
  }

  // Canonical default options for Engine A (instant_transaction)
  return {
    fulfillment: {
      required: true,
      options: [
        { mode: 'on_premise', destinations: ['on_premise_location', 'room'] },
        { mode: 'pickup', destinations: ['pickup_location'] },
        { mode: 'local_delivery', destinations: ['address'] },
        { mode: 'digital_delivery', destinations: ['digital_account'] },
      ],
    },
  };
}

export interface ModuleProviderProps {
  module: ModuleWithLayout | null;
  slug: string;
  propertySlug: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  isNotFound?: boolean;
  children: React.ReactNode;
}

/**
 * ModuleProvider — Scoped Context Provider for the active module route (Phase F3).
 *
 * Established directly by the route component (`[property]/[slug]/page.tsx`) to
 * avoid duplicate fetch waterfalls or competing module loaders.
 */
export function ModuleProvider({
  module,
  slug,
  propertySlug,
  isLoading = false,
  isDisabled = false,
  isNotFound = false,
  children,
}: ModuleProviderProps) {
  const capabilities = useMemo(() => resolveEngineACapabilities(module), [module]);
  const layout = useMemo(() => {
    if (module?.settings?.layout && Array.isArray(module.settings.layout) && module.settings.layout.length > 0) {
      return module.settings.layout;
    }
    return null;
  }, [module?.settings?.layout]);

  const value = useMemo<ModuleContextValue>(() => ({
    module,
    slug,
    propertySlug,
    isLoading,
    isDisabled,
    isNotFound,
    capabilities,
    layout,
  }), [module, slug, propertySlug, isLoading, isDisabled, isNotFound, capabilities, layout]);

  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  );
}

/**
 * Hook to consume the current module context in child presentation shells.
 */
export function useModuleContext(): ModuleContextValue {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModuleContext must be used within a ModuleProvider');
  }
  return context;
}

export default ModuleContext;
