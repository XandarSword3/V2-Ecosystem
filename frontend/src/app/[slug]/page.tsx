'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSiteSettings } from '@/lib/settings-context';
import { MenuService } from '@/components/modules/MenuService';
import { BookingService } from '@/components/modules/BookingService';
import { SessionService } from '@/components/modules/SessionService';
import { Loader2, AlertCircle, Home } from 'lucide-react';
import { motion } from 'framer-motion';

import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

interface ModuleWithLayout {
  id: string;
  template_type: 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access' | 'ongoing_entitlement';
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  settings?: {
    layout?: any[];
    showInNavigation?: boolean;
    icon?: string;
    theme?: string;
    primaryColor?: string;
    [key: string]: any;
  };
}

export default function ModulePage() {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const params = useParams();

  const router = useRouter();
  const { modules: cachedModules, loading: isLoading } = useSiteSettings();
  const [slug, setSlug] = useState<string>('');
  const [allModules, setAllModules] = useState<any[]>([]);
  const [moduleWithLayout, setModuleWithLayout] = useState<ModuleWithLayout | null>(null);
  const [fetchingLayout, setFetchingLayout] = useState(false);

  // Fetch all modules (including inactive) to check if module exists but is disabled
  useEffect(() => {
    const fetchAllModules = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/api/modules`);
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
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
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

  if (isLoading || fetchingLayout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  // Check if module is active (case-insensitive comparison)
  // Prefer moduleWithLayout (has full settings from API) over cachedModules
  const currentModule = moduleWithLayout || cachedModules.find((m) => m.slug.toLowerCase() === slug);
  
  // Check if module exists but is disabled
  const disabledModule = !currentModule && allModules.find((m) => m.slug.toLowerCase() === slug && !m.is_active);

  if (disabledModule) {
    // Module exists but is disabled - show friendly message
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
            {t('featureUnavailableDesc', { name: disabledModule.name })}
          </p>
          <Button onClick={() => router.push('/')} className="gap-2">
            <Home className="w-5 h-5" />
            {tCommon('returnHome')}
          </Button>
        </motion.div>
        </Container>
      </div>
    );
  }

  if (!currentModule) {
    // Module not found at all - 404
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
          <Button onClick={() => router.push('/')} className="gap-2">
            <Home className="w-5 h-5" />
            {tCommon('returnHome')}
          </Button>
        </motion.div>
        </Container>
      </div>
    );
  }

  // Check if module has a custom layout defined
  if (currentModule.settings?.layout && Array.isArray(currentModule.settings.layout) && currentModule.settings.layout.length > 0) {
    return <DynamicModuleRenderer layout={currentModule.settings.layout} module={currentModule} />;
  }

  // Fallback to legacy hardcoded templates for modules that have no custom layout.
  // Maps real engine types → nearest legacy component.
  switch (currentModule.template_type) {
    case 'instant_transaction':
      return <MenuService module={currentModule} />;
    case 'time_exclusive_reservation':
      return <BookingService module={currentModule} />;
    case 'shared_capacity_access':
      return <SessionService module={currentModule} />;
    case 'ongoing_entitlement':
      // No dedicated legacy component yet — fall through to generic message.
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p>Module type &quot;{currentModule.template_type}&quot; has no default renderer. Build a layout in the Visual Builder.</p>
        </div>
      );
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p>Unknown module type: {currentModule.template_type}</p>
        </div>
      );
  }
}
