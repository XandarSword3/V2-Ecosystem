'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Download,
  RefreshCw,
  UtensilsCrossed,
  Home,
  Waves,
  Cookie,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface OccupancyData {
  chalets: {
    occupancyRate: number;
    bookedNights: number;
    totalCapacity: number;
    activeUnits: number;
  };
  pool: {
    occupancyRate: number;
    ticketsSold: number;
    totalCapacity: number;
    dailyCapacity: number;
  };
}

interface CustomerData {
  topCustomers: Array<{
    id: string;
    name: string;
    revenue: number;
    count: number;
  }>;
  customerRetention: {
    new: number;
    returning: number;
    total: number;
    newRatio: number;
  };
}

interface ReportData {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalBookings: number;
    totalUsers: number;
    revenueChange: number;
    ordersChange: number;
  };
  revenueByService: {
    restaurant: number;
    snackBar: number;
    chalets: number;
    pool: number;
  };
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  topItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

type ExportType = 'restaurant' | 'chalets' | 'pool' | 'snack' | 'users';

const EXPORT_OPTIONS: { value: ExportType; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant Orders' },
  { value: 'chalets', label: 'Chalet Bookings' },
  { value: 'pool', label: 'Pool Tickets' },
  { value: 'snack', label: 'Snack Orders' },
  { value: 'users', label: 'Users' },
];

export default function AdminReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, occupancyRes, customerRes] = await Promise.all([
        api.get('/admin/reports/overview', { params: { range: dateRange } }),
        api.get('/admin/reports/occupancy', { params: { range: dateRange } }),
        api.get('/admin/reports/customers', { params: { range: dateRange } }),
      ]);

      setReportData(overviewRes.data.data || null);
      setOccupancyData(occupancyRes.data.data || null);
      setCustomerData(customerRes.data.data || null);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Failed to fetch reports data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportReport = async (type: ExportType) => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const response = await api.get('/admin/reports/export', {
        params: { range: dateRange, format: 'csv', type },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // Handle case when no data is available
  if (!reportData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Reports & Analytics
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Business performance overview
            </p>
          </div>
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No report data available</p>
            <p className="text-slate-500 dark:text-slate-400">Check back once there is transaction data in the system.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = reportData;
  const totalServiceRevenue = data.revenueByService ? Object.values(data.revenueByService).reduce((a, b) => a + b, 0) : 0;
  const revenueByMonth = data.revenueByMonth || [];
  const topItems = data.topItems || [];

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
            Reports & Analytics
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Business performance overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateRange === range
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <div className="relative">
            <Button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                {EXPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => exportReport(opt.value)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg text-sm"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatCurrency(data.overview.totalRevenue)}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${data.overview.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                    {data.overview.revenueChange >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(data.overview.revenueChange)}% vs last period
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
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.overview.totalOrders}
                  </p>
                  <div className={`flex items-center gap-1 mt-2 text-sm ${data.overview.ordersChange >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                    {data.overview.ordersChange >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(data.overview.ordersChange)}% vs last period
                  </div>
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
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Bookings</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.overview.totalBookings}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">Chalets & Pool</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {data.overview.totalUsers}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">Registered accounts</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Occupancy & Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy Card */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Unit Occupancy Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {occupancyData && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chalet Bookings</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{occupancyData.chalets.occupancyRate}%</span>
                      </div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${occupancyData.chalets.occupancyRate}%` }}
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                        />
                      </div>
                      <p className="text-xs text-slate-500">{occupancyData.chalets.bookedNights} nights / {occupancyData.chalets.totalCapacity} total</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pool Sessions</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{occupancyData.pool.occupancyRate}%</span>
                      </div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${occupancyData.pool.occupancyRate}%` }}
                          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
                        />
                      </div>
                      <p className="text-xs text-slate-500">{occupancyData.pool.ticketsSold} guests / {occupancyData.pool.totalCapacity} capacity</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Retention Card */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Customer Retention</CardTitle>
            </CardHeader>
            <CardContent>
              {customerData && (
                <div className="flex items-center gap-8 py-4">
                  <div className="relative w-32 h-32">
                    {/* Simplified donut chart using CSS */}
                    <div className="absolute inset-0 rounded-full border-[12px] border-slate-100 dark:border-slate-800" />
                    <div
                      className="absolute inset-0 rounded-full border-[12px] border-indigo-500 border-t-transparent border-l-transparent"
                      style={{ transform: `rotate(${45 + (customerData.customerRetention.newRatio * 3.6)}deg)` }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold">{customerData.customerRetention.newRatio}%</span>
                      <span className="text-[10px] text-slate-500 uppercase">New</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">New Customers</span>
                      </div>
                      <span className="font-semibold">{customerData.customerRetention.new}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Returning</span>
                      </div>
                      <span className="font-semibold">{customerData.customerRetention.returning}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Total Active Users</span>
                      <span className="font-bold">{customerData.customerRetention.total}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Service */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: 'bg-blue-500' },
                  { key: 'snackBar', label: 'Snack Bar', icon: Cookie, color: 'bg-orange-500' },
                  { key: 'chalets', label: 'Chalets', icon: Home, color: 'bg-green-500' },
                  { key: 'pool', label: 'Pool', icon: Waves, color: 'bg-primary-500' },
                ].map((service) => {
                  const value = data.revenueByService[service.key as keyof typeof data.revenueByService];
                  const percentage = totalServiceRevenue > 0 ? (value / totalServiceRevenue) * 100 : 0;
                  const Icon = service.icon;

                  return (
                    <div key={service.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {service.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(value)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full ${service.color} rounded-full`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Revenue Chart */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {revenueByMonth.map((item, index) => {
                  const maxRevenue = revenueByMonth.length > 0 ? Math.max(...revenueByMonth.map((r) => r.revenue)) : 0;
                  const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;

                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg min-h-[4px] relative group"
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          {formatCurrency(item.revenue)}
                        </div>
                      </motion.div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {item.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Items */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Rank
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Item Name
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Quantity Sold
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, index) => (
                    <motion.tr
                      key={item.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-slate-100 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-50 text-slate-500'
                          }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(item.revenue)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {topItems.length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No sales data available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      {/* Top Customers */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Customer
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Orders
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Total Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customerData?.topCustomers.map((customer, index) => (
                    <motion.tr
                      key={customer.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                            {customer.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{customer.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                        {customer.count}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(customer.revenue)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {(!customerData || customerData.topCustomers.length === 0) && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No customer data available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
