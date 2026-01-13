'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useModuleBuilderStore } from '@/store/module-builder-store';
import { BuilderCanvas } from '@/components/module-builder/BuilderCanvas';
import { ComponentToolbar } from '@/components/module-builder/ComponentToolbar';
import { PropertyPanel } from '@/components/module-builder/PropertyPanel';
import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { Loader2, ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { modulesApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UIBlock } from '@/types/module-builder';

export default function ModuleBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const tc = useTranslations('adminCommon');
  const id = params.id as string;
  
  const { 
    setLayout, 
    layout, 
    setActiveModuleId, 
    selectedBlockId,
    isPreview,
    togglePreview
  } = useModuleBuilderStore();

  const { data, isLoading } = useQuery({
    queryKey: ['module', id],
    queryFn: () => modulesApi.getById(id),
  });

  const saveMutation = useMutation({
    mutationFn: (newLayout: UIBlock[]) => {
        // We save the layout inside the 'settings' JSONb column
        // Merging with existing settings to prevent data loss
        const currentSettings = data?.data?.settings || {};
        return modulesApi.update(id, {
            settings: {
                ...currentSettings,
                layout: newLayout
            }
        });
    },
    onSuccess: () => toast.success(tc('builder.layoutSaved')),
    onError: () => toast.error(tc('builder.layoutSaveFailed'))
  });

  useEffect(() => {
    if (data?.data) {
      setActiveModuleId(id);
      // Load layout from settings if it exists, otherwise empty
      const savedLayout = data.data.settings?.layout || [];
      setLayout(savedLayout);
    }
  }, [data, id, setActiveModuleId, setLayout]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{data?.data?.name || tc('builder.title')}</h1>
            <p className="text-xs text-slate-500">{tc('builder.visualEditor')}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button
                onClick={togglePreview}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
                {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {isPreview ? tc('builder.backToEdit') : tc('builder.preview')}
            </button>
            <button 
                onClick={() => saveMutation.mutate(layout)}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? tc('saving') : tc('builder.saveLayout')}
            </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Render Canvas */}
         <main className={`flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950/50 ${isPreview ? 'p-0' : 'p-8'}`}>
            {isPreview ? (
                 <div className="bg-white dark:bg-slate-900 min-h-full">
                    {/* Pass current layout state to renderer for live preview */}
                    <DynamicModuleRenderer layout={layout} module={data?.data} />
                 </div>
            ) : (
                <div className="mx-auto max-w-5xl rounded-xl bg-white min-h-[600px] shadow-lg dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <BuilderCanvas />
                </div>
            )}
        </main>

        {/* Right Sidebar: Properties */}
        {!isPreview && (
            <aside className="w-80 border-l bg-white dark:bg-slate-800 dark:border-slate-700">
                <PropertyPanel />
            </aside>
        )}
      </div>

      {/* Bottom Bar: Components */}
      {!isPreview && (
          <div className="h-20 border-t bg-white px-6 shadow-up dark:bg-slate-800 dark:border-slate-700">
            <ComponentToolbar />
          </div>
      )}
    </div>
  );
}
