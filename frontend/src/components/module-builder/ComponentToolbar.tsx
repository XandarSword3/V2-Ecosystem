import { useModuleBuilderStore } from '@/store/module-builder-store';
import { Layout, Type, Image as ImageIcon, Grid, List, Box, Calendar, Clock, LucideIcon } from 'lucide-react';
import { UIComponentType } from '@/types/module-builder';

const COMPONENTS: { type: UIComponentType; label: string; icon: LucideIcon }[] = [
  { type: 'hero', label: 'Hero Section', icon: Layout },
  { type: 'text_block', label: 'Text Block', icon: Type },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'grid', label: 'Grid / Cards', icon: Grid },
  { type: 'menu_list', label: 'Menu List', icon: List },
  { type: 'session_list', label: 'Sessions', icon: Clock },
  { type: 'container', label: 'Container', icon: Box },
  { type: 'booking_calendar', label: 'Calendar', icon: Calendar },
];

export function ComponentToolbar() {
  const { addBlock } = useModuleBuilderStore();

  return (
    <div className="flex h-full items-center gap-4 overflow-x-auto py-2">
      <span className="text-sm font-semibold text-slate-500 whitespace-nowrap mr-2">
        Add Component:
      </span>
      {COMPONENTS.map((comp) => (
        <button
          key={comp.type}
          onClick={() => addBlock(comp.type)}
          className="flex flex-col items-center justify-center gap-1 min-w-[80px] h-16 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-slate-100 hover:border-indigo-500 hover:text-indigo-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600 transition-all"
        >
          <comp.icon className="h-5 w-5" />
          <span className="text-xs font-medium">{comp.label}</span>
        </button>
      ))}
    </div>
  );
}
