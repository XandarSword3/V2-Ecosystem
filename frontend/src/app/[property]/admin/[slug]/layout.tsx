
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useSiteSettings } from '@/lib/settings-context';
import { Loader2 } from 'lucide-react';
import { adminSubPath, ownerEnginesFor, ENGINE_LABELS } from '@/lib/engine-a/page-routing';
import type { EngineType } from '@/lib/engine-a/types';

export default function DynamicModuleLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
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

  // Engine-aware route gating: an admin sub-page only renders when this
  // module's engine_type owns it. Prevents Engine A modules deep-linking
  // into Engine B surfaces (pricing → /units/price-rules, addons →
  // accommodation_add_ons) and vice versa.
  const engineType = currentModule?.engine_type as EngineType | undefined;
  const ownerEngines = ownerEnginesFor(adminSubPath(pathname ?? ''));
  const wrongEngine =
    engineType && ownerEngines !== null && !ownerEngines.includes(engineType);

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

  // If the requesting sub-page belongs to another engine, block it here
  // rather than rendering a page wired to someone else's data model.
  if (wrongEngine && engineType) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{currentModule.name}</h1>
            <p className="text-muted-foreground">{currentModule.description}</p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-lg font-medium">Page not available for this module</p>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            This admin page belongs to{' '}
            {ownerEngines!.map((e) => ENGINE_LABELS[e]).join(' / ')} — not to{' '}
            {ENGINE_LABELS[engineType]}. Open this module&apos;s dashboard to
            manage it with the surfaces for its own engine.
          </p>
          <button
            type="button"
            className="mt-4 text-primary-600 hover:underline"
            onClick={() => router.push(`/${propertySlug}/admin/${encodeURIComponent(currentModule.slug)}`)}
          >
            Back to module dashboard
          </button>
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
