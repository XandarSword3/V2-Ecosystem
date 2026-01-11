'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { chaletsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useContentTranslation } from '@/lib/translate';
import { Loader2, Home, Users, Bed, Bath, Wifi, Wind, UtensilsCrossed, Car, AlertCircle, Star, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuroraSection } from '@/components/effects/AuroraBackground';
import { Card3D, TiltCard, FloatingCard } from '@/components/effects/Card3D';
import { SpotlightCard } from '@/components/effects/GlowingBorder';
import { GradientText, RevealHeading } from '@/components/effects/TextEffects';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';

interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  capacity: number;
  // Support both camelCase and snake_case from API
  bedroomCount?: number;
  bedroom_count?: number;
  bathroomCount?: number;
  bathroom_count?: number;
  amenities?: string[] | null;
  images?: string[] | null;
  basePrice?: number;
  base_price?: number;
  weekendPrice?: number;
  weekend_price?: number;
  isActive?: boolean;
  is_active?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
}

const amenityIcons: Record<string, React.ElementType> = {
  WiFi: Wifi,
  AC: Wind,
  Kitchen: UtensilsCrossed,
  Parking: Car,
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const
    }
  }
};

export default function ChaletsPage() {
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent, isRTL } = useContentTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['chalets'],
    queryFn: () => chaletsApi.getChalets(),
  });

  const chalets: Chalet[] = data?.data?.data || [];

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
            <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
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
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-emerald-500 to-teal-500 dark:from-green-800 dark:via-emerald-700 dark:to-teal-800">
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
            <span className="text-white font-medium">{t('luxuryStay')}</span>
          </motion.div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            {t('title')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-10">
            {t('subtitle')}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              { value: chalets.length, label: tCommon('chalets'), icon: <Home className="w-5 h-5" /> },
              { value: chalets.reduce((max, c) => Math.max(max, c.capacity || 0), 0), suffix: '+', label: tCommon('maxGuests'), icon: <Users className="w-5 h-5" /> },
              { value: 5.0, label: tCommon('starRating'), icon: <Star className="w-5 h-5 fill-current" /> },
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
        
        {/* Wave Bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-emerald-50/50 dark:fill-slate-900"/>
          </svg>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Chalets Grid */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {chalets.map((chalet, index) => (
            <TiltCard key={chalet.id} intensity={6} className="h-full">
              <motion.div 
                className="group h-full"
                variants={cardVariants}
              >
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-50 transition-opacity duration-500" />
                
                <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl overflow-hidden border border-white/30 dark:border-slate-700/50 rounded-2xl shadow-xl h-full flex flex-col">
                  {/* Image Gallery */}
                  <div className="relative h-80 overflow-hidden">
                    {chalet.images && chalet.images.length > 0 ? (
                      <img
                        src={chalet.images[0]}
                        alt={translateContent(chalet, 'name')}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="h-full bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 dark:from-green-900/30 dark:via-emerald-800/30 dark:to-teal-900/30 flex items-center justify-center">
                        <motion.div
                          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <Home className="w-24 h-24 text-green-500/50" />
                        </motion.div>
                      </div>
                    )}
                    
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    
                    {/* Featured badge */}
                    {(chalet.isFeatured || chalet.is_featured) && (
                      <motion.div 
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="absolute top-4 left-4"
                      >
                        <span className="flex items-center bg-gradient-to-r from-yellow-400 to-amber-400 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-amber-500/30">
                          <Star className="w-4 h-4 mr-1.5 fill-current" />
                          {tCommon('featured')}
                        </span>
                      </motion.div>
                    )}
                    
                    {/* Price badge */}
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="absolute bottom-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl px-5 py-3 shadow-xl border border-white/20"
                    >
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{tCommon('from')}</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(chalet.basePrice ?? chalet.base_price ?? 0, currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tCommon('perNight')}</p>
                    </motion.div>
                    
                    {/* Name overlay */}
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-3xl font-bold text-white drop-shadow-lg">{translateContent(chalet, 'name')}</h3>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Description */}
                    {translateContent(chalet, 'description') && (
                      <p className="text-slate-600 dark:text-slate-400 mb-5 line-clamp-2">
                        {translateContent(chalet, 'description')}
                      </p>
                    )}

                    {/* Specs - Glass Card */}
                    <div className="grid grid-cols-3 gap-4 mb-5 p-4 bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-slate-700/50 dark:to-slate-600/50 backdrop-blur-sm rounded-xl border border-green-100/50 dark:border-slate-600/50">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-2">
                          <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.capacity}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('guests')}</span>
                      </div>
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-2">
                          <Bed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.bedroomCount ?? chalet.bedroom_count ?? 0}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('bedrooms')}</span>
                      </div>
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center mb-2">
                          <Bath className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.bathroomCount ?? chalet.bathroom_count ?? 0}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('bathrooms')}</span>
                      </div>
                    </div>

                    {/* Amenities */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {(chalet.amenities || []).slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] || Home;
                        return (
                          <motion.span
                            key={amenity}
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="inline-flex items-center px-3 py-1.5 bg-green-50/80 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium backdrop-blur-sm border border-green-100/50 dark:border-green-800/50"
                          >
                            <Icon className="w-4 h-4 mr-1.5" />
                            {amenity}
                          </motion.span>
                        );
                      })}
                      {(chalet.amenities || []).length > 4 && (
                        <span className="inline-flex items-center px-3 py-1.5 bg-slate-100/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400 rounded-full text-sm backdrop-blur-sm">
                          +{(chalet.amenities || []).length - 4} {tCommon('andMore')}
                        </span>
                      )}
                    </div>

                    {/* Weekend Price Notice */}
                    <div className="bg-gradient-to-r from-amber-50/80 to-yellow-50/80 dark:from-amber-900/20 dark:to-yellow-900/20 backdrop-blur-sm border border-amber-200/50 dark:border-amber-700/50 rounded-xl p-3.5 mb-5">
                      <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                        <Star className="w-4 h-4 mr-2 text-amber-500" />
                        <span className="font-semibold mr-2">{t('weekendRate')}:</span> 
                        <span className="font-bold">{formatCurrency(chalet.weekendPrice ?? chalet.weekend_price ?? 0, currency)}</span>
                        <span className="ml-1 opacity-80">{tCommon('perNight')} (Fri-Sat)</span>
                      </p>
                    </div>

                    <Link
                      href={`/chalets/${chalet.id}`}
                      className="mt-auto"
                    >
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2 group/btn"
                      >
                        {t('viewDetailsBook')}
                        <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                      </motion.button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </TiltCard>
          ))}
        </motion.div>

        {chalets.length === 0 && (
          <motion.div 
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FloatingCard className="max-w-md mx-auto">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/30">
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Home className="w-20 h-20 text-green-300 dark:text-green-600 mx-auto mb-6" />
                </motion.div>
                <GradientText 
                  from="from-green-500" 
                  via="via-emerald-500" 
                  to="to-teal-500"
                  className="text-2xl font-bold mb-3 block"
                >
                  {t('noChaletsAvailable')}
                </GradientText>
                <p className="text-slate-600 dark:text-slate-400">{tCommon('checkBackLater')}</p>
              </div>
            </FloatingCard>
          </motion.div>
        )}

        {/* Info Section with Spotlight Cards */}
        <motion.div 
          className="mt-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <RevealHeading className="text-3xl md:text-4xl font-bold text-center mb-12">
            <GradientText from="from-green-500" via="via-emerald-500" to="to-teal-500">
              {t('bookingInfo.title')}
            </GradientText>
          </RevealHeading>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: MapPin,
                iconBg: 'bg-green-100 dark:bg-green-900/50',
                iconColor: 'text-green-600 dark:text-green-400',
                title: `${t('bookingInfo.checkIn')} / ${t('bookingInfo.checkOut')}`,
                content: (
                  <>
                    {t('bookingInfo.checkIn')}: {t('bookingInfo.checkInTime')}<br />
                    {t('bookingInfo.checkOut')}: {t('bookingInfo.checkOutTime')}
                  </>
                ),
                gradientFrom: 'rgba(34, 197, 94, 0.15)'
              },
              {
                icon: Star,
                iconBg: 'bg-blue-100 dark:bg-blue-900/50',
                iconColor: 'text-blue-600 dark:text-blue-400',
                title: t('bookingInfo.deposit'),
                content: t('bookingInfo.depositDescription'),
                gradientFrom: 'rgba(59, 130, 246, 0.15)'
              },
              {
                icon: AlertCircle,
                iconBg: 'bg-amber-100 dark:bg-amber-900/50',
                iconColor: 'text-amber-600 dark:text-amber-400',
                title: t('bookingInfo.cancellationPolicy'),
                content: t('bookingInfo.cancellationDescription'),
                gradientFrom: 'rgba(245, 158, 11, 0.15)'
              }
            ].map((item, index) => (
              <SpotlightCard 
                key={index}
                spotlightColor={item.gradientFrom}
                className="h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-slate-700/50 h-full"
                >
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className={`w-14 h-14 ${item.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-5`}
                  >
                    <item.icon className={`w-7 h-7 ${item.iconColor}`} />
                  </motion.div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-3">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {item.content}
                  </p>
                </motion.div>
              </SpotlightCard>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
