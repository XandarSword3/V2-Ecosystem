'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
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
  Ticket,
  CreditCard,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  Package,
  X,
  FileDown,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

type TabType = 'profile' | 'orders' | 'bookings' | 'tickets' | 'statement' | 'payments' | 'privacy';

interface OrderRecord {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface BookingRecord {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount: number;
  unit?: { name: string };
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  status: string;
  ticket_date: string;
  session?: { name: string };
  quantity: number;
  number_of_guests?: number;
  total_amount: number;
}

interface StatementRecord {
  id: string;
  type: string;
  status?: string;
  created_at: string;
  total_amount?: number;
  amount?: number;
  points?: number;
  order_number?: string;
  booking_number?: string;
  ticket_number?: string;
  reference_id?: string;
  reference_type?: string;
}

interface PaymentRecord {
  id: string;
  reference_type?: string;
  reference_id?: string;
  amount: number;
  status: string;
  method?: string;
  created_at: string;
  notes?: string;
}

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
  const { modules } = useSiteSettings();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [saving, setSaving] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'en',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch user orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/orders/me'),
    enabled: activeTab === 'orders' && !!user,
  });

  // Fetch user bookings
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/reservations/me'),
    enabled: activeTab === 'bookings' && !!user,
  });

  // Fetch user session passes (shared_capacity_access)
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get('/capacity-access/me'),
    enabled: activeTab === 'tickets' && !!user,
  });

  const { data: statementData, isLoading: statementLoading } = useQuery({
    queryKey: ['my-statement', statementFrom, statementTo],
    queryFn: () => api.get('/users/me/statement', { params: { from: statementFrom || undefined, to: statementTo || undefined } }),
    enabled: activeTab === 'statement' && !!user,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api.get('/payments/me'),
    enabled: activeTab === 'payments' && !!user,
  });

  const orders = ordersData?.data?.data || [];
  const bookings = bookingsData?.data?.data || [];
  const tickets = ticketsData?.data?.data || [];
  const statement = statementData?.data?.data || [];
  const payments = paymentsData?.data?.data || [];

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
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const response = await api.post('/users/me/data/portable', {}, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `user-data-${user?.id}-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Your data has been exported successfully.');
    } catch (error) {
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await api.delete('/users/me/data', { data: { confirmDeletion: true } });
      toast.success('Your account has been deleted. Anonymization will be completed within 30 days.', { duration: 8000 });
      setShowDeleteConfirm(false);
      setTimeout(() => logout(), 2000);
    } catch (error) {
      toast.error('Failed to delete account. Please contact support.');
      setIsDeleting(false);
    }
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

  // Derive which engine types have at least one active module on this property
  const hasInstantTransaction = modules.some(m => m.is_active && m.engine_type === 'instant_transaction');
  const hasTimeExclusiveReservation = modules.some(m => m.is_active && m.engine_type === 'time_exclusive_reservation');
  const hasSharedCapacityAccess = modules.some(m => m.is_active && m.engine_type === 'shared_capacity_access');

  const tabs = [
    { id: 'profile' as TabType, label: t('tabs.profile'), icon: User },
    ...(hasInstantTransaction ? [{ id: 'orders' as TabType, label: t('tabs.orders'), icon: UtensilsCrossed }] : []),
    ...(hasTimeExclusiveReservation ? [{ id: 'bookings' as TabType, label: t('tabs.bookings'), icon: Home }] : []),
    ...(hasSharedCapacityAccess ? [{ id: 'tickets' as TabType, label: t('tabs.tickets'), icon: Ticket }] : []),
    { id: 'statement' as TabType, label: t('tabs.statement'), icon: Calendar },
    { id: 'payments' as TabType, label: t('tabs.payments'), icon: CreditCard },
    { id: 'privacy' as TabType, label: t('tabs.privacy'), icon: Shield },
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
                      <button aria-label="Change profile photo" className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700"> {/* FIX Iter-8: aria-label */}
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
                          name="fullName"
                          autoComplete="name"
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
                          name="email"
                          autoComplete="email"
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
                          name="phone"
                          autoComplete="tel"
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

              {/* Access Level Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {t('yourRoles')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.scope ? (
                      <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {user.scope.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    ) : user.roles?.length > 0 ? (
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

              {/* Two-Factor Authentication */}
              <TwoFactorSettings />
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
                      {orders.map((order: OrderRecord) => (
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
                      {bookings.map((booking: BookingRecord) => (
                        <div
                          key={booking.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedBooking(booking)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBooking(booking); } }}
                          className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{booking.unit?.name || 'Unit'}</span>
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
                            <span className="text-sm text-slate-500">{t('numberOfGuests', { count: booking.number_of_guests })}</span>
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
                    <Ticket className="w-5 h-5" />
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
                      {tickets.map((ticket: TicketRecord) => (
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
                            <span className="text-sm text-slate-500">{t('numberOfGuests', { count: ticket.number_of_guests ?? 0 })}</span>
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

          {activeTab === 'statement' && (
            <motion.div
              key="statement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Unified Statement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <Input type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} />
                    <Input type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} />
                  </div>
                  {statementLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : statement.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No statement activity found</div>
                  ) : (
                    <div className="space-y-3">
                      {statement.map((row: StatementRecord) => (
                        <div key={`${row.type}-${row.id}`} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{row.type.replace(/_/g, ' ')}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[row.status || 'pending'] || statusColors.pending}`}>
                              {(row.status || 'recorded').toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">{formatDate(row.created_at)}</div>
                          <div className="text-sm text-slate-700 dark:text-slate-300">
                            Ref: {row.order_number || row.booking_number || row.ticket_number || row.reference_id || row.id}
                          </div>
                          <div className="font-semibold mt-1">
                            {row.total_amount !== undefined
                              ? formatCurrency(Number(row.total_amount), currency)
                              : row.amount !== undefined
                                ? formatCurrency(Number(row.amount), currency)
                                : `${row.points || 0} pts`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    My Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No payments found</div>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment: PaymentRecord) => (
                        <div key={payment.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{payment.reference_type || 'payment'}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${statusColors[payment.status] || statusColors.pending}`}>
                              {payment.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">{formatDate(payment.created_at)}</div>
                          <div className="text-sm text-slate-700 dark:text-slate-300">For: {payment.reference_id || '-'}</div>
                          <div className="font-semibold mt-1">{formatCurrency(Number(payment.amount || 0), currency)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'privacy' && (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Data Portability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Download a copy of your personal data, including profile information, bookings, orders, and consent history in JSON format.
                  </p>
                  <Button onClick={handleExportData} disabled={isExporting} className="flex items-center gap-2">
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    {isExporting ? 'Preparing Download...' : 'Export My Data'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-900/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
                    <Trash2 className="w-5 h-5" />
                    Right to Erasure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Permanently delete your account and personal data. This action cannot be undone. Some financial records may be anonymized rather than deleted to comply with local tax laws.
                  </p>
                  <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Delete My Account
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-500 mb-4">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-xl font-bold">Delete Account?</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                This action is irreversible. Your profile, active bookings, and personal data will be permanently removed. Financial transactions will be anonymized and retained for 30 days per legal requirements.
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                You will receive a confirmation email detailing the exact anonymization process. Consent records are retained strictly for audit compliance.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDeleteAccount} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
