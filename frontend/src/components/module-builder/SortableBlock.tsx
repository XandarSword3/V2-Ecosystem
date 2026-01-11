import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UIBlock } from '@/types/module-builder';
import { GripVertical, Trash2 } from 'lucide-react';
import { useModuleBuilderStore } from '@/store/module-builder-store';

interface SortableBlockProps {
  block: UIBlock;
}

export function SortableBlock({ block }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const { selectBlock, selectedBlockId, removeBlock } = useModuleBuilderStore();
  const isSelected = selectedBlockId === block.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectBlock(block.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeBlock(block.id);
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
      <div className={`absolute right-2 top-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}>
        <button
          onClick={handleDelete}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Block Content Review */}
      <div className="min-h-[50px] pointer-events-none select-none">
        <div className="mb-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            {block.label || block.type}
        </div>
        
        {/* Placeholder Preview Rendering */}
        <div className="opacity-70">
            {block.type === 'hero' && (
                <div className="h-32 rounded bg-slate-100 flex items-center justify-center dark:bg-slate-700">
                    <span className="text-xl font-bold">{block.props.title || 'Hero Title'}</span>
                </div>
            )}
            {block.type === 'grid' && (
                <div className="grid grid-cols-3 gap-2">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded dark:bg-slate-700"/>)}
                </div>
            )}
            {block.type === 'image' && (
                 <div className="h-40 rounded bg-slate-100 flex items-center justify-center dark:bg-slate-700">Image Placeholder</div>
            )}
            {block.type !== 'hero' && block.type !== 'grid' && block.type !== 'image' && (
                <div className="p-2 border border-dashed rounded text-sm text-center text-slate-500">
                    Configurable {block.type} component
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
