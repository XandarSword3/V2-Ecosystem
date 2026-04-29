'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api, chaletsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useContentTranslation } from '@/lib/translate';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import AvailabilityCalendar from '@/components/chalets/AvailabilityCalendar';
import {
  Loader2,
  Home,
  Users,
  Bed,
  Bath,
  Wifi,
  Wind,
  UtensilsCrossed,
  Car,
  AlertCircle,
  Star,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Minus,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  capacity: number;
  bedroom_count?: number;
  bathroom_count?: number;
  amenities?: string[];
  images?: string[];
  base_price?: number;
  weekend_price?: number;
  is_active?: boolean;
}

interface AddOn {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  price: number;
  price_type: 'per_night' | 'one_time';
  is_active: boolean;
}

const amenityIcons: Record<string, React.ElementType> = {
  WiFi: Wifi,
  wifi: Wifi,
  AC: Wind,
  ac: Wind,
  'air conditioning': Wind,
  Kitchen: UtensilsCrossed,
  kitchen: UtensilsCrossed,
  Parking: Car,
  parking: Car,
};

export default function ChaletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent, isRTL } = useContentTranslation();
  
  // Get moduleId from query params for add-ons filtering
  const moduleId = searchParams.get('module') || undefined;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [numberOfGuests, setNumberOfGuests] = useState(2);
  const [selectedAddOns, setSelectedAddOns] = useState<{ addOnId: string; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [dailyPricesMap, setDailyPricesMap] = useState<Record<string, { price: number; type: string; ruleName?: string; isBlocked: boolean }>>({});

  // Fetch chalet details
  const { data: chaletData, isLoading: chaletLoading, error: chaletError } = useQuery({
    queryKey: ['chalet', params.id],
    queryFn: () => chaletsApi.getChalet(params.id as string),
  });

  // Fetch add-ons (filtered by module if moduleId is provided)
  const { data: addOnsData } = useQuery({
    queryKey: ['chalet-addons', moduleId],
    queryFn: () => chaletsApi.getAddOns(moduleId),
  });

  const chalet: Chalet | null = chaletData?.data?.data || null;
  const addOns: AddOn[] = addOnsData?.data?.data || [];

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setCustomerName(user.fullName || '');
      setCustomerEmail(user.email || '');
    }
  }, [user]);

  // Fetch daily prices for the calendar (next 3 months)
  useEffect(() => {
    if (!chalet) return;
    const fetchDailyPrices = async () => {
      try {
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const response = await api.get(`/chalets/${chalet.id}/daily-prices`, { params: { startDate, endDate } });
        const prices = response.data?.data?.dailyPrices || [];
        const priceMap: Record<string, { price: number; type: string; ruleName?: string; isBlocked: boolean }> = {};
        prices.forEach((dp: { date: string; price: number; type: string; ruleName?: string; isBlocked: boolean }) => {
          priceMap[dp.date] = { price: dp.price, type: dp.type, ruleName: dp.ruleName, isBlocked: dp.isBlocked };
        });
        setDailyPricesMap(priceMap);
        // Extract blocked dates from the daily prices response
        const blocked = prices.filter((dp: { isBlocked: boolean }) => dp.isBlocked).map((dp: { date: string }) => dp.date);
        setBlockedDates(blocked);
      } catch (error) {
        console.error('Failed to fetch daily prices:', error);
      }
    };
    fetchDailyPrices();
  }, [chalet]);

  // Fetch availability when dates change
  useEffect(() => {
    if (chalet && checkInDate && checkOutDate) {
      fetchAvailability();
    }
  }, [chalet, checkInDate, checkOutDate]);

  const fetchAvailability = async () => {
    try {
      const response = await api.get(`/chalets/${params.id}/availability`, {
        params: { startDate: checkInDate, endDate: checkOutDate },
      });
      setBlockedDates(response.data.data?.blockedDates || []);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const calculatePricing = () => {
    if (!chalet || !checkInDate || !checkOutDate) return null;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return null;

    let baseAmount = 0;
    const current = new Date(checkIn);
    const nightBreakdown: Array<{ date: string; price: number; type: string }> = [];
    
    while (current < checkOut) {
      const dateStr = current.toISOString().split('T')[0];
      const dailyPrice = dailyPricesMap[dateStr];
      
      let nightPrice: number;
      let nightType: string;
      
      if (dailyPrice) {
        // Use engine-calculated price (includes price rules, seasonal adjustments)
        nightPrice = dailyPrice.price;
        nightType = dailyPrice.type;
      } else {
        // Fallback to chalet base prices if daily prices not loaded
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        nightPrice = isWeekend 
          ? (chalet.weekend_price || chalet.base_price || 0) 
          : (chalet.base_price || 0);
        nightType = isWeekend ? 'weekend' : 'weekday';
      }
      
      baseAmount += nightPrice;
      nightBreakdown.push({ date: dateStr, price: nightPrice, type: nightType });
      current.setDate(current.getDate() + 1);
    }

    let addOnsAmount = 0;
    selectedAddOns.forEach(({ addOnId, quantity }) => {
      const addOn = addOns.find(a => a.id === addOnId);
      if (addOn) {
        const multiplier = addOn.price_type === 'per_night' ? nights : 1;
        addOnsAmount += addOn.price * quantity * multiplier;
      }
    });

    const depositAmount = baseAmount * 0.3;
    const totalAmount = baseAmount + addOnsAmount;

    return { nights, baseAmount, addOnsAmount, depositAmount, totalAmount, nightBreakdown };
  };

  const pricing = calculatePricing();

  const handleAddOnToggle = (addOnId: string) => {
    const existing = selectedAddOns.find(a => a.addOnId === addOnId);
    if (existing) {
      setSelectedAddOns(prev => prev.filter(a => a.addOnId !== addOnId));
    } else {
      setSelectedAddOns(prev => [...prev, { addOnId, quantity: 1 }]);
    }
  };

  const updateAddOnQuantity = (addOnId: string, delta: number) => {
    setSelectedAddOns(prev =>
      prev.map(a =>
        a.addOnId === addOnId
          ? { ...a, quantity: Math.max(1, a.quantity + delta) }
          : a
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chalet || !pricing) {
      toast.error('Please select valid dates');
      return;
    }

    if (!customerName || !customerEmail || !customerPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check for blocked dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const current = new Date(checkIn);
    while (current < checkOut) {
      const dateStr = current.toISOString().split('T')[0];
      if (blockedDates.includes(dateStr)) {
        toast.error('Selected dates are not available');
        return;
      }
      current.setDate(current.getDate() + 1);
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/chalets/bookings', {
        chaletId: chalet.id,
        customerName,
        customerEmail,
        customerPhone,
        checkInDate,
        checkOutDate,
        numberOfGuests,
        addOns: selectedAddOns,
        specialRequests,
        paymentMethod: 'cash',
      });

      toast.success('Booking submitted successfully!');
      router.push(`/chalets/booking-confirmation?id=${response.data.data.id}`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || 'Failed to submit booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (chaletLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (chaletError || !chalet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Chalet not found</h2>
          <Link href="/chalets" className="btn btn-primary mt-4">
            Back to Chalets
          </Link>
        </div>
      </div>
    );
  }

  const images = chalet.images && chalet.images.length > 0 ? chalet.images : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-resort-sand to-white dark:from-slate-900 dark:to-slate-800">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          href="/chalets"
          className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tCommon('back')}
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Column - Images & Details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Image Gallery */}
            <motion.div
              className="relative rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 aspect-[4/3]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImageIndex]}
                    alt={translateContent(chalet, 'name')}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i - 1 + images.length) % images.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i + 1) % images.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-slate-800/80 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentImageIndex(i)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentImageIndex ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Home className="w-20 h-20 text-slate-400" />
                </div>
              )}
            </motion.div>

            {/* Chalet Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{translateContent(chalet, 'name')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                {translateContent(chalet, 'description') && (
                  <p className="text-slate-600 dark:text-slate-400">
                    {translateContent(chalet, 'description')}
                  </p>
                )}

                {/* Specs */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex flex-col items-center text-center">
                    <Users className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold">{chalet.capacity}</span>
                    <span className="text-xs text-slate-500">{tCommon('guests')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Bed className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold">{chalet.bedroom_count || 0}</span>
                    <span className="text-xs text-slate-500">{tCommon('bedrooms')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Bath className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-lg font-bold">{chalet.bathroom_count || 0}</span>
                    <span className="text-xs text-slate-500">{tCommon('bathrooms')}</span>
                  </div>
                </div>

                {/* Amenities */}
                {chalet.amenities && chalet.amenities.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">{t('amenities')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {chalet.amenities.map((amenity) => {
                        const Icon = amenityIcons[amenity] || amenityIcons[amenity.toLowerCase()] || Home;
                        return (
                          <span
                            key={amenity}
                            className="inline-flex items-center px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm"
                          >
                            <Icon className="w-4 h-4 mr-1.5" />
                            {amenity}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-slate-500">{t('weekdayRate')}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(chalet.base_price || 0, currency)}
                    </p>
                    <p className="text-xs text-slate-500">{tCommon('perNight')}</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-sm text-slate-500">{t('weekendRate')}</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(chalet.weekend_price || chalet.base_price || 0, currency)}
                    </p>
                    <p className="text-xs text-slate-500">{tCommon('perNight')} (Fri-Sat)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Booking Form */}
          <div className="lg:col-span-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('bookNow')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Availability Calendar with Daily Prices */}
                  <AvailabilityCalendar
                    blockedDates={blockedDates}
                    selectedCheckIn={checkInDate || undefined}
                    selectedCheckOut={checkOutDate || undefined}
                    onDateSelect={(checkIn, checkOut) => {
                      setCheckInDate(checkIn);
                      setCheckOutDate(checkOut || '');
                    }}
                    dailyPrices={dailyPricesMap as Record<string, { price: number; type: 'weekday' | 'weekend' | 'holiday' | 'seasonal'; ruleName?: string; isBlocked: boolean }>}
                    formatPrice={(amount) => formatCurrency(amount, currency)}
                    maxMonthsAhead={3}
                  />

                  {/* Guests */}
                  <div>
                    <label className="block text-sm font-medium mb-1">{tCommon('guests')}</label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setNumberOfGuests(g => Math.max(1, g - 1))}
                        className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-lg font-semibold">{numberOfGuests}</span>
                      <button
                        type="button"
                        onClick={() => setNumberOfGuests(g => Math.min(chalet.capacity, g + 1))}
                        className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-slate-500">
                        (max {chalet.capacity})
                      </span>
                    </div>
                  </div>

                  {/* Add-ons */}
                  {addOns.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('addOns')}</label>
                      <div className="space-y-2">
                        {addOns.filter(a => a.is_active).map((addOn) => {
                          const selected = selectedAddOns.find(a => a.addOnId === addOn.id);
                          return (
                            <div
                              key={addOn.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                selected
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                              }`}
                              onClick={() => handleAddOnToggle(addOn.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    selected ? 'border-green-500 bg-green-500' : 'border-slate-300'
                                  }`}>
                                    {selected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="font-medium">{translateContent(addOn, 'name')}</span>
                                </div>
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {formatCurrency(addOn.price, currency)}
                                  {addOn.price_type === 'per_night' && '/night'}
                                </span>
                              </div>
                              {selected && (
                                <div className="flex items-center gap-2 mt-2 ml-7" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => updateAddOnQuantity(addOn.id, -1)}
                                    className="w-6 h-6 rounded border flex items-center justify-center"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span>{selected.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateAddOnQuantity(addOn.id, 1)}
                                    className="w-6 h-6 rounded border flex items-center justify-center"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold">{t('contactInfo')}</h4>
                    <div>
                      <label className="block text-sm font-medium mb-1">{tCommon('fullName')}</label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{tCommon('email')}</label>
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{tCommon('phone')}</label>
                      <Input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{t('specialRequests')}</label>
                      <textarea
                        value={specialRequests}
                        onChange={(e) => setSpecialRequests(e.target.value)}
                        className="input w-full h-20"
                        placeholder={t('specialRequestsPlaceholder')}
                      />
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  {pricing && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{pricing.nights} {pricing.nights === 1 ? 'night' : 'nights'}</span>
                        <span>{formatCurrency(pricing.baseAmount, currency)}</span>
                      </div>
                      {/* Nightly breakdown */}
                      {pricing.nightBreakdown && pricing.nightBreakdown.length > 0 && pricing.nightBreakdown.length <= 14 && (
                        <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-600 ml-1">
                          {pricing.nightBreakdown.map((night) => {
                            const typeLabel = { weekday: '', weekend: '(weekend)', holiday: '(holiday)', seasonal: '(seasonal)' }[night.type] || '';
                            return (
                              <div key={night.date} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{new Date(night.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {typeLabel}</span>
                                <span>{formatCurrency(night.price, currency)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {pricing.addOnsAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>{t('addOns')}</span>
                          <span>{formatCurrency(pricing.addOnsAmount, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>{tCommon('total')}</span>
                        <span className="text-lg text-green-600">{formatCurrency(pricing.totalAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>{t('depositRequired')} (30%)</span>
                        <span>{formatCurrency(pricing.depositAmount, currency)}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isSubmitting}
                    disabled={!pricing || isSubmitting}
                  >
                    {t('submitBooking')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
