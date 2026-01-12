'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  CreditCard,
  Banknote,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  Download,
  DollarSign,
  TrendingUp,
  Settings as SettingsIcon,
  Save,
} from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'stripe';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference_type: string;
  reference_id: string;
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
}

interface PaymentStats {
  totalToday: number;
  totalPending: number;
  totalCompleted: number;
  transactionCount: number;
}

export default function AdminPaymentsPage() {
  const t = useTranslations('admin');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'settings'>('transactions');
  const [savingSettings, setSavingSettings] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    stripePublicKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripeMode: 'test' as 'test' | 'live',
    currency: 'USD',
  });
  const { socket } = useSocket();

  const exportPayments = async () => {
    try {
      setExporting(true);
      // Filter payments based on current filters
      const dataToExport = filteredPayments;

      // Create CSV content
      const headers = ['Date', 'Amount', 'Method', 'Status', 'Reference Type', 'Customer'];
      const rows = dataToExport.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.amount.toFixed(2),
        p.payment_method,
        p.status,
        p.reference_type,
        p.users?.full_name || 'Guest'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Payments exported successfully');
    } catch (error) {
      toast.error('Failed to export payments');
    } finally {
      setExporting(false);
    }
  };

  const fetchPayments = useCallback(async () => {
    try {
      const response = await api.get('/payments/transactions');
      setPayments(response.data.data || []);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayPayments = (response.data.data || []).filter(
        (p: Payment) => p.created_at.startsWith(today)
      );

      setStats({
        totalToday: todayPayments.reduce((sum: number, p: Payment) => sum + p.amount, 0),
        totalPending: (response.data.data || []).filter((p: Payment) => p.status === 'pending').length,
        totalCompleted: (response.data.data || []).filter((p: Payment) => p.status === 'completed').length,
        transactionCount: (response.data.data || []).length,
      });
    } catch (error) {
      toast.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get('/admin/settings');
      if (response.data.success && response.data.data.payments) {
        setPaymentSettings(response.data.data.payments);
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchSettings();
  }, [fetchPayments, fetchSettings]);

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.put('/admin/settings', {
        key: 'payments',
        value: paymentSettings
      });
      toast.success('Payment settings saved successfully');
    } catch (error) {
      toast.error('Failed to save payment settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRefund = async (paymentId: string) => {
    const reason = prompt('Please enter the reason for the refund:');
    if (reason === null) return;

    try {
      await api.post(`/payments/transactions/${paymentId}/refund`, { reason });
      toast.success('Refund processed successfully');
      fetchPayments();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || 'Failed to process refund');
    }
  };

  // Real-time payment updates
  useEffect(() => {
    if (socket) {
      socket.on('payment:new', (payment: Payment) => {
        setPayments((prev) => [payment, ...prev]);
        toast.success(`New payment received: ${formatCurrency(payment.amount)}`);
      });

      socket.on('payment:updated', (payment: Payment) => {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? payment : p))
        );
      });

      return () => {
        socket.off('payment:new');
        socket.off('payment:updated');
      };
    }
  }, [socket]);

  const filteredPayments = payments
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.id.toLowerCase().includes(query) ||
          p.reference_type.toLowerCase().includes(query) ||
          p.users?.full_name?.toLowerCase().includes(query) ||
          p.users?.email?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'refunded':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'card':
      case 'stripe':
        return <CreditCard className="w-4 h-4" />;
      case 'cash':
        return <Banknote className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Payments
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage and track all payment transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPayments}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportPayments} disabled={exporting}>
            <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transactions'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Provider Config
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'transactions' ? (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total Today</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(stats?.totalToday || 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total Completed</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {stats?.totalCompleted || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {stats?.totalPending || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Search className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total Transactions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          {stats?.transactionCount || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                    <select
                      value={methodFilter}
                      onChange={(e) => setMethodFilter(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="all">All Methods</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="stripe">Stripe</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    >
                      <ArrowUpDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                          No transactions found
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(payment.created_at)}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500 whitespace-nowrap">
                            {payment.id.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {payment.users?.full_name || 'Guest'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {payment.users?.email || 'No email'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {payment.reference_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 capitalize">
                              {getMethodIcon(payment.payment_method)}
                              {payment.payment_method}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {payment.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefund(payment.id)}
                              >
                                Refund
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Stripe Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Stripe Mode
                  </label>
                  <select
                    value={paymentSettings.stripeMode}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeMode: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="test">Test Mode</option>
                    <option value="live">Live Mode</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Public Key
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.stripePublicKey}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripePublicKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    placeholder="pk_test_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Secret Key
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.stripeSecretKey}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeSecretKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    placeholder="sk_test_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.stripeWebhookSecret}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeWebhookSecret: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    placeholder="whsec_..."
                  />
                </div>
                <div className="pt-4">
                  <Button
                    className="w-full"
                    onClick={saveSettings}
                    disabled={savingSettings}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  General Payment Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Default Currency
                  </label>
                  <select
                    value={paymentSettings.currency}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, currency: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="LBP">LBP (ل.ل)</option>
                  </select>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> Stripe settings will override environment variables if configured here. Ensure keys match the selected mode.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
