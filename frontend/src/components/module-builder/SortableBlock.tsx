import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UIBlock } from '@/types/module-builder';
import { GripVertical, Trash2, Copy, Layout, Type, Image as ImageIcon, Grid, List, Calendar, Clock, Box, MousePointer2, FormInput, Sparkles, Star, BarChart3, Dumbbell, ArrowRight, Divide, Minus, CreditCard, Users } from 'lucide-react';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import { useEffect, useState } from 'react';
import { api, modulesApi } from '@/lib/api';

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

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
                        {liveData ? `${liveData.count || 0} live records. ${liveData.subtitle || ''}` : 'Displays live data from this module'}
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
                        {liveData ? `${liveData.count || 0} sessions connected. ${liveData.subtitle || ''}` : 'Displays bookable sessions with date picker'}
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
                        {liveData ? `${liveData.count || 0} bookings connected. ${liveData.subtitle || ''}` : 'Check-in / Check-out date selection'}
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
            {block.type === 'hero_v2' && (
                <div className="h-36 rounded bg-gradient-to-r from-slate-800 to-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
                    {block.background?.image?.url && (
                        <img src={block.background.image.url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                    )}
                    <div className="relative z-10 text-center">
                        {block.props.eyebrow && <span className="text-xs text-amber-400 block mb-1">{block.props.eyebrow}</span>}
                        <span className="text-lg font-bold block">{block.props.title || 'Hero Title'}</span>
                        {block.props.subtitle && <span className="text-xs opacity-80 block mt-1">{block.props.subtitle}</span>}
                        <div className="flex gap-2 justify-center mt-2">
                            {block.props.primaryButton && <span className="text-[10px] px-2 py-1 bg-amber-500 text-slate-900 rounded">{block.props.primaryButton}</span>}
                            {block.props.secondaryButton && <span className="text-[10px] px-2 py-1 bg-white/20 rounded border border-white/30">{block.props.secondaryButton}</span>}
                        </div>
                    </div>
                </div>
            )}
            {block.type === 'features' && (() => {
                const features = block.props.features || [];
                const parsed = typeof features === 'string' ? (() => { try { return JSON.parse(features); } catch { return []; } })() : features;
                return (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded dark:bg-slate-700/50">
                        {(Array.isArray(parsed) ? parsed : []).slice(0, 4).map((f: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-white rounded shadow-sm dark:bg-slate-600">
                                <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center text-xs text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">✓</div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium truncate dark:text-slate-200">{f.title || 'Feature'}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{f.description || ''}</div>
                                </div>
                            </div>
                        ))}
                        {(!Array.isArray(parsed) || parsed.length === 0) && <div className="col-span-2 text-center text-xs text-slate-400 py-2">No features defined</div>}
                    </div>
                );
            })()}
            {block.type === 'stats' && (() => {
                const stats = block.props.stats || [];
                const parsed = typeof stats === 'string' ? (() => { try { return JSON.parse(stats); } catch { return []; } })() : stats;
                return (
                    <div className="flex justify-around p-3 bg-slate-50 rounded dark:bg-slate-700/50">
                        {(Array.isArray(parsed) ? parsed : []).slice(0, 4).map((s: any, i: number) => (
                            <div key={i} className="text-center">
                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{s.value || '0'}</div>
                                <div className="text-[10px] text-slate-500">{s.label || 'Label'}</div>
                            </div>
                        ))}
                        {(!Array.isArray(parsed) || parsed.length === 0) && <div className="text-xs text-slate-400">No stats defined</div>}
                    </div>
                );
            })()}
            {block.type === 'card_grid' && (() => {
                const cards = block.props.cards || [];
                const parsed = typeof cards === 'string' ? (() => { try { return JSON.parse(cards); } catch { return []; } })() : cards;
                const cols = block.props.columns || 3;
                return (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                        {(Array.isArray(parsed) ? parsed : []).slice(0, 3).map((c: any, i: number) => (
                            <div key={i} className="p-2 bg-gradient-to-br from-white/80 to-white/50 rounded border border-slate-200 dark:from-slate-700/80 dark:to-slate-700/50 dark:border-slate-600">
                                <div className="text-xs font-medium dark:text-slate-200">{c.title || 'Card'}</div>
                                <div className="text-[10px] text-slate-500 truncate">{c.description || ''}</div>
                            </div>
                        ))}
                        {(!Array.isArray(parsed) || parsed.length === 0) && Array.from({ length: cols }).map((_, i) => (
                            <div key={i} className="h-14 bg-slate-100 rounded dark:bg-slate-700 flex items-center justify-center">
                                <span className="text-xs text-slate-400">Card {i + 1}</span>
                            </div>
                        ))}
                    </div>
                );
            })()}
            {block.type === 'class_schedule' && (() => {
                const classes = block.props.classes || [];
                const parsed = typeof classes === 'string' ? (() => { try { return JSON.parse(classes); } catch { return []; } })() : classes;
                return (
                    <div className="space-y-1 p-2 bg-slate-800 rounded">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-amber-500 font-semibold uppercase">{block.props.subtitle || 'Upcoming Sessions'}</span>
                            <span className="text-xs text-white font-bold">{block.props.title || 'Next Classes'}</span>
                        </div>
                        {(Array.isArray(parsed) ? parsed : []).slice(0, 3).map((c: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-white p-1.5 bg-slate-700/50 rounded">
                                <span className="text-amber-500">{c.icon === 'Dumbbell' ? '💪' : c.icon === 'Sparkles' ? '✨' : c.icon === 'Zap' ? '⚡' : c.icon === 'Heart' ? '❤️' : '•'}</span>
                                <span className="flex-1 truncate">{c.name || 'Class'}</span>
                                <span className="text-slate-400">{c.time?.split(' - ')[0] || ''}</span>
                            </div>
                        ))}
                        {(!Array.isArray(parsed) || parsed.length === 0) && <div className="text-[10px] text-slate-400 text-center py-1">No classes defined</div>}
                    </div>
                );
            })()}
            {block.type === 'calendar' && (
                <div className="p-2 bg-slate-800 rounded">
                    <div className="text-xs text-white font-bold mb-2">{block.props.title || 'Calendar'}</div>
                    <div className="grid grid-cols-7 gap-1">
                        {['M','T','W','T','F','S','S'].map((d, i) => (
                            <div key={i} className="text-[8px] text-slate-500 text-center">{d}</div>
                        ))}
                        {Array.from({length: 14}).map((_, i) => (
                            <div key={i} className="w-4 h-4 bg-slate-700 rounded text-[8px] text-white flex items-center justify-center">{i+1}</div>
                        ))}
                    </div>
                </div>
            )}
            {block.type === 'testimonials_carousel' && (() => {
                const testimonials = block.props.testimonials || [];
                const parsed = typeof testimonials === 'string' ? (() => { try { return JSON.parse(testimonials); } catch { return []; } })() : testimonials;
                return (
                    <div>
                        <div className="text-center mb-2">
                            <span className="text-[10px] text-amber-500 font-semibold uppercase">{block.props.subtitle || 'Testimonials'}</span>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{block.props.title || 'Reviews'}</div>
                        </div>
                        <div className="flex gap-2">
                            {(Array.isArray(parsed) ? parsed : []).slice(0, 2).map((t: any, i: number) => (
                                <div key={i} className="flex-1 p-2 bg-slate-50 rounded shadow-sm dark:bg-slate-700">
                                    <div className="text-amber-500 text-[10px] mb-1">{'★'.repeat(t.rating || 5)}</div>
                                    <div className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">"{t.text || 'Review'}"</div>
                                    <div className="text-[10px] text-slate-400 mt-1">— {t.name || 'User'}</div>
                                </div>
                            ))}
                            {(!Array.isArray(parsed) || parsed.length === 0) && <div className="text-xs text-slate-400 py-2">No testimonials defined</div>}
                        </div>
                    </div>
                );
            })()}
            {block.type === 'pricing_table' && (() => {
                const plans = block.props.plans || [];
                const parsed = typeof plans === 'string' ? (() => { try { return JSON.parse(plans); } catch { return []; } })() : plans;
                return (
                    <div>
                        {block.props.title && <div className="text-xs font-bold text-center mb-2 dark:text-slate-200">{block.props.title}</div>}
                        <div className="flex gap-2">
                            {(Array.isArray(parsed) ? parsed : []).slice(0, 3).map((p: any, i: number) => (
                                <div key={i} className={`flex-1 p-2 rounded text-center text-xs ${p.popular ? 'bg-indigo-100 border border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700' : 'bg-slate-50 dark:bg-slate-700'}`}>
                                    <div className="font-semibold dark:text-slate-200">{p.name || 'Plan'}</div>
                                    <div className="text-indigo-600 font-bold dark:text-indigo-400">{p.price || '$0'}</div>
                                    {p.popular && <div className="text-[8px] text-indigo-600 mt-1">★ Popular</div>}
                                </div>
                            ))}
                            {(!Array.isArray(parsed) || parsed.length === 0) && <div className="text-xs text-slate-400 py-2">No plans defined</div>}
                        </div>
                    </div>
                );
            })()}
            {block.type === 'cta' && (
                <div className="p-4 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-center text-white">
                    <div className="text-sm font-bold">{block.props.title || 'CTA Title'}</div>
                    {block.props.description && <div className="text-xs opacity-80 mt-1">{block.props.description}</div>}
                    <div className="mt-2 px-3 py-1 bg-white text-slate-900 rounded inline-block text-xs">{block.props.buttonText || 'Get Started'}</div>
                </div>
            )}
            {block.type === 'divider' && (
                <div className="py-3 flex items-center justify-center">
                    <div className="w-1/2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${block.props.accentColor || '#6366f1'}40, transparent)` }}></div>
                </div>
            )}
            {block.type === 'spacer' && (
                <div className="flex items-center justify-center text-slate-400 text-xs" style={{ height: Math.min(Number(block.props.height) || 40, 80) }}>
                    Spacer ({block.props.height || 40}px)
                </div>
            )}
            {block.type === 'testimonials' && (
                <div className="p-3 bg-amber-50 rounded border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Users className="h-5 w-5" />
                        <span className="text-sm font-medium">Testimonials</span>
                    </div>
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                        Displays {block.props.count || 3} testimonials{block.props.showRatings ? ' with ratings' : ''}
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
