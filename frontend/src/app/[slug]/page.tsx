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

export default function ModulePage() {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const params = useParams();

  const router = useRouter();
  const { modules, loading: isLoading } = useSiteSettings();
  const [slug, setSlug] = useState<string>('');
  const [allModules, setAllModules] = useState<any[]>([]);

  // Fetch all modules (including inactive) to check if module exists but is disabled
  useEffect(() => {
    const fetchAllModules = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/modules`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  // Check if module is active (case-insensitive comparison)
  const currentModule = modules.find((m) => m.slug.toLowerCase() === slug);
  
  // Check if module exists but is disabled
  const disabledModule = !currentModule && allModules.find((m) => m.slug.toLowerCase() === slug && !m.is_active);

  if (disabledModule) {
    // Module exists but is disabled - show friendly message
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {t('featureUnavailable')}
          </h1>
          <p className="text-slate-400 mb-6">
            {t('featureUnavailableDesc', { name: disabledModule.name })}
          </p>
          <button 
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            {tCommon('returnHome')}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentModule) {
    // Module not found at all - 404
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-slate-300 mb-3">{t('pageNotFound')}</h2>
          <p className="text-slate-400 mb-6">
            {t('pageNotFoundDesc')}
          </p>
          <button 
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            {tCommon('returnHome')}
          </button>
        </motion.div>
      </div>
    );
  }

  // Check if module has a custom layout defined
  if (currentModule.settings?.layout && Array.isArray(currentModule.settings.layout) && currentModule.settings.layout.length > 0) {
    return <DynamicModuleRenderer layout={currentModule.settings.layout} module={currentModule} />;
  }

  // Fallback to legacy hardcoded templates
  switch (currentModule.template_type) {
    case 'menu_service':
      return <MenuService module={currentModule} />;
    case 'multi_day_booking':
      return <BookingService module={currentModule} />;
    case 'session_access':
      return <SessionService module={currentModule} />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p>Unknown module type: {currentModule.template_type}</p>
        </div>
      );
  }
}
