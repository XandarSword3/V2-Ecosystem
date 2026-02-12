'use client';

import { useQuery } from '@tanstack/react-query';
import { chaletsApi as chaletApi } from '@/lib/api';
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
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['chalets', module.id],
    queryFn: () => chaletApi.getChalets(module.id),
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
      {/* Hero Section with Aurora Effect */}
      <div className="relative min-h-[50vh] overflow-hidden">
        {/* Aurora Background */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${headerColor}, ${accentColor})` }}
        >
          {/* Animated Blobs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, -40, 0], y: [0, -50, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute bottom-1/4 left-1/2 w-72 h-72 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/10" />

        {/* Wave Bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-emerald-50/50 dark:fill-slate-900" />
          </svg>
        </div>

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col items-center justify-center min-h-[50vh] px-4 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="mb-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30"
          >
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-white font-medium">{t('luxuryStay') || 'Premium Stay'}</span>
          </motion.div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            {module.name}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-10">
            {module.description || t('subtitle')}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              { value: units.length, label: tCommon('chalets') || 'Units', icon: <Home className="w-5 h-5" /> },
              { value: units.reduce((max, c) => Math.max(max, c.capacity || 0), 0), suffix: '+', label: tCommon('maxGuests') || 'Max Guests', icon: <Users className="w-5 h-5" /> },
              { value: 5.0, label: tCommon('starRating') || 'Star Rating', icon: <Star className="w-5 h-5 fill-current" /> },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ y: -4, scale: 1.05 }}
                className="bg-white/20 backdrop-blur-xl rounded-2xl px-8 py-4 border border-white/30 text-white"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-3xl font-bold">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={2} decimals={stat.value % 1 !== 0 ? 1 : 0} />
                  </span>
                </div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

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
