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
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  ChefHat,
  Home,
  Waves,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Package,
  AlertTriangle,
  Trash2,
  XCircle,
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

interface StockAlert {
  id: string;
  item_name: string;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  severity: 'low' | 'critical' | 'out_of_stock';
}

interface WastageForm {
  itemId: string;
  itemName: string;
  quantity: string;
  reason: string;
  notes: string;
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
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showWastageForm, setShowWastageForm] = useState(false);
  const [wastageForm, setWastageForm] = useState<WastageForm>({ itemId: '', itemName: '', quantity: '', reason: '', notes: '' });
  const [submittingWastage, setSubmittingWastage] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; unit: string }[]>([]);

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
    if (!activeProperty?.id) {
      // PropertyContext not yet resolved — release the loading gate so the
      // page doesn't spin forever. The useCallback dep on activeProperty?.id
      // means this function is replaced (and this effect re-runs) as soon as
      // the property becomes available, at which point we proceed to fetch.
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      // Fetch live transactions from unified endpoint
      const response = await api.get('/staff/transactions/live', {
        params: {
          statuses: 'pending,confirmed,preparing,ready,delivered,active',
        }
      });

      const allTransactions: TransactionRecord[] = response.data?.data || [];

      // Count by transaction status
      const pending = allTransactions.filter((t: TransactionRecord) => 
        ['pending', 'confirmed', 'preparing', 'active', 'delivered'].includes(t.status)
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

  // Fetch low-stock and out-of-stock alerts for staff awareness
  const fetchStockAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const { data } = await api.get('/inventory/alerts?status=active&limit=8');
      setStockAlerts(data?.alerts || []);
    } catch {
      // Non-critical — don't surface error to staff
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Fetch inventory items for wastage form dropdown
  const fetchInventoryItems = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/items?limit=200&fields=id,name,unit');
      setInventoryItems(data?.items || []);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStockAlerts();
    }
  }, [isAuthenticated, fetchStockAlerts]);

  const handleOpenWastageForm = () => {
    fetchInventoryItems();
    setShowWastageForm(true);
  };

  const handleSubmitWastage = async () => {
    if (!wastageForm.itemId || !wastageForm.quantity || !wastageForm.reason) {
      toast.error('Please fill in item, quantity, and reason');
      return;
    }
    setSubmittingWastage(true);
    try {
      await api.post('/inventory/wastage', {
        inventory_item_id: wastageForm.itemId,
        quantity: parseFloat(wastageForm.quantity),
        reason: wastageForm.reason,
        notes: wastageForm.notes,
      });
      toast.success('Wastage recorded — pending manager approval');
      setWastageForm({ itemId: '', itemName: '', quantity: '', reason: '', notes: '' });
      setShowWastageForm(false);
      fetchStockAlerts(); // Refresh alerts after recording
    } catch {
      toast.error('Failed to record wastage. Please try again.');
    } finally {
      setSubmittingWastage(false);
    }
  };

  const alertSeverityStyles = (severity: StockAlert['severity']) => {
    if (severity === 'out_of_stock') return 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800';
    if (severity === 'critical') return 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800';
    return 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800';
  };

  const alertIcon = (severity: StockAlert['severity']) => {
    if (severity === 'out_of_stock') return <XCircle className="w-4 h-4 text-red-500" />;
    if (severity === 'critical') return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  };

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

  // Quick actions derived entirely from active modules — no hardcoded slugs.
  // Routes are /staff/modules/:slug for all modules so new modules work
  // automatically without any code changes here.
  const quickActions = (modules || [])
    .filter(m => m.is_active)
    .map(m => {
      let icon = Home;
      let color = 'from-blue-400 to-indigo-500';
      let bgColor = 'bg-blue-50 dark:bg-blue-950/30';
      let description = m.description || 'Manage module';

      if (m.template_type === 'instant_transaction') {
        icon = ChefHat;
        color = 'from-orange-400 to-rose-500';
        bgColor = 'bg-orange-50 dark:bg-orange-950/30';
        description = 'Kitchen view';
      } else if (m.template_type === 'shared_capacity_access') {
        icon = Waves;
        color = 'from-primary-400 to-secondary-500';
        bgColor = 'bg-primary-50 dark:bg-primary-950/30';
        description = 'Sessions & Capacity';
      } else if (m.template_type === 'time_exclusive_reservation') {
        icon = Home;
        color = 'from-emerald-400 to-teal-500';
        bgColor = 'bg-emerald-50 dark:bg-emerald-950/30';
        description = 'Reservations';
      }

      return {
        title: m.name,
        description,
        href: `/staff/modules/${m.slug}`,
        icon,
        color,
        bgColor,
      };
    });

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

      {/* Stock Alerts Panel */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Stock Alerts
                {stockAlerts.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {stockAlerts.length}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStockAlerts}
                  disabled={alertsLoading}
                  className="text-xs"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${alertsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenWastageForm}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Log Wastage
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading stock levels…
              </div>
            ) : stockAlerts.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">All stock levels are healthy</span>
              </div>
            ) : (
              <div className="space-y-2">
                {stockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${alertSeverityStyles(alert.severity)}`}
                  >
                    <div className="flex items-center gap-2">
                      {alertIcon(alert.severity)}
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                          {alert.item_name}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {alert.severity === 'out_of_stock'
                            ? 'Out of stock'
                            : `${alert.current_stock} ${alert.unit} remaining (min: ${alert.minimum_stock} ${alert.unit})`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      alert.severity === 'out_of_stock' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      alert.severity === 'critical' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {alert.severity === 'out_of_stock' ? 'OUT' : alert.severity.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Wastage Reporting Form (slide-in) */}
      <AnimatePresence>
        {showWastageForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowWastageForm(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-amber-500" />
                  Log Wastage
                </h2>
                <button onClick={() => setShowWastageForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record spoilage, spills, or damaged stock. This will be sent for manager approval.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Item *</label>
                  <select
                    value={wastageForm.itemId}
                    onChange={(e) => {
                      const item = inventoryItems.find(i => i.id === e.target.value);
                      setWastageForm(f => ({ ...f, itemId: e.target.value, itemName: item?.name || '' }));
                    }}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Select an item…</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 2.5"
                    value={wastageForm.quantity}
                    onChange={(e) => setWastageForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason *</label>
                  <select
                    value={wastageForm.reason}
                    onChange={(e) => setWastageForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Select a reason…</option>
                    <option value="spoilage">Spoilage / Expired</option>
                    <option value="spill">Spill / Accident</option>
                    <option value="damage">Damaged packaging</option>
                    <option value="preparation">Preparation loss</option>
                    <option value="theft">Suspected theft</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
                  <textarea
                    placeholder="Any additional details…"
                    rows={2}
                    value={wastageForm.notes}
                    onChange={(e) => setWastageForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowWastageForm(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={handleSubmitWastage}
                  disabled={submittingWastage}
                >
                  {submittingWastage ? 'Submitting…' : 'Submit for Approval'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
