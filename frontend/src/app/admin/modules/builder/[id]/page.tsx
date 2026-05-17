'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { BuilderCanvas } from '@/components/module-builder/BuilderCanvas';
import { ComponentToolbar } from '@/components/module-builder/ComponentToolbar';
import { PropertyPanel } from '@/components/module-builder/PropertyPanel';
import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { Loader2, ArrowLeft, Save, Eye, EyeOff, Undo2, Redo2, ZoomIn, ZoomOut, Layers, LayoutList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { modulesApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UIBlock } from '@/types/module-builder';

export default function ModuleBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { 
    setLayout, 
    layout, 
    setActiveModuleId, 
    isPreview,
    togglePreview,
    canvasMode,
    setCanvasMode,
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
  } = useModuleBuilderStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['module', id],
    queryFn: () => modulesApi.getById(id),
    staleTime: 0,
    refetchOnMount: 'always', // Force refetch on navigation to prevent stale blank state
  });

  const saveMutation = useMutation({
    mutationFn: (newLayout: UIBlock[]) => {
        // We save the layout inside the 'settings' JSONb column
        // Merging with existing settings to prevent data loss
        const currentSettings = data?.data?.data?.settings || {};
        return modulesApi.update(id, {
            settings: {
                ...currentSettings,
                layout: newLayout
            },
            settings_version: data?.data?.data?.settings_version
        });
    },
    onSuccess: () => {
      toast.success('Layout saved successfully');
      refetch(); // Refresh data after save to ensure consistency
    },
    onError: () => toast.error('Failed to save layout')
  });

  useEffect(() => {
    if (data?.data?.data) {
      setActiveModuleId(id);
      // Load layout from settings if it exists, otherwise empty
      // Use skipHistory=true to not add initial load to undo stack
      const savedLayout = data.data.data.settings?.layout || [];
      console.log('[ModuleBuilder] Loading layout from API:', savedLayout);
      setLayout(savedLayout, true); // Skip history for initial load
    }
  }, [data, id, setActiveModuleId, setLayout]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-red-500">Failed to load module</p>
          <p className="text-sm text-slate-500 mt-2">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
          <button
            onClick={() => router.push('/admin/modules')}
            className="mt-4 ml-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            Back to Modules
          </button>
        </div>
      </div>
    );
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{data?.data?.data?.name || 'Module Builder'}</h1>
            <p className="text-xs text-slate-500">Visual Editor</p>
          </div>
        </div>
        <div className="flex gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center border border-slate-300 rounded-lg dark:border-slate-600 overflow-hidden">
                <button
                    onClick={undo}
                    disabled={!canUndo()}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 className="h-4 w-4" />
                </button>
                <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
                <button
                    onClick={redo}
                    disabled={!canRedo()}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 className="h-4 w-4" />
                </button>
            </div>

            {/* Zoom */}
            <div className="flex items-center border border-slate-300 rounded-lg dark:border-slate-600 overflow-hidden">
                <button
                    onClick={() => setZoom(zoom - 10)}
                    disabled={zoom <= 50}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30"
                    title="Zoom Out"
                >
                    <ZoomOut className="h-4 w-4" />
                </button>
                <span className="px-2 text-sm font-medium min-w-[50px] text-center">{zoom}%</span>
                <button
                    onClick={() => setZoom(zoom + 10)}
                    disabled={zoom >= 150}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30"
                    title="Zoom In"
                >
                    <ZoomIn className="h-4 w-4" />
                </button>
            </div>


            <button
                onClick={togglePreview}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
                {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {isPreview ? 'Back to Edit' : 'Preview'}
            </button>
            <button 
                onClick={() => saveMutation.mutate(layout)}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Layout'}
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
                    <DynamicModuleRenderer layout={layout} module={data?.data?.data} />
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
