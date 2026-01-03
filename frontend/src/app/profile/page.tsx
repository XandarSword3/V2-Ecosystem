'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api, restaurantApi, poolApi, chaletsApi, snackApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Save,
  LogOut,
  Camera,
  UtensilsCrossed,
  Home,
  Waves,
  Cookie,
  Ticket,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  Package,
} from 'lucide-react';

type TabType = 'profile' | 'orders' | 'snacks' | 'bookings' | 'tickets';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  preparing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  valid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  used: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  checked_in: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  checked_out: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
};

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
  const currency = useSettingsStore((s) => s.currency);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'en',
  });

  // Fetch user orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => restaurantApi.getMyOrders(),
    enabled: activeTab === 'orders' && !!user,
  });

  // Fetch user bookings
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => chaletsApi.getMyBookings(),
    enabled: activeTab === 'bookings' && !!user,
  });

  // Fetch user pool tickets
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => poolApi.getMyTickets(),
    enabled: activeTab === 'tickets' && !!user,
  });

  // Fetch user snack orders
  const { data: snackOrdersData, isLoading: snackOrdersLoading } = useQuery({
    queryKey: ['my-snack-orders'],
    queryFn: () => snackApi.getMyOrders(),
    enabled: activeTab === 'snacks' && !!user,
  });

  const orders = ordersData?.data?.data || [];
  const bookings = bookingsData?.data?.data || [];
  const tickets = ticketsData?.data?.data || [];
  const snackOrders = snackOrdersData?.data?.data || [];

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        preferredLanguage: user.preferredLanguage || 'en',
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/users/profile', {
        full_name: formData.fullName,
        phone: formData.phone,
        preferred_language: formData.preferredLanguage,
      });
      refreshUser();
      toast.success(t('profileUpdated'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <CardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">{t('pleaseLogin')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'profile' as TabType, label: t('tabs.profile'), icon: User },
    { id: 'orders' as TabType, label: t('tabs.orders'), icon: UtensilsCrossed },
    { id: 'snacks' as TabType, label: t('tabs.snacks'), icon: Cookie },
    { id: 'bookings' as TabType, label: t('tabs.bookings'), icon: Home },
    { id: 'tickets' as TabType, label: t('tabs.tickets'), icon: Ticket },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </div>
          <Button variant="danger" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            {tCommon('logout')}
          </Button>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeInUp}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t('profileInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                        {user.fullName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <Camera className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tCommon('fullName')}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tCommon('email')}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="email"
                          value={formData.email}
                          disabled
                          className="pl-10 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {tCommon('phone')}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('preferredLanguage')}
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                          value={formData.preferredLanguage}
                          onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="en">English</option>
                          <option value="ar">العربية (Arabic)</option>
                          <option value="fr">Français (French)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {tCommon('processing')}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {tCommon('save')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Roles Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {t('yourRoles')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.roles?.length > 0 ? (
                      user.roles.map((role) => (
                        <span
                          key={role}
                          className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">{t('noRoles')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5" />
                    {t('myOrders')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('noOrders')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order: any) => (
                        <div
                          key={order.id}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-medium">#{order.order_number}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[order.status] || statusColors.pending}`}>
                              {order.status?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(order.created_at)}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(order.total_amount, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'snacks' && (
            <motion.div
              key="snacks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cookie className="w-5 h-5" />
                    {t('mySnackOrders')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {snackOrdersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : snackOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <Cookie className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('noSnackOrders')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {snackOrders.map((order: any) => (
                        <div
                          key={order.id}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-medium">#{order.order_number}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[order.status] || statusColors.pending}`}>
                              {order.status?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(order.created_at)}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(order.total_amount, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'bookings' && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5" />
                    {t('myBookings')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bookingsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Home className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('noBookings')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.map((booking: any) => (
                        <div
                          key={booking.id}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{booking.chalet?.name || 'Chalet'}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[booking.status] || statusColors.pending}`}>
                              {booking.status?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
                            </span>
                          </div>
                          <div className="mt-2 flex justify-between">
                            <span className="text-sm text-slate-500">{booking.number_of_guests} guests</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(booking.total_amount, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'tickets' && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="w-5 h-5" />
                    {t('myTickets')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-8">
                      <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">{t('noTickets')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-medium">#{ticket.ticket_number}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[ticket.status] || statusColors.pending}`}>
                              {ticket.status?.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(ticket.ticket_date)}
                            </span>
                            <span>{ticket.session?.name}</span>
                          </div>
                          <div className="mt-2 flex justify-between">
                            <span className="text-sm text-slate-500">{ticket.number_of_guests} guests</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(ticket.total_amount, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
