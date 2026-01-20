'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
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
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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

  // Check for manager role
  const isManager = user?.roles?.some(r => 
    ['admin', 'super_admin', 'restaurant_manager', 'chalet_manager', 'pool_manager', 'manager'].includes(r)
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
      loadDashboardData();
    }
  }, [isAuthenticated, isLoading, isManager]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch real data from multiple API endpoints
      const [ordersRes, staffRes, activityRes, weeklyOrdersRes, approvalsRes, todayShiftsRes] = await Promise.all([
        api.get('/restaurant/staff/orders/live').catch(() => ({ data: { data: [] } })),
        api.get('/admin/users', { params: { role: 'staff' } }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/audit/activity_logs', { params: { limit: 50 } }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/dashboard/stats').catch(() => ({ data: { data: null } })),
        api.get('/manager/approvals/pending').catch(() => ({ data: { data: [] } })),
        api.get('/manager/shifts/today').catch(() => ({ data: { data: [], summary: null } })),
      ]);

      const orders = ordersRes.data.data || [];
      const staff = staffRes.data.data || [];
      const activityLogs = activityRes.data.data || [];
      const dashboardStats = weeklyOrdersRes.data?.data || weeklyOrdersRes.data;
      const pendingApprovals = approvalsRes.data.data || [];
      const todayShifts = todayShiftsRes.data?.data || [];
      const shiftSummary = todayShiftsRes.data?.summary;

      // Calculate stats from REAL orders data
      const pending = orders.filter((o: any) => 
        ['pending', 'confirmed', 'preparing'].includes(o.status)
      ).length;
      
      const completed = orders.filter((o: any) => 
        o.status === 'completed'
      ).length;
      
      const todayRevenue = orders
        .filter((o: any) => o.status === 'completed' || o.payment_status === 'paid')
        .reduce((sum: number, o: any) => sum + (o.total || o.total_amount || 0), 0);

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
        issues: orders.filter((o: any) => o.status === 'cancelled').length,
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

      // Get real order counts per staff member
      const staffOrderCounts = new Map<string, number>();
      orders.forEach((order: any) => {
        const staffId = order.staff_id || order.assigned_to;
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
        // Group orders by day for real weekly performance
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData = new Map<string, { orders: number; revenue: number }>();
        
        orders.forEach((order: any) => {
          const date = new Date(order.created_at);
          const dayName = dayNames[date.getDay()];
          const existing = weekData.get(dayName) || { orders: 0, revenue: 0 };
          weekData.set(dayName, {
            orders: existing.orders + 1,
            revenue: existing.revenue + (order.total || order.total_amount || 0)
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
  };

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
          <Button variant="outline" onClick={loadDashboardData}>
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
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
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
          <TabsTrigger value="reports">Reports</TabsTrigger>
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
                          style={{ width: `${(day.orders / 100) * 100}%` }}
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
                <Link href="/staff/restaurant" className="block">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <ChefHat className="w-5 h-5 text-orange-500" />
                    Restaurant Orders
                    <Badge className="ml-auto bg-orange-100 text-orange-700">{stats.pendingOrders}</Badge>
                  </Button>
                </Link>
                <Link href="/staff/chalets" className="block">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <Home className="w-5 h-5 text-green-500" />
                    Chalet Check-ins
                  </Button>
                </Link>
                <Link href="/staff/pool" className="block">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <Waves className="w-5 h-5 text-blue-500" />
                    Pool Management
                  </Button>
                </Link>
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

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Quick Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto p-4 justify-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Daily Revenue Report</p>
                  <p className="text-sm text-slate-500">Sales breakdown by category</p>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 justify-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Staff Performance</p>
                  <p className="text-sm text-slate-500">Orders, response times</p>
                </div>
              </Button>
              <Button variant="outline" className="h-auto p-4 justify-start gap-4">
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
      </Tabs>
    </motion.div>
  );
}
