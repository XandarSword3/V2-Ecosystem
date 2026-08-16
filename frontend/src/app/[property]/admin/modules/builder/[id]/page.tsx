'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  LayoutTemplate, History, CheckCircle2, Clock, ChevronDown, Wifi, ShieldAlert, Plus, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { modulesApi } from '@/lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UIBlock } from '@/types/module-builder';
import { useRealtimeLWW } from '@/hooks/useRealtimeLWW';
import { AccessibilityAuditPanel } from '@/components/module-builder/AccessibilityAuditPanel';

// ─── Zoom bounds ──────────────────────────────────────────────────────────────
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;

// ─── Starter Templates per vertical ──────────────────────────────────────────
const STARTER_TEMPLATES: Record<string, { label: string; blocks: UIBlock[] }> = {
  menu: {
    label: 'Dining & Menu',
    blocks: [
      {
        id: 'tpl_hero_menu',
        type: 'hero_v2',
        props: { eyebrow: 'Culinary Experience', title: 'Seasonal Dining Menu', subtitle: 'Crafted with fresh local ingredients', primaryButton: 'Reserve Table' },
        position: { x: 0, y: 0, z: 1, width: '1440px', height: '400px' },
      },
      {
        id: 'tpl_menu_1',
        type: 'menu_list',
        props: { title: 'Chef Specials' },
        position: { x: 120, y: 430, z: 2, width: '1200px', height: '550px' },
      },
    ],
  },
  schedule: {
    label: 'Fitness & Schedule',
    blocks: [
      {
        id: 'tpl_hero_schedule',
        type: 'hero_v2',
        props: { eyebrow: 'Wellness & Activities', title: 'Daily Class Schedule', subtitle: 'Join our certified instructors daily', primaryButton: 'Book Class' },
        position: { x: 0, y: 0, z: 1, width: '1440px', height: '400px' },
      },
      {
        id: 'tpl_schedule_1',
        type: 'class_schedule',
        props: { title: 'Weekly Classes' },
        position: { x: 120, y: 430, z: 2, width: '1200px', height: '550px' },
      },
    ],
  },
  sessions: {
    label: 'Sessions & Events',
    blocks: [
      {
        id: 'tpl_hero_sessions',
        type: 'hero_v2',
        props: { eyebrow: 'Conferences & Workshops', title: 'Event Sessions', subtitle: 'Explore keynotes and breakout sessions', primaryButton: 'Register' },
        position: { x: 0, y: 0, z: 1, width: '1440px', height: '400px' },
      },
      {
        id: 'tpl_sessions_1',
        type: 'session_list',
        props: { title: 'Upcoming Sessions' },
        position: { x: 120, y: 430, z: 2, width: '1200px', height: '550px' },
      },
    ],
  },
  booking: {
    label: 'Booking & Calendar',
    blocks: [
      {
        id: 'tpl_hero_booking',
        type: 'hero_v2',
        props: { eyebrow: 'Reservations', title: 'Book Your Experience', subtitle: 'Select dates and choose your preferred package', primaryButton: 'Check Dates' },
        position: { x: 0, y: 0, z: 1, width: '1440px', height: '400px' },
      },
      {
        id: 'tpl_booking_1',
        type: 'booking_calendar',
        props: { title: 'Availability Calendar' },
        position: { x: 120, y: 430, z: 2, width: '1200px', height: '550px' },
      },
    ],
  },
};

export default function ModuleBuilderPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';
  const router = useRouter();
  const id = params.id as string;

  const {
    setLayout,
    layout,
    selectedBlockId,
    setActiveModuleId,
    isPreview,
    togglePreview,
    previewDevice,
    setPreviewDevice,
    undo, redo, canUndo, canRedo,
    zoom, setZoom,
  } = useModuleBuilderStore();

  const [layersPanelOpen, setLayersPanelOpen] = useState(true);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [a11yPanelOpen, setA11yPanelOpen] = useState(false);
  const [componentPaletteOpen, setComponentPaletteOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [versionSnapshots, setVersionSnapshots] = useState<Array<{ id: string; label: string; timestamp: Date; layout: UIBlock[] }>>([]);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // Close template menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /** Apply a starter template (replaces canvas) */
  const applyTemplate = useCallback((key: string) => {
    const tpl = STARTER_TEMPLATES[key];
    if (!tpl) return;
    const cloned = tpl.blocks.map((b) => ({
      ...b,
      id: `${b.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    }));
    setLayout(cloned);
    setTemplateMenuOpen(false);
    toast.success(`Applied "${tpl.label}" template`);
  }, [setLayout]);

  /** Snapshot the current layout into version history */
  const snapshotVersion = useCallback((label?: string) => {
    const snap = {
      id: `v_${Date.now()}`,
      label: label || `Version ${versionSnapshots.length + 1}`,
      timestamp: new Date(),
      layout: JSON.parse(JSON.stringify(layout)),
    };
    setVersionSnapshots((prev) => [snap, ...prev].slice(0, 50));
    toast.success('Version snapshot saved');
  }, [layout, versionSnapshots.length]);

  /** Restore layout from a version snapshot */
  const restoreVersion = useCallback((snapId: string) => {
    const snap = versionSnapshots.find((s) => s.id === snapId);
    if (!snap) return;
    setLayout(JSON.parse(JSON.stringify(snap.layout)));
    toast.success(`Restored "${snap.label}"`);
  }, [versionSnapshots, setLayout]);

  // ── Phase 12: Real-time LWW Collaboration ────────────────────────────────
  const lwwUserId = useMemo(() => `user_${Math.random().toString(36).slice(2, 8)}`, []);
  const { connected: lwwConnected, collaborators, broadcastPatch } = useRealtimeLWW({
    moduleId: id,
    userId: lwwUserId,
    displayName: 'Editor',
    socketUrl: typeof window !== 'undefined'
      ? (window as any).__LWW_SOCKET_URL__ || undefined   // set via env / runtime config when server is ready
      : undefined,
    onRemotePatch: useCallback((patch) => {
      // Apply remote patch into the store
      const { blockId, field, value } = patch;
      const block = layout.find((b) => b.id === blockId);
      if (!block) return;
      const parts = field.split('.');
      const updates: any = {};
      let cursor = updates;
      for (let i = 0; i < parts.length - 1; i++) {
        cursor[parts[i]] = { ...(block as any)[parts[i]] };
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
      useModuleBuilderStore.getState().updateBlock(blockId, updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

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
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
      refetch();
    },
    onError: () => {
      setAutoSaveStatus('idle');
      toast.error('Failed to save layout');
    },
  });

  useEffect(() => {
    if (data?.data?.data) {
      setActiveModuleId(id);
      const savedLayout = data.data.data.settings?.layout || [];
      setLayout(savedLayout, true);
    }
  }, [data, id, setActiveModuleId, setLayout]);

  // Debounced Autosave (2000ms delay)
  useEffect(() => {
    if (!data?.data?.data || layout.length === 0) return;
    const timer = setTimeout(() => {
      setAutoSaveStatus('saving');
      saveMutation.mutate(layout);
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

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
      <header className="flex items-center justify-between border-b bg-white px-5 py-2.5 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex-shrink-0">
        
        {/* Group 1: Navigation & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Back to Modules"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">
                {moduleData?.name || 'Module Builder'}
              </h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                V2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              {autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-amber-500 font-medium animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Saved
                </span>
              )}
              {autoSaveStatus === 'idle' && <span>Auto-save active</span>}
            </p>
          </div>
        </div>

        {/* Center / Group 2: Tools & Panel Toggles */}
        {!isPreview && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {/* Add Block trigger */}
            <button
              onClick={() => setComponentPaletteOpen((v) => !v)}
              className={[
                'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
                componentPaletteOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Block
            </button>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

            {/* Templates picker */}
            <div className="relative" ref={templateMenuRef}>
              <button
                onClick={() => setTemplateMenuOpen((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LayoutTemplate className="h-3.5 w-3.5 text-indigo-500" />
                Templates
                <ChevronDown className={`h-3 w-3 transition-transform ${templateMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {templateMenuOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-200 bg-white shadow-xl dark:bg-slate-800 dark:border-slate-700">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Vertical Starter Templates</p>
                  </div>
                  <div className="p-1.5 max-h-64 overflow-y-auto">
                    {Object.entries(STARTER_TEMPLATES).map(([key, tpl]) => (
                      <button
                        key={key}
                        onClick={() => applyTemplate(key)}
                        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:from-indigo-900/40 dark:to-violet-900/40">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">{tpl.label}</p>
                          <p className="text-[10px] text-slate-400">{tpl.blocks.length} blocks</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

            {/* Panel Toggles */}
            <button
              onClick={() => setLayersPanelOpen((v) => !v)}
              title={layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
              className={[
                'p-1.5 rounded-lg text-xs font-medium transition-colors',
                layersPanelOpen
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => setA11yPanelOpen((v) => !v)}
              title="WCAG Accessibility Audit"
              className={[
                'p-1.5 rounded-lg text-xs font-medium transition-colors',
                a11yPanelOpen
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => setVersionPanelOpen((v) => !v)}
              title="Version History"
              className={[
                'p-1.5 rounded-lg text-xs font-medium transition-colors',
                versionPanelOpen
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              <History className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Group 3: Actions & Status */}
        <div className="flex gap-2 items-center">
          {/* History & Zoom */}
          {!isPreview && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 dark:border-slate-700">
              <div className="flex items-center border border-slate-200 rounded-lg dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={undo}
                  disabled={!canUndo()}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                <button
                  onClick={redo}
                  disabled={!canRedo()}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center border border-slate-200 rounded-lg dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => setZoom(zoom - 10)}
                  disabled={zoom <= ZOOM_MIN}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 text-xs font-semibold min-w-[42px] text-center tabular-nums text-slate-700 dark:text-slate-300">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom(zoom + 10)}
                  disabled={zoom >= ZOOM_MAX}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Collaborator presence avatars */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {collaborators.slice(0, 4).map((c) => (
                <div
                  key={c.userId}
                  title={c.displayName}
                  className="h-6 w-6 rounded-full border border-white dark:border-slate-800 flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: c.color }}
                >
                  {c.displayName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}

          {lwwConnected && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold" title="Real-time collaboration active">
              <Wifi className="h-3 w-3" /> Live
            </span>
          )}

          {/* Preview device switcher */}
          {isPreview && (
            <div className="flex items-center border border-slate-300 rounded-lg dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  previewDevice === 'desktop'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  previewDevice === 'mobile'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Mobile
              </button>
            </div>
          )}

          <button
            onClick={togglePreview}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {isPreview ? 'Edit' : 'Preview'}
          </button>

          {!isPreview && (
            <button
              onClick={() => snapshotVersion()}
              title="Save version snapshot"
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
            >
              <Clock className="h-3.5 w-3.5" />
              Snapshot
            </button>
          )}

          <button
            onClick={() => saveMutation.mutate(layout)}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
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
        <main className="flex-1 overflow-hidden">
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

        {/* Right sidebar: Properties — auto-collapsing (only visible when a block is selected) */}
        {!isPreview && selectedBlockId && (
          <aside className="w-80 flex-shrink-0 border-l bg-white dark:bg-slate-800 dark:border-slate-700 overflow-y-auto animate-in slide-in-from-right-2 duration-150">
            <PropertyPanelV2 />
          </aside>
        )}

        {/* Version History Panel */}
        {!isPreview && versionPanelOpen && (
          <aside className="w-72 flex-shrink-0 border-l bg-white dark:bg-slate-800 dark:border-slate-700 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <History className="h-4 w-4" /> Version History
              </h3>
              <button
                onClick={() => snapshotVersion()}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Snapshot
              </button>
            </div>
            {versionSnapshots.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No snapshots yet.<br />
                Click &quot;Snapshot&quot; to save current state.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {versionSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                    onClick={() => restoreVersion(snap.id)}
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">
                      {snap.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {snap.timestamp.toLocaleTimeString()} — {snap.layout.length} blocks
                    </p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* Accessibility Audit Panel */}
        {!isPreview && a11yPanelOpen && (
          <aside className="w-80 flex-shrink-0 border-l bg-white dark:bg-slate-800 dark:border-slate-700 overflow-y-auto">
            <AccessibilityAuditPanel />
          </aside>
        )}
      </div>

      {/* ── Floating Component Catalog Popover / Drawer ────────────────────────── */}
      {!isPreview && componentPaletteOpen && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[720px] max-w-[90vw] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Add Component Block
              </span>
            </div>
            <button
              onClick={() => setComponentPaletteOpen(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto pr-1">
            <ComponentToolbarV2 />
          </div>
        </div>
      )}
    </div>
  );
}
