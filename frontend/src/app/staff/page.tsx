'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
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
} from 'lucide-react';
import Link from 'next/link';

export default function StaffDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const t = useTranslations('staff');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/staff');
    }
  }, [isAuthenticated, isLoading, router]);

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

  const quickActions = [
    {
      title: 'Kitchen Orders',
      description: 'View and manage restaurant orders',
      href: '/staff/restaurant',
      icon: ChefHat,
      color: 'from-orange-400 to-rose-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      title: 'Snack Bar',
      description: 'Handle snack bar orders',
      href: '/staff/snack',
      icon: Cookie,
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Chalets',
      description: 'Check-ins and check-outs',
      href: '/staff/chalets',
      icon: Home,
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'Pool',
      description: 'Manage pool access',
      href: '/staff/pool',
      icon: Waves,
      color: 'from-cyan-400 to-blue-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    },
  ];

  const stats = [
    { label: 'Pending Orders', value: '12', icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Completed Today', value: '47', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Issues', value: '2', icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
    { label: 'Avg Response', value: '4m', icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400' },
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
          Here&apos;s what&apos;s happening today at V2 Resort
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
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
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
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
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Order #1234 marked as ready', time: '2 min ago', type: 'success' },
                { action: 'New order #1235 received', time: '5 min ago', type: 'info' },
                { action: 'Pool ticket scanned - Adult', time: '8 min ago', type: 'info' },
                { action: 'Chalet A2 check-in completed', time: '15 min ago', type: 'success' },
              ].map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    <span className="text-slate-700 dark:text-slate-300">{activity.action}</span>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{activity.time}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
