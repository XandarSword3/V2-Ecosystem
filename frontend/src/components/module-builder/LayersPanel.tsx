'use client';

import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { UIBlock, UIComponentType } from '@/types/module-builder';
import {
  Eye, EyeOff, Lock, Unlock, GripVertical,
  Layout, Type, Image as ImageIcon, Grid, List, Calendar,
  Clock, Box, MousePointer2, FormInput, Sparkles, Star,
  BarChart3, Dumbbell, ArrowRight, Divide, Minus, CreditCard,
  Users, ChevronDown, ChevronRight, ChevronsUp, ChevronsDown, Pencil, Check, X,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Partial<Record<UIComponentType, React.ElementType>> = {
  hero: Layout,
  hero_v2: Sparkles,
  text_block: Type,
  image: ImageIcon,
  grid: Grid,
  card_grid: Grid,
  menu_list: List,
  session_list: Clock,
  booking_calendar: Calendar,
  calendar: Calendar,
  container: Box,
  form_container: FormInput,
  button: MousePointer2,
  features: Star,
  stats: BarChart3,
  class_schedule: Dumbbell,
  testimonials: Users,
  testimonials_carousel: Star,
  pricing_table: CreditCard,
  cta: ArrowRight,
  divider: Divide,
  spacer: Minus,
  section: Layout,
};

function blockIcon(type: UIComponentType): React.ElementType {
  return TYPE_ICONS[type] ?? Box;
}

// ─── Single row ───────────────────────────────────────────────────────────────

interface LayerRowProps {
  block: UIBlock;
  depth?: number;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
}

function LayerRow({ block, depth = 0, isDragOver, onDragStart, onDragOver, onDrop }: LayerRowProps) {
  const {
    selectedBlockId, selectedBlockIds,
    selectBlock, addToSelection, removeFromSelection,
    updateBlock, toggleLock, lockedBlockIds,
    bringToFront, sendToBack,
  } = useModuleBuilderStore();

  const isSelected = selectedBlockIds.includes(block.id) || selectedBlockId === block.id;
  const isLocked = lockedBlockIds.includes(block.id);
  const isHidden = block.style?.visibility === 'hidden';
  const Icon = blockIcon(block.type);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(block.label ?? block.type);
  const [childrenOpen, setChildrenOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = block.children && block.children.length > 0;

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== block.label) {
      updateBlock(block.id, { label: trimmed });
    }
    setIsRenaming(false);
  }, [renameValue, block.id, block.label, updateBlock]);

  const handleRowClick = (e: React.MouseEvent) => {
    if (isLocked) return;
    if (e.shiftKey) {
      isSelected ? removeFromSelection(block.id) : addToSelection(block.id);
    } else {
      selectBlock(block.id);
    }
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateBlock(block.id, {
      style: {
        ...(block.style ?? {}),
        visibility: isHidden ? 'visible' : 'hidden',
      },
    });
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLock(block.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(block.label ?? block.type);
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const indentPx = depth * 16;

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(block.id)}
        onDragOver={(e) => { e.preventDefault(); onDragOver(block.id); }}
        onDrop={(e) => { e.preventDefault(); onDrop(block.id); }}
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        className={[
          'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer select-none transition-colors text-[13px]',
          isSelected
            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300',
          isDragOver ? 'border-t-2 border-indigo-500' : '',
          isHidden ? 'opacity-40' : '',
        ].join(' ')}
        style={{ paddingLeft: `${8 + indentPx}px` }}
      >
        {/* Drag grip */}
        <GripVertical className="h-3 w-3 text-slate-300 dark:text-slate-600 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Expand/collapse arrow for blocks with children */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setChildrenOpen((v) => !v); }}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {childrenOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Type icon */}
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />

        {/* Label / rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white dark:bg-slate-700 border border-indigo-400 rounded px-1 py-0 text-[12px] outline-none text-slate-900 dark:text-white"
            autoFocus
          />
        ) : (
          <span className="flex-1 min-w-0 truncate leading-none">
            {block.label ?? block.type.replace(/_/g, ' ')}
          </span>
        )}

        {/* Action buttons — only visible on hover or selected */}
        <div className={`flex items-center gap-0.5 flex-shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {/* Bring to Front */}
          <button
            onClick={(e) => { e.stopPropagation(); bringToFront(block.id); }}
            title="Bring to Front"
            className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ChevronsUp className="h-3 w-3" />
          </button>
          {/* Send to Back */}
          <button
            onClick={(e) => { e.stopPropagation(); sendToBack(block.id); }}
            title="Send to Back"
            className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ChevronsDown className="h-3 w-3" />
          </button>
          {/* Visibility */}
          <button
            onClick={handleToggleVisibility}
            title={isHidden ? 'Show' : 'Hide'}
            className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          {/* Lock */}
          <button
            onClick={handleToggleLock}
            title={isLocked ? 'Unlock' : 'Lock'}
            className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {isLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
          </button>
        </div>

        {/* Locked badge */}
        {isLocked && (
          <Lock className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
        )}
      </div>

      {/* Children */}
      {hasChildren && childrenOpen && (
        <div>
          {block.children!.map((child) => (
            <LayerRow
              key={child.id}
              block={child}
              depth={depth + 1}
              isDragOver={false}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function LayersPanel() {
  const { layout, moveBlock } = useModuleBuilderStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (id: string) => setDragOverId(id);
  const handleDrop = (targetId: string) => {
    if (draggedId && draggedId !== targetId) {
      moveBlock(draggedId, targetId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Layers
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {layout.length} block{layout.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Block list — rendered bottom-to-top visually = top block is z-highest */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {layout.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-[12px] text-center px-4">
            <Minus className="h-4 w-4 mb-2 opacity-40" />
            No blocks yet.
            <br />
            Add one from the toolbar below.
          </div>
        ) : (
          // Reverse so highest z (last in array) appears at top of list
          [...layout].reverse().map((block) => (
            <LayerRow
              key={block.id}
              block={block}
              isDragOver={dragOverId === block.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
          Drag rows to reorder · Double-click to rename · Shift+click to multi-select
        </p>
      </div>
    </div>
  );
}
