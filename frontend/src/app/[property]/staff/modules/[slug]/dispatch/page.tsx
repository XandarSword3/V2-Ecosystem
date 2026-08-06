'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { DispatchBoard } from '@/components/staff/DispatchBoard';

interface ModuleData {
  id: string;
  name: string;
  slug: string;
  engine_type: string;
  is_active: boolean;
}

export default function DispatchPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug ?? '');
  const [module, setModule] = useState<ModuleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await api.get(`/admin/modules/${slug}`);
        if (response.data.success) {
          setModule(response.data.data);
        } else {
          setError('Module not found');
        }
      } catch (err) {
        console.error('Failed to fetch module:', err);
        setError('Failed to load module details');
        toast.error('Failed to load module details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModule();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-2">{error ?? 'Module not found'}</p>
          <p className="text-gray-400 text-sm">Slug: {slug}</p>
        </div>
      </div>
    );
  }

  // Dispatch only exists for instant_transaction (Engine A) right now — the
  // other engines (reservations, session access, entitlements) don't have a
  // ready/served hand-off step at all, so there's nothing for this board to
  // show them. Matches the guard already on the backend (getModuleOrders
  // rejects non-instant_transaction/menu_service modules the same way).
  if (module.engine_type !== 'instant_transaction') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Dispatch isn&apos;t applicable to this module type.</p>
          <p className="text-gray-400 text-sm mt-1">{module.name}</p>
        </div>
      </div>
    );
  }

  if (!module.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">This module is currently disabled.</p>
          <p className="text-gray-400 text-sm mt-1">{module.name}</p>
        </div>
      </div>
    );
  }

  return <DispatchBoard slug={slug} moduleName={module.name} moduleId={module.id} />;
}
