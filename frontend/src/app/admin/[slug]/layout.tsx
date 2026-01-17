
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSiteSettings } from '@/lib/settings-context';
import { Loader2 } from 'lucide-react';

export default function DynamicModuleLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { modules, loading } = useSiteSettings();
  const [currentModule, setCurrentModule] = useState<any>(null);

  useEffect(() => {
    if (!loading && modules.length > 0 && params?.slug) {
      const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
      const decodedSlug = slug ? decodeURIComponent(slug).toLowerCase() : '';
      const foundModule = modules.find(m => m.slug.toLowerCase() === decodedSlug);
      
      if (foundModule) {
        setCurrentModule(foundModule);
      } else {
        // Module not found
        router.push('/admin');
      }
    }
  }, [loading, modules, params, router]);

  if (loading || !currentModule) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
