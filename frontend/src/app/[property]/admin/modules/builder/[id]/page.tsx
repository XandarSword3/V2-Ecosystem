'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { BuilderCanvasV2 } from '@/components/module-builder/BuilderCanvasV2';
import { ComponentToolbarV2 } from '@/components/module-builder/ComponentToolbarV2';
import { PropertyPanelV2 } from '@/components/module-builder/PropertyPanelV2';
import { LayersPanel } from '@/components/module-builder/LayersPanel';
import { DynamicModuleRenderer } from '@/components/module-builder/DynamicModuleRenderer';
import {
  Loader2, ArrowLeft, Save, Eye, EyeOff,
  Undo2, Redo2, ZoomIn, ZoomOut, Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { modulesApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UIBlock } from '@/types/module-builder';

// ─── Zoom bounds ──────────────────────────────────────────────────────────────
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;

export default function ModuleBuilderPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';
  const router = useRouter();
  const id = params.id as string;

  const {
    setLayout,
    layout,
    setActiveModuleId,
    isPreview,
    togglePreview,
    previewDevice,
    setPreviewDevice,
    undo, redo, canUndo, canRedo,
    zoom, setZoom,
  } = useModuleBuilderStore();

  // LayersPanel collapsed state — persisted in component state only
  const [layersPanelOpen, setLayersPanelOpen] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['module', id],
    queryFn: () => modulesApi.getById(id),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const saveMutation = useMutation({
    mutationFn: (newLayout: UIBlock[]) => {
      const currentSettings = data?.data?.data?.settings || {};
      return modulesApi.update(id, {
        settings: { ...currentSettings, layout: newLayout },
        settings_version: data?.data?.data?.settings_version,
      });
    },
    onSuccess: () => {
      toast.success('Layout saved successfully');
      refetch();
    },
    onError: () => toast.error('Failed to save layout'),
  });

  useEffect(() => {
    if (data?.data?.data) {
      setActiveModuleId(id);
      const savedLayout = data.data.data.settings?.layout || [];
      console.log('[ModuleBuilder] Loading layout from API:', savedLayout);
      setLayout(savedLayout, true);
    }
  }, [data, id, setActiveModuleId, setLayout]);

  // ─── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
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
            onClick={() => router.push(`/${propertySlug}/admin/modules`)}
            className="mt-4 ml-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            Back to Modules
          </button>
        </div>
      </div>
    );
  }

  const moduleData = data?.data?.data;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {moduleData?.name || 'Module Builder'}
            </h1>
            <p className="text-xs text-slate-500">
              Visual Editor <span className="ml-1 text-indigo-500 font-medium">V2</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* LayersPanel toggle */}
          {!isPreview && (
            <button
              onClick={() => setLayersPanelOpen(v => !v)}
              title={layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
              className={[
                'p-2 rounded-lg border transition-colors',
                layersPanelOpen
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-700'
                  : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400',
              ].join(' ')}
            >
              <Layers className="h-4 w-4" />
            </button>
          )}

          {/* Undo / Redo */}
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

          {/* Zoom — range extended to 25–200 per spec */}
          <div className="flex items-center border border-slate-300 rounded-lg dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => setZoom(zoom - 10)}
              disabled={zoom <= ZOOM_MIN}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium min-w-[52px] text-center tabular-nums">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(zoom + 10)}
              disabled={zoom >= ZOOM_MAX}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Preview device switcher */}
          {isPreview && (
            <div className="flex items-center border border-slate-300 rounded-lg dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  previewDevice === 'desktop'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  previewDevice === 'mobile'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Mobile
              </button>
            </div>
          )}

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
            {saveMutation.isPending ? 'Saving…' : 'Save Layout'}
          </button>
        </div>
      </header>

      {/* ── Main workspace ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: Layers Panel — 240px, collapsible */}
        {!isPreview && layersPanelOpen && (
          <aside
            className="flex-shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-700"
            style={{ width: 240 }}
          >
            <LayersPanel />
          </aside>
        )}

        {/* Canvas area */}
        <main className={`flex-1 overflow-hidden ${isPreview ? '' : ''}`}>
          {isPreview ? (
            previewDevice === 'mobile' ? (
              <div className="flex items-center justify-center h-full py-8 bg-slate-100 dark:bg-slate-950/50 overflow-auto">
                <div className="relative mx-auto border-[14px] border-slate-900 dark:border-slate-800 rounded-[2.5rem] h-[812px] w-[375px] shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
                    <div className="bg-slate-900 dark:bg-slate-800 h-4 w-32 rounded-b-xl" />
                  </div>
                  <div className="h-full w-full overflow-y-auto pt-6 bg-white dark:bg-slate-900">
                    <DynamicModuleRenderer layout={layout} module={moduleData} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto bg-white dark:bg-slate-900">
                <DynamicModuleRenderer layout={layout} module={moduleData} />
              </div>
            )
          ) : (
            <BuilderCanvasV2 module={moduleData} />
          )}
        </main>

        {/* Right sidebar: Properties — 320px */}
        {!isPreview && (
          <aside className="w-80 flex-shrink-0 border-l bg-white dark:bg-slate-800 dark:border-slate-700 overflow-y-auto">
            <PropertyPanelV2 />
          </aside>
        )}
      </div>

      {/* ── Bottom toolbar ───────────────────────────────────────────────────── */}
      {!isPreview && (
        <div className="h-20 flex-shrink-0 border-t bg-white px-6 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] dark:bg-slate-800 dark:border-slate-700">
          <ComponentToolbarV2 />
        </div>
      )}
    </div>
  );
}
