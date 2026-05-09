'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useSiteSettings } from '@/lib/settings-context';
import { useProperty } from '@/context/PropertyContext';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  ChefHat,
  Cookie,
  Home,
  Waves,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardStats {
  pendingOrders: number;
  completedToday: number;
  issues: number;
  avgResponseTime: string;
}

interface RecentActivity {
  id: string;
  action: string;
  time: string;
  type: 'success' | 'info' | 'warning';
}

export default function StaffDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { modules } = useSiteSettings();
  const t = useTranslations('staff');
  const td = useTranslations('staff.dashboard');
  const { socket } = useSocket();
  
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    completedToday: 0,
    issues: 0,
    avgResponseTime: '-',
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  interface TransactionRecord {
    id: string;
    engine_type: 'instant_transaction' | 'shared_capacity_access' | 'time_exclusive_reservation' | 'ongoing_entitlement';
    status: string;
    amount: number;
    metadata: {
      order_number?: string;
      ticket_number?: string;
      booking_number?: string;
      customer_name?: string;
    };
    updated_at?: string;
    created_at?: string;
  }

  const { activeProperty } = useProperty();

  const fetchDashboardData = useCallback(async () => {
    if (!activeProperty?.id) return;
    
    try {
      // Fetch live transactions from unified endpoint
      const response = await api.get('/transactions/live', {
        params: {
          propertyId: activeProperty.id,
          statuses: 'pending,confirmed,preparing,active,ready',
        }
      });

      const allTransactions: TransactionRecord[] = response.data?.data || [];

      // Count by transaction status
      const pending = allTransactions.filter((t: TransactionRecord) => 
        ['pending', 'confirmed', 'preparing', 'active'].includes(t.status)
      ).length;

      const completed = allTransactions.filter((t: TransactionRecord) => 
        ['completed', 'used', 'checked_out'].includes(t.status) && 
        new Date(t.updated_at || '').toDateString() === new Date().toDateString()
      ).length;

      setStats({
        pendingOrders: pending,
        completedToday: completed,
        issues: allTransactions.filter((t: TransactionRecord) => t.status === 'cancelled').length,
        avgResponseTime: '-',
      });

      // Generate recent activity from transactions
      const activities: RecentActivity[] = allTransactions
        .slice(0, 5)
        .map((tx: TransactionRecord, index: number) => {
          const referenceNumber = tx.metadata.order_number || tx.metadata.ticket_number || tx.metadata.booking_number || tx.id.slice(0, 8);
          const engineLabel = tx.engine_type === 'instant_transaction' ? 'Order' : 
                             tx.engine_type === 'shared_capacity_access' ? 'Ticket' : 
                             tx.engine_type === 'time_exclusive_reservation' ? 'Booking' : 'Membership';
          return {
            id: tx.id,
            action: `${engineLabel} #${referenceNumber} - ${tx.status}`,
            time: getRelativeTime(tx.updated_at || tx.created_at || ''),
            type: ['completed', 'used', 'checked_out'].includes(tx.status) ? 'success' : 
                  tx.status === 'cancelled' ? 'warning' : 'info',
          };
        });

      setRecentActivity(activities);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeProperty?.id]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/staff');
      return;
    }

    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated, isLoading, router, fetchDashboardData]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (socket) {
      // Listen for new transactions
      socket.on('transaction:new', (tx: TransactionRecord) => {
        // Only count if for this property
        setStats((prev) => ({
          ...prev,
          pendingOrders: prev.pendingOrders + 1,
        }));
        const referenceNumber = tx.metadata.order_number || tx.metadata.ticket_number || tx.metadata.booking_number || tx.id.slice(0, 8);
        const engineLabel = tx.engine_type === 'instant_transaction' ? 'Order' : 
                           tx.engine_type === 'shared_capacity_access' ? 'Ticket' : 
                           tx.engine_type === 'time_exclusive_reservation' ? 'Booking' : 'Membership';
        setRecentActivity((prev) => [
          {
            id: tx.id,
            action: `New ${engineLabel.toLowerCase()} #${referenceNumber} received`,
            time: td('justNow'),
            type: 'info',
          },
          ...prev.slice(0, 4),
        ]);
        toast.info(td('newTransactionReceived'));
      });

      // Listen for transaction status changes
      socket.on('transaction:statusChanged', ({ transactionId, status, engine_type }: { transactionId: string; status: string; engine_type: string }) => {
        if (['completed', 'used', 'checked_out'].includes(status)) {
          setStats((prev) => ({
            ...prev,
            pendingOrders: Math.max(0, prev.pendingOrders - 1),
            completedToday: prev.completedToday + 1,
          }));
        }
        const engineLabel = engine_type === 'instant_transaction' ? 'Order' : 
                           engine_type === 'shared_capacity_access' ? 'Ticket' : 
                           engine_type === 'time_exclusive_reservation' ? 'Booking' : 'Membership';
        setRecentActivity((prev) => [
          {
            id: transactionId,
            action: `${engineLabel} #${transactionId.slice(0, 8)} ${status}`,
            time: td('justNow'),
            type: ['completed', 'used', 'checked_out'].includes(status) ? 'success' : 'info',
          },
          ...prev.slice(0, 4),
        ]);
      });

      return () => {
        socket.off('transaction:new');
        socket.off('transaction:statusChanged');
      };
    }
  }, [socket]);

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return td('justNow');
    if (diffMins < 60) return td('minAgo', { count: diffMins });
    if (diffMins < 1440) return td('hoursAgo', { count: Math.floor(diffMins / 60) });
    return td('daysAgo', { count: Math.floor(diffMins / 1440) });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const moduleActions = (modules || [])
    .filter(m => m.is_active && !['restaurant', 'chalets', 'pool', 'snack-bar'].includes(m.slug))
    .map(m => {
      let icon = Home;
      let color = 'from-blue-400 to-indigo-500';
      let bgColor = 'bg-blue-50 dark:bg-blue-950/30';
      let description = 'Manage module';

      if (m.template_type === 'menu_service') {
        icon = ChefHat;
        color = 'from-orange-400 to-rose-500';
        bgColor = 'bg-orange-50 dark:bg-orange-950/30';
        description = 'Kitchen view';
      } else if (m.template_type === 'session_access') {
        icon = Waves;
        color = 'from-primary-400 to-secondary-500';
        bgColor = 'bg-primary-50 dark:bg-primary-950/30';
        description = 'Sessions & Capacity';
      }

      return {
        title: m.name,
        description,
        href: `/staff/modules/${m.slug}`,
        icon,
        color,
        bgColor
      };
    });

  const quickActions = [
    {
      title: td('kitchenOrders'),
      description: td('kitchenOrdersDesc'),
      href: '/staff/restaurant',
      icon: ChefHat,
      color: 'from-orange-400 to-rose-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    },
    ...moduleActions,
    {
      title: td('snackBar'),
      description: td('snackBarDesc'),
      href: '/staff/snack',
      icon: Cookie,
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: td('housekeeping'),
      description: td('housekeepingDesc'),
      href: '/staff/housekeeping',
      icon: ClipboardList,
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: td('chalets'),
      description: td('chaletsDesc'),
      href: '/staff/chalets',
      icon: Home,
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: td('pool'),
      description: td('poolDesc'),
      href: '/staff/pool',
      icon: Waves,
      color: 'from-primary-400 to-secondary-500',
      bgColor: 'bg-primary-50 dark:bg-primary-950/30',
    },
  ];

  const statsDisplay = [
    { label: td('pendingOrders'), value: stats.pendingOrders.toString(), icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    { label: td('completedToday'), value: stats.completedToday.toString(), icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: td('issues'), value: stats.issues.toString(), icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
    { label: td('avgResponse'), value: stats.avgResponseTime, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8"
    >
      {/* Welcome Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Welcome, {user?.fullName?.split(' ')[0] || 'Staff'} 👋
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {td('welcomeSubtitle')}
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsDisplay.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fadeInUp}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">{td('quickActions')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${action.bgColor} rounded-xl p-6 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all hover:shadow-lg`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{action.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{action.description}</p>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              {td('recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {recentActivity.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                    {td('noActivity')}
                  </p>
                ) : (
                  recentActivity.map((activity, index) => (
                    <motion.div
                      key={activity.id + index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      layout
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'success' ? 'bg-emerald-500' : 
                          activity.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-slate-700 dark:text-slate-300">{activity.action}</span>
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{activity.time}</span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
