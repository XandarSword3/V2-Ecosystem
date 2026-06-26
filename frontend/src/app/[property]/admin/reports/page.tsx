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
import EconomicsDashboard from './EconomicsDashboard';
import { useProperty } from '@/context/PropertyContext';
import {
  BarChart3,
  DollarSign,
  Users,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
} from 'lucide-react';

interface OccupancyData {
  units: {
    occupancyRate: number;
    bookedNights: number;
    totalCapacity: number;
    activeUnits: number;
  };
  capacity_access: {
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
  // Canonical — dynamic array from the backend; present in all responses after Issue 13 fix.
  revenueByModule?: Array<{
    slug: string;
    name: string;
    revenue: number;
    count: number;
  }>;
  // Legacy compat shape — still returned by backend but derived dynamically, not hardcoded.
  // Use revenueByModule when available; fall back here only for older cached responses.
  revenueByService: Record<string, number>;
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

type ExportType = string;
interface ExportOption { value: string; label: string; }

const BAR_COLORS = [
  'bg-blue-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-indigo-500',
];

export default function AdminReportsPage() {
  const t = useTranslations('adminReports');
  const tc = useTranslations('adminCommon');
  const { activePropertyId } = useProperty();

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'economics'>('overview');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModules, setExportModules] = useState<ExportOption[]>([{ value: 'users', label: 'Users' }]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab === 'economics') {
      setActiveTab('economics');
    }
  }, []);

  const handleTabChange = (tab: 'overview' | 'economics') => {
    setActiveTab(tab);
    window.history.pushState(null, '', `?tab=${tab}`);
  };

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      // x-property-id is required by all admin report controllers.
      // Missing this header causes the backend to reject with 400 or return empty data.
      const headers = activePropertyId ? { 'x-property-id': activePropertyId } : {};
      const [overviewRes, occupancyRes, customerRes, modulesRes] = await Promise.all([
        api.get('/admin/reports/overview', { params: { range: dateRange }, headers }),
        api.get('/admin/reports/occupancy', { params: { range: dateRange }, headers }),
        api.get('/admin/reports/customers', { params: { range: dateRange }, headers }),
        api.get('/admin/modules', { headers }),
      ]);

      setReportData(overviewRes.data.data || null);
      setOccupancyData(occupancyRes.data.data || null);
      setCustomerData(customerRes.data.data || null);

      if (modulesRes.data.success && modulesRes.data.data) {
        const moduleOpts: ExportOption[] = (modulesRes.data.data as Array<{ slug: string; name: string; is_active: boolean }>)
          .filter((m) => m.is_active)
          .map((m) => ({ value: m.slug, label: m.name }));
        setExportModules([...moduleOpts, { value: 'users', label: 'Users' }]);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error(t('errors.failedToLoad'));
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange, activePropertyId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportReport = async (type: ExportType) => {
    setExporting(true);
    setShowExportMenu(false);
    const headers = activePropertyId ? { 'x-property-id': activePropertyId } : {};
    const params = type === 'users'
      ? { range: dateRange, format: 'csv', type: 'users' }
      : { range: dateRange, format: 'csv', moduleSlug: type };
    try {
      const response = await api.get('/admin/reports/export', {
        params,
        headers,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(t('exported'));
    } catch (error) {
      toast.error(t('errors.failedToExport'));
    } finally {
      setExporting(false);
    }
  };

  if (loading && activeTab !== 'economics') {
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

  if (!reportData && activeTab !== 'economics') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              {t('subtitle')}
            </p>
          </div>
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{tc('noData')}</p>
            <p className="text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = reportData!;
  const revenueByMonth = data?.revenueByMonth || [];
  const topItems = data?.topItems || [];

  // Prefer the canonical revenueByModule array (dynamic, all modules).
  // Fall back to Object.entries(revenueByService) for older or cached responses.
  const moduleBreakdown: Array<{ slug: string; name: string; revenue: number; count: number }> =
    data?.revenueByModule && data.revenueByModule.length > 0
      ? data.revenueByModule
      : Object.entries(data?.revenueByService || {}).map(([slug, revenue]) => ({
          slug,
          name: slug.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()), // kioskOrders → Kiosk Orders
          revenue,
          count: 0,
        }));

  const totalModuleRevenue = moduleBreakdown.reduce((sum, m) => sum + m.revenue, 0);

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
            {t('title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('economics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'economics'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Economics
            </button>
          </div>

          {/* Date range selector — overview only */}
          {activeTab === 'overview' && (
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
          )}

          {activeTab === 'overview' && (
            <>
              <Link href="/admin/reports/scheduled">
                <Button variant="outline">
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Scheduled
                </Button>
              </Link>
              <Button variant="outline" onClick={fetchReports}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {tc('refresh')}
              </Button>
              <div className="relative">
                <Button onClick={() => setShowExportMenu(!showExportMenu)} disabled={exporting}>
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? tc('loading') : tc('export')}
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
                    {exportModules.map((opt) => (
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
            </>
          )}
        </div>
      </div>

      {activeTab === 'economics' ? (
        <div className="-mx-6">
          <EconomicsDashboard />
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div variants={fadeInUp}>
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalRevenue')}</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(data.overview.totalRevenue)}
                      </p>
                      <div className={`flex items-center gap-1 mt-2 text-sm ${data.overview.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalOrders')}</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {data.overview.totalOrders}
                      </p>
                      <div className={`flex items-center gap-1 mt-2 text-sm ${data.overview.ordersChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalBookings')}</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {data.overview.totalBookings}
                      </p>
                      <p className="text-sm text-slate-400 mt-2">Reservations &amp; Capacity Access</p>
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalUsers')}</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {data.overview.totalUsers}
                      </p>
                      <p className="text-sm text-slate-400 mt-2">{t('registeredAccounts')}</p>
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
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reservation Units</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{occupancyData.units.occupancyRate}%</span>
                          </div>
                          <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${occupancyData.units.occupancyRate}%` }}
                              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                            />
                          </div>
                          <p className="text-xs text-slate-500">{occupancyData.units.bookedNights} nights / {occupancyData.units.totalCapacity} total</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Shared Capacity Access</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{occupancyData.capacity_access.occupancyRate}%</span>
                          </div>
                          <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${occupancyData.capacity_access.occupancyRate}%` }}
                              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full"
                            />
                          </div>
                          <p className="text-xs text-slate-500">{occupancyData.capacity_access.ticketsSold} guests / {occupancyData.capacity_access.totalCapacity} capacity</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card>
                <CardHeader>
                  <CardTitle>Customer Retention</CardTitle>
                </CardHeader>
                <CardContent>
                  {customerData && (
                    <div className="flex items-center gap-8 py-4">
                      <div className="relative w-32 h-32">
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
                            <span className="text-sm text-slate-600 dark:text-slate-400">{t('newCustomers')}</span>
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
            {/* Revenue by Module — dynamic, works for any module configuration */}
            <motion.div variants={fadeInUp}>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Module</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {moduleBreakdown.length > 0 ? (
                      moduleBreakdown.map((module, i) => {
                        const percentage = totalModuleRevenue > 0
                          ? (module.revenue / totalModuleRevenue) * 100
                          : 0;
                        return (
                          <div key={module.slug} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                                  {module.name}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(module.revenue)}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No revenue data available yet
                      </div>
                    )}
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
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Rank</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Item Name</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Quantity Sold</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Revenue</th>
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
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{item.quantity}</td>
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
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Customer</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Orders</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Total Revenue</th>
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
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{customer.count}</td>
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
        </>
      )}
    </motion.div>
  );
}
