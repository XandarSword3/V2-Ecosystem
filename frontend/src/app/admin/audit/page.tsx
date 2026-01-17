'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Shield,
  Search,
  RefreshCw,
  User,
  Settings,
  Database,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Eye,
  Filter,
  Calendar,
  Clock,
  Activity,
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource: string;
  resource_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  };
}

const actionConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  create: { icon: Plus, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  update: { icon: Edit, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  delete: { icon: Trash2, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  login: { icon: LogIn, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  logout: { icon: LogOut, color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-700' },
  view: { icon: Eye, color: 'text-primary-500', bgColor: 'bg-primary-100 dark:bg-primary-900/30' },
  settings: { icon: Settings, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
};

const entityConfig: Record<string, { icon: React.ElementType; label: string }> = {
  user: { icon: User, label: 'User' },
  users: { icon: User, label: 'User' },
  menu_item: { icon: Database, label: 'Menu Item' },
  category: { icon: Database, label: 'Category' },
  chalet: { icon: Database, label: 'Chalet' },
  booking: { icon: Calendar, label: 'Booking' },
  order: { icon: Activity, label: 'Order' },
  settings: { icon: Settings, label: 'Settings' },
  session: { icon: Clock, label: 'Session' },
  module: { icon: Settings, label: 'Module' },
  backups: { icon: Database, label: 'Backup' },
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/audit-logs');
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (entityFilter !== 'all' && log.resource !== entityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.resource.toLowerCase().includes(query) ||
        log.users?.full_name?.toLowerCase().includes(query) ||
        log.users?.email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map((l: AuditLog) => l.action)));
  const uniqueEntities = Array.from(new Set(logs.map((l: AuditLog) => l.resource)));

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // Helper to parse JSON strings if needed
  const parseValue = (val: unknown): unknown => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  };

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
            Audit Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Track all system activities and changes
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Events</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {logs.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Plus className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Logins</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {logs.filter((l) => l.action === 'LOGIN').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Edit className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Updates</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {logs.filter((l) => l.action.includes('UPDATE')).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Deletes</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {logs.filter((l) => l.action.includes('DELETE')).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>

            {/* Entity Filter */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Resources</option>
              {uniqueEntities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Timeline */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filteredLogs.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No audit logs found</p>
                </motion.div>
              ) : (
                filteredLogs.map((log, index) => {
                  const normalizedAction = log.action.toLowerCase();
                  const ActionIcon = actionConfig[normalizedAction]?.icon || (normalizedAction.includes('create') ? Plus : normalizedAction.includes('update') ? Edit : normalizedAction.includes('delete') ? Trash2 : Activity);
                  const actionColor = actionConfig[normalizedAction]?.color || (normalizedAction.includes('create') ? 'text-green-500' : normalizedAction.includes('update') ? 'text-blue-500' : normalizedAction.includes('delete') ? 'text-red-500' : 'text-slate-500');
                  const actionBg = actionConfig[normalizedAction]?.bgColor || (normalizedAction.includes('create') ? 'bg-green-100' : normalizedAction.includes('update') ? 'bg-blue-100' : normalizedAction.includes('delete') ? 'bg-red-100' : 'bg-slate-100');
                  const EntityIcon = entityConfig[log.resource]?.icon || Database;

                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      layout
                      className="relative pl-8 pb-6 last:pb-0"
                    >
                      {/* Timeline line */}
                      {index < filteredLogs.length - 1 && (
                        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                      )}

                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1 p-1.5 rounded-full ${actionBg}`}>
                        <ActionIcon className={`w-3 h-3 ${actionColor}`} />
                      </div>

                      {/* Log content */}
                      <div
                        className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`font-semibold capitalize ${actionColor}`}>
                            {log.action.replace('_', ' ').toLowerCase()}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <EntityIcon className="w-4 h-4" />
                            {entityConfig[log.resource]?.label || log.resource.replace('_', ' ')}
                          </span>
                          {log.resource_id && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className="font-mono text-xs text-slate-500">
                                {log.resource_id.slice(0, 8)}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.users?.full_name || 'System'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.created_at)}
                          </span>
                          {log.ip_address && (
                            <span className="font-mono text-xs">
                              IP: {log.ip_address}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Audit Log Details
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Action</span>
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {selectedLog.action.replace('_', ' ').toLowerCase()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Resource</span>
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {selectedLog.resource.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">User</span>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {selectedLog.users?.full_name || 'System'}
                    </p>
                    <p className="text-xs text-slate-500">{selectedLog.users?.email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Timestamp</span>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {formatDate(selectedLog.created_at)}
                    </p>
                  </div>
                </div>

                {selectedLog.ip_address && (
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">IP Address</span>
                    <p className="font-mono text-sm text-slate-900 dark:text-white">
                      {selectedLog.ip_address}
                    </p>
                  </div>
                )}

                {selectedLog.old_value && (
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Previous Values</span>
                    <pre className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm overflow-x-auto text-red-800 dark:text-red-200">
                      {typeof parseValue(selectedLog.old_value) === 'object'
                        ? JSON.stringify(parseValue(selectedLog.old_value), null, 2)
                        : selectedLog.old_value}
                    </pre>
                  </div>
                )}

                {selectedLog.new_value && (
                  <div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">New Values</span>
                    <pre className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm overflow-x-auto text-green-800 dark:text-green-200">
                      {typeof parseValue(selectedLog.new_value) === 'object'
                        ? JSON.stringify(parseValue(selectedLog.new_value), null, 2)
                        : selectedLog.new_value}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
