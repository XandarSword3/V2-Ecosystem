'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api, chaletsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useContentTranslation } from '@/lib/translate';
import { useSiteSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Minus,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface BookingUnit {
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
  WiFi: Wifi, wifi: Wifi, AC: Wind, ac: Wind, 'air conditioning': Wind,
  Kitchen: UtensilsCrossed, kitchen: UtensilsCrossed, Parking: Car, parking: Car,
};

export default function DynamicUnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent } = useContentTranslation();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || '';
  const unitId = Array.isArray(params?.unitId) ? params.unitId[0] : params?.unitId || '';
  const moduleIdParam = searchParams.get('module') || undefined;

  const currentModule = modules.find((m) => m.slug.toLowerCase() === slug.toLowerCase());
  const moduleName = currentModule?.name || 'Booking';
  const moduleId = moduleIdParam || currentModule?.id;

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

  // Fetch unit details (uses same chalets API — shared table)
  const { data: unitData, isLoading, error: unitError } = useQuery({
    queryKey: ['chalet', unitId],
    queryFn: () => chaletsApi.getChalet(unitId),
  });

  // Fetch add-ons
  const { data: addOnsData } = useQuery({
    queryKey: ['chalet-addons', moduleId],
    queryFn: () => chaletsApi.getAddOns(moduleId),
    enabled: !!moduleId,
  });

  const unit: BookingUnit | null = unitData?.data?.data || null;
  const addOns: AddOn[] = addOnsData?.data?.data || [];

  useEffect(() => {
    if (user) {
      setCustomerName(user.fullName || '');
      setCustomerEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (unit && checkInDate && checkOutDate) {
      fetchAvailability();
    }
  }, [unit, checkInDate, checkOutDate]);

  const fetchAvailability = async () => {
    try {
      const response = await api.get(`/chalets/${unitId}/availability`, {
        params: { startDate: checkInDate, endDate: checkOutDate },
      });
      setBlockedDates(response.data.data?.blockedDates || []);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const calculatePricing = () => {
    if (!unit || !checkInDate || !checkOutDate) return null;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return null;

    let baseAmount = 0;
    const current = new Date(checkIn);
    while (current < checkOut) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      baseAmount += isWeekend
        ? (unit.weekend_price || unit.base_price || 0)
        : (unit.base_price || 0);
      current.setDate(current.getDate() + 1);
    }

    let addOnsAmount = 0;
    selectedAddOns.forEach(({ addOnId, quantity }) => {
      const addOn = addOns.find(a => a.id === addOnId);
      if (addOn) {
        addOnsAmount += addOn.price * quantity * (addOn.price_type === 'per_night' ? nights : 1);
      }
    });

    return { nights, baseAmount, addOnsAmount, depositAmount: baseAmount * 0.3, totalAmount: baseAmount + addOnsAmount };
  };

  const pricing = calculatePricing();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit || !pricing) { toast.error('Please select valid dates'); return; }
    if (!customerName || !customerEmail || !customerPhone) { toast.error('Please fill in all required fields'); return; }

    setIsSubmitting(true);
    try {
      const response = await api.post('/chalets/bookings', {
        chaletId: unit.id,
        customerName, customerEmail, customerPhone,
        checkInDate, checkOutDate, numberOfGuests,
        addOns: selectedAddOns, specialRequests,
        paymentMethod: 'cash',
      });
      toast.success('Booking submitted successfully!');
      router.push(`/${slug}/confirmation?type=booking&id=${response.data.data.id}`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || 'Failed to submit booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (unitError || !unit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Unit not found</h2>
          <Link href={`/${slug}`}>
            <Button className="mt-4">Back to {moduleName}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = unit.images && unit.images.length > 0 ? unit.images : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {moduleName}
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
                  <img src={images[currentImageIndex]} alt={translateContent(unit, 'name')} className="w-full h-full object-cover" />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setCurrentImageIndex(i => (i - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-slate-800/80 rounded-full flex items-center justify-center">
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button onClick={() => setCurrentImageIndex(i => (i + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-slate-800/80 rounded-full flex items-center justify-center">
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((_, i) => (
                          <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />
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

            {/* Unit Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{translateContent(unit, 'name')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {unit.description && (
                  <p className="text-slate-600 dark:text-slate-400">{translateContent(unit, 'description')}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Users className="w-5 h-5 text-primary-600" />
                    <span>{unit.capacity} Guests</span>
                  </div>
                  {unit.bedroom_count && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Bed className="w-5 h-5 text-primary-600" />
                      <span>{unit.bedroom_count} Bedrooms</span>
                    </div>
                  )}
                  {unit.bathroom_count && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Bath className="w-5 h-5 text-primary-600" />
                      <span>{unit.bathroom_count} Bathrooms</span>
                    </div>
                  )}
                </div>
                {unit.amenities && unit.amenities.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {unit.amenities.map((amenity) => {
                        const Icon = amenityIcons[amenity] || Check;
                        return (
                          <span key={amenity} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                            <Icon className="w-4 h-4" />
                            {amenity}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold mb-2">Pricing</h3>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm text-slate-500">Weekday</p>
                      <p className="text-xl font-bold text-primary-600">{formatCurrency(unit.base_price, currency)}<span className="text-sm font-normal text-slate-500">/night</span></p>
                    </div>
                    {unit.weekend_price && unit.weekend_price !== unit.base_price && (
                      <div>
                        <p className="text-sm text-slate-500">Weekend</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(unit.weekend_price, currency)}<span className="text-sm font-normal text-slate-500">/night</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Booking Form */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <Card>
                <CardHeader className="bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-t-xl">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Book {translateContent(unit, 'name')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Check-in</label>
                        <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Check-out</label>
                        <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} min={checkInDate || new Date().toISOString().split('T')[0]} className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" required />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Guests</label>
                      <div className="flex items-center gap-3 mt-1">
                        <button type="button" onClick={() => setNumberOfGuests(Math.max(1, numberOfGuests - 1))} className="w-8 h-8 rounded-full border flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                        <span className="font-medium w-8 text-center">{numberOfGuests}</span>
                        <button type="button" onClick={() => setNumberOfGuests(Math.min(unit.capacity, numberOfGuests + 1))} className="w-8 h-8 rounded-full border flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                        <span className="text-sm text-slate-500">/ {unit.capacity} max</span>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full Name *" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" required />
                      <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email *" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" required />
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone Number *" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" required />
                      <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Special requests (optional)" rows={2} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm resize-none" />
                    </div>

                    {/* Add-Ons */}
                    {addOns.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Add-Ons</h3>
                        <div className="space-y-2">
                          {addOns.filter(a => a.is_active).map((addOn) => {
                            const selected = selectedAddOns.find(a => a.addOnId === addOn.id);
                            return (
                              <div key={addOn.id} className={`p-3 rounded-lg border transition-all cursor-pointer ${selected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => {
                                if (selected) setSelectedAddOns(prev => prev.filter(a => a.addOnId !== addOn.id));
                                else setSelectedAddOns(prev => [...prev, { addOnId: addOn.id, quantity: 1 }]);
                              }}>
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-sm">{translateContent(addOn, 'name')}</p>
                                    <p className="text-xs text-slate-500">{formatCurrency(addOn.price, currency)} / {addOn.price_type === 'per_night' ? 'night' : 'total'}</p>
                                  </div>
                                  {selected && (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <button type="button" onClick={() => setSelectedAddOns(prev => prev.map(a => a.addOnId === addOn.id ? { ...a, quantity: Math.max(1, a.quantity - 1) } : a))} className="w-6 h-6 rounded-full border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                      <span className="text-sm font-medium">{selected.quantity}</span>
                                      <button type="button" onClick={() => setSelectedAddOns(prev => prev.map(a => a.addOnId === addOn.id ? { ...a, quantity: a.quantity + 1 } : a))} className="w-6 h-6 rounded-full border flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pricing Summary */}
                    {pricing && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{pricing.nights} night{pricing.nights > 1 ? 's' : ''}</span>
                          <span>{formatCurrency(pricing.baseAmount, currency)}</span>
                        </div>
                        {pricing.addOnsAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Add-ons</span>
                            <span>{formatCurrency(pricing.addOnsAmount, currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total</span>
                          <span className="text-primary-600">{formatCurrency(pricing.totalAmount, currency)}</span>
                        </div>
                        <p className="text-xs text-slate-500">Deposit: {formatCurrency(pricing.depositAmount, currency)} (30%)</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isSubmitting || !pricing}>
                      {isSubmitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
                      ) : (
                        <>Book Now{pricing ? ` • ${formatCurrency(pricing.totalAmount, currency)}` : ''}</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
