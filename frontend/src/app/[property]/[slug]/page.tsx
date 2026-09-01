'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSiteSettings } from '@/lib/settings-context';
import { MenuService } from '@/components/modules/MenuService';
import { BookingService } from '@/components/modules/BookingService';
import { SessionService } from '@/components/modules/SessionService';
import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { ModuleProvider, ModuleWithLayout } from '@/components/shells/ModuleContext';
import { ModuleShell } from '@/components/shells/ModuleShell';
import { CommerceShell } from '@/components/shells/CommerceShell';

export default function ModulePage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  const { modules: cachedModules, loading: isLoading } = useSiteSettings();
  const [slug, setSlug] = useState<string>('');
  const [allModules, setAllModules] = useState<any[]>([]);
  const [moduleWithLayout, setModuleWithLayout] = useState<ModuleWithLayout | null>(null);
  const [fetchingLayout, setFetchingLayout] = useState(false);

  // Fetch all modules (including inactive) to check if module exists but is disabled
  useEffect(() => {
    const fetchAllModules = async () => {
      try {
        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const apiUrl = rawBaseUrl.replace(/\/api\/?$/, '');
        const response = await fetch(`${apiUrl}/api/modules`);
        if (response.ok) {
          const data = await response.json();
          setAllModules(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch all modules:', error);
      }
    };
    fetchAllModules();
  }, []);

  useEffect(() => {
    if (params?.slug) {
      // Decode and normalize the slug for comparison
      const rawSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
      setSlug(decodeURIComponent(rawSlug).toLowerCase());
    }
  }, [params]);

  // Fetch full module details including settings.layout
  useEffect(() => {
    const fetchModuleDetails = async () => {
      if (!slug) return;
      
      // First check if we have it in cache with layout
      const cached = cachedModules.find((m) => m.slug.toLowerCase() === slug);
      if (cached?.settings?.layout) {
        setModuleWithLayout(cached as ModuleWithLayout);
        return;
      }
      
      // Otherwise fetch from API
      setFetchingLayout(true);
      try {
        const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
        const res = await fetch(`${baseUrl}/api/modules/${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setModuleWithLayout(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch module details:', error);
      } finally {
        setFetchingLayout(false);
      }
    };
    
    fetchModuleDetails();
  }, [slug, cachedModules]);

  // Check if module is active (case-insensitive comparison)
  // Prefer moduleWithLayout (has full settings from API) over cachedModules
  const currentModule = moduleWithLayout || cachedModules.find((m) => m.slug.toLowerCase() === slug);
  
  // Check if module exists but is disabled
  const disabledModule = !currentModule && allModules.find((m) => m.slug.toLowerCase() === slug && !m.is_active);

  const isDataLoading = isLoading || fetchingLayout;
  const isNotFound = !isDataLoading && !currentModule && !disabledModule;

  // Render the appropriate renderer inside ModuleShell
  const renderModuleContent = () => {
    if (!currentModule) return null;

    // 1. Custom Visual Builder layout (preserved unchanged)
    if (currentModule.settings?.layout && Array.isArray(currentModule.settings.layout) && currentModule.settings.layout.length > 0) {
      return <DynamicModuleRenderer layout={currentModule.settings.layout} module={currentModule} propertySlug={propertySlug} />;
    }

    // 2. Fallback to canonical engine renderers
    switch (currentModule.engine_type) {
      case 'instant_transaction':
        return (
          <CommerceShell>
            <MenuService module={currentModule} />
          </CommerceShell>
        );
      case 'time_exclusive_reservation':
        return <BookingService module={currentModule} />;
      case 'shared_capacity_access':
        return <SessionService module={currentModule} />;
      case 'ongoing_entitlement':
        return (
          <div className="min-h-[40vh] flex items-center justify-center p-8 text-center text-muted-foreground">
            <p>Module type &quot;{currentModule.engine_type}&quot; has no default renderer. Build a layout in the Visual Builder.</p>
          </div>
        );
      default:
        return (
          <div className="min-h-[40vh] flex items-center justify-center p-8 text-center text-muted-foreground">
            <p>Unknown module type: {currentModule.engine_type}</p>
          </div>
        );
    }
  };

  return (
    <ModuleProvider
      module={(currentModule as ModuleWithLayout) || (disabledModule as ModuleWithLayout) || null}
      slug={slug}
      propertySlug={propertySlug}
      isLoading={isDataLoading}
      isDisabled={Boolean(disabledModule)}
      isNotFound={isNotFound}
    >
      <ModuleShell>
        {renderModuleContent()}
      </ModuleShell>
    </ModuleProvider>
  );
}
