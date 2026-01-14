'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { poolApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useContentTranslation } from '@/lib/translate';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket';
import { JsonLd, generatePoolSchema, generateBreadcrumbSchema } from '@/lib/structured-data';
import { Loader2, Waves, Users, Clock, Calendar, AlertCircle, Ticket, Droplets, Sun, Umbrella, QrCode, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card3D, FloatingCard } from '@/components/effects/Card3D';
import { SpotlightCard } from '@/components/effects/GlowingBorder';
import { GradientText, RevealHeading } from '@/components/effects/TextEffects';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';

interface PoolSession {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  // Support both snake_case (from API) and camelCase
  start_time?: string;
  end_time?: string;
  max_capacity?: number;
  is_active?: boolean;
  startTime?: string;
  endTime?: string;
  maxCapacity?: number;
  price: number | string; // API may return as string
  adult_price: number | string;
  child_price: number | string;
  isActive?: boolean;
  availability?: {
    remaining?: number;
  };
}

interface PurchaseTicketData {
  sessionId: string;
  ticketDate: string;
  customerName: string;
  customerPhone: string;
  numberOfAdults: number;
  numberOfChildren: number;
  numberOfGuests: number;
  paymentMethod: 'cash' | 'card' | 'online';
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function PoolPage() {
          // ...existing code...
        // Booking handler
        const handleBooking = async () => {
          if (!selectedSession) {
            toast.error(t('selectSession'));
            return;
          }
          if (!customerName.trim() || !customerPhone.trim()) {
            toast.error(t('fillContactInfo'));
            return;
          }
          purchaseMutation.mutate({
            sessionId: selectedSession.id,
            ticketDate: selectedDate,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            numberOfAdults: adultCount,
            numberOfChildren: childCount,
            numberOfGuests: adultCount + childCount,
            paymentMethod: 'cash',
          });
        };
    // State declarations
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSession, setSelectedSession] = useState<PoolSession | null>(null);
    const [adultCount, setAdultCount] = useState(1);
    const [childCount, setChildCount] = useState(0);
    const { user } = useAuth();
    const t = useTranslations('pool');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const { settings, modules } = useSiteSettings();
    const poolModule = modules.find(m => m.slug === 'pool');
    const currency = useSettingsStore((s) => s.currency);
    const { translateContent } = useContentTranslation();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    useEffect(() => {
      setAdultCount(1);
      setChildCount(0);
    }, [selectedSession]);

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
      visible: { opacity: 1, y: 0 }
    };

    const { data, isLoading, error, refetch } = useQuery({
      queryKey: ['pool-sessions', selectedDate, poolModule?.id],
      queryFn: () => poolApi.getSessions(selectedDate, poolModule?.id),
      enabled: !!poolModule,
    });
      const sessions = data?.data?.data || [];
  
    // Fetch user's tickets if logged in
    const { data: myTicketsData } = useQuery({
      queryKey: ['my-pool-tickets'],
      queryFn: () => poolApi.getMyTickets(),
      enabled: !!user,
    });
  
    const myTickets = myTicketsData?.data?.data || [];
    const purchaseMutation = useMutation({
      mutationFn: (data: PurchaseTicketData) => poolApi.purchaseTicket(data),
      onSuccess: (response) => {
        toast.success(t('ticketPurchased'));
        const ticket = response.data.data;
        router.push(`/pool/confirmation?id=${ticket.id}`);
      },
      onError: (err: ApiError) => {
        toast.error(err.response?.data?.error || t('purchaseFailed'));
      },
    });
  
    const { socket } = useSocket();
  
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">{tCommon('loading')}</p>
          </div>
        </div>
      );
    }



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 relative" />
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">{tCommon('loading')}</p>
        </motion.div>
      </div>
    );
  }



  // Static SEO data for bots
  const poolSchema = generatePoolSchema({
    name: settings.poolName || 'V2 Resort Pool',
    description: 'Refreshing swimming pool experience at V2 Resort. Multiple daily sessions available with family-friendly options.',
    url: 'https://v2-ecosystem.vercel.app/pool',
    priceRange: '$$',
    openingHours: 'Mo-Su 09:00-20:00',
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app/' },
    { name: 'Pool', url: 'https://v2-ecosystem.vercel.app/pool' },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <JsonLd data={[poolSchema, breadcrumbSchema]} />
      
      {/* Static content for bots/LLMs that don't run JavaScript */}
      <noscript>
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1>V2 Resort Swimming Pool</h1>
          <p>Experience our refreshing swimming pool at V2 Resort in Lebanon. We offer multiple daily pool sessions suitable for all ages.</p>
          
          <h2>Pool Features</h2>
          <ul>
            <li>Clean, refreshing water maintained daily</li>
            <li>Multiple sessions throughout the day</li>
            <li>Family-friendly environment</li>
            <li>Poolside amenities available</li>
            <li>Separate adult and child pricing</li>
          </ul>
          
          <h2>How to Book</h2>
          <ol>
            <li>Select your preferred date</li>
            <li>Choose an available session time</li>
            <li>Enter number of adults and children</li>
            <li>Complete your booking</li>
          </ol>
          
          <h2>Pricing</h2>
          <p>Pool entry includes access for the full session duration. Special rates for children available. Weekend sessions may have different pricing.</p>
          
          <h2>Contact</h2>
          <p>For pool reservations or inquiries: info@v2resort.com | +961 XX XXX XXX</p>
          
          <p><a href="/">← Return to V2 Resort Home</a></p>
        </div>
      </noscript>
      
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-white to-secondary-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section with Aurora Effect */}
      <div className="relative min-h-[45vh] overflow-hidden">
        {/* Aurora Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 dark:from-blue-800 dark:via-cyan-700 dark:to-teal-600">
          {/* Animated Blobs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 70%)' }}
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

        {/* Animated water waves at bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-32 fill-cyan-50/50 dark:fill-slate-900" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <motion.path
              d="M0,0 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
              animate={{
                d: [
                  "M0,40 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z",
                  "M0,60 C360,40 720,80 1080,40 C1260,60 1380,100 1440,60 L1440,120 L0,120 Z",
                  "M0,40 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
                ]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[45vh] px-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-white font-medium">{t('refreshingExperience')}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center mb-4"
          >
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Waves className="w-14 h-14 text-white drop-shadow-lg" />
            </motion.div>
          </motion.div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-lg">
            {settings.poolName || t('title')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-8">{t('subtitle')}</p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              { value: sessions.length, label: t('sessionsToday'), icon: <Clock className="w-5 h-5" /> },
              { value: sessions.reduce((sum: number, s: PoolSession) => sum + (s.availability?.remaining ?? s.maxCapacity ?? 50), 0), label: t('availableSpots'), icon: <Users className="w-5 h-5" /> },
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
                    <AnimatedCounter value={stat.value} duration={2} />
                  </span>
                </div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Picker - Glass Card */}
            <motion.div
              className="p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <label className="flex items-center text-slate-900 dark:text-white text-lg font-semibold mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center mr-3">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                {t('selectDate')}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full text-lg py-3 px-4 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </motion.div>

            <RevealHeading className="text-xl font-semibold text-slate-900 dark:text-white flex items-center">
              <Sun className="w-6 h-6 mr-2 text-yellow-500" />
              <GradientText from="from-blue-500" via="via-cyan-500" to="to-teal-500">
                {t('availableSessions', { date: formatDate(selectedDate) })}
              </GradientText>
            </RevealHeading>

            {sessions.length > 0 ? (
              <motion.div
                className="space-y-5"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {sessions.map((session: PoolSession, index: number) => {
                  const remaining = session.availability?.remaining ?? session.maxCapacity ?? 50;
                  const isSoldOut = remaining === 0;
                  const isSelected = selectedSession?.id === session.id;

                  return (
                    <SpotlightCard
                      key={session.id}
                      spotlightColor={isSelected ? "rgba(59, 130, 246, 0.25)" : "rgba(6, 182, 212, 0.15)"}
                      className="h-full"
                    >
                      <motion.div
                        variants={cardVariants}
                        className={`p-6 cursor-pointer transition-all duration-300 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-2 rounded-2xl ${
                          isSelected
                            ? 'border-blue-500 shadow-xl shadow-blue-200/50 dark:shadow-blue-900/30'
                            : isSoldOut
                              ? 'border-slate-200/50 dark:border-slate-700/50 opacity-60 cursor-not-allowed'
                              : 'border-white/30 dark:border-slate-700/50 hover:border-blue-300/50'
                        }`}
                        onClick={() => !isSoldOut && setSelectedSession(session)}
                        whileHover={!isSoldOut ? { y: -4 } : {}}
                        whileTap={!isSoldOut ? { scale: 0.98 } : {}}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                              {session.name}
                            </h3>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="flex items-center bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300">
                                <Clock className="w-4 h-4 mr-1.5" />
                                {session.startTime} - {session.endTime}
                              </span>
                              <span className={`flex items-center px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${
                                remaining < 10 ? 'bg-red-50/80 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                remaining < 20 ? 'bg-yellow-50/80 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                'bg-green-50/80 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              }`}>
                                <Users className="w-4 h-4 mr-1.5" />
                                {tCommon('spotsLeft', { count: remaining })}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {t('pricing.adult')}: {formatCurrency(session.adult_price, currency)}
                            </p>
                            <p className="text-lg font-bold text-secondary-600 dark:text-secondary-400">
                              {t('pricing.child')}: {formatCurrency(session.child_price, currency)}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{tCommon('perPerson')}</p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                            <span>{t('capacity')}</span>
                            <span>{remaining}/{session.maxCapacity}</span>
                          </div>
                          <div className="w-full bg-slate-200/50 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                            <motion.div
                              className={`h-3 rounded-full ${
                                remaining < 10 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                                remaining < 20 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                'bg-gradient-to-r from-green-500 to-emerald-400'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${(remaining / (session.maxCapacity ?? 50)) * 100}%` }}
                              transition={{ duration: 0.8, delay: index * 0.1 }}
                            />
                          </div>
                        </div>

                        {isSoldOut && (
                          <div className="mt-4">
                            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-medium px-4 py-1.5 rounded-full">{tCommon('soldOut')}</span>
                          </div>
                        )}
                      </motion.div>
                    </SpotlightCard>
                  );
                })}
              </motion.div>
            ) : (
              <FloatingCard className="w-full">
                <div className="p-12 text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl">
                  <motion.div
                    animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Waves className="w-20 h-20 text-blue-300 mx-auto mb-6" />
                  </motion.div>
                  <GradientText from="from-blue-500" via="via-cyan-500" to="to-teal-500" className="text-xl font-bold mb-2 block">
                    {t('noSessionsAvailable')}
                  </GradientText>
                  <p className="text-slate-600 dark:text-slate-400">{t('selectDifferentDate')}</p>
                </div>
              </FloatingCard>
            )}
          </div>

          {/* Booking Summary - Glass Card */}
          <div className="lg:col-span-1">
            <motion.div
              className="sticky top-24 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {/* Header with gradient */}
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400" />
                <motion.div
                  className="absolute inset-0 opacity-30"
                  style={{ background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3) 0%, transparent 50%)' }}
                  animate={{ x: ['-50%', '150%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative p-5">
                  <h3 className="font-bold text-white flex items-center text-lg">
                    <Ticket className="w-6 h-6 mr-2" />
                    {t('yourBooking')}
                  </h3>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                {selectedSession ? (
                  <>
                    <div className="p-4 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20 backdrop-blur-sm rounded-xl border border-blue-100/50 dark:border-blue-800/50">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">{selectedSession.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {formatDate(selectedDate)} • {selectedSession.startTime} - {selectedSession.endTime}
                      </p>
                    </div>



                    {/* Contact Info - Glass Inputs */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">{t('yourName')}</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={t('enterYourName')}
                          className="w-full px-4 py-3 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">{t('phoneNumber')}</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder={t('enterPhoneNumber')}
                          className="w-full px-4 py-3 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-5">
                      <div className="flex gap-4 items-center mb-5">
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-white">{t('adults')}</label>
                          <input 
                            type="number" 
                            min={1} 
                            value={adultCount} 
                            onChange={e => setAdultCount(Math.max(1, Number(e.target.value)))} 
                            className="w-full px-4 py-3 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl text-center font-bold text-lg" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-white">{t('children')}</label>
                          <input 
                            type="number" 
                            min={0} 
                            value={childCount} 
                            onChange={e => setChildCount(Math.max(0, Number(e.target.value)))} 
                            className="w-full px-4 py-3 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl text-center font-bold text-lg" 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between mb-3 text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          {adultCount} × {formatCurrency(selectedSession.adult_price, currency)} {t('adult')}
                          {childCount > 0 && (
                            <>
                              {' + '}
                              {childCount} × {formatCurrency(selectedSession.child_price, currency)} {t('child')}
                            </>
                          )}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency((Number(selectedSession.adult_price) * adultCount + Number(selectedSession.child_price) * childCount), currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xl font-bold p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-blue-900/20 dark:to-cyan-900/20 backdrop-blur-sm rounded-xl">
                        <span className="text-slate-900 dark:text-white">{tCommon('total')}</span>
                        <GradientText from="from-blue-600" via="via-cyan-500" to="to-teal-500">
                          {formatCurrency((Number(selectedSession.adult_price) * adultCount + Number(selectedSession.child_price) * childCount), currency)}
                        </GradientText>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBooking}
                      disabled={purchaseMutation.isPending}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all disabled:opacity-60"
                    >
                      {purchaseMutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />{tCommon('processing')}
                        </span>
                      ) : (
                        t('purchaseTickets')
                      )}
                    </motion.button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Waves className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-slate-500 dark:text-slate-400">{t('selectSessionToContinue')}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-4 bg-slate-50/50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  {t('nonRefundable')}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Your Tickets Section - Only show if user is logged in and has tickets */}
        {user && myTickets.length > 0 && (
          <motion.div
            className="mt-12 bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <Ticket className="w-6 h-6 mr-2 text-blue-500" />
              {t('yourTickets')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTickets.slice(0, 6).map((ticket: { id: string; ticket_number: string; status: string; ticket_date: string; number_of_guests: number; total_amount: number }) => (
                <Link
                  key={ticket.id}
                  href={`/pool/confirmation?id=${ticket.id}`}
                  className="block p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-100 dark:border-blue-800 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                      #{ticket.ticket_number}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ticket.status === 'valid'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : ticket.status === 'used'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white mb-1">
                    {formatDate(ticket.ticket_date)}
                  </p>
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {ticket.number_of_guests} {ticket.number_of_guests > 1 ? 'guests' : 'guest'}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(ticket.total_amount, currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400">
                    <span>View ticket</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              ))}
            </div>
            {myTickets.length > 6 && (
              <div className="mt-4 text-center">
                <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {t('viewAllTickets')} ({myTickets.length})
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Info Section with Spotlight Cards */}
        <motion.div 
          className="mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <RevealHeading className="text-3xl font-bold text-center mb-10">
            <GradientText from="from-blue-500" via="via-cyan-500" to="to-teal-500">
              {t('poolInfo.title')}
            </GradientText>
          </RevealHeading>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: t('poolInfo.hoursTitle'),
                content: t('poolInfo.hours'),
                gradientFrom: 'rgba(59, 130, 246, 0.15)',
                iconBg: 'bg-blue-100 dark:bg-blue-900/50',
                iconColor: 'text-blue-600 dark:text-blue-400'
              },
              {
                icon: Umbrella,
                title: t('poolInfo.whatToBring'),
                content: 'Swimwear, towel, sunscreen. Lockers available for valuables',
                gradientFrom: 'rgba(6, 182, 212, 0.15)',
                iconBg: 'bg-primary-100 dark:bg-primary-900/50',
                iconColor: 'text-primary-600 dark:text-primary-400'
              },
              {
                icon: Droplets,
                title: t('poolInfo.amenitiesTitle'),
                content: 'Changing rooms, showers. Snack bar nearby, loungers included',
                gradientFrom: 'rgba(20, 184, 166, 0.15)',
                iconBg: 'bg-teal-100 dark:bg-teal-900/50',
                iconColor: 'text-teal-600 dark:text-teal-400'
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
                  className="p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-slate-700/50 h-full"
                >
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className={`w-14 h-14 ${item.iconBg} rounded-2xl flex items-center justify-center mb-5`}
                  >
                    <item.icon className={`w-7 h-7 ${item.iconColor}`} />
                  </motion.div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-3">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{item.content}</p>
                </motion.div>
              </SpotlightCard>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
    </>
  );
}
