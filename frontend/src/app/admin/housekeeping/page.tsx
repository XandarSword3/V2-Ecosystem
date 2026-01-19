'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Calendar,
  Plus,
  RefreshCw,
  Play,
  Pause,
  Check,
  Flag,
  Filter,
  Home,
  User,
  Timer,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

interface Task {
  id: string;
  chalet_id?: string;
  chalet_name?: string;
  room_number?: string;
  task_type_id: string;
  task_type_name: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  notes?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  scheduled_for?: string;
  started_at?: string;
  completed_at?: string;
  estimated_duration?: number;
  created_at: string;
}

interface TaskType {
  id: string;
  name: string;
  estimated_duration: number;
  checklist?: any;
  is_active: boolean;
}

interface Staff {
  id: string;
  name: string;
  email: string;
  active_tasks: number;
}

interface Stats {
  pending: number;
  in_progress: number;
  completed_today: number;
  total_completed: number;
  on_hold: number;
  urgent: number;
}

interface StaffPerformance {
  id: string;
  name: string;
  tasks_completed: number;
  avg_time_minutes: number;
}

export default function HousekeepingAdminPage() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    chaletId: '',
    taskTypeId: '',
    priority: 'normal',
    notes: '',
    assignedTo: '',
    scheduledFor: '',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter, assignedFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, typesRes, staffRes, statsRes] = await Promise.all([
        api.get('/housekeeping/tasks', {
          params: {
            status: statusFilter === 'all' ? undefined : statusFilter,
            priority: priorityFilter === 'all' ? undefined : priorityFilter,
            assignedTo: assignedFilter === 'all' ? undefined : assignedFilter,
          }
        }),
        api.get('/housekeeping/task-types'),
        api.get('/housekeeping/staff'),
        api.get('/housekeeping/stats'),
      ]);

      if (tasksRes.data.success) setTasks(tasksRes.data.data);
      if (typesRes.data.success) setTaskTypes(typesRes.data.data);
      if (staffRes.data.success) setStaff(staffRes.data.data);
      if (statsRes.data.success) {
        setStats(statsRes.data.data.summary);
        setStaffPerformance(statsRes.data.data.staffPerformance || []);
      }
    } catch (error) {
      toast.error('Failed to load housekeeping data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!createForm.taskTypeId) {
      toast.error('Please select a task type');
      return;
    }
    
    try {
      const res = await api.post('/housekeeping/tasks', {
        chaletId: createForm.chaletId || undefined,
        taskTypeId: createForm.taskTypeId,
        priority: createForm.priority,
        notes: createForm.notes || undefined,
        assignedTo: createForm.assignedTo || undefined,
        scheduledFor: createForm.scheduledFor || new Date().toISOString(),
      });
      
      if (res.data.success) {
        toast.success('Task created');
        setShowCreateModal(false);
        setCreateForm({
          chaletId: '',
          taskTypeId: '',
          priority: 'normal',
          notes: '',
          assignedTo: '',
          scheduledFor: '',
        });
        loadData();
      }
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleAssignTask = async (taskId: string, staffId: string) => {
    try {
      const res = await api.post(`/housekeeping/tasks/${taskId}/assign`, { staffId });
      if (res.data.success) {
        toast.success('Task assigned');
        setShowAssignModal(false);
        setSelectedTask(null);
        loadData();
      }
    } catch (error) {
      toast.error('Failed to assign task');
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      let endpoint = `/housekeeping/tasks/${taskId}`;
      let method = 'put';
      let payload: any = { status: newStatus };
      
      if (newStatus === 'in_progress') {
        endpoint = `/housekeeping/tasks/${taskId}/start`;
        method = 'post';
        payload = {};
      } else if (newStatus === 'completed') {
        endpoint = `/housekeeping/tasks/${taskId}/complete`;
        method = 'post';
        payload = {};
      }
      
      const res = method === 'post' 
        ? await api.post(endpoint, payload)
        : await api.put(endpoint, payload);
      
      if (res.data.success) {
        toast.success('Task updated');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      normal: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return <Badge className={styles[priority] || styles.normal}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> },
      in_progress: { bg: 'bg-blue-100 text-blue-700', icon: <Play className="w-3 h-3" /> },
      completed: { bg: 'bg-green-100 text-green-700', icon: <Check className="w-3 h-3" /> },
      cancelled: { bg: 'bg-slate-100 text-slate-500', icon: <Pause className="w-3 h-3" /> },
      on_hold: { bg: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
    };
    const style = styles[status] || styles.pending;
    return (
      <Badge className={`flex items-center gap-1 ${style.bg}`}>
        {style.icon}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Housekeeping</h1>
          <p className="text-slate-500 dark:text-slate-400">Task management and scheduling</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">Pending</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
              <Clock className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">In Progress</p>
                <p className="text-2xl font-bold">{stats?.in_progress || 0}</p>
              </div>
              <Play className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Done Today</p>
                <p className="text-2xl font-bold">{stats?.completed_today || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs">Total Done</p>
                <p className="text-2xl font-bold">{stats?.total_completed || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs">On Hold</p>
                <p className="text-2xl font-bold">{stats?.on_hold || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-100 text-xs">Urgent</p>
                <p className="text-2xl font-bold">{stats?.urgent || 0}</p>
              </div>
              <Flag className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All Staff</option>
              <option value="unassigned">Unassigned</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4">
            {tasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getPriorityBadge(task.priority)}
                        {getStatusBadge(task.status)}
                        {task.chalet_name && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {task.chalet_name}
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-lg">{task.task_type_name}</h3>
                      
                      {task.notes && (
                        <p className="text-sm text-slate-500 mt-1">{task.notes}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        {task.assigned_to_name ? (
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {task.assigned_to_name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <AlertTriangle className="w-4 h-4" />
                            Unassigned
                          </span>
                        )}
                        
                        {task.scheduled_for && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(task.scheduled_for)}
                          </span>
                        )}
                        
                        {task.estimated_duration && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            ~{task.estimated_duration} min
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!task.assigned_to && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedTask(task); setShowAssignModal(true); }}
                        >
                          Assign
                        </Button>
                      )}
                      
                      {task.status === 'pending' && task.assigned_to && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                          className="text-blue-600"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start
                        </Button>
                      )}
                      
                      {task.status === 'in_progress' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(task.id, 'completed')}
                          className="text-green-600"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {tasks.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-slate-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{member.name}</h3>
                      <p className="text-sm text-slate-500">{member.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{member.active_tasks}</p>
                      <p className="text-xs text-slate-500">active tasks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Staff Performance (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staffPerformance.map((perf) => (
                  <div key={perf.id} className="flex items-center gap-4">
                    <div className="w-40 truncate font-medium">{perf.name}</div>
                    <div className="flex-1">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full" 
                          style={{ width: `${Math.min(100, (perf.tasks_completed / 20) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-bold">{perf.tasks_completed}</span>
                      <span className="text-slate-500 text-sm"> tasks</span>
                    </div>
                    <div className="w-24 text-right text-sm text-slate-500">
                      ~{Math.round(perf.avg_time_minutes)} min/task
                    </div>
                  </div>
                ))}
                
                {staffPerformance.length === 0 && (
                  <p className="text-center text-slate-500 py-4">No performance data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Create Task</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Task Type *</label>
                  <select
                    value={createForm.taskTypeId}
                    onChange={(e) => setCreateForm(f => ({ ...f, taskTypeId: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">Select task type</option>
                    {taskTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} (~{type.estimated_duration} min)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Assign To</label>
                  <select
                    value={createForm.assignedTo}
                    onChange={(e) => setCreateForm(f => ({ ...f, assignedTo: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.active_tasks} active)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                    rows={3}
                    placeholder="Additional notes..."
                    value={createForm.notes}
                    onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>
                  Create Task
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowAssignModal(false); setSelectedTask(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Assign Task</h3>
              <p className="text-slate-500 mb-4">
                Select a staff member to assign: <strong>{selectedTask.task_type_name}</strong>
              </p>
              
              <div className="space-y-2">
                {staff.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssignTask(selectedTask.id, member.id)}
                    className="w-full p-4 flex items-center gap-4 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-slate-500">{member.active_tasks} active tasks</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { setShowAssignModal(false); setSelectedTask(null); }}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
