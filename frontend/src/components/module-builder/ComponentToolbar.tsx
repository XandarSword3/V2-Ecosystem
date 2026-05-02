import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { Layout, Type, Image as ImageIcon, Grid, List, Box, Calendar, CalendarDays, Clock, MousePointer2, FormInput, LucideIcon, Users, CreditCard, Star, Dumbbell, Sparkles, Zap, ArrowRight, BarChart3, Divide, Minus } from 'lucide-react';
import { UIComponentType } from '@/types/module-builder';

type ComponentCategory = 'layout' | 'content' | 'gym' | 'utility';

interface ComponentEntry {
  type: UIComponentType;
  label: string;
  icon: LucideIcon;
  category: ComponentCategory;
}

const COMPONENTS: ComponentEntry[] = [
  // LAYOUT
  { type: 'hero', label: 'Hero (Simple)', icon: Layout, category: 'layout' },
  { type: 'hero_v2', label: 'Hero (Advanced)', icon: Sparkles, category: 'layout' },
  { type: 'container', label: 'Container', icon: Box, category: 'layout' },
  { type: 'card_grid', label: 'Card Grid', icon: Grid, category: 'layout' },

  // CONTENT
  { type: 'text_block', label: 'Text Block', icon: Type, category: 'content' },
  { type: 'image', label: 'Image', icon: ImageIcon, category: 'content' },
  { type: 'button', label: 'Button', icon: MousePointer2, category: 'content' },
  { type: 'features', label: 'Features', icon: Star, category: 'content' },
  { type: 'stats', label: 'Stats', icon: BarChart3, category: 'content' },
  { type: 'testimonials_carousel', label: 'Testimonials', icon: Users, category: 'content' },
  { type: 'pricing_table', label: 'Pricing Table', icon: CreditCard, category: 'content' },
  { type: 'cta', label: 'CTA Section', icon: ArrowRight, category: 'content' },

  // GYM / MODULE-SPECIFIC
  { type: 'menu_list', label: 'Menu List', icon: List, category: 'gym' },
  { type: 'session_list', label: 'Sessions', icon: Clock, category: 'gym' },
  { type: 'class_schedule', label: 'Class Schedule', icon: Dumbbell, category: 'gym' },
  { type: 'booking_calendar', label: 'Booking Calendar', icon: CalendarDays, category: 'gym' },
  { type: 'calendar', label: 'Mini Calendar', icon: Calendar, category: 'gym' },
  { type: 'form_container', label: 'Form', icon: FormInput, category: 'gym' },

  // UTILITY
  { type: 'divider', label: 'Divider', icon: Divide, category: 'utility' },
  { type: 'spacer', label: 'Spacer', icon: Minus, category: 'utility' },
];

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: 'Layout',
  content: 'Content',
  gym: 'Module',
  utility: 'Utility',
};

export function ComponentToolbar() {
  const { addBlock } = useModuleBuilderStore();

  const categories = Object.keys(CATEGORY_LABELS) as ComponentCategory[];

  return (
    <div className="flex h-full items-center gap-4 overflow-x-auto py-2">
      <span className="text-sm font-semibold text-slate-500 whitespace-nowrap mr-2">
        Add:
      </span>
      {categories.map((category) => (
        <div key={category} className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">
            {CATEGORY_LABELS[category]}
          </span>
          {COMPONENTS.filter(c => c.category === category).map((comp) => (
            <button
              key={comp.type}
              onClick={() => addBlock(comp.type)}
              className="flex flex-col items-center justify-center gap-1 min-w-[72px] h-14 rounded-lg border border-slate-200 bg-slate-50 p-1.5 hover:bg-slate-100 hover:border-indigo-500 hover:text-indigo-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              <comp.icon className="h-4 w-4" />
              <span className="text-[10px] font-medium leading-tight">{comp.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
        </div>
      ))}
    </div>
  );
}
