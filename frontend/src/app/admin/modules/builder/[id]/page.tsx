'use client';

import { useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useModuleBuilderStore } from '@/store/module-builder-store';
import { BuilderCanvas } from '@/components/module-builder/BuilderCanvas';
import { ComponentToolbar } from '@/components/module-builder/ComponentToolbar';
import { PropertyPanel } from '@/components/module-builder/PropertyPanel';
import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import { Loader2, ArrowLeft, Save, Eye, EyeOff, Undo2, Redo2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
    togglePreview,
    zoom,
    setZoom,
    undo,
    redo,
    canUndo,
    canRedo,
    removeBlock,
  } = useModuleBuilderStore();

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['module', id],
    queryFn: () => modulesApi.getById(id),
  });
  
  // Extract the actual module data from the API response
  const moduleData = queryData?.data?.data || queryData?.data;

  const saveMutation = useMutation({
    mutationFn: (newLayout: UIBlock[]) => {
        // We save the layout inside the 'settings' JSONb column
        // Merging with existing settings to prevent data loss
        const currentSettings = moduleData?.settings || {};
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

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) undo();
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo()) redo();
    }
    
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveMutation.mutate(layout);
    }
    
    // Delete/Backspace = Remove selected block
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
      e.preventDefault();
      removeBlock(selectedBlockId);
    }
    
    // Escape = Deselect
    if (e.key === 'Escape') {
      useModuleBuilderStore.getState().selectBlock(null);
    }
  }, [canUndo, canRedo, undo, redo, saveMutation, layout, selectedBlockId, removeBlock]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (moduleData) {
      console.log('[Builder] Loading module data:', moduleData.name, 'Layout:', moduleData.settings?.layout);
      setActiveModuleId(id);
      // Load existing layout from settings if it exists
      const savedLayout = moduleData.settings?.layout || [];
      console.log('[Builder] Setting layout:', savedLayout);
      // Use skipHistory=true to not add initial load to undo stack
      setLayout(savedLayout, true);
    }
  }, [moduleData, id, setActiveModuleId, setLayout]);

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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{moduleData?.name || tc('builder.title')}</h1>
            <p className="text-xs text-slate-500">{tc('builder.visualEditor')}</p>
          </div>
        </div>
        <div className="flex gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center border-r border-slate-200 dark:border-slate-600 pr-2 mr-2">
              <button
                onClick={undo}
                disabled={!canUndo()}
                title="Undo (Ctrl+Z)"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                title="Redo (Ctrl+Shift+Z)"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-600 pr-2 mr-2">
              <button
                onClick={() => setZoom(zoom - 10)}
                disabled={zoom <= 50}
                title="Zoom Out"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(zoom + 10)}
                disabled={zoom >= 150}
                title="Zoom In"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(100)}
                title="Reset Zoom"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
            
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
                    <DynamicModuleRenderer layout={layout} module={moduleData} />
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
