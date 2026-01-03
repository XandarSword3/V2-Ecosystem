'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings-context';
import { MenuService } from '@/components/modules/MenuService';
import { BookingService } from '@/components/modules/BookingService';
import { SessionService } from '@/components/modules/SessionService';
import { Loader2 } from 'lucide-react';

export default function ModulePage() {
  const params = useParams();
  const router = useRouter();
  const { modules, isLoading } = useSettings();
  const [slug, setSlug] = useState<string>('');

  useEffect(() => {
    if (params?.slug) {
      setSlug(Array.isArray(params.slug) ? params.slug[0] : params.slug);
    }
  }, [params]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  const module = modules.find((m) => m.slug === slug);

  if (!module) {
    // If module not found, it might be a 404 or we are still syncing
    // For now, let's show a simple not found or redirect
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <button 
          onClick={() => router.push('/')}
          className="text-primary-600 hover:underline"
        >
          Return Home
        </button>
      </div>
    );
  }

  // Render the appropriate component based on template type
  switch (module.template_type) {
    case 'menu_service':
      return <MenuService module={module} />;
    case 'multi_day_booking':
      return <BookingService module={module} />;
    case 'session_access':
      return <SessionService module={module} />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p>Unknown module type: {module.template_type}</p>
        </div>
      );
  }
}
