'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useProperty } from '@/context/PropertyContext';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  DollarSign,
  BarChart3,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  ChefHat,
  Home,
  Waves,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Shield,
  Package,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSocket } from '@/lib/socket';

interface OverviewStats {
  totalRevenue: number;
  todayRevenue: number;
  revenueChange: number;
  pendingOrders: number;
  completedToday: number;
  activeStaff: number;
  issues: number;
}

interface PendingApproval {
  id: string;
  type: 'refund' | 'discount' | 'override' | 'void';
  amount?: number;
  description: string;
  requestedBy: string;
  requestedAt: string;
  orderId?: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'on_break' | 'offline';
  lastAction?: string;
  lastActionTime?: string;
  ordersCompleted: number;
}

interface PerformanceData {
  period: string;
  orders: number;
  revenue: number;
  avgTime: number;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const [stats, setStats] = useState<OverviewStats>({
    totalRevenue: 0,
    todayRevenue: 0,
    revenueChange: 0,
    pendingOrders: 0,
    completedToday: 0,
    activeStaff: 0,
    issues: 0,
  });
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeModules, setActiveModules] = useState<any[]>([]);
  const [moduleSummary, setModuleSummary] = useState<Array<{ module: string; todays_order_count: number; todays_revenue: number; active_orders_count: number; staff_on_shift: number }>>([]);
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [inventoryAlerts, setInventoryAlerts] = useState<Array<{ id: string; item_name: string; current_stock: number; minimum_stock: number; unit: string; severity: string }>>([]);
  const [inventoryStats, setInventoryStats] = useState<{ total: number; low: number; critical: number; out_of_stock: number; total_value: number } | null>(null);
  const [pendingWastageApprovals, setPendingWastageApprovals] = useState<Array<{ id: string; item_name: string; quantity: number; unit: string; reason: string; notes: string; reported_by: string; created_at: string }>>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [shiftForm, setShiftForm] = useState({
    staffId: '',
    shiftDate: '',
    startTime: '09:00',
    endTime: '17:00',
    department: '',
    breakMinutes: 0,
  });
  const { socket } = useSocket();

  // Check for manager role
  const isManager = user?.roles?.some(r => 
    ['admin', 'super_admin', 'manager'].includes(r)
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/staff/manager');
      return;
    }
    if (!isLoading && !isManager) {
      toast.error('Access denied. Manager role required.');
      router.push('/staff');
      return;
    }
    if (isAuthenticated && isManager) {
      // FIX Iter-14: AbortController prevents setState on unmounted component
      const controller = new AbortController();
      loadDashboardData(controller.signal);
      return () => controller.abort();
    }
  }, [isAuthenticated, isLoading, isManager]);

  const { activeProperty } = useProperty();

  const loadDashboardData = useCallback(async (signal?: AbortSignal) => {
    if (!activeProperty?.id) return;
    setLoading(true);
    try {
      // FIX Iter-14: Pass AbortSignal to all API calls to cancel on unmount
      const [transactionsRes, modulesRes, staffRes, activityRes, weeklyOrdersRes, approvalsRes, todayShiftsRes, managerSummaryRes] = await Promise.all([
        api.get('/transactions/live', { 
          params: { 
            propertyId: activeProperty.id,
            statuses: 'pending,confirmed,preparing,active,ready'
          },
          signal 
        }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/modules', { signal }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/users', { params: { role: 'staff' }, signal }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/audit-logs', { params: { limit: 50 }, signal }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/dashboard', { signal }).catch(() => ({ data: { data: null } })),
        api.get('/manager/approvals/pending', { signal }).catch(() => ({ data: { data: [] } })),
        api.get('/manager/shifts/today', { signal }).catch(() => ({ data: { data: [], summary: null } })),
        api.get('/manager/summary', { signal }).catch(() => ({ data: { data: [] } })),
      ]);
      // FIX Iter-14: Bail out if aborted before processing results
      if (signal?.aborted) return;

      const allTransactions = transactionsRes.data?.data || [];
      const allModules = modulesRes.data?.data || [];
      const activeModulesList = allModules.filter((m: any) => m.is_active);
      setActiveModules(activeModulesList);

      const staff = staffRes.data.data || [];
      const activityLogs = activityRes.data.data || [];
      const dashboardStats = weeklyOrdersRes.data?.data || weeklyOrdersRes.data;
      const pendingApprovals = approvalsRes.data.data || [];
      const todayShifts = todayShiftsRes.data?.data || [];
      const shiftSummary = todayShiftsRes.data?.summary;
      const summaryModules = managerSummaryRes.data?.data || [];
      setModuleSummary(summaryModules);
      setTodayShifts(todayShifts);

      // Calculate stats from unified transactions data
      const pending = allTransactions.filter((t: any) => 
        ['pending', 'confirmed', 'preparing', 'active'].includes(t.status)
      ).length;
      
      const completed = allTransactions.filter((t: any) => 
        ['completed', 'used', 'checked_out'].includes(t.status)
      ).length;
      
      const todayRevenue = allTransactions
        .filter((t: any) => ['completed', 'used', 'checked_out'].includes(t.status) || t.payment_status === 'paid')
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const issues = allTransactions.filter((t: any) => t.status === 'cancelled').length;

      // Use real dashboard stats if available, otherwise calculate from orders
      const totalRevenue = dashboardStats?.totalRevenue || todayRevenue;
      const revenueChange = dashboardStats?.revenueChange || 0;
      
      // Active staff count from shifts or staff list
      const activeStaffCount = shiftSummary?.active || staff.filter((s: any) => s.is_active).length;

      setStats({
        totalRevenue,
        todayRevenue,
        revenueChange,
        pendingOrders: pending,
        completedToday: completed,
        activeStaff: activeStaffCount,
        issues,
      });

      // Set real approvals from API
      setApprovals(pendingApprovals.map((a: any) => ({
        id: a.id,
        type: a.type,
        amount: a.amount,
        description: a.description,
        requestedBy: a.requested_by_name || 'Staff Member',
        requestedAt: a.created_at,
        orderId: a.reference_id,
      })));

      // Map REAL staff data with REAL activity from logs
      const staffActivityMap = new Map<string, { action: string; time: string }>();
      activityLogs.forEach((log: any) => {
        if (log.user_id && !staffActivityMap.has(log.user_id)) {
          staffActivityMap.set(log.user_id, {
            action: `${log.action} on ${log.resource || 'item'}`,
            time: log.created_at
          });
        }
      });

      // Get real transaction counts per staff member
      const staffOrderCounts = new Map<string, number>();
      allTransactions.forEach((tx: any) => {
        const staffId = tx.staff_id || tx.assigned_to;
        if (staffId) {
          staffOrderCounts.set(staffId, (staffOrderCounts.get(staffId) || 0) + 1);
        }
      });

      setStaffList(staff.slice(0, 10).map((s: any) => {
        const activity = staffActivityMap.get(s.id);
        const orderCount = staffOrderCounts.get(s.id) || 0;
        return {
          id: s.id,
          name: s.full_name || s.name || s.email?.split('@')[0] || 'Staff Member',
          role: s.role || (s.roles && s.roles[0]) || 'staff',
          // Real status based on is_active flag - no fake randomization
          status: s.is_active ? 'active' : 'offline',
          lastAction: activity?.action || 'No recent activity',
          lastActionTime: activity?.time || s.last_login || s.updated_at,
          ordersCompleted: orderCount,
        };
      }));

      // Calculate REAL performance data from dashboard stats or orders
      if (dashboardStats?.weeklyData) {
        setPerformanceData(dashboardStats.weeklyData);
      } else {
        // Group transactions by day for real weekly performance
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData = new Map<string, { orders: number; revenue: number }>();
        
        allTransactions.forEach((tx: any) => {
          const date = new Date(tx.created_at);
          const dayName = dayNames[date.getDay()];
          const existing = weekData.get(dayName) || { orders: 0, revenue: 0 };
          weekData.set(dayName, {
            orders: existing.orders + 1,
            revenue: existing.revenue + (tx.amount || 0)
          });
        });

        // Build performance array in order
        const performanceArray = dayNames.map(day => ({
          period: day,
          orders: weekData.get(day)?.orders || 0,
          revenue: weekData.get(day)?.revenue || 0,
          avgTime: 0, // Would need order timestamps to calculate
        }));
        
        setPerformanceData(performanceArray);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [activeProperty?.id]);

  const fetchInventoryData = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const [alertsRes, statsRes, wastageRes] = await Promise.all([
        api.get('/inventory/alerts?status=active&limit=20').catch(() => ({ data: { alerts: [] } })),
        api.get('/inventory/stats').catch(() => ({ data: null })),
        api.get('/inventory/wastage?status=pending&limit=20').catch(() => ({ data: { records: [] } })),
      ]);
      setInventoryAlerts(alertsRes.data?.alerts || []);
      setInventoryStats(statsRes.data || null);
      setPendingWastageApprovals(wastageRes.data?.records || []);
    } catch {
      // Non-critical fetch
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventoryData();
    }
  }, [activeTab, fetchInventoryData]);

  const handleWastageApproval = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/inventory/wastage/${id}`, { status: approved ? 'approved' : 'rejected' });
      toast.success(`Wastage report ${approved ? 'approved' : 'rejected'}`);
      setPendingWastageApprovals(prev => prev.filter(w => w.id !== id));
    } catch {
      toast.error('Failed to update wastage status');
    }
  };

  useEffect(() => {
    if (!socket) return;

    const requestBrowserPermission = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignore permission errors and keep in-app notifications only.
        }
      }
    };

    requestBrowserPermission();

    const handleApprovalNew = (payload?: { approval?: any }) => {
      const approval = payload?.approval;
      if (approval) {
        setApprovals((prev) => {
          const normalized: PendingApproval = {
            id: approval.id,
            type: approval.type,
            amount: approval.amount,
            description: approval.description,
            requestedBy: approval.requested_by_name || 'Staff Member',
            requestedAt: approval.created_at,
            orderId: approval.reference_id,
          };
          const withoutDuplicate = prev.filter((p) => p.id !== normalized.id);
          return [normalized, ...withoutDuplicate];
        });
      }
      toast.info('New approval request received');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = 'New approval request';
        const body = approval?.description || 'A staff approval request requires review.';
        new Notification(title, { body });
      }
    };
    const handleApprovalReviewed = () => {
      loadDashboardData();
    };

    socket.on('approval:new', handleApprovalNew);
    socket.on('new_approval_request', handleApprovalNew);
    socket.on('approval:reviewed', handleApprovalReviewed);

    return () => {
      socket.off('approval:new', handleApprovalNew);
      socket.off('new_approval_request', handleApprovalNew);
      socket.off('approval:reviewed', handleApprovalReviewed);
    };
  }, [socket, loadDashboardData]);

  const handleApproval = async (id: string, approved: boolean) => {
    try {
      // Call the real API endpoint
      await api.put(`/manager/approvals/${id}/review`, {
        status: approved ? 'approved' : 'rejected',
        notes: approved ? 'Approved by manager' : 'Rejected by manager',
      });
      toast.success(approved ? 'Request approved' : 'Request denied');
      setApprovals(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error('Failed to process request');
    }
  };

  const getApprovalTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      refund: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      discount: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      override: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      void: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return <Badge className={styles[type] || ''}>{type.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      on_break: 'bg-amber-100 text-amber-700',
      offline: 'bg-slate-100 text-slate-700',
    };
    return <Badge className={styles[status]}>{status.replace('_', ' ')}</Badge>;
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            Manager Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Oversee operations, approve requests, and monitor staff
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadDashboardData()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/admin">
            <Button>
              Full Admin Panel
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Today&apos;s Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.todayRevenue)}</p>
                <p className="text-xs text-green-100 flex items-center gap-1 mt-1">
                  {stats.revenueChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(stats.revenueChange)}% vs yesterday
                </p>
              </div>
              <DollarSign className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Pending Orders</p>
                <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                <p className="text-xs text-blue-100 mt-1">{stats.completedToday} completed today</p>
              </div>
              <ClipboardList className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Active Staff</p>
                <p className="text-2xl font-bold">{stats.activeStaff}</p>
                <p className="text-xs text-purple-100 mt-1">{staffList.filter(s => s.status === 'on_break').length} on break</p>
              </div>
              <Users className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${approvals.length > 0 ? 'from-amber-500 to-orange-600' : 'from-slate-500 to-slate-600'} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Pending Approvals</p>
                <p className="text-2xl font-bold">{approvals.length}</p>
                <p className="text-xs text-amber-100 mt-1">Requires your attention</p>
              </div>
              <AlertTriangle className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {approvals.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
                {approvals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Inventory
            {inventoryAlerts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {inventoryAlerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Weekly Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.map((day) => (
                    <div key={day.period} className="flex items-center gap-4">
                      <span className="w-8 text-sm font-medium text-slate-500">{day.period}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          // FIX Iter-14: Normalize against max in dataset to prevent overflow >100%
                          style={{ width: `${Math.min(100, (day.orders / Math.max(...performanceData.map(d => d.orders), 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-20 text-right">{day.orders} orders</span>
                      <span className="text-sm text-slate-500 w-24 text-right">{formatCurrency(day.revenue)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Dynamic active modules */}
                {(activeModules || []).slice(0, 6).map((m: any) => (
                  <Link key={m.id} href={`/staff/${m.slug}`} className="block">
                    <Button variant="outline" className="w-full justify-start gap-3">
                      {m.template_type === 'menu_service' && <ChefHat className="w-5 h-5 text-amber-500" />}
                      {m.template_type === 'multi_day_booking' && <Calendar className="w-5 h-5 text-indigo-500" />}
                      {m.template_type === 'session_access' && <Users className="w-5 h-5 text-teal-500" />}
                      {m.name}
                    </Button>
                  </Link>
                ))}
                <Link href="/admin/housekeeping" className="block">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <ClipboardList className="w-5 h-5 text-purple-500" />
                    Housekeeping Tasks
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          {approvals.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  No Approval Requests
                </h3>
                <p className="text-slate-500 mb-4">
                  The approval workflow system is available for refund requests, discount approvals, and price overrides.
                </p>
                <p className="text-sm text-slate-400">
                  When staff members request refunds or discounts that exceed their authority, requests will appear here for your review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {approvals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getApprovalTypeBadge(approval.type)}
                          {approval.amount && (
                            <span className="font-bold text-lg text-slate-900 dark:text-white">
                              {approval.type === 'discount' ? `${approval.amount}%` : formatCurrency(approval.amount)}
                            </span>
                          )}
                          {approval.orderId && (
                            <span className="text-sm text-slate-500">#{approval.orderId}</span>
                          )}
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-2">{approval.description}</p>
                        <p className="text-sm text-slate-500">
                          Requested by <strong>{approval.requestedBy}</strong> • {formatDate(approval.requestedAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleApproval(approval.id, false)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <ThumbsDown className="w-4 h-4 mr-1" />
                          Deny
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleApproval(approval.id, true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Staff Status
                </span>
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-700">
                    {staffList.filter(s => s.status === 'active').length} Active
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700">
                    {staffList.filter(s => s.status === 'on_break').length} On Break
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left p-3 font-medium text-slate-500">Staff Member</th>
                      <th className="text-left p-3 font-medium text-slate-500">Role</th>
                      <th className="text-left p-3 font-medium text-slate-500">Status</th>
                      <th className="text-left p-3 font-medium text-slate-500">Last Action</th>
                      <th className="text-center p-3 font-medium text-slate-500">Orders Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((staff) => (
                      <tr key={staff.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                              {staff.name.charAt(0)}
                            </div>
                            <span className="font-medium">{staff.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-500 capitalize">{staff.role}</td>
                        <td className="p-3">{getStatusBadge(staff.status)}</td>
                        <td className="p-3">
                          <div>
                            <p className="text-sm">{staff.lastAction}</p>
                            <p className="text-xs text-slate-500">{formatDate(staff.lastActionTime || '')}</p>
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold">{staff.ordersCompleted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Today's Shift Schedule
                </span>
                <Button
                  onClick={() => {
                    setEditingShift(null);
                    setShiftForm({
                      staffId: '',
                      shiftDate: new Date().toISOString().split('T')[0],
                      startTime: '09:00',
                      endTime: '17:00',
                      department: '',
                      breakMinutes: 0,
                    });
                    setShowShiftForm(true);
                  }}
                >
                  Create Shift
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayShifts.map((shift) => (
                <div key={shift.id} className="border rounded p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{shift.staff_name || 'Unknown staff'}</div>
                    <div className="text-sm text-slate-500">
                      {shift.start_time} - {shift.end_time} | {shift.department || 'general'} | {shift.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingShift(shift);
                        setShiftForm({
                          staffId: shift.staff_id || '',
                          shiftDate: shift.shift_date || new Date().toISOString().split('T')[0],
                          startTime: shift.start_time || '09:00',
                          endTime: shift.end_time || '17:00',
                          department: shift.department || '',
                          breakMinutes: shift.break_minutes || 0,
                        });
                        setShowShiftForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.delete(`/manager/shifts/${shift.id}`);
                          toast.success('Shift deleted');
                          loadDashboardData();
                        } catch {
                          toast.error('Failed to delete shift');
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {todayShifts.length === 0 && <div className="text-slate-500 text-sm">No shifts scheduled for today</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          {moduleSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Live Module Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {moduleSummary.map((row) => (
                  <div key={row.module} className="rounded-lg border p-3">
                    <div className="font-medium capitalize">{row.module.replaceAll('_', ' ')}</div>
                    <div className="text-sm text-slate-500">
                      Orders: {row.todays_order_count} | Active: {row.active_orders_count}
                    </div>
                    <div className="text-sm text-slate-500">
                      Revenue: {formatCurrency(row.todays_revenue)} | Staff: {row.staff_on_shift}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Quick Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => window.location.href = `/${activeProperty?.public_slug}/admin/reports?type=revenue&period=today`}>
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Daily Revenue Report</p>
                  <p className="text-sm text-slate-500">Sales breakdown by category</p>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => window.location.href = `/${activeProperty?.public_slug}/admin/reports?type=staff&period=today`}>
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Staff Performance</p>
                  <p className="text-sm text-slate-500">Orders, response times</p>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 justify-start gap-4" onClick={() => window.location.href = `/${activeProperty?.public_slug}/admin/reports?type=orders&period=today`}>
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Order Summary</p>
                  <p className="text-sm text-slate-500">Volume, avg value, status</p>
                </div>
              </Button>
              <Link href="/admin/reports/scheduled" className="block">
                <Button variant="outline" className="h-auto p-4 justify-start gap-4 w-full">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Scheduled Reports</p>
                    <p className="text-sm text-slate-500">Configure automated reports</p>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Inventory Overview</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchInventoryData} disabled={inventoryLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${inventoryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/admin/inventory">
                <Button size="sm" variant="outline">
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Full Inventory
                </Button>
              </Link>
            </div>
          </div>

          {/* Summary Stats */}
          {inventoryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Items', value: inventoryStats.total, color: 'text-slate-700 dark:text-slate-300' },
                { label: 'Low Stock', value: inventoryStats.low, color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Critical', value: inventoryStats.critical, color: 'text-orange-600 dark:text-orange-400' },
                { label: 'Out of Stock', value: inventoryStats.out_of_stock, color: 'text-red-600 dark:text-red-400' },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Active Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inventoryLoading ? (
                <p className="text-sm text-slate-400 py-2">Loading alerts…</p>
              ) : inventoryAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">All stock levels healthy</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {inventoryAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        alert.severity === 'out_of_stock'
                          ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                          : alert.severity === 'critical'
                          ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
                          : 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{alert.item_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {alert.severity === 'out_of_stock'
                            ? 'Out of stock'
                            : `${alert.current_stock} ${alert.unit} remaining (min: ${alert.minimum_stock} ${alert.unit})`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        alert.severity === 'out_of_stock' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        alert.severity === 'critical' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.severity === 'out_of_stock' ? 'OUT' : alert.severity.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Wastage Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="w-4 h-4 text-slate-500" />
                Pending Wastage Approvals
                {pendingWastageApprovals.length > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingWastageApprovals.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWastageApprovals.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No pending wastage reports</p>
              ) : (
                <div className="space-y-3">
                  {pendingWastageApprovals.map((w) => (
                    <div key={w.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {w.item_name} — {w.quantity} {w.unit}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">Reason: {w.reason}</p>
                          {w.notes && <p className="text-xs text-slate-400 italic mt-0.5">"{w.notes}"</p>}
                          <p className="text-xs text-slate-400 mt-1">Reported by {w.reported_by}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2"
                            onClick={() => handleWastageApproval(w.id, true)}
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs px-2"
                            onClick={() => handleWastageApproval(w.id, false)}
                          >
                            <ThumbsDown className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{editingShift ? 'Edit Shift' : 'Create Shift'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Staff ID" value={shiftForm.staffId} onChange={(e) => setShiftForm((s) => ({ ...s, staffId: e.target.value }))} />
              <Input type="date" value={shiftForm.shiftDate} onChange={(e) => setShiftForm((s) => ({ ...s, shiftDate: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((s) => ({ ...s, startTime: e.target.value }))} />
                <Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((s) => ({ ...s, endTime: e.target.value }))} />
              </div>
              <Input placeholder="Department" value={shiftForm.department} onChange={(e) => setShiftForm((s) => ({ ...s, department: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowShiftForm(false)}>Cancel</Button>
                <Button
                  onClick={async () => {
                    try {
                      const payload = {
                        staffId: shiftForm.staffId,
                        shiftDate: shiftForm.shiftDate,
                        startTime: shiftForm.startTime,
                        endTime: shiftForm.endTime,
                        department: shiftForm.department || undefined,
                        breakMinutes: shiftForm.breakMinutes || 0,
                      };
                      if (editingShift) {
                        await api.put(`/manager/shifts/${editingShift.id}`, payload);
                        toast.success('Shift updated');
                      } else {
                        await api.post('/manager/shifts', payload);
                        toast.success('Shift created');
                      }
                      setShowShiftForm(false);
                      loadDashboardData();
                    } catch {
                      toast.error('Failed to save shift');
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
