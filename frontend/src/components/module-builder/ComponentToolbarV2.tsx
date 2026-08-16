'use client';

/**
 * ComponentToolbarV2
 * Phase 2 — drag-to-place toolbar.
 *
 * Each entry is draggable via the HTML5 Drag API (no dnd-kit — lighter weight).
 * The canvas (BuilderCanvasV2) picks up onDrop and calls addBlock(type, { x, y }).
 * A ghost overlay follows the cursor during drag so the user sees what they're placing.
 *
 * Old ComponentToolbar is untouched — feature flag in page.tsx swaps them.
 */

import { useRef, useState } from 'react';
import {
  Layout, Type, Image as ImageIcon, Grid, List, Box,
  Calendar, CalendarDays, Clock, MousePointer2, FormInput,
  Users, CreditCard, Star, Dumbbell, Sparkles,
  ArrowRight, BarChart3, Divide, Minus, LucideIcon,
} from 'lucide-react';
import { UIComponentType } from '@/types/module-builder';
import { useModuleBuilderStore } from '@/stores/module-builder-store';

// ─── Component registry ───────────────────────────────────────────────────────

type Category = 'layout' | 'content' | 'module' | 'utility';

interface Entry {
  type: UIComponentType;
  label: string;
  icon: LucideIcon;
  category: Category;
  /** Default width dropped onto canvas (px) */
  defaultWidth?: number;
}

const COMPONENTS: Entry[] = [
  // Layout
  { type: 'hero',                label: 'Hero',            icon: Layout,       category: 'layout',  defaultWidth: 1440 },
  { type: 'hero_v2',             label: 'Hero V2',         icon: Sparkles,     category: 'layout',  defaultWidth: 1440 },
  { type: 'container',           label: 'Container',       icon: Box,          category: 'layout',  defaultWidth: 800  },
  { type: 'card_grid',           label: 'Card Grid',       icon: Grid,         category: 'layout',  defaultWidth: 1200 },

  // Content
  { type: 'text_block',          label: 'Text',            icon: Type,         category: 'content', defaultWidth: 600  },
  { type: 'image',               label: 'Image',           icon: ImageIcon,    category: 'content', defaultWidth: 600  },
  { type: 'button',              label: 'Button',          icon: MousePointer2,category: 'content', defaultWidth: 200  },
  { type: 'features',            label: 'Features',        icon: Star,         category: 'content', defaultWidth: 1200 },
  { type: 'stats',               label: 'Stats',           icon: BarChart3,    category: 'content', defaultWidth: 1200 },
  { type: 'testimonials_carousel',label: 'Testimonials',   icon: Users,        category: 'content', defaultWidth: 1200 },
  { type: 'pricing_table',       label: 'Pricing',         icon: CreditCard,   category: 'content', defaultWidth: 1200 },
  { type: 'cta',                 label: 'CTA',             icon: ArrowRight,   category: 'content', defaultWidth: 1200 },

  // Module-specific
  { type: 'menu_list',           label: 'Menu List',       icon: List,         category: 'module',  defaultWidth: 1200 },
  { type: 'session_list',        label: 'Sessions',        icon: Clock,        category: 'module',  defaultWidth: 1200 },
  { type: 'class_schedule',      label: 'Schedule',        icon: Dumbbell,     category: 'module',  defaultWidth: 1200 },
  { type: 'booking_calendar',    label: 'Booking Cal',     icon: CalendarDays, category: 'module',  defaultWidth: 1200 },
  { type: 'calendar',            label: 'Mini Cal',        icon: Calendar,     category: 'module',  defaultWidth: 400  },
  { type: 'form_container',      label: 'Form',            icon: FormInput,    category: 'module',  defaultWidth: 600  },

  // Utility
  { type: 'divider',             label: 'Divider',         icon: Divide,       category: 'utility', defaultWidth: 1440 },
  { type: 'spacer',              label: 'Spacer',          icon: Minus,        category: 'utility', defaultWidth: 1440 },
];

const CATEGORY_LABELS: Record<Category, string> = {
  layout:  'Layout',
  content: 'Content',
  module:  'Module',
  utility: 'Utility',
};

// Key written to dataTransfer so BuilderCanvasV2 can read it
export const DRAG_TYPE_KEY = 'application/x-builder-component';

// ─── Ghost overlay ────────────────────────────────────────────────────────────

interface GhostProps {
  entry: Entry;
  x: number;
  y: number;
}

function DragGhost({ entry, x, y }: GhostProps) {
  const Icon = entry.icon;
  return (
    <div
      style={{
        position: 'fixed',
        left: x + 12,
        top: y - 20,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      className="flex items-center gap-1.5 bg-indigo-600 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl opacity-90"
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {entry.label}
    </div>
  );
}

// ─── Single component button ──────────────────────────────────────────────────

interface ButtonProps {
  entry: Entry;
  onDragStart: (entry: Entry) => void;
  onDragEnd: () => void;
  onMouseMove: (x: number, y: number) => void;
  onClick: (entry: Entry) => void;
}

function ComponentButton({ entry, onDragStart, onDragEnd, onMouseMove, onClick }: ButtonProps) {
  const Icon = entry.icon;

  return (
    <button
      draggable
      onDragStart={(e) => {
        // Write the component type into the drag payload
        e.dataTransfer.setData(DRAG_TYPE_KEY, JSON.stringify({
          type: entry.type,
          defaultWidth: entry.defaultWidth ?? 400,
        }));
        // Replace the default browser ghost with a transparent 1px image
        // so our custom DragGhost component shows instead
        const blank = document.createElement('img');
        blank.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(blank, 0, 0);
        onDragStart(entry);
      }}
      onDrag={(e) => {
        if (e.clientX !== 0 || e.clientY !== 0) onMouseMove(e.clientX, e.clientY);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(entry)}
      className="flex flex-col items-center justify-center gap-1 min-w-[68px] h-14 rounded-lg border border-slate-200 bg-slate-50 p-1.5 cursor-grab active:cursor-grabbing hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:border-indigo-500 transition-all select-none"
    >
      {/* Grip dots */}
      <div className="absolute top-1 left-1 text-[6px] text-slate-300 leading-none opacity-0 group-hover:opacity-100">⠿</div>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-[10px] font-medium leading-tight text-center">{entry.label}</span>
    </button>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function ComponentToolbarV2() {
  const { addBlock } = useModuleBuilderStore();

  const [dragging, setDragging] = useState<Entry | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const handleDragStart = (entry: Entry) => {
    setDragging(entry);
  };

  const handleDragEnd = () => {
    setDragging(null);
  };

  const handleMouseMove = (x: number, y: number) => {
    setGhostPos({ x, y });
  };

  // Click fallback — adds block at default stagger position
  const handleClick = (entry: Entry) => {
    addBlock(entry.type);
  };

  const categories = Object.keys(CATEGORY_LABELS) as Category[];

  const filteredComponents = COMPONENTS.filter(c => {
    const matchesSearch = c.label.toLowerCase().includes(search.toLowerCase()) ||
                          c.type.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      {/* Custom drag ghost */}
      {dragging && <DragGhost entry={dragging} x={ghostPos.x} y={ghostPos.y} />}

      <div className="flex h-full items-center gap-3 overflow-x-auto py-2">
        {/* Search input */}
        <div className="relative flex-shrink-0 w-36">
          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <span className="absolute left-2 top-2 text-slate-400 text-xs">🔍</span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 pr-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Component Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {filteredComponents.length === 0 ? (
            <span className="text-xs text-slate-400 italic px-2">No blocks match "{search}"</span>
          ) : (
            filteredComponents.map(entry => (
              <ComponentButton
                key={entry.type}
                entry={entry}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onMouseMove={handleMouseMove}
                onClick={handleClick}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
