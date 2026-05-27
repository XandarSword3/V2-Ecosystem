'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { SessionAccessDashboard } from '@/components/staff/SessionAccessDashboard';
import { KitchenView } from '@/components/staff/KitchenView';
import { MultiDayBookingDashboard } from './components/MultiDayBookingDashboard';
import { MembershipDashboard } from '@/components/staff/MembershipDashboard';
import { GenericModuleDashboard } from '@/components/staff/GenericModuleDashboard';

interface ModuleData {
  id: string;
  name: string;
  slug: string;
  template_type: string;
  description?: string;
  is_active: boolean;
}

export default function ModulePage() {
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

  // Route to the correct staff dashboard based on template_type
  switch (module.template_type) {
    case 'instant_transaction':
      return <KitchenView slug={slug} moduleName={module.name} moduleId={module.id} />;

    case 'shared_capacity_access':
      return <SessionAccessDashboard slug={slug} moduleName={module.name} />;

    case 'time_exclusive_reservation':
      return <MultiDayBookingDashboard slug={slug} moduleName={module.name} moduleId={module.id} />;

    case 'ongoing_entitlement':
      // Pool memberships, gym memberships, season passes, VIP clubs
      return <MembershipDashboard slug={slug} moduleName={module.name} moduleId={module.id} />;

    default:
      // Generic fallback — shows module info and allows basic management
      // Prevents the "blank page" problem for newly created modules
      return (
        <GenericModuleDashboard
          slug={slug}
          moduleName={module.name}
          moduleId={module.id}
          templateType={module.template_type}
          description={module.description}
        />
      );
  }
}
