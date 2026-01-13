'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/lib/socket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Users,
  UserCircle,
  UserCog,
  UserCheck,
  Monitor,
  Clock,
  Activity,
  RefreshCw,
  Globe,
  Smartphone,
  Laptop,
  Eye,
} from 'lucide-react';

interface OnlineUser {
  socketId: string;
  userId?: string;
  email?: string;
  fullName?: string;
  roles: string[];
  currentPage?: string;
  connectedAt: string;
  lastActivity: string;
  userAgent?: string;
  ipAddress?: string;
}

function formatDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTimeSince(time: string): string {
  const then = new Date(time);
  const now = new Date();
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diff < 5) return 'Just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function getDeviceIcon(userAgent?: string) {
  if (!userAgent) return <Globe className="h-4 w-4" />;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone className="h-4 w-4" />;
  }
  return <Laptop className="h-4 w-4" />;
}

function getBrowser(userAgent?: string): string {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  return 'Other';
}

function getRoleBadge(roles: string[]) {
  if (roles.includes('super_admin')) {
    return <Badge className="bg-red-500 text-white">Super Admin</Badge>;
  }
  if (roles.includes('admin')) {
    return <Badge className="bg-purple-500 text-white">Admin</Badge>;
  }
  if (roles.includes('staff')) {
    return <Badge className="bg-blue-500 text-white">Staff</Badge>;
  }
  if (roles.includes('customer')) {
    return <Badge className="bg-green-500 text-white">Customer</Badge>;
  }
  return <Badge className="bg-gray-500 text-white">Guest</Badge>;
}

function getRoleIcon(roles: string[]) {
  if (roles.includes('super_admin') || roles.includes('admin')) {
    return <UserCog className="h-5 w-5 text-purple-500" />;
  }
  if (roles.includes('staff')) {
    return <UserCheck className="h-5 w-5 text-blue-500" />;
  }
  return <UserCircle className="h-5 w-5 text-green-500" />;
}

function formatPagePath(path?: string): string {
  if (!path) return 'Unknown';
  // Remove locale prefix and clean up
  const cleanPath = path.replace(/^\/(en|ar|fr)/, '') || '/';
  
  // Map common paths to friendly names
  const pathMaps: Record<string, string> = {
    '/': 'Home Page',
    '/admin': 'Admin Dashboard',
    '/admin/orders': 'Orders Management',
    '/admin/restaurant': 'Restaurant Admin',
    '/admin/chalets': 'Chalets Admin',
    '/admin/pool': 'Pool Admin',
    '/admin/users': 'Users Management',
    '/admin/settings': 'Settings',
    '/admin/reports': 'Reports',
    '/staff': 'Staff Dashboard',
    '/staff/orders': 'Staff Orders',
    '/restaurant': 'Restaurant Menu',
    '/chalets': 'Chalets Booking',
    '/pool': 'Pool Tickets',
    '/checkout': 'Checkout',
    '/cart': 'Cart',
    '/profile': 'Profile',
    '/auth/login': 'Login Page',
    '/auth/register': 'Registration',
  };
  
  // Check for exact match first
  if (pathMaps[cleanPath]) return pathMaps[cleanPath];
  
  // Check for prefix matches
  for (const [prefix, name] of Object.entries(pathMaps)) {
    if (cleanPath.startsWith(prefix + '/')) {
      return name;
    }
  }
  
  return cleanPath;
}

export default function LiveUsersPage() {
  const t = useTranslations();
  const { socket, isConnected } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOnlineUsers = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('request:online_users_detailed');
      setLastRefresh(new Date());
    }
  }, [socket, isConnected]);

  useEffect(() => {
    if (socket && isConnected) {
      // Request initial data
      fetchOnlineUsers();

      // Listen for detailed user updates
      const handleOnlineUsersDetailed = (data: { users: OnlineUser[]; count: number }) => {
        setOnlineUsers(data.users);
        setLoading(false);
      };

      socket.on('stats:online_users_detailed', handleOnlineUsersDetailed);

      // Auto-refresh every 10 seconds if enabled
      let interval: NodeJS.Timeout | null = null;
      if (autoRefresh) {
        interval = setInterval(() => {
          fetchOnlineUsers();
        }, 10000);
      }

      return () => {
        socket.off('stats:online_users_detailed', handleOnlineUsersDetailed);
        if (interval) clearInterval(interval);
      };
    }
  }, [socket, isConnected, fetchOnlineUsers, autoRefresh]);

  // Update duration display every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update durations
      setLastRefresh(prev => new Date(prev));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Group users by role
  const adminUsers = onlineUsers.filter(u => 
    u.roles.includes('super_admin') || u.roles.includes('admin')
  );
  const staffUsers = onlineUsers.filter(u => 
    u.roles.includes('staff') && !u.roles.includes('admin')
  );
  const customerUsers = onlineUsers.filter(u => 
    u.roles.includes('customer') && !u.roles.includes('staff') && !u.roles.includes('admin')
  );
  const guestUsers = onlineUsers.filter(u => 
    !u.roles.includes('admin') && !u.roles.includes('staff') && !u.roles.includes('customer') && !u.roles.includes('super_admin')
  );

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-green-500" />
            {t('admin.liveUsers.title', { fallback: 'Live Users Monitor' })}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.liveUsers.description', { fallback: 'Real-time view of who is online and their activity' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? t('admin.liveUsers.autoRefreshOn', { fallback: 'Auto-refresh ON' }) : t('admin.liveUsers.autoRefreshOff', { fallback: 'Auto-refresh OFF' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOnlineUsers}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh', { fallback: 'Refresh' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  {t('admin.liveUsers.totalOnline', { fallback: 'Total Online' })}
                </p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {onlineUsers.length}
                </p>
              </div>
              <Users className="h-10 w-10 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  {t('admin.liveUsers.admins', { fallback: 'Admins' })}
                </p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {adminUsers.length}
                </p>
              </div>
              <UserCog className="h-10 w-10 text-purple-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {t('admin.liveUsers.staff', { fallback: 'Staff' })}
                </p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {staffUsers.length}
                </p>
              </div>
              <UserCheck className="h-10 w-10 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {t('admin.liveUsers.customers', { fallback: 'Customers' })}
                </p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {customerUsers.length + guestUsers.length}
                </p>
              </div>
              <UserCircle className="h-10 w-10 text-amber-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        {isConnected 
          ? t('admin.liveUsers.connected', { fallback: 'Connected to live updates' })
          : t('admin.liveUsers.disconnected', { fallback: 'Disconnected - trying to reconnect...' })
        }
        <span className="mx-2">•</span>
        <Clock className="h-4 w-4" />
        {t('admin.liveUsers.lastUpdate', { fallback: 'Last update' })}: {lastRefresh.toLocaleTimeString()}
      </div>

      {/* Users List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mx-auto" />
            <p className="mt-2 text-slate-500">{t('common.loading', { fallback: 'Loading...' })}</p>
          </CardContent>
        </Card>
      ) : onlineUsers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              {t('admin.liveUsers.noUsers', { fallback: 'No users currently online' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('admin.liveUsers.activeConnections', { fallback: 'Active Connections' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.user', { fallback: 'User' })}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.role', { fallback: 'Role' })}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.currentPage', { fallback: 'Current Page' })}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.device', { fallback: 'Device' })}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.connected', { fallback: 'Connected' })}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('admin.liveUsers.lastActivity', { fallback: 'Last Activity' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {onlineUsers.map((user, index) => (
                      <motion.tr
                        key={user.socketId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {getRoleIcon(user.roles)}
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {user.fullName || user.email || t('admin.liveUsers.guest', { fallback: 'Guest' })}
                              </p>
                              {user.email && user.fullName && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getRoleBadge(user.roles)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {formatPagePath(user.currentPage)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(user.userAgent)}
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {getBrowser(user.userAgent)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {formatDuration(user.connectedAt)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${
                            new Date().getTime() - new Date(user.lastActivity).getTime() < 30000
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {formatTimeSince(user.lastActivity)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
