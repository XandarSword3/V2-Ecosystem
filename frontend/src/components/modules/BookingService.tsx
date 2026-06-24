'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, Calendar, Users, Home, Bed, Bath, Wifi, Wind, UtensilsCrossed, Car, Star, Sparkles, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContentTranslation } from '@/lib/translate';
import { motion } from 'framer-motion';
import { Module } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRouter } from 'next/navigation';
import { SpotlightCard } from '@/components/effects/GlowingBorder';
import { FloatingCard } from '@/components/effects/Card3D';
import { GradientText, RevealHeading } from '@/components/effects/TextEffects';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';
import { ModuleHero, GlassSearch, CategoryPills, GlassCard } from './';

interface BookingServiceProps {
  module: Module;
}

interface BookingUnit {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  images?: string[];
  price_per_night?: number;
  base_price?: number;
  basePrice?: number;
  weekend_price?: number;
  weekendPrice?: number;
  capacity?: number;
  bedroom_count?: number;
  bedroomCount?: number;
  bathroom_count?: number;
  bathroomCount?: number;
  amenities?: string[] | null;
  is_featured?: boolean;
  isFeatured?: boolean;
}

const amenityIcons: Record<string, React.ElementType> = {
  WiFi: Wifi,
  wifi: Wifi,
  AC: Wind,
  ac: Wind,
  'Air Conditioning': Wind,
  Kitchen: UtensilsCrossed,
  kitchen: UtensilsCrossed,
  Parking: Car,
  parking: Car,
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } }
};

export function BookingService({ module }: BookingServiceProps) {
  const t = useTranslations('bookingService');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bookable_units', module.id],
    queryFn: () => api.get(`/${module.slug}/availability`),
  });

  const units: BookingUnit[] = data?.data?.data || [];

  // Get module-specific colors or use defaults
  const headerColor = module.settings?.header_color || '#059669';
  const accentColor = module.settings?.accent_color || '#0d9488';
  const depositPercent = module.settings?.depositPercent || 30;

  const getBedroomCount = (u: BookingUnit) => u.bedroom_count || u.bedroomCount || 0;
  const getBathroomCount = (u: BookingUnit) => u.bathroom_count || u.bathroomCount || 0;
  const getBasePrice = (u: BookingUnit) => u.base_price || u.basePrice || u.price_per_night || 0;
  const isFeatured = (u: BookingUnit) => u.is_featured || u.isFeatured || false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-green-600 relative" />
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">{tCommon('loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <FloatingCard>
          <div className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/30">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{tCommon('error')}</h2>
            <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater') || 'Please try again later'}</p>
          </div>
        </FloatingCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-white to-green-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section - New glassmorphic component */}
      <ModuleHero
        title={module.name}
        description={module.description || t('subtitle')}
        headerColor={headerColor}
        accentColor={accentColor}
        badgeText={t('luxuryStay') || 'Premium Stay'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Units Grid */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {units.map((unit) => {
            const featured = isFeatured(unit);

            return (
              <SpotlightCard
                key={unit.id}
                spotlightColor={featured ? "rgba(16, 185, 129, 0.25)" : "rgba(20, 184, 166, 0.15)"}
                className="h-full"
              >
                <motion.div
                  variants={cardVariants}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/30 dark:border-slate-700/50 flex flex-col md:flex-row h-full"
                  whileHover={{ y: -4 }}
                >
                  {/* Image */}
                  <div className="md:w-1/2 h-64 md:h-auto relative">
                    {unit.images && unit.images[0] ? (
                      <img
                        src={unit.images[0]}
                        alt={translateContent(unit, 'name')}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                        <Home className="w-16 h-16 text-emerald-300 dark:text-slate-500" />
                      </div>
                    )}
                    {/* Featured Badge */}
                    {featured && (
                      <div className="absolute top-3 left-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-3.5 h-3.5" />
                        Featured
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 md:w-1/2 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {translateContent(unit, 'name')}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                        {translateContent(unit, 'description')}
                      </p>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{unit.capacity} Guests</span>
                        </div>
                        {getBedroomCount(unit) > 0 && (
                          <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            <span>{getBedroomCount(unit)} Beds</span>
                          </div>
                        )}
                        {getBathroomCount(unit) > 0 && (
                          <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            <span>{getBathroomCount(unit)} Baths</span>
                          </div>
                        )}
                      </div>

                      {/* Amenity Icons */}
                      {unit.amenities && unit.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {unit.amenities.map((amenity) => {
                            const Icon = amenityIcons[amenity] || MapPin;
                            return (
                              <span
                                key={amenity}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium"
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {amenity}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                      <div>
                        <span className="text-2xl font-bold text-primary-600">
                          {formatCurrency(getBasePrice(unit), currency)}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">/ night</span>
                        {Number(depositPercent) > 0 && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {depositPercent}% deposit required
                          </p>
                        )}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push(`/${module.slug}/${unit.id}?module=${module.id}`)}
                        className="px-6 py-2 text-white rounded-xl font-semibold transition-colors shadow-lg"
                        style={{ background: `linear-gradient(to right, ${headerColor}, ${accentColor})` }}
                      >
                        {t('bookNow')}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </SpotlightCard>
            );
          })}
        </motion.div>

        {units.length === 0 && (
          <FloatingCard className="w-full">
            <div className="p-12 text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl">
              <Home className="w-20 h-20 text-emerald-300 mx-auto mb-6" />
              <GradientText from="from-emerald-500" via="via-green-500" to="to-teal-500" className="text-xl font-bold mb-2 block">
                No units available
              </GradientText>
              <p className="text-slate-600 dark:text-slate-400">Please check back later for availability.</p>
            </div>
          </FloatingCard>
        )}
      </main>
    </div>
  );
}
