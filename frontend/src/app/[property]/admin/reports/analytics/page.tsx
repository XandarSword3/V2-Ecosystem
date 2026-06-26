'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Briefcase,
  Building2,
  FileSpreadsheet,
  Shield,
  Activity,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Calendar,
  PieChart,
  LineChart,
  BarChart2,
  Target,
} from 'lucide-react';

// 10 Report Categories from Planning.md
const REPORT_CATEGORIES = [
  {
    id: 'executive',
    name: 'Executive Overview',
    description: 'Immediate situational awareness - revenue, orders, growth, health',
    icon: Briefcase,
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    endpoint: '/admin/reports/overview',
  },
  {
    id: 'sales',
    name: 'Sales & Revenue',
    description: 'Where money comes from - by time, service, location',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
    endpoint: '/reports/daily-sales',
  },
  {
    id: 'orders',
    name: 'Order Flow & Operations',
    description: 'Order funnel, prep times, bottlenecks, cancellations',
    icon: ShoppingCart,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    endpoint: '/reports/order-flow',
  },
  {
    id: 'customers',
    name: 'Customer Intelligence',
    description: 'New vs returning, retention, CLV, top customers',
    icon: Users,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
    endpoint: '/reports/customer-intelligence',
  },
  {
    id: 'products',
    name: 'Product & Menu Performance',
    description: 'Top sellers, time-based popularity, attach rate, margins',
    icon: PieChart,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-600 dark:text-orange-400',
    endpoint: '/reports/menu-performance',
  },
  {
    id: 'payments',
    name: 'Payments & Finance',
    description: 'Revenue by method, refunds, reconciliation, Stripe',
    icon: FileSpreadsheet,
    color: 'from-teal-500 to-green-500',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
    textColor: 'text-teal-600 dark:text-teal-400',
    endpoint: '/reports/payments-finance',
  },
  {
    id: 'capacity',
    name: 'Capacity & Utilization',
    description: 'Occupancy, RevPAR, booking conversion, no-shows',
    icon: Building2,
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    textColor: 'text-rose-600 dark:text-rose-400',
    endpoint: '/reports/capacity-utilization',
  },
  {
    id: 'staff',
    name: 'Staff & System Performance',
    description: 'Orders per staff, handling time, logins, overrides',
    icon: Activity,
    color: 'from-sky-500 to-blue-500',
    bgColor: 'bg-sky-100 dark:bg-sky-900/30',
    textColor: 'text-sky-600 dark:text-sky-400',
    endpoint: '/reports/staff-performance',
  },
  {
    id: 'trends',
    name: 'Comparative & Trends',
    description: 'Period comparisons, forecasting, anomaly detection',
    icon: LineChart,
    color: 'from-violet-500 to-indigo-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    textColor: 'text-violet-600 dark:text-violet-400',
    endpoint: '/reports/comparative-analysis',
  },
  {
    id: 'audit',
    name: 'Export & Audit',
    description: 'CSV/Excel exports, audit logs, compliance',
    icon: Shield,
    color: 'from-slate-500 to-gray-500',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    textColor: 'text-slate-600 dark:text-slate-400',
    endpoint: '/reports/audit',
  },
];

interface ExecutiveData {
  today: { revenue: number; orders: number; bookings: number };
  mtd: { revenue: number; netRevenue: number; orders: number; bookings: number; discounts: number; refunds: number };
  ytd: { revenue: number; orders: number; bookings: number };
  growth: { orderGrowthPercent: string; revenueGrowthPercent: string };
  aov: string;
  activeCustomers: number;
  systemHealth: { orderFailures24h: number; paymentFailures24h: number; status: string };
}

function normalizeExecutiveData(raw: any): ExecutiveData | null {
  if (!raw || typeof raw !== 'object') return null;

  // Newer/legacy expected shape (already matches UI)
  if (raw.today && raw.mtd && raw.ytd && raw.growth) {
    return raw as ExecutiveData;
  }

  // Current backend shape: { overview, revenueByService, revenueByMonth, topItems }
  const overview = raw.overview;
  if (!overview || typeof overview !== 'object') return null;

  const totalRevenue = Number(overview.totalRevenue || 0);
  const totalOrders = Number(overview.totalOrders || 0);
  const totalBookings = Number(overview.totalBookings || 0);
  const revenueChange = Number(overview.revenueChange || 0);
  const ordersChange = Number(overview.ordersChange || 0);

  const aov = totalOrders > 0 ? String(Math.round((totalRevenue / totalOrders) * 100) / 100) : '0';

  return {
    today: { revenue: totalRevenue, orders: totalOrders, bookings: totalBookings },
    mtd: {
      revenue: totalRevenue,
      netRevenue: totalRevenue,
      orders: totalOrders,
      bookings: totalBookings,
      discounts: 0,
      refunds: 0,
    },
    ytd: { revenue: totalRevenue, orders: totalOrders, bookings: totalBookings },
    growth: { orderGrowthPercent: String(ordersChange), revenueGrowthPercent: String(revenueChange) },
    aov,
    activeCustomers: Number(overview.totalUsers || 0),
    systemHealth: { orderFailures24h: 0, paymentFailures24h: 0, status: 'ok' },
  };
}

export default function AnalyticsReportsPage() {
  const t = useTranslations('adminReports');
  const [executiveData, setExecutiveData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  }, []);

  const fetchExecutiveOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/reports/overview');
      const normalized = normalizeExecutiveData(response.data.data);
      setExecutiveData(normalized);
    } catch (error) {
      console.error('Failed to fetch executive overview:', error);
      toast.error('Failed to load executive overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutiveOverview();
  }, [fetchExecutiveOverview]);

  const fetchCategoryData = async (category: typeof REPORT_CATEGORIES[0]) => {
    try {
      setCategoryLoading(true);
      setSelectedCategory(category.id);
      const response = await api.get(category.endpoint, {
        params: { startDate: dateRange.start, endDate: dateRange.end },
      });
      setCategoryData(response.data.data);
    } catch (error) {
      console.error(`Failed to fetch ${category.name}:`, error);
      toast.error(`Failed to load ${category.name}`);
    } finally {
      setCategoryLoading(false);
    }
  };

  const exportData = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await api.get('/admin/reports/export', {
        params: {
          // Backend admin exportReport expects moduleSlug, moduleId, or engineType.
          // This UI exports instant transactions by default.
          engineType: 'instant_transaction',
          format,
          range: 'month',
        },
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (format === 'csv') {
        const csvBlob =
          response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(csvBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report_export_${dateRange.start}_${dateRange.end}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Report exported successfully');
      } else {
        // Handle JSON download
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report_export_${dateRange.start}_${dateRange.end}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Report exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export report');
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
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
            Analytics Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Comprehensive reporting across 10 categories
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border-none text-sm focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border-none text-sm focus:outline-none"
            />
          </div>
          <Button variant="outline" onClick={fetchExecutiveOverview}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => exportData('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Executive Overview KPIs */}
      {executiveData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeInUp}>
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Today&apos;s Revenue</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(executiveData.today.revenue)}
                    </p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${
                      parseFloat(executiveData.growth.revenueGrowthPercent) >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {parseFloat(executiveData.growth.revenueGrowthPercent) >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {Math.abs(parseFloat(executiveData.growth.revenueGrowthPercent))}% vs last month
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">MTD Revenue</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(executiveData.mtd.revenue)}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      Net: {formatCurrency(executiveData.mtd.netRevenue)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Active Customers</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {executiveData.activeCustomers}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      AOV: {formatCurrency(parseFloat(executiveData.aov))}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                    <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Card className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                executiveData.systemHealth.status === 'healthy' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              }`} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">System Health</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 capitalize">
                      {executiveData.systemHealth.status}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                      {executiveData.systemHealth.orderFailures24h > 0 && (
                        <span className="text-red-500">
                          {executiveData.systemHealth.orderFailures24h} order failures
                        </span>
                      )}
                      {executiveData.systemHealth.paymentFailures24h > 0 && (
                        <span className="text-red-500">
                          {executiveData.systemHealth.paymentFailures24h} payment failures
                        </span>
                      )}
                      {executiveData.systemHealth.status === 'healthy' && (
                        <span className="text-green-500">All systems operational</span>
                      )}
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    executiveData.systemHealth.status === 'healthy'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {executiveData.systemHealth.status === 'healthy' ? (
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* 10 Report Categories */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Report Categories
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {REPORT_CATEGORIES.map((category, index) => (
            <motion.div
              key={category.id}
              variants={fadeInUp}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  selectedCategory === category.id ? 'ring-2 ring-primary-500' : ''
                }`}
                onClick={() => fetchCategoryData(category)}
              >
                <CardContent className="p-4">
                  <div className={`w-12 h-12 rounded-xl ${category.bgColor} flex items-center justify-center mb-3`}>
                    <category.icon className={`w-6 h-6 ${category.textColor}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {category.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Selected Category Detail */}
      {selectedCategory && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {REPORT_CATEGORIES.find(c => c.id === selectedCategory)?.name} Report
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedCategory(null);
                  setCategoryData(null);
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {categoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : categoryData ? (
                <div className="space-y-4">
                  {/* Render based on category type */}
                  {selectedCategory === 'orders' && categoryData.funnel && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      {Object.entries(categoryData.funnel).map(([status, count]) => (
                        <div key={status} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{count as number}</p>
                          <p className="text-sm text-slate-500 capitalize">{status}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCategory === 'customers' && categoryData.overview && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Total Customers</p>
                        <p className="text-2xl font-bold">{categoryData.overview.totalCustomers}</p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-600">New Customers</p>
                        <p className="text-2xl font-bold text-green-700">{categoryData.overview.newCustomers}</p>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-600">Returning</p>
                        <p className="text-2xl font-bold text-blue-700">{categoryData.overview.returningCustomers}</p>
                      </div>
                    </div>
                  )}

                  {selectedCategory === 'products' && categoryData.topSellers && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Product</th>
                            <th className="text-right py-2">Quantity</th>
                            <th className="text-right py-2">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.topSellers.slice(0, 10).map((item: any) => (
                            <tr key={item.productId} className="border-b">
                              <td className="py-2">{item.productName}</td>
                              <td className="text-right">{item.quantity}</td>
                              <td className="text-right font-semibold">{formatCurrency(item.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedCategory === 'payments' && categoryData.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Total Revenue</p>
                        <p className="text-2xl font-bold">{formatCurrency(categoryData.summary.totalRevenue)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Transactions</p>
                        <p className="text-2xl font-bold">{categoryData.summary.totalPayments}</p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-600">Failed</p>
                        <p className="text-2xl font-bold text-red-700">{categoryData.summary.failedPayments}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Failure Rate</p>
                        <p className="text-2xl font-bold">{categoryData.summary.failureRate}%</p>
                      </div>
                    </div>
                  )}

                  {selectedCategory === 'capacity' && categoryData.overview && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Total Units</p>
                        <p className="text-2xl font-bold">{categoryData.overview.totalUnits}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Occupancy Rate</p>
                        <p className="text-2xl font-bold">{categoryData.overview.occupancyRate}%</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Booked Days</p>
                        <p className="text-2xl font-bold">{categoryData.overview.bookedDays}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-500">Total Capacity</p>
                        <p className="text-2xl font-bold">{categoryData.overview.totalCapacityDays}</p>
                      </div>
                    </div>
                  )}

                  {selectedCategory === 'staff' && categoryData.staffPerformance && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Staff Member</th>
                            <th className="text-right py-2">Orders</th>
                            <th className="text-right py-2">Revenue</th>
                            <th className="text-right py-2">Avg Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.staffPerformance.map((staff: any) => (
                            <tr key={staff.staffId} className="border-b">
                              <td className="py-2">{staff.name}</td>
                              <td className="text-right">{staff.ordersHandled}</td>
                              <td className="text-right font-semibold">{formatCurrency(staff.revenue)}</td>
                              <td className="text-right">{staff.avgHandlingTimeMinutes} min</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedCategory === 'trends' && categoryData.comparison && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(categoryData.comparison).map(([metric, data]: [string, any]) => (
                          <div key={metric} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <p className="text-sm text-slate-500 capitalize">{metric.replace('_', ' ')}</p>
                            <p className="text-xl font-bold">
                              {typeof data.current === 'number' && metric.includes('revenue') 
                                ? formatCurrency(data.current) 
                                : data.current}
                            </p>
                            <div className={`flex items-center gap-1 text-sm ${
                              parseFloat(data.change) >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {parseFloat(data.change) >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {data.change}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCategory === 'audit' && categoryData.logs && (
                    <div className="space-y-4">
                      <div className="text-sm text-slate-500">
                        Showing {categoryData.logs.length} of {categoryData.summary.total} logs
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white dark:bg-slate-900">
                            <tr className="border-b">
                              <th className="text-left py-2">Action</th>
                              <th className="text-left py-2">User</th>
                              <th className="text-right py-2">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryData.logs.slice(0, 50).map((log: any, i: number) => (
                              <tr key={i} className="border-b">
                                <td className="py-2 font-mono text-xs">{log.action}</td>
                                <td className="py-2">{log.user_id || 'System'}</td>
                                <td className="text-right text-slate-500">
                                  {formatDate(log.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Generic data display for other categories */}
                  {!['orders', 'customers', 'products', 'payments', 'capacity', 'staff', 'trends', 'audit'].includes(selectedCategory) && (
                    <pre className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                      {JSON.stringify(categoryData, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No data available for this report
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/reports">
              <Button variant="outline" className="w-full justify-start">
                <BarChart2 className="w-4 h-4 mr-2" />
                Legacy Reports Dashboard
              </Button>
            </Link>
            <Link href="/admin/reports/scheduled">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Scheduled Reports
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportData('json')}>
              <Download className="w-4 h-4 mr-2" />
              Export as JSON
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">YTD Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {executiveData?.ytd && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Revenue</span>
                  <span className="font-semibold">{formatCurrency(executiveData.ytd.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Orders</span>
                  <span className="font-semibold">{executiveData.ytd.orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Bookings</span>
                  <span className="font-semibold">{executiveData.ytd.bookings}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
