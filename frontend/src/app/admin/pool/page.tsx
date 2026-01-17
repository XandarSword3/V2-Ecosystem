'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Waves,
  Calendar,
  Ticket,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  UserCheck,
  CircleDot,
} from 'lucide-react';

interface PoolStats {
  todayTickets: number;
  todayRevenue: number;
  currentOccupancy: number;
  maxCapacity: number;
  activeSessions: number;
  validatedTickets: number;
  pendingPayments: number;
  trends?: {
    tickets: number;
    revenue: number;
  };
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

// Animated stat card
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  gradient,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-lg border border-slate-100 dark:border-slate-700"
    >
      <div className={`absolute inset-0 opacity-5 ${gradient}`} />
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />
      
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
              className="text-3xl font-bold text-slate-900 dark:text-white"
            >
              {value}
            </motion.p>
          </div>
          <div className={`p-3 rounded-xl ${gradient}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {trend !== 'neutral' && (
          <div className="mt-4 flex items-center gap-2">
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            )}
            <span className={`text-sm font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {trendValue}
            </span>
            <span className="text-xs text-slate-400">vs yesterday</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminPoolPage() {
  const t = useTranslations('adminPool');
  const tc = useTranslations('adminCommon');
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch multiple endpoints in parallel
      const [capacityRes, dailyReportRes, sessionsRes] = await Promise.allSettled([
        api.get('/pool/staff/capacity'),
        api.get('/pool/admin/reports/daily'),
        api.get('/pool/sessions'),
      ]);

      const capacity = capacityRes.status === 'fulfilled' ? capacityRes.value.data.data : { currentOccupancy: 0, maxCapacity: 100 };
      const dailyReport = dailyReportRes.status === 'fulfilled' ? dailyReportRes.value.data.data : { totalTickets: 0, totalRevenue: 0, validatedTickets: 0 };
      const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data.data : [];

      setStats({
        todayTickets: dailyReport.totalTickets || 0,
        todayRevenue: dailyReport.totalRevenue || 0,
        currentOccupancy: capacity.currentOccupancy || 0,
        maxCapacity: capacity.maxCapacity || 100,
        activeSessions: sessions.filter((s: { is_active?: boolean }) => s.is_active !== false).length || 0,
        validatedTickets: dailyReport.validatedTickets || 0,
        pendingPayments: dailyReport.pendingPayments || 0,
        trends: {
          tickets: dailyReport.ticketsTrend || 0,
          revenue: dailyReport.revenueTrend || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching pool stats:', error);
      // Set default stats on error
      setStats({
        todayTickets: 0,
        todayRevenue: 0,
        currentOccupancy: 0,
        maxCapacity: 100,
        activeSessions: 0,
        validatedTickets: 0,
        pendingPayments: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
    toast.success(tc('dataRefreshed'));
  };

  const quickActions: QuickAction[] = [
    {
      title: t('quickActions.manageSessions') || 'Manage Sessions',
      description: t('quickActions.manageSessionsDesc') || 'Create and edit pool time slots',
      href: '/admin/pool/sessions',
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      title: t('quickActions.viewTickets') || 'View Tickets',
      description: t('quickActions.viewTicketsDesc') || 'Browse and manage pool tickets',
      href: '/admin/pool/tickets',
      icon: Ticket,
      color: 'bg-emerald-500',
    },
    {
      title: t('quickActions.capacity') || 'Capacity Monitor',
      description: t('quickActions.capacityDesc') || 'Real-time pool occupancy',
      href: '/admin/pool/capacity',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      title: t('quickActions.reports') || 'Reports',
      description: t('quickActions.reportsDesc') || 'View pool analytics and reports',
      href: '/admin/reports',
      icon: BarChart3,
      color: 'bg-amber-500',
    },
  ];

  const occupancyPercentage = stats ? Math.round((stats.currentOccupancy / stats.maxCapacity) * 100) : 0;
  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 90) return 'text-rose-500';
    if (percentage >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Waves className="w-8 h-8 text-blue-500" />
            {t('title') || 'Pool Management'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('subtitle') || 'Manage pool sessions, tickets, and capacity'}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {tc('refresh')}
        </Button>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          title={t('stats.todayTickets') || "Today's Tickets"}
          value={loading ? '...' : stats?.todayTickets || 0}
          icon={Ticket}
          trend={stats?.trends?.tickets && stats.trends.tickets > 0 ? 'up' : stats?.trends?.tickets && stats.trends.tickets < 0 ? 'down' : 'neutral'}
          trendValue={stats?.trends?.tickets ? `${Math.abs(stats.trends.tickets)}%` : '0%'}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          delay={0}
        />
        <StatCard
          title={t('stats.todayRevenue') || "Today's Revenue"}
          value={loading ? '...' : formatCurrency(stats?.todayRevenue || 0)}
          icon={DollarSign}
          trend={stats?.trends?.revenue && stats.trends.revenue > 0 ? 'up' : stats?.trends?.revenue && stats.trends.revenue < 0 ? 'down' : 'neutral'}
          trendValue={stats?.trends?.revenue ? `${Math.abs(stats.trends.revenue)}%` : '0%'}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          delay={0.1}
        />
        <StatCard
          title={t('stats.currentOccupancy') || 'Current Occupancy'}
          value={loading ? '...' : `${stats?.currentOccupancy || 0} / ${stats?.maxCapacity || 100}`}
          icon={Users}
          trend="neutral"
          trendValue=""
          gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          delay={0.2}
        />
        <StatCard
          title={t('stats.validatedTickets') || 'Validated Today'}
          value={loading ? '...' : stats?.validatedTickets || 0}
          icon={UserCheck}
          trend="neutral"
          trendValue=""
          gradient="bg-gradient-to-br from-amber-500 to-amber-600"
          delay={0.3}
        />
      </motion.div>

      {/* Occupancy Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 text-blue-500" />
            {t('occupancy.title') || 'Pool Occupancy'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">
                {stats?.currentOccupancy || 0} {t('occupancy.guests') || 'guests'} / {stats?.maxCapacity || 100} {t('occupancy.capacity') || 'capacity'}
              </span>
              <span className={`text-2xl font-bold ${getOccupancyColor(occupancyPercentage)}`}>
                {occupancyPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${occupancyPercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  occupancyPercentage >= 90 
                    ? 'bg-gradient-to-r from-rose-400 to-rose-500' 
                    : occupancyPercentage >= 70 
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                }`}
              />
            </div>
            {occupancyPercentage >= 90 && (
              <div className="flex items-center gap-2 text-rose-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {t('occupancy.nearCapacity') || 'Pool is near capacity!'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          {t('quickActions.title') || 'Quick Actions'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={action.href} href={action.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all cursor-pointer h-full"
              >
                <div className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center mb-4`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  {action.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {action.description}
                </p>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Active Sessions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            {t('sessions.active') || 'Active Sessions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {loading ? '...' : stats?.activeSessions || 0}
                </p>
                <p className="text-sm text-slate-500">
                  {t('sessions.activeDescription') || 'sessions currently active'}
                </p>
              </div>
            </div>
            <Link href="/admin/pool/sessions">
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t('sessions.manage') || 'Manage'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
