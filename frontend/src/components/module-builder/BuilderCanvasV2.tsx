'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { UIBlock, AlignmentDirection } from '@/types/module-builder';
import { Module } from '@/lib/settings-context';
import { BlockRenderer } from './DynamicModuleRenderer';
import { Copy, Trash2, Lock, AlignLeft, AlignCenter, AlignRight, MoveHorizontal, MoveVertical, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Bookmark, Group, Ungroup } from 'lucide-react';
import { DRAG_TYPE_KEY } from './ComponentToolbarV2';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 1440;
const GRID = 8;
const SNAP_THRESHOLD = 8;
const MIN_CANVAS_HEIGHT = 800;

const INLINE_EDITABLE_TYPES = new Set([
  'text_block', 'hero', 'hero_v2', 'button', 'cta',
  'features', 'stats', 'card_grid', 'testimonials_carousel', 'pricing_table',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parsePx = (val: string | number | undefined, fallback = 200): number => {
  if (val == null) return fallback;
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val.includes('%')) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

interface Rect { id: string; x: number; y: number; w: number; h: number }

const blockToRect = (b: UIBlock): Rect => ({
  id: b.id,
  x: b.position?.x ?? 0,
  y: b.position?.y ?? 0,
  w: parsePx(b.position?.width, 400),
  h: parsePx(b.position?.height, 200),
});

const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ─── Snap computation ─────────────────────────────────────────────────────────

interface SnapLine { axis: 'x' | 'y'; value: number }

function computeSnapLines(dragging: Rect, others: Rect[]): SnapLine[] {
  const lines: SnapLine[] = [];
  const dEdgesX = [dragging.x, dragging.x + dragging.w / 2, dragging.x + dragging.w];
  const dEdgesY = [dragging.y, dragging.y + dragging.h / 2, dragging.y + dragging.h];

  for (const other of others) {
    const oEdgesX = [other.x, other.x + other.w / 2, other.x + other.w];
    const oEdgesY = [other.y, other.y + other.h / 2, other.y + other.h];
    for (const dv of dEdgesX)
      for (const ov of oEdgesX)
        if (Math.abs(dv - ov) < SNAP_THRESHOLD) lines.push({ axis: 'x', value: ov });
    for (const dv of dEdgesY)
      for (const ov of oEdgesY)
        if (Math.abs(dv - ov) < SNAP_THRESHOLD) lines.push({ axis: 'y', value: ov });
  }
  // Canvas center snap
  if (Math.abs((dragging.x + dragging.w / 2) - CANVAS_WIDTH / 2) < SNAP_THRESHOLD)
    lines.push({ axis: 'x', value: CANVAS_WIDTH / 2 });

  const seen = new Set<string>();
  return lines.filter(l => {
    const k = `${l.axis}:${l.value}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

// ─── Resize handles ───────────────────────────────────────────────────────────

const HANDLE_BASE: React.CSSProperties = {
  width: 10, height: 10,
  background: '#ffffff',
  border: '2px solid #4f46e5',
  borderRadius: 2,
  zIndex: 100,
};

function buildHandleStyles(visible: boolean): Record<string, React.CSSProperties> {
  if (!visible) return {};
  return {
    topLeft:     { ...HANDLE_BASE, top: -5, left: -5 },
    topRight:    { ...HANDLE_BASE, top: -5, right: -5 },
    bottomLeft:  { ...HANDLE_BASE, bottom: -5, left: -5 },
    bottomRight: { ...HANDLE_BASE, bottom: -5, right: -5 },
    top:         { ...HANDLE_BASE, top: -5, left: '50%', marginLeft: -5 },
    bottom:      { ...HANDLE_BASE, bottom: -5, left: '50%', marginLeft: -5 },
    left:        { ...HANDLE_BASE, left: -5, top: '50%', marginTop: -5 },
    right:       { ...HANDLE_BASE, right: -5, top: '50%', marginTop: -5 },
  };
}

// ─── Alignment bar ────────────────────────────────────────────────────────────
// Uses inline SVGs for vertical-align icons since lucide 0.359 doesn't have them.

const AlignTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="3" x2="21" y2="3"/><rect x="9" y="6" width="6" height="15" rx="1"/>
  </svg>
);
const AlignMiddleVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><rect x="9" y="5" width="6" height="14" rx="1"/>
  </svg>
);
const AlignBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="15" rx="1"/><line x1="3" y1="21" x2="21" y2="21"/>
  </svg>
);
const DistributeHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="3" x2="3" y2="21"/><line x1="21" y1="3" x2="21" y2="21"/>
    <rect x="9" y="7" width="6" height="10" rx="1"/>
  </svg>
);
const DistributeVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="3" x2="21" y2="3"/><line x1="3" y1="21" x2="21" y2="21"/>
    <rect x="7" y="9" width="10" height="6" rx="1"/>
  </svg>
);

function MultiSelectBar({
  selectedIds,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
}: {
  selectedIds: string[];
  onAlign: (a: AlignmentDirection) => void;
  onDistribute: (d: 'horizontal' | 'vertical') => void;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  const btn = 'p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent';
  const can3 = selectedIds.length >= 3;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl shadow-lg px-2 py-1 select-none">
      <span className="text-[10px] text-slate-400 font-medium pr-2 border-r border-slate-200 mr-1 whitespace-nowrap">
        {selectedIds.length} selected
      </span>
      {/* Horizontal align */}
      <button className={btn} title="Align Left"     onClick={() => onAlign('left')}>   <AlignLeft   className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Align Center H" onClick={() => onAlign('center')}> <AlignCenter className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Align Right"    onClick={() => onAlign('right')}>  <AlignRight  className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      {/* Vertical align */}
      <button className={btn} title="Align Top"    onClick={() => onAlign('top')}>    <AlignTopIcon /></button>
      <button className={btn} title="Align Middle" onClick={() => onAlign('middle')}> <AlignMiddleVIcon /></button>
      <button className={btn} title="Align Bottom" onClick={() => onAlign('bottom')}> <AlignBottomIcon /></button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      {/* Distribute */}
      <button className={btn} title="Distribute Horizontally" disabled={!can3} onClick={() => onDistribute('horizontal')}><DistributeHIcon /></button>
      <button className={btn} title="Distribute Vertically"   disabled={!can3} onClick={() => onDistribute('vertical')}><DistributeVIcon /></button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      {/* Group / Ungroup */}
      <button className={btn} title="Group Selection" onClick={onGroup}><Group className="h-3.5 w-3.5" /></button>
      <button className={btn} title="Ungroup Selection" onClick={onUngroup}><Ungroup className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ─── Main canvas ──────────────────────────────────────────────────────────────

interface BuilderCanvasV2Props {
  module: Module;
}

export function BuilderCanvasV2({ module }: BuilderCanvasV2Props) {
  const {
    layout, updateBlock, zoom,
    selectedBlockId, selectedBlockIds,
    selectBlock, addToSelection, removeFromSelection, selectMultiple, clearSelection,
    duplicateBlock, removeBlock, toggleLock, lockedBlockIds,
    setInlineEditing, inlineEditingBlockId,
    alignBlocks, distributeBlocks,
    addBlock,
    bringToFront, sendToBack, bringForward, sendBackward,
    saveAsSymbol, groupBlocks, ungroupBlock,
  } = useModuleBuilderStore();

  const canvasRef = useRef<HTMLDivElement>(null);

  const [showColumns, setShowColumns] = useState(false);
  const [snapLines,   setSnapLines]   = useState<SnapLine[]>([]);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [rubberBand,  setRubberBand]  = useState<{
    startX: number; startY: number; curX: number; curY: number;
  } | null>(null);

  const allRects = layout.map(blockToRect);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'g' || e.key === 'G') setShowColumns(v => !v);

      if (e.key === 'Escape') {
        if (inlineEditingBlockId) setInlineEditing(null);
        else clearSelection();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBlockIds.length > 0) {
          // Copy array first — removing mutates store
          [...selectedBlockIds].forEach(id => removeBlock(id));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBlockIds, inlineEditingBlockId, removeBlock, clearSelection, setInlineEditing]);

  // ── Canvas height ───────────────────────────────────────────────────────────

  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    ...layout.map(b => (b.position?.y ?? 0) + parsePx(b.position?.height, 200) + 120),
  );

  // ── Rubber-band ─────────────────────────────────────────────────────────────

  const canvasToLocal = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scale = zoom / 100;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }, [zoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    const { x, y } = canvasToLocal(e.clientX, e.clientY);
    setRubberBand({ startX: x, startY: y, curX: x, curY: y });
    clearSelection();
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rubberBand) return;
    const { x, y } = canvasToLocal(e.clientX, e.clientY);
    setRubberBand(r => r ? { ...r, curX: x, curY: y } : null);
  };

  const handleCanvasMouseUp = () => {
    if (rubberBand) {
      const sel: Rect = {
        id: '__sel__',
        x: Math.min(rubberBand.startX, rubberBand.curX),
        y: Math.min(rubberBand.startY, rubberBand.curY),
        w: Math.abs(rubberBand.curX - rubberBand.startX),
        h: Math.abs(rubberBand.curY - rubberBand.startY),
      };
      if (sel.w > 4 && sel.h > 4) {
        const hit = allRects
          .filter(r => !lockedBlockIds.includes(r.id) && rectsIntersect(sel, r))
          .map(r => r.id);
        if (hit.length > 0) selectMultiple(hit);
      }
    }
    setRubberBand(null);
  };

  // ── Block interactions ──────────────────────────────────────────────────────

  const handleBlockClick = (block: UIBlock, e: React.MouseEvent) => {
    if (lockedBlockIds.includes(block.id)) return;
    e.stopPropagation();
    if (e.shiftKey) {
      selectedBlockIds.includes(block.id)
        ? removeFromSelection(block.id)
        : addToSelection(block.id);
    } else {
      selectBlock(block.id);
    }
  };

  const handleBlockDblClick = (block: UIBlock) => {
    if (lockedBlockIds.includes(block.id)) return;
    if (INLINE_EDITABLE_TYPES.has(block.type)) setInlineEditing(block.id);
  };

  const handleDrag = useCallback((block: UIBlock, x: number, y: number) => {
    const dragging: Rect = {
      id: block.id, x, y,
      w: parsePx(block.position?.width, 400),
      h: parsePx(block.position?.height, 200),
    };
    setSnapLines(computeSnapLines(dragging, allRects.filter(r => r.id !== block.id)));
  }, [allRects]);

  const handleDragStop = (block: UIBlock, x: number, y: number) => {
    setDraggingId(null);
    setSnapLines([]);
    updateBlock(block.id, { position: { ...block.position, x, y } });
  };

  const handleResizeStop = (block: UIBlock, x: number, y: number, width: string, height: string) => {
    updateBlock(block.id, { position: { ...block.position, x, y, width, height } });
  };

  // ── Derived display state ───────────────────────────────────────────────────

  const multiSelected     = selectedBlockIds.length >= 2;
  const singleBlock       = !multiSelected ? layout.find(b => b.id === selectedBlockId) : undefined;
  const showFloatBar      = !!singleBlock && draggingId !== singleBlock?.id;

  const floatBarPos = (() => {
    if (!singleBlock) return null;
    const r = blockToRect(singleBlock);
    return { x: r.x + r.w / 2, y: r.y };
  })();

  const rbRect = rubberBand ? {
    left:   Math.min(rubberBand.startX, rubberBand.curX),
    top:    Math.min(rubberBand.startY, rubberBand.curY),
    width:  Math.abs(rubberBand.curX - rubberBand.startX),
    height: Math.abs(rubberBand.curY - rubberBand.startY),
  } : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-200 dark:bg-slate-900">
      <div className="inline-flex min-w-full justify-center p-8 min-h-full">

        {/* Alignment & Grouping bar — sticky at top of scroll area when multi-selected */}
        {multiSelected && (
          <MultiSelectBar
            selectedIds={selectedBlockIds}
            onAlign={dir => alignBlocks(selectedBlockIds, dir)}
            onDistribute={dir => distributeBlocks(selectedBlockIds, dir)}
            onGroup={() => groupBlocks(selectedBlockIds)}
            onUngroup={() => ungroupBlock(selectedBlockIds[0])}
          />
        )}

        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData(DRAG_TYPE_KEY);
            if (!raw) return;
            try {
              const { type, defaultWidth } = JSON.parse(raw);
              const el = canvasRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const scale = zoom / 100;
              // Canvas-relative position, snapped to 8px grid
              const rawX = (e.clientX - rect.left) / scale;
              const rawY = (e.clientY - rect.top)  / scale;
              const x = Math.round(rawX / GRID) * GRID;
              const y = Math.round(rawY / GRID) * GRID;
              addBlock(type, { x, y, width: `${defaultWidth ?? 400}px` });
            } catch {}
          }}
          style={{
            width: CANVAS_WIDTH,
            minHeight: canvasHeight,
            position: 'relative',
            backgroundColor: '#ffffff',
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: `${GRID}px ${GRID}px`,
            boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            flexShrink: 0,
            userSelect: rubberBand ? 'none' : 'auto',
          }}
        >
        {/* 12-column overlay (G key) */}
        {showColumns && (
          <div className="absolute inset-0 pointer-events-none z-50 flex px-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  marginLeft: i === 0 ? 0 : 12,
                  marginRight: 12,
                  background: 'rgba(99,102,241,0.07)',
                  borderLeft:  '1px solid rgba(99,102,241,0.18)',
                  borderRight: '1px solid rgba(99,102,241,0.18)',
                  height: '100%',
                }}
              />
            ))}
          </div>
        )}

        {/* Snap lines */}
        {snapLines.map((line, i) =>
          line.axis === 'x' ? (
            <div key={i} className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: line.value, width: 1, background: '#4f46e5', zIndex: 1000, opacity: 0.75 }} />
          ) : (
            <div key={i} className="absolute left-0 right-0 pointer-events-none"
              style={{ top: line.value, height: 1, background: '#4f46e5', zIndex: 1000, opacity: 0.75 }} />
          )
        )}

        {/* Rubber-band rect */}
        {rbRect && (
          <div className="absolute pointer-events-none" style={{
            left: rbRect.left, top: rbRect.top,
            width: rbRect.width, height: rbRect.height,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.5)',
            zIndex: 999,
          }} />
        )}

        {/* Empty state */}
        {layout.length === 0 && (
          <div className="absolute inset-0 m-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
            <p className="text-sm font-medium">Drag components from the toolbar</p>
            <p className="mt-1 text-xs opacity-70">or click to add at the default position</p>
          </div>
        )}

        {/* Floating single-select action bar */}
        {showFloatBar && floatBarPos && singleBlock && (
          <div
            className="absolute pointer-events-auto"
            style={{ left: floatBarPos.x, top: floatBarPos.y - 44, transform: 'translateX(-50%)', zIndex: 1001 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-lg px-2 py-1">
              <span className="text-[10px] text-slate-500 font-medium pr-1.5 border-r border-slate-200 mr-0.5 whitespace-nowrap">
                {singleBlock.type.replace(/_/g, ' ')}
              </span>
              <button
                onClick={() => bringToFront(singleBlock.id)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Bring to Front"
              >
                <ChevronsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => bringForward(singleBlock.id)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Bring Forward"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => sendBackward(singleBlock.id)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Send Backward"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => sendToBack(singleBlock.id)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Send to Back"
              >
                <ChevronsDown className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-3 bg-slate-200 mx-0.5" />
              <button
                onClick={() => duplicateBlock(singleBlock.id)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => removeBlock(singleBlock.id)}
                className="p-1 rounded hover:bg-red-50 text-slate-500 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => saveAsSymbol(singleBlock.id, 'property')}
                className="p-1 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600"
                title="Save as Symbol"
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toggleLock(singleBlock.id)}
                className="p-1 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600"
                title="Lock"
              >
                <Lock className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Blocks ── */}
        {layout.map(block => {
          const isLocked   = lockedBlockIds.includes(block.id);
          const isSelected = selectedBlockId === block.id || selectedBlockIds.includes(block.id);
          const isSingle   = isSelected && selectedBlockIds.length <= 1;
          const hasRotation = !!block.position?.rotation && block.position.rotation !== 0;

          return (
            <Rnd
              key={block.id}
              position={{ x: block.position?.x ?? 100, y: block.position?.y ?? 100 }}
              size={{ width: block.position?.width ?? '400px', height: block.position?.height ?? 'auto' }}
              dragGrid={[GRID, GRID]}
              resizeGrid={[GRID, GRID]}
              bounds="parent"
              dragHandleClassName="drag-handle"
              disableDragging={isLocked}
              enableResizing={!isLocked && !hasRotation}
              style={{ zIndex: isSelected ? 10 + (block.position?.z ?? 1) : (block.position?.z ?? 1) }}
              resizeHandleStyles={buildHandleStyles(isSingle && !hasRotation)}
              onDragStart={() => setDraggingId(block.id)}
              onDrag={(_e, d) => handleDrag(block, d.x, d.y)}
              onDragStop={(_e, d) => handleDragStop(block, d.x, d.y)}
              onResizeStop={(_e, _dir, ref, _delta, pos) =>
                handleResizeStop(block, pos.x, pos.y, ref.style.width, ref.style.height)
              }
            >
              <div
                onClick={e => handleBlockClick(block, e)}
                onDoubleClick={() => handleBlockDblClick(block)}
                className={[
                  'group relative h-full w-full rounded-lg border-2 bg-white transition-colors overflow-hidden',
                  isSelected
                    ? 'border-indigo-600 shadow-lg'
                    : 'border-transparent hover:border-slate-300',
                  isLocked ? 'opacity-60' : '',
                  block.style?.visibility === 'hidden' ? 'opacity-30' : '',
                ].join(' ')}
                style={{
                  transform: (() => {
                    const t: string[] = [];
                    if (block.position?.rotation) t.push(`rotate(${block.position.rotation}deg)`);
                    if (block.position?.scale && block.position.scale !== 1) t.push(`scale(${block.position.scale})`);
                    return t.length > 0 ? t.join(' ') : undefined;
                  })(),
                  transformOrigin: 'center center',
                }}
              >
                {/* Drag handle strip */}
                <div className={[
                  'drag-handle absolute top-0 left-0 right-0 z-10 flex items-center gap-1.5 px-2 py-1',
                  'bg-white/90 backdrop-blur-sm border-b border-slate-100',
                  'text-[10px] text-slate-500 cursor-grab active:cursor-grabbing transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}>
                  <span className="font-mono text-[8px] tracking-widest text-slate-300">⠿⠿</span>
                  <span className="flex-1 truncate font-medium">
                    {block.label ?? block.type.replace(/_/g, ' ')}
                  </span>
                  {isLocked && <span className="text-amber-500 text-[9px] font-semibold">LOCKED</span>}
                  {block.style?.visibility === 'hidden' && (
                    <span className="text-slate-400 text-[9px] font-semibold">HIDDEN</span>
                  )}
                </div>

                {/* Block content */}
                <div className={[
                  'w-full h-full pt-6 overflow-hidden',
                  block.id === inlineEditingBlockId ? '' : 'pointer-events-none select-none',
                ].join(' ')}>
                  <BlockRenderer
                    block={block}
                    module={module}
                    isEditing={block.id === inlineEditingBlockId}
                    onUpdateProps={(updates) =>
                      updateBlock(block.id, { props: { ...block.props, ...updates } })
                    }
                  />
                </div>
              </div>
            </Rnd>
          );
        })}
      </div>
      </div>

      {/* Column overlay hint */}
      <div className="fixed bottom-24 right-6 text-[10px] text-slate-400 select-none pointer-events-none">
        Press <kbd className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">G</kbd> to {showColumns ? 'hide' : 'show'} columns
      </div>
    </div>
  );
}
