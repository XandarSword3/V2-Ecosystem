'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCardSkeleton, CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  Users,
  UtensilsCrossed,
  Home,
  Waves,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Sparkles,
} from 'lucide-react';

interface RecentOrder {
  id: string;
  orderNumber?: string;
  customerName?: string;
  itemCount?: number;
  totalAmount?: number;
  status?: string;
}

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  todayBookings: number;
  todayTickets: number;
  recentOrders: RecentOrder[];
  revenueByUnit: {
    restaurant: number;
    snackBar: number;
    chalets: number;
    pool: number;
  };
  trends?: {
    orders: number;
    revenue: number;
    bookings: number;
    tickets: number;
  };
}

// Animated stat card with gradient background
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
      {/* Gradient accent */}
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
          <motion.div
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ delay: delay + 0.1, type: 'spring' }}
            className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center shadow-lg`}
          >
            <Icon className="w-7 h-7 text-white" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3 }}
          className={`flex items-center gap-1 mt-4 text-sm font-medium ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {trend === 'up' ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : trend === 'down' ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : null}
          <span>{trendValue}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Revenue progress bar with animation
function RevenueBar({
  name,
  value,
  percentage,
  color,
  delay,
}: {
  name: string;
  value: number;
  percentage: number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="space-y-2"
    >
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>
        <span className="text-slate-500 dark:text-slate-400">{formatCurrency(value)}</span>
      </div>
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </motion.div>
  );
}

// Order status badge
function OrderStatus({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    pending: { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', icon: Clock, label: 'Pending' },
    preparing: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: Timer, label: 'Preparing' },
    ready: { color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Ready' },
    completed: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Completed' },
    cancelled: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: AlertTriangle, label: 'Cancelled' },
  };

  const config = configs[status] || configs.pending;
  const StatusIcon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <StatusIcon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('stats:online_users', (data: { count: number }) => {
        setOnlineUsers(data.count);
      });
      
      // Request initial online users count when socket is ready
      if (socket.connected) {
        socket.emit('request:online_users');
      } else {
        socket.once('connect', () => {
          socket.emit('request:online_users');
        });
      }
    }
    return () => {
      socket?.off('stats:online_users');
    };
  }, [socket]);

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data.data);
      if (isRefresh) toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Calculate totals
  const totalRevenue = stats?.revenueByUnit
    ? Object.values(stats.revenueByUnit).reduce((a, b) => a + b, 0)
    : 0;

  const getPercentage = (value: number) => {
    if (totalRevenue === 0) return 0;
    return Math.round((value / totalRevenue) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-5 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8"
    >
      {/* Welcome Header */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            Welcome back
            <motion.span
              animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="inline-block"
            >
              👋
            </motion.span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Here&apos;s what&apos;s happening at V2 Resort today, <span className="font-medium text-slate-700 dark:text-slate-300">{user?.fullName}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadStats(true)}
          isLoading={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Online Users"
          value={onlineUsers}
          icon={Users}
          trend="neutral"
          trendValue="Live Count"
          gradient="bg-gradient-to-br from-blue-400 to-indigo-500"
          delay={0}
        />
        <StatCard
          title="Today's Orders"
          value={stats?.todayOrders || 0}
          icon={UtensilsCrossed}
          trend={stats?.trends?.orders !== undefined ? (stats.trends.orders >= 0 ? 'up' : 'down') : 'neutral'}
          trendValue={stats?.trends?.orders !== undefined ? `${stats.trends.orders >= 0 ? '+' : ''}${stats.trends.orders}% from yesterday` : 'No data'}
          gradient="bg-gradient-to-br from-orange-400 to-rose-500"
          delay={0}
        />
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats?.todayRevenue || 0)}
          icon={DollarSign}
          trend={stats?.trends?.revenue !== undefined ? (stats.trends.revenue >= 0 ? 'up' : 'down') : 'neutral'}
          trendValue={stats?.trends?.revenue !== undefined ? `${stats.trends.revenue >= 0 ? '+' : ''}${stats.trends.revenue}% from yesterday` : 'No data'}
          gradient="bg-gradient-to-br from-emerald-400 to-teal-500"
          delay={0.1}
        />
        <StatCard
          title="Active Bookings"
          value={stats?.todayBookings || 0}
          icon={Home}
          trend={stats?.trends?.bookings !== undefined ? (stats.trends.bookings >= 0 ? 'up' : 'down') : 'neutral'}
          trendValue={stats?.trends?.bookings !== undefined ? `${stats.trends.bookings >= 0 ? '+' : ''}${stats.trends.bookings}% from last week` : 'No data'}
          gradient="bg-gradient-to-br from-blue-400 to-indigo-500"
          delay={0.2}
        />
        <StatCard
          title="Pool Tickets"
          value={stats?.todayTickets || 0}
          icon={Waves}
          trend={stats?.trends?.tickets !== undefined ? (stats.trends.tickets >= 0 ? 'up' : 'down') : 'neutral'}
          trendValue={stats?.trends?.tickets !== undefined ? `${stats.trends.tickets >= 0 ? '+' : ''}${stats.trends.tickets}% from yesterday` : 'No data'}
          gradient="bg-gradient-to-br from-primary-400 to-secondary-500"
          delay={0.3}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue by Unit */}
        <motion.div variants={fadeInUp}>
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Revenue by Business Unit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <RevenueBar
                  name="🍽️ Restaurant"
                  value={stats?.revenueByUnit?.restaurant || 0}
                  percentage={getPercentage(stats?.revenueByUnit?.restaurant || 0)}
                  color="bg-gradient-to-r from-orange-400 to-rose-500"
                  delay={0.4}
                />
                <RevenueBar
                  name="🍿 Snack Bar"
                  value={stats?.revenueByUnit?.snackBar || 0}
                  percentage={getPercentage(stats?.revenueByUnit?.snackBar || 0)}
                  color="bg-gradient-to-r from-amber-400 to-orange-500"
                  delay={0.5}
                />
                <RevenueBar
                  name="🏠 Chalets"
                  value={stats?.revenueByUnit?.chalets || 0}
                  percentage={getPercentage(stats?.revenueByUnit?.chalets || 0)}
                  color="bg-gradient-to-r from-emerald-400 to-teal-500"
                  delay={0.6}
                />
                <RevenueBar
                  name="🏊 Pool"
                  value={stats?.revenueByUnit?.pool || 0}
                  percentage={getPercentage(stats?.revenueByUnit?.pool || 0)}
                  color="bg-gradient-to-r from-primary-400 to-secondary-500"
                  delay={0.7}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Total Revenue</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(totalRevenue)}
                  </span>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Orders */}
        <motion.div variants={fadeInUp}>
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {(stats?.recentOrders || []).slice(0, 5).map((order: RecentOrder, index: number) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                          #{order.orderNumber?.slice(-3) || '---'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{order.customerName || 'Guest'}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{order.itemCount || 0} items</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(order.totalAmount || 0)}</p>
                        <OrderStatus status={order.status || 'pending'} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p>No orders yet today</p>
                    <p className="text-sm">Orders will appear here as they come in</p>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { href: '/admin/restaurant/menu', icon: UtensilsCrossed, label: 'Manage Menu', color: 'from-orange-400 to-rose-500' },
                { href: '/admin/chalets', icon: Home, label: 'Manage Chalets', color: 'from-emerald-400 to-teal-500' },
                { href: '/admin/pool', icon: Waves, label: 'Pool Sessions', color: 'from-primary-400 to-secondary-500' },
                { href: '/admin/reports', icon: TrendingUp, label: 'View Reports', color: 'from-purple-400 to-indigo-500' },
              ].map((action, index) => (
                <motion.div
                  key={action.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  <Link href={action.href}>
                    <motion.div
                      whileHover={{ scale: 1.05, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 hover:border-slate-200 dark:hover:border-slate-500 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                        <action.icon className="w-7 h-7 text-white" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{action.label}</span>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
