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
import PrivacyCenter from '@/components/PrivacyCenter';
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
  Award,
  Gift,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type TabType = 'profile' | 'orders' | 'bookings' | 'tickets' | 'loyalty' | 'statement' | 'privacy';

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
  tax_amount?: number;
  discount_amount?: number;
  payment_method?: string;
  points?: number;
  order_number?: string;
  booking_number?: string;
  ticket_number?: string;
  reference_id?: string;
  reference_type?: string;
  module_id?: string;
  module_name?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number; price?: number; unit_price?: number }>;
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
  const [statementFilter, setStatementFilter] = useState<'all' | 'orders' | 'bookings' | 'tickets' | 'payments' | 'loyalty'>('all');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'en',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch user orders - statement endpoint returns instant_transaction
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/users/me/statement'),
    enabled: (activeTab === 'orders' || activeTab === 'statement') && !!user,
  });

  // Fetch user bookings - statement endpoint returns time_exclusive_reservation
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/users/me/statement'),
    enabled: (activeTab === 'bookings' || activeTab === 'statement') && !!user,
  });

  // Fetch user session passes (shared_capacity_access)
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get('/users/me/statement'),
    enabled: (activeTab === 'tickets' || activeTab === 'statement') && !!user,
  });

  const { data: statementData, isLoading: statementLoading } = useQuery({
    queryKey: ['my-statement', statementFrom, statementTo],
    queryFn: () => api.get('/users/me/statement', { params: { from: statementFrom || undefined, to: statementTo || undefined } }),
    enabled: activeTab === 'statement' && !!user,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api.get('/payments/me'),
    enabled: activeTab === 'statement' && !!user,
  });

  // Loyalty Queries
  const { data: loyaltyData, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['my-loyalty-account'],
    queryFn: async () => {
      try {
        const res = await api.get('/loyalty/me');
        return res.data?.data || null;
      } catch {
        return null;
      }
    },
    enabled: activeTab === 'loyalty' && !!user,
  });

  const { data: loyaltyTxData, isLoading: loyaltyTxLoading } = useQuery({
    queryKey: ['my-loyalty-transactions'],
    queryFn: async () => {
      try {
        const res = await api.get('/loyalty/me/transactions');
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'loyalty' && !!user,
  });

  const allStatement = ordersData?.data?.data || [];
  const orders = allStatement.filter((row: StatementRecord) => row.type === 'instant_transaction');
  const bookings = (bookingsData?.data?.data || []).filter((row: StatementRecord) => row.type === 'time_exclusive_reservation');
  const tickets = (ticketsData?.data?.data || []).filter((row: StatementRecord) => row.type === 'shared_capacity_access');
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

  const tabs = [
    { id: 'profile' as TabType, label: 'Profile', icon: User },
    { id: 'orders' as TabType, label: 'Orders', icon: UtensilsCrossed },
    { id: 'bookings' as TabType, label: 'Bookings', icon: Home },
    { id: 'tickets' as TabType, label: 'Passes & Tickets', icon: Ticket },
    { id: 'loyalty' as TabType, label: 'Loyalty & Rewards', icon: Award },
    { id: 'statement' as TabType, label: 'Unified Statement', icon: Calendar },
    { id: 'privacy' as TabType, label: 'Privacy & Data', icon: Shield },
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
                      <button
                        aria-label="Change profile photo"
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-700"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const form = new FormData();
                            form.append('avatar', file);
                            try {
                              await import('@/lib/api').then(({ api }) =>
                                api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
                              );
                              window.location.reload();
                            } catch { /* toast handled by interceptor */ }
                          };
                          input.click();
                        }}
                      > {/* FIX Iter-8: aria-label */}
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
                    <UtensilsCrossed className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    My Orders
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
                      <p className="text-slate-500">No past orders found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order: StatementRecord) => {
                        const isExpanded = !!expandedOrders[order.id];
                        const orderNum = order.order_number || `ORD-${order.id.slice(-8).toUpperCase()}`;
                        return (
                          <div
                            key={order.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-base font-bold text-slate-900 dark:text-white">#{orderNum}</span>
                                {order.module_name && (
                                  <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                    {order.module_name}
                                  </span>
                                )}
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[order.status || 'pending'] || statusColors.pending}`}>
                                {(order.status || 'pending').toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 mb-3">
                              <span className="flex items-center gap-1.5 text-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {formatDate(order.created_at)}
                              </span>
                              {order.payment_method && (
                                <span className="text-xs uppercase font-medium px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-800">
                                  {order.payment_method}
                                </span>
                              )}
                            </div>

                            {/* Itemized summary trigger if items exist */}
                            {order.items && order.items.length > 0 && (
                              <div className="mb-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                <button
                                  onClick={() => setExpandedOrders((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  {isExpanded ? 'Hide Item Details' : `View ${order.items.length} Ordered Item(s)`}
                                </button>
                                {isExpanded && (
                                  <div className="mt-2 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 text-xs">
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300">
                                        <span>
                                          {item.quantity || item.qty || 1}x {item.name || item.title || 'Item'}
                                        </span>
                                        <span className="font-mono">
                                          {formatCurrency((item.price || item.unit_price || 0) * (item.quantity || item.qty || 1), currency)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/80">
                              <div className="text-xs text-slate-500 space-x-3">
                                {order.tax_amount && order.tax_amount > 0 ? (
                                  <span>Tax: {formatCurrency(order.tax_amount, currency)}</span>
                                ) : null}
                                {order.discount_amount && order.discount_amount > 0 ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">Discount: -{formatCurrency(order.discount_amount, currency)}</span>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-slate-400 mr-2">Total Amount</span>
                                <span className="text-lg font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(order.total_amount || order.amount || 0, currency)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                    <Home className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    My Bookings & Stays
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
                      <p className="text-slate-500">No active or past bookings found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.map((booking: BookingRecord & StatementRecord) => {
                        const bookingRef = booking.booking_number || `RES-${booking.id.slice(-8).toUpperCase()}`;
                        return (
                          <div
                            key={booking.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white text-base">
                                  {booking.unit?.name || booking.module_name || 'Accommodation Unit'}
                                </span>
                                <div className="font-mono text-xs text-slate-500 mt-0.5">#{bookingRef}</div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[booking.status] || statusColors.pending}`}>
                                {booking.status?.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                <span className="font-medium">{formatDate(booking.check_in_date || booking.created_at)}</span>
                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                <span className="font-medium">{formatDate(booking.check_out_date || booking.created_at)}</span>
                              </span>
                            </div>
                            <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700/80">
                              <span className="text-xs text-slate-500">
                                {booking.number_of_guests ? `${booking.number_of_guests} Guest(s)` : 'Standard Occupancy'}
                              </span>
                              <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {formatCurrency(booking.total_amount || booking.amount || 0, currency)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
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
                    <Ticket className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Passes & Tickets
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
                      <p className="text-slate-500">No session passes or tickets found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket: TicketRecord & StatementRecord) => {
                        const ticketRef = ticket.ticket_number || `TKT-${ticket.id.slice(-8).toUpperCase()}`;
                        return (
                          <div
                            key={ticket.id}
                            className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">#{ticketRef}</span>
                                {ticket.module_name && (
                                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800 font-medium">
                                    {ticket.module_name}
                                  </span>
                                )}
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[ticket.status] || statusColors.pending}`}>
                                {ticket.status?.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 my-2">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-purple-500" />
                                {formatDate(ticket.ticket_date || ticket.created_at)}
                              </span>
                              {ticket.session?.name && <span className="font-medium text-slate-800 dark:text-slate-200">{ticket.session.name}</span>}
                            </div>
                            <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700/80">
                              <span className="text-xs text-slate-500">
                                {ticket.quantity || ticket.number_of_guests || 1} Pass(es)
                              </span>
                              <span className="text-lg font-bold text-slate-900 dark:text-white">
                                {formatCurrency(ticket.total_amount || ticket.amount || 0, currency)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'loyalty' && (
            <motion.div
              key="loyalty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Loyalty Header & Status */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
                  <Award className="w-64 h-64" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-amber-100 text-xs font-semibold tracking-wider uppercase">Resort Rewards</span>
                      <h2 className="text-3xl font-extrabold mt-1 flex items-center gap-2">
                        {loyaltyData?.tier?.name || 'Member Tier'}
                        <Sparkles className="w-6 h-6 text-yellow-300" />
                      </h2>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-right border border-white/30">
                      <div className="text-xs text-amber-100 font-medium">Balance</div>
                      <div className="text-2xl font-black">{loyaltyData?.available_points || 0} pts</div>
                    </div>
                  </div>

                  {/* Tier Progress */}
                  <div className="mt-6 pt-4 border-t border-amber-400/40">
                    <div className="flex justify-between text-xs text-amber-100 mb-1.5">
                      <span>Current Progress</span>
                      <span>Next Tier: {loyaltyData?.nextTier?.name || 'Max Tier'}</span>
                    </div>
                    <div className="w-full bg-amber-900/40 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-yellow-300 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((loyaltyData?.available_points || 0) / 1000) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Loyalty History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-amber-600" />
                    Points Activity History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loyaltyTxLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                    </div>
                  ) : loyaltyTxData.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No loyalty points history found</div>
                  ) : (
                    <div className="space-y-3">
                      {loyaltyTxData.map((tx: any) => (
                        <div key={tx.id} className="p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm text-slate-900 dark:text-white">
                              {tx.description || (tx.points > 0 ? 'Points Earned' : 'Points Redeemed')}
                            </div>
                            <div className="text-xs text-slate-500">{formatDate(tx.created_at)}</div>
                          </div>
                          <span className={`font-mono text-base font-bold ${tx.points >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                          </span>
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
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Unified Statement & Ledger
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Date Filters & Category Tabs */}
                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
                        <Input type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
                        <Input type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} />
                      </div>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-700">
                      {[
                        { id: 'all', label: 'All Activity' },
                        { id: 'orders', label: 'Orders' },
                        { id: 'bookings', label: 'Bookings' },
                        { id: 'tickets', label: 'Passes' },
                        { id: 'payments', label: 'Payments' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setStatementFilter(f.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            statementFilter === f.id
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {statementLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : statement.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No activity recorded for this period</div>
                  ) : (
                    <div className="space-y-3">
                      {statement
                        .filter((row: StatementRecord) => {
                          if (statementFilter === 'all') return true;
                          if (statementFilter === 'orders') return row.type === 'instant_transaction';
                          if (statementFilter === 'bookings') return row.type === 'time_exclusive_reservation';
                          if (statementFilter === 'tickets') return row.type === 'shared_capacity_access';
                          if (statementFilter === 'payments') return row.type === 'payment' || row.payment_method;
                          return true;
                        })
                        .map((row: StatementRecord) => {
                          const refCode = row.order_number || row.booking_number || row.ticket_number || row.reference_id || `REF-${row.id.slice(-8).toUpperCase()}`;
                          return (
                            <div key={`${row.type}-${row.id}`} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                                    {row.type.replace(/_/g, ' ')}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[row.status || 'pending'] || statusColors.pending}`}>
                                    {(row.status || 'recorded').toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 space-x-2">
                                  <span>{formatDate(row.created_at)}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-600 dark:text-slate-400">Ref: #{refCode}</span>
                                  {row.module_name && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 dark:text-blue-400">{row.module_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-slate-900 dark:text-white">
                                  {row.total_amount !== undefined
                                    ? formatCurrency(Number(row.total_amount), currency)
                                    : row.amount !== undefined
                                      ? formatCurrency(Number(row.amount), currency)
                                      : `${row.points || 0} pts`}
                                </div>
                                {row.payment_method && (
                                  <div className="text-[11px] text-slate-400 uppercase font-medium">{row.payment_method}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
            >
              <PrivacyCenter />
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
