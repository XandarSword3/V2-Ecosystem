
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSiteSettings } from '@/lib/settings-context';
import { Loader2 } from 'lucide-react';

export default function DynamicModuleLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const propertySlug = (params?.property as string) || '';
  const { modules, loading } = useSiteSettings();
  const [currentModule, setCurrentModule] = useState<any>(null);
  const [moduleNotFound, setModuleNotFound] = useState(false);

  useEffect(() => {
    // Only check module after loading is complete AND we have modules
    if (!loading && params?.slug) {
      const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
      const decodedSlug = slug ? decodeURIComponent(slug).toLowerCase() : '';
      const foundModule = modules.find(m => m.slug.toLowerCase() === decodedSlug);
      
      if (foundModule) {
        setCurrentModule(foundModule);
        setModuleNotFound(false);
      } else if (modules.length > 0) {
        // Only redirect if we have modules loaded but this one doesn't exist
        // This prevents redirect loops during initial load
        setModuleNotFound(true);
        console.warn(`Module not found: ${decodedSlug}, available: ${modules.map(m => m.slug).join(', ')}`);
        router.replace(`/${propertySlug}/admin`);
      }
      // If modules.length === 0, we're still loading, don't redirect
    }
  }, [loading, modules, params, router]);

  // Show loading while settings are loading or module is being resolved
  if (loading || (!currentModule && !moduleNotFound)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // If module not found after loading, show error (redirect will happen)
  if (moduleNotFound) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Module not found. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentModule.name}</h1>
          <p className="text-muted-foreground">{currentModule.description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
