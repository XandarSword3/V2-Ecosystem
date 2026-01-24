import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UIBlock } from '@/types/module-builder';
import { GripVertical, Trash2, Copy, Layout, Type, Image as ImageIcon, Grid, List, Calendar, Clock, Box, MousePointer2, FormInput } from 'lucide-react';
import { useModuleBuilderStore } from '@/store/module-builder-store';

interface SortableBlockProps {
  block: UIBlock;
}

const typeIcons: Record<string, any> = {
  hero: Layout,
  text_block: Type,
  image: ImageIcon,
  grid: Grid,
  menu_list: List,
  session_list: Clock,
  booking_calendar: Calendar,
  container: Box,
  form_container: FormInput,
  button: MousePointer2,
};

export function SortableBlock({ block }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const { selectBlock, selectedBlockId, removeBlock, duplicateBlock } = useModuleBuilderStore();
  const isSelected = selectedBlockId === block.id;
  const TypeIcon = typeIcons[block.type] || Box;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: block.style?.width || '100%',
  };

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
      ref={setNodeRef}
      style={style}
      onClick={handleSelect}
      className={`
        group relative mb-4 rounded-lg border-2 bg-white p-4 transition-all
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
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Block Content Preview */}
      <div className="min-h-[50px] pointer-events-none select-none">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            <TypeIcon className="h-3 w-3" />
            {block.label || block.type}
        </div>
        
        {/* Placeholder Preview Rendering */}
        <div className="opacity-70">
            {block.type === 'hero' && (
                <div className="h-32 rounded bg-gradient-to-r from-indigo-500 to-purple-500 flex flex-col items-center justify-center text-white">
                    <span className="text-xl font-bold">{block.props.title || 'Hero Title'}</span>
                    <span className="text-sm opacity-80">{block.props.subtitle || 'Subtitle text'}</span>
                </div>
            )}
            {block.type === 'grid' && (
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${block.props.columns || 3}, 1fr)` }}>
                    {Array.from({ length: parseInt(block.props.columns || '3') }).map((_, i) => (
                      <div key={i} className="h-16 bg-slate-100 rounded dark:bg-slate-700 flex items-center justify-center">
                        <span className="text-xs text-slate-400">Item {i + 1}</span>
                      </div>
                    ))}
                </div>
            )}
            {block.type === 'image' && (
                 <div className="h-40 rounded bg-slate-100 flex items-center justify-center dark:bg-slate-700">
                   <ImageIcon className="h-8 w-8 text-slate-400" />
                 </div>
            )}
            {block.type === 'text_block' && (
                <div className="p-3 bg-slate-50 rounded dark:bg-slate-700/50">
                    <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                        {block.props.content || 'Text content will appear here...'}
                    </div>
                </div>
            )}
            {block.type === 'menu_list' && (
                <div className="p-3 bg-amber-50 rounded border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <List className="h-5 w-5" />
                        <span className="text-sm font-medium">Menu Items List</span>
                    </div>
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                        Displays menu items from this module
                    </div>
                </div>
            )}
            {block.type === 'session_list' && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-medium">Session Booking</span>
                    </div>
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-500">
                        Displays bookable sessions with date picker
                    </div>
                </div>
            )}
            {block.type === 'booking_calendar' && (
                <div className="p-3 bg-green-50 rounded border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Calendar className="h-5 w-5" />
                        <span className="text-sm font-medium">Booking Calendar</span>
                    </div>
                    <div className="mt-2 text-xs text-green-600 dark:text-green-500">
                        Check-in / Check-out date selection
                    </div>
                </div>
            )}
            {block.type === 'button' && (
                <div className="flex justify-center">
                    <button 
                        className="px-6 py-2 rounded-lg font-medium text-white transition-colors"
                        style={{ 
                            backgroundColor: block.props.backgroundColor || '#6366f1',
                        }}
                    >
                        {block.props.text || 'Button'}
                    </button>
                </div>
            )}
            {block.type === 'container' && (
                <div className="p-3 border-2 border-dashed border-slate-300 rounded min-h-[60px] dark:border-slate-600">
                    <div className="text-xs text-slate-400 text-center">
                        Container - Drop components here
                    </div>
                </div>
            )}
            {block.type === 'form_container' && (
                <div className="p-3 bg-purple-50 rounded border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                        <Box className="h-5 w-5" />
                        <span className="text-sm font-medium">Form Container</span>
                    </div>
                </div>
            )}
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
