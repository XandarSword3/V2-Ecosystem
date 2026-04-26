'use client';

import { UIBlock } from '@/types/module-builder';
import { Module } from '@/lib/settings-context';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api, restaurantApi, poolApi } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useContentTranslation } from '@/lib/translate';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCartStore } from '@/stores/cartStore';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Clock, Users, ShoppingCart, Plus, Minus, Calendar, Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

// Type definitions for menu and session data
interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  image_url?: string;
  image?: string;
  category_id: string;
  is_available: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  sort_order: number;
}

interface PoolSession {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  start_time: string;
  end_time: string;
  capacity: number;
  available_spots?: number;
  price?: number;
  adult_price?: number;
  gender?: 'mixed' | 'male' | 'female';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockProps = Record<string, any>;

interface RendererProps {
  layout: UIBlock[];
  module: Module;
}

// Zod Schema for Run-time Validation
const SafeBlockSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.any()).optional(),
  style: z.record(z.any()).optional(),
  children: z.array(SafeBlockSchema).optional(),
}));

// Helper to parse props - handles both JSON objects and PowerShell-style strings
function parseProps(props: Record<string, unknown>): BlockProps {
  if (!props) return {};

  // If props is already a proper object, return it
  if (typeof props === 'object' && !Array.isArray(props)) {
    // Check if any value looks like a PowerShell object string
    const parsed: BlockProps = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'string' && value.startsWith('@{') && value.endsWith('}')) {
        // Parse PowerShell-style string: @{key=value; key2=value2}
        const inner = value.slice(2, -1);
        const pairs = inner.split(';').map(p => p.trim()).filter(Boolean);
        for (const pair of pairs) {
          const eqIndex = pair.indexOf('=');
          if (eqIndex > 0) {
            const k = pair.slice(0, eqIndex).trim();
            const v = pair.slice(eqIndex + 1).trim();
            parsed[k] = v;
          }
        }
        return parsed;
      }
      parsed[key] = value;
    }
    return parsed;
  }

  return props as BlockProps;
}

export function DynamicModuleRenderer({ layout, module }: RendererProps) {
  // Validate schema version
  const result = z.array(SafeBlockSchema).safeParse(layout);
  if (!result.success) {
    console.error("Schema validation failed", result.error);
    // Fallback UI for P0 requirement
    return <div className="p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">Module content format is incompatible.</div>;
  }
  const safeLayout = result.data as UIBlock[];

  if (!safeLayout || safeLayout.length === 0) {
    return <div className="p-10 text-center">No layout defined for this module.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {safeLayout.map((block) => (
        <BlockRenderer key={block.id} block={block} module={module} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, module }: { block: UIBlock; module: Module }) {
  const { type, style } = block;

  // Validate Block Type
  const KNOWN_TYPES = ['hero', 'container', 'grid', 'text_block', 'image', 'menu_list', 'session_list', 'booking_calendar', 'button', 'form_container', 'testimonials', 'pricing_table'];
  if (!KNOWN_TYPES.includes(type)) {
    return null;
  }

  const props = parseProps(block.props);

  // style object conversion if needed
  const inlineStyle = {
    ...style,
    // ensure background image works if provided in props or style
    backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : style?.backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } as React.CSSProperties;

  switch (type) {
    case 'hero':
      return (
        <section
          style={inlineStyle}
          className="w-full flex items-center justify-center relative overflow-hidden text-white min-h-[300px]"
        >
          {/* Overlay if image exists */}
          {props.backgroundImage && <div className="absolute inset-0 bg-black/40 z-0" />}

          <div className="container relative z-10 px-4 py-20 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{props.title || module.name}</h1>
            <p className="text-xl md:text-2xl opacity-90">{props.subtitle || module.description}</p>
          </div>
        </section>
      );

    case 'container':
      return (
        <div style={inlineStyle} className="container mx-auto px-4 py-8">
          {block.children?.map(child => (
            <BlockRenderer key={child.id} block={child} module={module} />
          ))}
        </div>
      );

    case 'grid':
      const gridCols = props.columns || 3;
      return (
        <div className={`grid grid-cols-1 md:grid-cols-${gridCols} gap-6 container mx-auto px-4 py-8`} style={inlineStyle}>
          {block.children && block.children.length > 0
            ? block.children.map(child => <BlockRenderer key={child.id} block={child} module={module} />)
            : <div className="col-span-full text-center p-8 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">Grid - Add content in the builder</div>
          }
        </div>
      );

    case 'text_block':
      return (
        <div style={inlineStyle} className="prose dark:prose-invert max-w-none container mx-auto px-4 py-8">
          {props.content || 'Empty Text Block'}
        </div>
      );

    case 'image':
      return (
        <div style={inlineStyle} className="w-full container mx-auto px-4 py-4">
          <img
            src={props.src || '/placeholder-image.jpg'}
            alt={props.alt || 'Module Image'}
            className="w-full h-auto rounded-lg shadow-md"
          />
        </div>
      );

    case 'menu_list':
      return <MenuListComponent module={module} props={props} />;

    case 'session_list':
      return <SessionListComponent module={module} props={props} />;

    case 'booking_calendar':
      return <BookingCalendarComponent module={module} props={props} />;

    case 'button':
      const buttonSizeClasses = {
        sm: 'px-4 py-1.5 text-sm',
        md: 'px-6 py-2.5 text-base',
        lg: 'px-8 py-3 text-lg',
      };
      const sizeClass = buttonSizeClasses[props.size as keyof typeof buttonSizeClasses] || buttonSizeClasses.md;
      const isOutline = props.variant === 'outline';
      const isGhost = props.variant === 'ghost';
      const bgColor = props.backgroundColor || '#6366f1';

      const buttonStyle: React.CSSProperties = {
        backgroundColor: isOutline || isGhost ? 'transparent' : bgColor,
        color: isOutline || isGhost ? bgColor : (bgColor === '#ffffff' ? '#1e293b' : '#ffffff'),
        border: isOutline ? `2px solid ${bgColor}` : 'none',
      };

      const ButtonContent = (
        <button
          className={`${sizeClass} rounded-lg font-medium transition-all hover:opacity-90 inline-block`}
          style={buttonStyle}
        >
          {props.text || 'Button'}
        </button>
      );

      return (
        <div style={inlineStyle} className="flex justify-center py-4">
          {props.href ? (
            <a href={props.href} className="no-underline">
              {ButtonContent}
            </a>
          ) : ButtonContent}
        </div>
      );

    case 'form_container':
      return <FormContainerComponent module={module} block={block} props={props} />;

    case 'testimonials':
      return <TestimonialsComponent props={props} />;

    case 'pricing_table':
      return <PricingTableComponent module={module} props={props} />;

    default:
      // This case should be unreachable due to the check above, but as a safety net:
      return null;
  }
}

// ============================================
// Menu List Component for menu_service modules
// ============================================
function MenuListComponent({ module, props }: { module: Module; props: BlockProps }) {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const allItems = useCartStore((s) => s.items);

  const { data, isLoading, error } = useQuery({
    queryKey: ['menu', module.id],
    queryFn: () => restaurantApi.getMenu(module.id),
  });

  const categories: MenuCategory[] = data?.data?.data?.categories || [];
  const items: MenuItem[] = data?.data?.data?.items || [];

  const filteredItems = selectedCategory
    ? items.filter((item) => item.category_id === selectedCategory)
    : items;

  const getItemQuantity = (itemId: string) => {
    const item = allItems.find((i) => i.id === itemId && i.moduleId === module.id);
    return item?.quantity || 0;
  };

  const addToCart = (item: MenuItem) => {
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.name,
      type: 'restaurant' as const,
      imageUrl: item.image_url || item.image
    };
    addItem(cartItem);
    toast.success(`${translateContent(item, 'name')} added to cart`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load menu items
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
          >
            {tCommon('all')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
            >
              {translateContent(cat, 'name')}
            </button>
          ))}
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const qty = getItemQuantity(item.id);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden"
            >
              {item.image_url && (
                <div className="h-48 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={translateContent(item, 'name')}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {translateContent(item, 'name')}
                  </h3>
                  <span className="text-primary-600 font-bold">
                    {formatCurrency(item.price, currency)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                    {translateContent(item, 'description')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {qty > 0 ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold">{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No items available in this category
        </div>
      )}
    </div>
  );
}

// ============================================
// Session List Component for session_access modules
// ============================================
function SessionListComponent({ module, props }: { module: Module; props: BlockProps }) {
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', module.id, selectedDate],
    queryFn: () => poolApi.getSessions(selectedDate, module.id),
  });

  const sessions: PoolSession[] = data?.data?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load sessions
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Date Picker */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <Calendar className="w-5 h-5 text-primary-600" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
        />
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {translateContent(session, 'name')}
                </h3>
                {session.gender && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${session.gender === 'mixed'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : session.gender === 'female'
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                    {session.gender}
                  </span>
                )}
              </div>

              {session.description && (
                <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                  {translateContent(session, 'description')}
                </p>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <Clock className="w-4 h-4 mr-3 text-primary-600" />
                  <span className="text-sm">
                    {session.start_time} - {session.end_time}
                  </span>
                </div>
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <Users className="w-4 h-4 mr-3 text-primary-600" />
                  <span className="text-sm">
                    {session.available_spots || session.capacity} spots available
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(session.adult_price || session.price, currency)}
                  </span>
                  <span className="text-slate-500 text-sm ml-1">/person</span>
                </div>
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Book Now
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No sessions available for this date
        </div>
      )}
    </div>
  );
}

// ============================================
// Booking Calendar Component for multi_day_booking modules
// ============================================
function BookingCalendarComponent({ module, props }: { module: Module; props: BlockProps }) {
  const tCommon = useTranslations('common');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: availabilityResponse } = useQuery({
    queryKey: ['module-availability', module.slug, startDate, endDate],
    queryFn: () => api.get(`/${module.slug}/availability`, { params: { startDate, endDate } }),
    retry: 1,
  });

  const blockedDates: string[] = availabilityResponse?.data?.data?.blockedDates || [];
  const dateRows = Array.from({ length: 30 }).map((_, idx) => {
    const d = new Date(Date.now() + idx * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().split('T')[0];
    return {
      date: iso,
      available: !blockedDates.includes(iso),
    };
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-w-2xl mx-auto">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          {props.title || 'Select Your Dates'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Check-in Date
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Check-out Date
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            />
          </div>
        </div>

        <button
          disabled={!checkIn || !checkOut}
          className="w-full mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search Availability
        </button>

        <div className="mt-6">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Next 30 days</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {dateRows.map((row) => (
              <button
                key={row.date}
                type="button"
                onClick={() => row.available && setCheckIn(row.date)}
                className={`px-2 py-1 rounded text-xs border ${
                  row.available
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-600 cursor-not-allowed'
                }`}
                disabled={!row.available}
                title={row.available ? 'Available' : 'Unavailable'}
              >
                {row.date}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Form Container Component
// ============================================
function FormContainerComponent({ module, block, props }: { module: Module; block: UIBlock; props: BlockProps }) {
  const tCommon = useTranslations('common');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { formAction } = props;
      let subject = 'Contact Form Submission';
      let message = '';

      if (formAction === 'reservation') {
        subject = 'Reservation Request';
        message = `Requested Date: ${formData.date}\nGuests: ${formData.guests}\nNotes: ${formData.notes || 'None'}`;
      } else if (formAction === 'feedback') {
        subject = 'Customer Feedback';
        message = `Rating: ${formData.rating || 'N/A'}\nFeedback: ${formData.feedback}`;
      } else {
        subject = formData.subject || 'Contact Inquiry';
        message = formData.message;
      }

      await api.post('/messaging/inquiries', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject,
        message,
        moduleId: module.id,
        moduleSlug: module.slug,
        moduleName: module.name,
      });

      toast.success('Your request has been submitted successfully!');
      setFormData({});
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to submit form. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default form fields based on formAction
  const getDefaultFields = () => {
    switch (props.formAction) {
      case 'reservation':
        return [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'date', label: 'Preferred Date', type: 'date', required: true },
          { name: 'guests', label: 'Number of Guests', type: 'number', required: true },
          { name: 'notes', label: 'Special Requests', type: 'textarea', required: false },
        ];
      case 'feedback':
        return [
          { name: 'name', label: 'Your Name', type: 'text', required: false },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true },
          { name: 'feedback', label: 'Your Feedback', type: 'textarea', required: true },
        ];
      default: // contact
        return [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'subject', label: 'Subject', type: 'text', required: false },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
        ];
    }
  };

  const fields = getDefaultFields();

  return (
    <div className="container mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-w-xl mx-auto space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                name={field.name}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                rows={4}
              />
            ) : (
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {props.submitText || tCommon('submit')}
        </button>
      </form>
    </div>
  );
}

// ============================================
// Testimonials Component
// ============================================
function TestimonialsComponent({ props }: { props: BlockProps }) {
  const staticTestimonials = [
    { name: 'John Doe', avatar: 'JD', text: 'Amazing experience! The staff was super friendly.', rating: 5 },
    { name: 'Sarah Smith', avatar: 'SS', text: 'The pool was crystal clear and very refreshing.', rating: 4 },
    { name: 'Michael Brown', avatar: 'MB', text: 'Best food I have had in a long time. Will come back!', rating: 5 },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {staticTestimonials.slice(0, props.count || 3).map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              {Array.from({ length: item.rating }).map((_, r) => (
                <Star key={r} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-400 italic mb-6">"{item.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold">
                {item.avatar}
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Pricing Table Component
// ============================================
function PricingTableComponent({ module, props }: { module: Module; props: BlockProps }) {
  const { data: pricingRes } = useQuery({
    queryKey: ['module-pricing', module.slug, module.template_type],
    queryFn: async () => {
      if (module.template_type === 'session_access') {
        return api.get(`/${module.slug}/sessions`);
      }
      return api.get(`/${module.slug}/plans`);
    },
    retry: 1,
  });

  let plans: any[] = [];
  if (module.template_type === 'session_access') {
    plans = (pricingRes?.data?.data || []).map((s: any) => ({
      name: s.name || s.session_name || 'Session',
      price: String(s.price || s.adult_price || 0),
      features: [
        `${s.start_time || ''} - ${s.end_time || ''}`,
        `Capacity: ${s.capacity || 0}`,
      ],
      popular: false,
    }));
  } else if (pricingRes?.data?.data) {
    plans = (pricingRes.data.data || []).map((p: any) => ({
      name: p.name || p.title || 'Plan',
      price: String(p.price || 0),
      features: Array.isArray(p.features) ? p.features : [],
      popular: Boolean(p.popular),
    }));
  } else {
    try {
      plans = typeof props.plans === 'string' ? JSON.parse(props.plans) : (props.plans || []);
    } catch (e) {
      console.error("Failed to parse pricing plans", e);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {props.title && <h2 className="text-3xl font-bold text-center mb-12 dark:text-white">{props.title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan: any, i: number) => (
          <div
            key={i}
            className={`flex flex-col p-8 rounded-3xl border-2 transition-all ${plan.popular
              ? 'border-primary-500 bg-white dark:bg-slate-800 shadow-xl scale-105 z-10'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
          >
            {plan.popular && (
              <span className="bg-primary-500 text-white text-xs font-bold uppercase py-1 px-3 rounded-full self-start mb-4">
                Most Popular
              </span>
            )}
            <h3 className="text-2xl font-bold mb-2 dark:text-white">{plan.name}</h3>
            <div className="text-4xl font-bold mb-6 text-primary-600">{plan.price}</div>
            <ul className="space-y-4 mb-8 flex-grow">
              {plan.features.map((feature: string, f: number) => (
                <li key={f} className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button className={`w-full py-3 px-6 rounded-xl font-bold transition-all ${plan.popular
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}>
              Get Started
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
