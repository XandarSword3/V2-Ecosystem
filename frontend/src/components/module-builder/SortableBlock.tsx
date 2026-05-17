import { UIBlock } from '@/types/module-builder';
import { GripVertical, Trash2, Copy, Layout, Type, Image as ImageIcon, Grid, List, Calendar, Clock, Box, MousePointer2, FormInput, Sparkles, Star, BarChart3, Dumbbell, ArrowRight, Divide, Minus, CreditCard, Users } from 'lucide-react';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { useEffect, useState } from 'react';
import { api, modulesApi } from '@/lib/api';
import { BlockRenderer } from './DynamicModuleRenderer';

interface SortableBlockProps {
  block: UIBlock;
}

const typeIcons: Record<string, any> = {
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
};

export function SortableBlock({ block }: SortableBlockProps) {
  const { selectBlock, selectedBlockId, removeBlock, duplicateBlock, activeModuleId } = useModuleBuilderStore();
  const [liveData, setLiveData] = useState<{ count?: number; subtitle?: string } | null>(null);
  const isSelected = selectedBlockId === block.id;
  const TypeIcon = typeIcons[block.type] || Box;

  useEffect(() => {
    let cancelled = false;

    const fetchLiveData = async () => {
      if (!activeModuleId) return;
      if (!['menu_list', 'session_list', 'booking_calendar'].includes(block.type)) return;
      try {
        const moduleRes = await modulesApi.getById(activeModuleId);
        const moduleSlug = moduleRes?.data?.slug;
        if (!moduleSlug) return;

        if (block.type === 'menu_list') {
          const ordersRes = await api.get(`/${moduleSlug}/orders`);
          const rows = ordersRes.data?.data || [];
          if (!cancelled) {
            setLiveData({
              count: rows.length,
              subtitle: rows[0]?.order_number ? `Latest: #${rows[0].order_number}` : 'Live order feed connected',
            });
          }
        } else if (block.type === 'session_list') {
          const sessionsRes = await api.get(`/${moduleSlug}/sessions`);
          const rows = sessionsRes.data?.data || [];
          if (!cancelled) {
            setLiveData({
              count: rows.length,
              subtitle: rows[0]?.session_name || rows[0]?.name || 'Sessions feed connected',
            });
          }
        } else if (block.type === 'booking_calendar') {
          const bookingsRes = await api.get(`/${moduleSlug}/bookings`);
          const rows = bookingsRes.data?.data || [];
          if (!cancelled) {
            setLiveData({
              count: rows.length,
              subtitle: rows[0]?.booking_number ? `Latest: #${rows[0].booking_number}` : 'Bookings feed connected',
            });
          }
        }
      } catch {
        if (!cancelled) setLiveData(null);
      }
    };

    fetchLiveData();
    return () => {
      cancelled = true;
    };
  }, [activeModuleId, block.type]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectBlock(block.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeBlock(block.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateBlock(block.id);
  };

  return (
    <div
      onClick={handleSelect}
      className={`
        group relative h-full w-full rounded-lg border-2 bg-white p-4 transition-all
        ${isSelected 
          ? 'border-indigo-600 shadow-md z-10' 
          : 'border-transparent hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700'
        }
      `}
    >
      {/* Drag Handle & Actions (Visible on Hover/Select) */}
      <div className={`absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}>
        <button
          onClick={handleDuplicate}
          className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={handleDelete}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div
          className="drag-handle cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          title="Drag to position"
        >
          <GripVertical className="h-4 w-4 pointer-events-none" />
        </div>
      </div>

      {/* Block Content Preview */}
      <div className="min-h-[50px] pointer-events-none select-none">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            <TypeIcon className="h-3 w-3" />
            {block.label || block.type}
        </div>
        
        {/* Real Component Rendering */}
        <div className="w-full h-full relative overflow-hidden">
            <BlockRenderer block={block} module={{} as any} />
        </div>
      </div>

      
      {/* Width indicator */}
      {block.style?.width && block.style.width !== '100%' && (
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-400">
          {block.style.width}
        </div>
      )}
    </div>
  );
}
