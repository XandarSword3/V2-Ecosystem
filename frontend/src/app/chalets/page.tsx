'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { chaletsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useContentTranslation } from '@/lib/translate';
import { Loader2, Home, Users, Bed, Bath, Wifi, Wind, UtensilsCrossed, Car, AlertCircle, Star, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  capacity: number;
  bedroomCount: number;
  bathroomCount: number;
  amenities?: string[] | null;
  images?: string[] | null;
  basePrice: number;
  weekendPrice: number;
  isActive: boolean;
  isFeatured?: boolean;
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
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-slate-600 dark:text-slate-400">{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{tCommon('error')}</h2>
          <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-resort-sand via-white to-resort-sand dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative h-64 bg-gradient-to-r from-green-600 to-emerald-500 dark:from-green-800 dark:to-emerald-700 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <motion.div 
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg md:text-xl opacity-90">{t('subtitle')}</p>
          </div>
        </motion.div>
        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-resort-sand dark:from-slate-900" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        {/* Chalets Grid */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {chalets.map((chalet, index) => (
            <motion.div 
              key={chalet.id} 
              className="group card overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500"
              variants={cardVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
            >
              {/* Image Gallery */}
              <div className="relative h-72 overflow-hidden">
                {chalet.images && chalet.images.length > 0 ? (
                  <img
                    src={chalet.images[0]}
                    alt={translateContent(chalet, 'name')}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="h-full bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/30 dark:to-emerald-800/30 flex items-center justify-center">
                    <Home className="w-20 h-20 text-green-500 opacity-50" />
                  </div>
                )}
                
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Featured badge */}
                {chalet.isFeatured && (
                  <div className="absolute top-4 left-4 flex items-center bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    {tCommon('featured')}
                  </div>
                )}
                
                {/* Price badge */}
                <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tCommon('from')}</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(chalet.basePrice, currency)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tCommon('perNight')}</p>
                </div>
                
                {/* Name overlay */}
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-2xl font-bold text-white drop-shadow-lg">{translateContent(chalet, 'name')}</h3>
                </div>
              </div>

              <div className="card-body p-6">
                {/* Description */}
                {translateContent(chalet, 'description') && (
                  <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                    {translateContent(chalet, 'description')}
                  </p>
                )}

                {/* Specs */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex flex-col items-center text-center">
                    <Users className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.capacity}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('guests')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Bed className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.bedroomCount}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('bedrooms')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Bath className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{chalet.bathroomCount}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{tCommon('bathrooms')}</span>
                  </div>
                </div>

                {/* Amenities */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(chalet.amenities || []).slice(0, 4).map((amenity) => {
                    const Icon = amenityIcons[amenity] || Home;
                    return (
                      <span
                        key={amenity}
                        className="inline-flex items-center px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium"
                      >
                        <Icon className="w-4 h-4 mr-1.5" />
                        {amenity}
                      </span>
                    );
                  })}
                  {(chalet.amenities || []).length > 4 && (
                    <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full text-sm">
                      +{(chalet.amenities || []).length - 4} {tCommon('andMore')}
                    </span>
                  )}
                </div>

                {/* Weekend Price Notice */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center">
                    <span className="font-semibold mr-2">{t('weekendRate')}:</span> 
                    <span className="font-bold">{formatCurrency(chalet.weekendPrice, currency)}</span>
                    <span className="ml-1">{tCommon('perNight')} (Fri-Sat)</span>
                  </p>
                </div>

                <Link
                  href={`/chalets/${chalet.id}`}
                  className="btn btn-primary w-full group/btn flex items-center justify-center gap-2 py-3"
                >
                  {t('viewDetailsBook')}
                  <span className="transition-transform group-hover/btn:translate-x-1">→</span>
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {chalets.length === 0 && (
          <motion.div 
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Home className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">{t('noChaletsAvailable')}</h3>
            <p className="text-slate-600 dark:text-slate-400">{tCommon('checkBackLater')}</p>
          </motion.div>
        )}

        {/* Info Section */}
        <motion.div 
          className="mt-16 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 md:p-10 border border-slate-200 dark:border-slate-700 shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">{t('bookingInfo.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.checkIn')} / {t('bookingInfo.checkOut')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.checkIn')}: {t('bookingInfo.checkInTime')}<br />
                {t('bookingInfo.checkOut')}: {t('bookingInfo.checkOutTime')}
              </p>
            </div>
            <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.deposit')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.depositDescription')}
              </p>
            </div>
            <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.cancellationPolicy')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.cancellationDescription')}
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
