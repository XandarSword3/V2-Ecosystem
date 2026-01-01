'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { chaletsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Home, Users, Bed, Bath, Wifi, Wind, UtensilsCrossed, Car, AlertCircle } from 'lucide-react';

interface Chalet {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  capacity: number;
  bedroomCount: number;
  bathroomCount: number;
  amenities: string[];
  images: string[];
  basePrice: number;
  weekendPrice: number;
  isActive: boolean;
}

const amenityIcons: Record<string, React.ElementType> = {
  WiFi: Wifi,
  AC: Wind,
  Kitchen: UtensilsCrossed,
  Parking: Car,
};

export default function ChaletsPage() {
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');

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
    <div className="min-h-screen bg-resort-sand dark:bg-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>

        {/* Chalets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {chalets.map((chalet) => (
            <div key={chalet.id} className="card overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
              {/* Image Gallery */}
              {chalet.images && chalet.images.length > 0 ? (
                <div className="h-64 bg-slate-200 dark:bg-slate-700">
                  <img
                    src={chalet.images[0]}
                    alt={chalet.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-64 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
                  <Home className="w-16 h-16 text-green-500" />
                </div>
              )}

              <div className="card-body p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{chalet.name}</h3>
                    {chalet.nameAr && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-arabic">{chalet.nameAr}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{tCommon('from')}</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(chalet.basePrice)}
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{tCommon('perNight')}</span>
                    </p>
                  </div>
                </div>

                {chalet.description && (
                  <p className="text-slate-600 dark:text-slate-400 mb-4">{chalet.description}</p>
                )}

                {/* Specs */}
                <div className="flex items-center gap-6 mb-4 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    <span>{chalet.capacity} {tCommon('guests')}</span>
                  </div>
                  <div className="flex items-center">
                    <Bed className="w-5 h-5 mr-2" />
                    <span>{chalet.bedroomCount} {tCommon('bedrooms')}</span>
                  </div>
                  <div className="flex items-center">
                    <Bath className="w-5 h-5 mr-2" />
                    <span>{chalet.bathroomCount} {tCommon('bathrooms')}</span>
                  </div>
                </div>

                {/* Amenities */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {chalet.amenities.slice(0, 5).map((amenity) => {
                    const Icon = amenityIcons[amenity] || Home;
                    return (
                      <span
                        key={amenity}
                        className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm"
                      >
                        <Icon className="w-4 h-4 mr-1" />
                        {amenity}
                      </span>
                    );
                  })}
                  {chalet.amenities.length > 5 && (
                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm">
                      +{chalet.amenities.length - 5} more
                    </span>
                  )}
                </div>

                {/* Weekend Price Notice */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>{t('weekendRate')}:</strong> {formatCurrency(chalet.weekendPrice)}{tCommon('perNight')} (Fri-Sat)
                  </p>
                </div>

                <Link
                  href={`/chalets/${chalet.id}`}
                  className="btn btn-primary w-full"
                >
                  {t('viewDetailsBook')}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {chalets.length === 0 && (
          <div className="text-center py-12">
            <Home className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t('noChaletsAvailable')}</h3>
            <p className="text-slate-600 dark:text-slate-400">{tCommon('checkBackLater')}</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white dark:bg-slate-800 rounded-lg p-8 border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('bookingInfo.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.checkIn')} / {t('bookingInfo.checkOut')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.checkIn')}: {t('bookingInfo.checkInTime')}<br />
                {t('bookingInfo.checkOut')}: {t('bookingInfo.checkOutTime')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.deposit')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.depositDescription')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('bookingInfo.cancellationPolicy')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('bookingInfo.cancellationDescription')}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
