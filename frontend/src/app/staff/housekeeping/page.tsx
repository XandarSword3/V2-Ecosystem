'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { housekeepingTasksStore, cacheManager, isOnline } from '@/lib/offline/offline-storage';
import { createOfflineTaskStatusUpdate } from '@/lib/offline/offline-sync';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import { DataFreshnessFooter } from '@/components/offline/DataFreshnessFooter';
import {
  ClipboardList,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Home,
  Timer,
  CheckCircle
} from 'lucide-react';

interface HousekeepingTask {
  id: string;
  room_number: string;
  task_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  chalet_name?: string;
}

const statusConfig: Record<string, { color: string; icon: any }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  in_progress: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Play },
  completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelled: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: AlertCircle },
};

const priorityConfig: Record<string, { color: string }> = {
  low: { color: 'bg-slate-100 text-slate-600' },
  medium: { color: 'bg-blue-100 text-blue-600' },
  high: { color: 'bg-orange-100 text-orange-600' },
  urgent: { color: 'bg-red-100 text-red-600 animate-pulse' },
};

export default function HousekeepingTasksPage() {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    // 1. Load from offline store immediately
    const offlineTasks = await housekeepingTasksStore.getAll();
    if (offlineTasks.length > 0) {
      setTasks(offlineTasks as unknown as HousekeepingTask[]);
      setLoading(false);
    }

    // 2. Refresh from API in background if online
    if (isOnline()) {
      try {
        const response = await api.get('/housekeeping/my-tasks', { signal });
        if (!signal?.aborted) {
          const freshData = response.data.tasks || [];
          setTasks(freshData);
          setLoading(false);
          
          // 3. Update offline store
          await housekeepingTasksStore.clear();
          await housekeepingTasksStore.putMany(freshData);
          await cacheManager.updateMetadata('housekeeping_tasks', freshData.length);
        }
      } catch (error: any) {
        if (error?.name === 'CanceledError') return;
        console.error('Failed to fetch tasks:', error);
        if (offlineTasks.length === 0) {
          toast.error('Failed to load tasks');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    } else if (offlineTasks.length === 0) {
      toast.error('Working offline. No cached tasks found.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTasks(controller.signal);
    return () => controller.abort();
  }, [fetchTasks]);

  const updateTaskStatus = async (taskId: string, newStatus: 'in_progress' | 'completed') => {
    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const endpoint = newStatus === 'in_progress' ? `/housekeeping/tasks/${taskId}/start` : `/housekeeping/tasks/${taskId}/complete`;
      await api.post(endpoint);
      toast.success(`Task ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      if (!isOnline()) {
        await createOfflineTaskStatusUpdate(taskId, newStatus);
        toast.info('Task updated offline', { icon: '⏳' });
        return;
      }
      // Revert on error if online
      setTasks(previousTasks);
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 space-y-6 flex-1"
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-blue-500" />
              My Tasks
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              {pendingTasks.length} tasks remaining for today
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchTasks()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Tasks</h2>
          <AnimatePresence mode="popLayout">
            {pendingTasks.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>All tasks completed! Great job.</p>
                </CardContent>
              </Card>
            ) : (
              pendingTasks.map((task) => {
                const config = statusConfig[task.status];
                const priority = priorityConfig[task.priority];
                const StatusIcon = config.icon;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    variants={fadeInUp}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Card className={`overflow-hidden border-l-4 ${
                      task.priority === 'urgent' ? 'border-l-red-500' : 
                      task.priority === 'high' ? 'border-l-orange-500' : 'border-l-blue-500'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <Home className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white">
                                {task.chalet_name || `Room ${task.room_number}`}
                              </h3>
                              <p className="text-sm text-slate-500">{task.task_type}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={config.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${priority.color}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        {task.notes && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded mb-4">
                            {task.notes}
                          </p>
                        )}

                        <div className="flex gap-2 mt-4">
                          {task.status === 'pending' && (
                            <Button 
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                              onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            >
                              <Play className="w-4 h-4 mr-2" /> Start Task
                            </Button>
                          )}
                          {task.status === 'in_progress' && (
                            <Button 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Task
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>

          {completedTasks.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider pt-6">Completed Recently</h2>
              <div className="space-y-2 opacity-60">
                {completedTasks.map(task => (
                  <Card key={task.id} className="bg-slate-50 dark:bg-slate-800/30">
                    <CardContent className="p-3 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">{task.chalet_name || `Room ${task.room_number}`} - {task.task_type}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {task.completed_at ? new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Done'}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="mt-auto sticky bottom-0 z-20">
        <DataFreshnessFooter storeName="housekeeping_tasks" />
      </footer>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
