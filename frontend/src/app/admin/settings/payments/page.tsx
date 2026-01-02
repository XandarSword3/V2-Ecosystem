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
  const socket = useSocket();

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

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Today's Revenue</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(stats?.totalToday || 0)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Transactions</p>
                  <p className="text-2xl font-bold mt-1">
                    {stats?.transactionCount || 0}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Pending</p>
                  <p className="text-2xl font-bold mt-1">
                    {stats?.totalPending || 0}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-yellow-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Completed</p>
                  <p className="text-2xl font-bold mt-1">
                    {stats?.totalCompleted || 0}
                  </p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID, customer, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="stripe">Stripe</option>
            </select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <AnimatePresence mode="popLayout">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <p className="text-slate-500 dark:text-slate-400">
                          No payments found
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment, index) => (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
                            #{payment.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {payment.users?.full_name || 'Guest'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {payment.users?.email || '-'}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-slate-600 dark:text-slate-300">
                            {payment.reference_type?.replace('_', ' ') || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getMethodIcon(payment.payment_method)}
                            <span className="capitalize text-slate-600 dark:text-slate-300">
                              {payment.payment_method}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              payment.status
                            )}`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(payment.created_at)}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
