'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { offlineActivityStore, syncQueue } from '@/lib/offline/offline-storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Activity, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface ActivityEntry {
  id: string;
  type: string;
  entityId: string;
  action: string;
  timestamp: string;
  syncedAt: string | null;
  error?: string;
}

export default function OfflineActivityReport() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadActivities = async () => {
    try {
      const all = await offlineActivityStore.getAll();
      setActivities((all as unknown as ActivityEntry[]).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const clearLogs = async () => {
    if (!window.confirm('Clear all offline activity logs?')) return;
    try {
      await offlineActivityStore.clear();
      setActivities([]);
      toast.success('Activity logs cleared');
    } catch (error) {
      toast.error('Failed to clear logs');
    }
  };

  const filteredActivities = activities.filter(a => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesSearch = a.entityId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         a.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const stats = {
    total: activities.length,
    pending: activities.filter(a => !a.syncedAt).length,
    synced: activities.filter(a => !!a.syncedAt).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Offline Activity Report
          </h1>
          <p className="text-slate-500 mt-1">
            Audit log of all actions taken during offline periods
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadActivities}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="ghost" onClick={clearLogs} className="text-red-500 hover:text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Audit Log
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Actions</span>
              <span className="text-3xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm text-blue-500 uppercase tracking-wider font-semibold">Queued/Pending</span>
              <span className="text-3xl font-bold">{stats.pending}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-6">
            <div className="flex flex-col">
              <span className="text-sm text-green-500 uppercase tracking-wider font-semibold">Synced Success</span>
              <span className="text-3xl font-bold">{stats.synced}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
              >
                <option value="all">All Modules</option>
                <option value="order">Orders</option>
                <option value="payment">Cash Payments</option>
                <option value="booking">Accommodation Bookings</option>
                <option value="pool_ticket">Access Tickets</option>
                <option value="housekeeping_task">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-semibold">Module</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                  <th className="px-6 py-3 font-semibold">Entity ID</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No activity logs found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize">
                          {activity.type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium capitalize">
                        {activity.action}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">
                        {activity.entityId}
                      </td>
                      <td className="px-6 py-4">
                        {activity.syncedAt ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                            <CheckCircle className="h-3 w-3" />
                            Synced {new Date(activity.syncedAt).toLocaleTimeString()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-blue-600 text-xs font-semibold">
                            <RefreshCw className="h-3 w-3 animate-spin-slow" />
                            Queued
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
