'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { SessionAccessDashboard } from '@/components/staff/SessionAccessDashboard';
import { KitchenView } from '@/components/staff/KitchenView';
import { MultiDayBookingDashboard } from './components/MultiDayBookingDashboard';

export default function ModulePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState<string>('');
  const [templateType, setTemplateType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await api.get(`/admin/modules/${slug}`);
        if (response.data.success) {
            setModuleId(response.data.data.id);
            setModuleName(response.data.data.name);
            setTemplateType(response.data.data.template_type);
        }
      } catch (error) {
        console.error('Failed to fetch module:', error);
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
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!moduleId) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <p className="text-gray-500">Module not found.</p>
          </div>
      );
  }

  if (templateType === 'menu_service') {
      return <KitchenView slug={slug} moduleName={moduleName} moduleId={moduleId} />;
  }

  if (templateType === 'session_access') {
      return <SessionAccessDashboard slug={slug} moduleName={moduleName} />;
  }
  
  if (templateType === 'multi_day_booking') {
       return <MultiDayBookingDashboard slug={slug} moduleName={moduleName} moduleId={moduleId} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Unsupported Module Type: {templateType}</p>
    </div>
  );
}
