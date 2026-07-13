import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';

// Validation schemas
const createTaskSchema = z.object({
  unitId: z.string().uuid().optional(),
  roomNumber: z.string().max(20).optional(),
  taskTypeId: z.string().uuid(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  scheduledFor: z.string().datetime().optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'on_hold']).optional(),
});

const assignTaskSchema = z.object({
  staffId: z.string().uuid(),
});

const completeTaskSchema = z.object({
  notes: z.string().optional(),
  checklistCompleted: z.record(z.string(), z.boolean()).optional(),
  photosUrls: z.array(z.string().url()).optional(),
});

const createScheduleSchema = z.object({
  unitId: z.string().uuid().optional(),
  taskTypeId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6).optional(), // 0=Sunday, 6=Saturday
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/),
  assignedTo: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  repeatPattern: z.enum(['daily', 'weekly', 'checkout']).default('daily'),
});

export class HousekeepingController {
  /**
   * Get all task types
   */
  async getTaskTypes(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      const { data: taskTypes, error } = await supabase
        .from('housekeeping_task_types')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data: taskTypes || [],
      });
    } catch (error: any) {
      console.error('Error fetching task types:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch task types',
        message: error.message,
      });
    }
  }

  /**
   * Get all tasks with filters
   */
  async getTasks(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        priority,
        assignedTo,
        unitId,
        date,
        unassigned,
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const supabase = getSupabase();

      let query = supabase
        .from('housekeeping_tasks')
        .select('*', { count: 'exact' });

      if (status) {
        if (status === 'active') {
          query = query.in('status', ['pending', 'in_progress']);
        } else {
          query = query.eq('status', status as string);
        }
      }

      if (priority) {
        query = query.eq('priority', priority as string);
      }

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo as string);
      }

      if (unitId) {
        query = query.eq('unit_id', unitId as string);
      }

      if (date) {
        const startOfDay = new Date(date as string);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date as string);
        endOfDay.setHours(23, 59, 59, 999);
        query = query
          .gte('scheduled_for', startOfDay.toISOString())
          .lte('scheduled_for', endOfDay.toISOString());
      }

      if (unassigned === 'true') {
        query = query.is('assigned_to', null);
      }

      const { data: tasks, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Get related data
      const taskTypeIds = [...new Set((tasks || []).map(t => t.task_type_id).filter(Boolean))];
      const unitIds = [...new Set((tasks || []).map(t => t.unit_id).filter(Boolean))];
      const userIds = [...new Set((tasks || []).map(t => t.assigned_to).filter(Boolean))];

      // Fetch related entities
      const [taskTypesResult, unitsResult, usersResult] = await Promise.all([
        taskTypeIds.length > 0
          ? supabase.from('housekeeping_task_types').select('id, name, estimated_duration, checklist').in('id', taskTypeIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from('accommodation_units').select('id, name').in('id', unitIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : { data: [] },
      ]);

      // Create lookup maps
      const taskTypesMap = ((taskTypesResult.data || []) as any[]).reduce((acc, tt) => { acc[tt.id] = tt; return acc; }, {} as Record<string, any>);
      const unitsMap = ((unitsResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      const usersMap = ((usersResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);

      // Enrich tasks
      const enrichedTasks = (tasks || []).map(task => ({
        ...task,
        task_type_name: taskTypesMap[task.task_type_id]?.name,
        estimated_duration: taskTypesMap[task.task_type_id]?.estimated_duration,
        checklist: taskTypesMap[task.task_type_id]?.checklist,
        unit_name: unitsMap[task.unit_id]?.name,
        assigned_to_name: usersMap[task.assigned_to]?.full_name,
      }));

      res.json({
        success: true,
        data: enrichedTasks,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
        },
      });
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks',
        message: error.message,
      });
    }
  }

  /**
   * Get tasks for current staff member
   */
  async getMyTasks(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { status = 'active' } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('assigned_to', userId);

      if (status === 'active') {
        query = query.in('status', ['pending', 'in_progress']);
      } else if (status !== 'all') {
        query = query.eq('status', status as string);
      }

      const { data: tasks, error } = await query.order('scheduled_for', { ascending: true });

      if (error) throw error;

      // Enrich with task type and unit info
      const taskTypeIds = [...new Set((tasks || []).map(t => t.task_type_id).filter(Boolean))];
      const unitIds = [...new Set((tasks || []).map(t => t.unit_id).filter(Boolean))];

      const [taskTypesResult, unitsResult] = await Promise.all([
        taskTypeIds.length > 0
          ? supabase.from('housekeeping_task_types').select('id, name, estimated_duration, checklist').in('id', taskTypeIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from('accommodation_units').select('id, name, unit_number').in('id', unitIds)
          : { data: [] },
      ]);

      const taskTypesMap = ((taskTypesResult.data || []) as any[]).reduce((acc, tt) => { acc[tt.id] = tt; return acc; }, {} as Record<string, any>);
      const unitsMap = ((unitsResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);

      const enrichedTasks = (tasks || []).map(task => ({
        ...task,
        task_type_name: taskTypesMap[task.task_type_id]?.name,
        estimated_duration: taskTypesMap[task.task_type_id]?.estimated_duration,
        checklist: taskTypesMap[task.task_type_id]?.checklist,
        unit_name: unitsMap[task.unit_id]?.name,
        unit_number: unitsMap[task.unit_id]?.unit_number,
      }));

      res.json({
        success: true,
        data: enrichedTasks,
      });
    } catch (error: any) {
      console.error('Error fetching my tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks',
        message: error.message,
      });
    }
  }

  /**
   * Get single task details
   */
  async getTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      const { data: task, error } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Get related data
      const [taskTypeResult, unitResult, assigneeResult, creatorResult, logsResult] = await Promise.all([
        task.task_type_id
          ? supabase.from('housekeeping_task_types').select('name, estimated_duration, checklist').eq('id', task.task_type_id).single()
          : { data: null },
        task.unit_id
          ? supabase.from('accommodation_units').select('name, unit_number').eq('id', task.unit_id).single()
          : { data: null },
        task.assigned_to
          ? supabase.from('users').select('full_name').eq('id', task.assigned_to).single()
          : { data: null },
        task.created_by
          ? supabase.from('users').select('full_name').eq('id', task.created_by).single()
          : { data: null },
        supabase.from('housekeeping_logs').select('*').eq('task_id', id).order('created_at', { ascending: false }),
      ]);

      // Get performer names for logs
      const logUserIds = [...new Set((logsResult.data || []).map((l: any) => l.performed_by).filter(Boolean))];
      let logUsersMap: Record<string, any> = {};
      if (logUserIds.length > 0) {
        const { data: logUsers } = await supabase.from('users').select('id, full_name').in('id', logUserIds);
        logUsersMap = (logUsers || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      }

      const logsWithNames = (logsResult.data || []).map((log: any) => ({
        ...log,
        performed_by_name: logUsersMap[log.performed_by]?.full_name,
      }));

      res.json({
        success: true,
        data: {
          ...task,
          task_type_name: taskTypeResult.data?.name,
          estimated_duration: taskTypeResult.data?.estimated_duration,
          checklist: taskTypeResult.data?.checklist,
          unit_name: unitResult.data?.name,
          unit_number: unitResult.data?.unit_number,
          assigned_to_name: assigneeResult.data?.full_name,
          created_by_name: creatorResult.data?.full_name,
          logs: logsWithNames,
        },
      });
    } catch (error: any) {
      console.error('Error fetching task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch task',
        message: error.message,
      });
    }
  }

  /**
   * Create a new task
   */
  async createTask(req: Request, res: Response) {
    try {
      const validation = createTaskSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const data = validation.data;
      const userId = req.user?.id;
      const supabase = getSupabase();

      // Get task type name for title
      const { data: taskType } = await supabase
        .from('housekeeping_task_types')
        .select('name')
        .eq('id', data.taskTypeId)
        .single();

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .insert({
          task_type_id: data.taskTypeId,
          title: taskType?.name || 'Housekeeping Task',
          unit_id: data.unitId || null,
          priority: data.priority,
          notes: data.notes,
          assigned_to: data.assignedTo,
          created_by: userId,
          scheduled_for: data.scheduledFor || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Log the creation
      await supabase.from('housekeeping_logs').insert({
        task_id: result.id,
        action: 'created',
        performed_by: userId,
        notes: 'Task created',
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create task',
        message: error.message,
      });
    }
  }

  /**
   * Update a task
   */
  async updateTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = updateTaskSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const data = validation.data;
      const userId = req.user?.id;
      const supabase = getSupabase();

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (data.unitId !== undefined) updates.unit_id = data.unitId;
      if (data.roomNumber !== undefined) updates.room_number = data.roomNumber;
      if (data.taskTypeId !== undefined) updates.task_type_id = data.taskTypeId;
      if (data.priority !== undefined) updates.priority = data.priority;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo;
      if (data.scheduledFor !== undefined) updates.scheduled_for = data.scheduledFor;
      if (data.status !== undefined) {
        updates.status = data.status;
        if (data.status === 'in_progress') updates.started_at = new Date().toISOString();
        if (data.status === 'completed') updates.completed_at = new Date().toISOString();
      }

      if (Object.keys(updates).length === 1) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Log the update
      if (data.status) {
        await supabase.from('housekeeping_logs').insert({
          task_id: id,
          action: `status_${data.status}`,
          performed_by: userId,
          notes: data.notes || `Status changed to ${data.status}`,
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update task',
        message: error.message,
      });
    }
  }

  /**
   * Assign task to staff
   */
  async assignTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = assignTaskSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const { staffId } = validation.data;
      const userId = req.user?.id;
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .update({
          assigned_to: staffId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Get staff name for log
      const { data: staff } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', staffId)
        .single();

      await supabase.from('housekeeping_logs').insert({
        task_id: id,
        action: 'assigned',
        performed_by: userId,
        notes: `Assigned to ${staff?.full_name || 'Unknown'}`,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error assigning task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign task',
        message: error.message,
      });
    }
  }

  /**
   * Start a task
   */
  async startTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const isAdmin = req.user?.roles?.includes('admin') || req.user?.roles?.includes('super_admin');
      const supabase = getSupabase();

      const { data: existingTask } = await supabase
        .from('housekeeping_tasks')
        .select('id, assigned_to')
        .eq('id', id)
        .single();

      if (!existingTask) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      if (!isAdmin && existingTask.assigned_to !== userId) {
        return res.status(403).json({ success: false, error: 'Task not assigned to you' });
      }

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('housekeeping_logs').insert({
        task_id: id,
        action: 'started',
        performed_by: userId,
        notes: 'Task started',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error starting task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start task',
        message: error.message,
      });
    }
  }

  /**
   * Complete a task
   */
  async completeTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = completeTaskSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const data = validation.data;
      const userId = req.user?.id;
      const isAdmin = req.user?.roles?.includes('admin') || req.user?.roles?.includes('super_admin');
      const supabase = getSupabase();

      const { data: existingTask } = await supabase
        .from('housekeeping_tasks')
        .select('id, assigned_to')
        .eq('id', id)
        .single();

      if (!existingTask) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      if (!isAdmin && existingTask.assigned_to !== userId) {
        return res.status(403).json({ success: false, error: 'Task not assigned to you' });
      }

      const updates: Record<string, any> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (data.checklistCompleted) updates.checklist_completed = data.checklistCompleted;
      if (data.photosUrls) updates.photos_urls = data.photosUrls;

      const { data: result, error } = await supabase
        .from('housekeeping_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('housekeeping_logs').insert({
        task_id: id,
        action: 'completed',
        performed_by: userId,
        notes: data.notes || 'Task completed',
      });

      // FIX: Iteration 19 - Update unit cleaning status when task is completed
      if (result.unit_id) {
        await supabase
          .from('accommodation_units')
          .update({
            cleaning_status: 'clean',
            last_cleaned: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.unit_id);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error completing task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete task',
        message: error.message,
      });
    }
  }

  /**
   * Report an issue for a task
   */
  async reportIssue(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { issueType, notes, photosUrls } = req.body;
      const userId = req.user?.id;
      const supabase = getSupabase();

      await supabase
        .from('housekeeping_tasks')
        .update({
          status: 'on_hold',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      await supabase.from('housekeeping_logs').insert({
        task_id: id,
        action: 'issue_reported',
        performed_by: userId,
        notes: notes,
        issue_type: issueType,
        photos_urls: photosUrls,
      });

      res.json({
        success: true,
        message: 'Issue reported successfully',
      });
    } catch (error: any) {
      console.error('Error reporting issue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to report issue',
        message: error.message,
      });
    }
  }

  /**
   * Get schedules
   */
  async getSchedules(req: Request, res: Response) {
    try {
      const { unitId, dayOfWeek, isActive } = req.query;
      const supabase = getSupabase();

      let query = supabase.from('housekeeping_schedules').select('*');

      if (unitId) query = query.eq('unit_id', unitId as string);
      if (dayOfWeek !== undefined) query = query.or(`day_of_week.eq.${dayOfWeek},repeat_pattern.eq.daily`);
      if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');

      const { data: schedules, error } = await query.order('time_slot', { ascending: true });

      if (error) throw error;

      // Enrich with related data
      const taskTypeIds = [...new Set((schedules || []).map(s => s.task_type_id).filter(Boolean))];
      const unitIds = [...new Set((schedules || []).map(s => s.unit_id).filter(Boolean))];
      const userIds = [...new Set((schedules || []).map(s => s.assigned_to).filter(Boolean))];

      const [taskTypesResult, unitsResult, usersResult] = await Promise.all([
        taskTypeIds.length > 0
          ? supabase.from('housekeeping_task_types').select('id, name, estimated_duration').in('id', taskTypeIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from('accommodation_units').select('id, name').in('id', unitIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : { data: [] },
      ]);

      const taskTypesMap = ((taskTypesResult.data || []) as any[]).reduce((acc, tt) => { acc[tt.id] = tt; return acc; }, {} as Record<string, any>);
      const unitsMap = ((unitsResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      const usersMap = ((usersResult.data || []) as any[]).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);

      const enrichedSchedules = (schedules || []).map(schedule => ({
        ...schedule,
        task_type_name: taskTypesMap[schedule.task_type_id]?.name,
        estimated_duration: taskTypesMap[schedule.task_type_id]?.estimated_duration,
        unit_name: unitsMap[schedule.unit_id]?.name,
        assigned_to_name: usersMap[schedule.assigned_to]?.full_name,
      }));

      res.json({
        success: true,
        data: enrichedSchedules,
      });
    } catch (error: any) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch schedules',
        message: error.message,
      });
    }
  }

  /**
   * Create a schedule
   */
  async createSchedule(req: Request, res: Response) {
    try {
      const validation = createScheduleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const data = validation.data;
      const userId = req.user?.id;
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('housekeeping_schedules')
        .insert({
          unit_id: data.unitId,
          task_type_id: data.taskTypeId,
          day_of_week: data.dayOfWeek,
          time_slot: data.timeSlot,
          assigned_to: data.assignedTo,
          is_active: data.isActive,
          repeat_pattern: data.repeatPattern,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create schedule',
        message: error.message,
      });
    }
  }

  /**
   * Update a schedule
   */
  async updateSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // FIX: Iteration 11 - Validate input (was missing, unlike createSchedule)
      const validation = createScheduleSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.issues });
      }
      const data = validation.data;
      const supabase = getSupabase();

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (data.unitId !== undefined) updates.unit_id = data.unitId;
      if (data.taskTypeId !== undefined) updates.task_type_id = data.taskTypeId;
      if (data.dayOfWeek !== undefined) updates.day_of_week = data.dayOfWeek;
      if (data.timeSlot !== undefined) updates.time_slot = data.timeSlot;
      if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo;
      if (data.isActive !== undefined) updates.is_active = data.isActive;
      if (data.repeatPattern !== undefined) updates.repeat_pattern = data.repeatPattern;

      if (Object.keys(updates).length === 1) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: result, error } = await supabase
        .from('housekeeping_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Schedule not found' });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update schedule',
        message: error.message,
      });
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      const { error } = await supabase
        .from('housekeeping_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Schedule deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete schedule',
        message: error.message,
      });
    }
  }

  /**
   * Generate tasks from schedules (cron job endpoint)
   */
  async generateScheduledTasks(req: Request, res: Response) {
    try {
      const dayOfWeek = new Date().getDay();
      const supabase = getSupabase();

      const { data: schedules, error } = await supabase
        .from('housekeeping_schedules')
        .select('*')
        .eq('is_active', true)
        .or(`day_of_week.eq.${dayOfWeek},repeat_pattern.eq.daily`);

      if (error) throw error;

      let created = 0;
      const today = new Date().toISOString().split('T')[0];

      for (const schedule of schedules || []) {
        // Check if task already exists for today
        const { data: existing } = await supabase
          .from('housekeeping_tasks')
          .select('id')
          .eq('task_type_id', schedule.task_type_id)
          .eq('unit_id', schedule.unit_id || '')
          .gte('scheduled_for', `${today}T00:00:00.000Z`)
          .lte('scheduled_for', `${today}T23:59:59.999Z`)
          .single();

        if (!existing) {
          const scheduledTime = new Date();
          const [hours, minutes] = schedule.time_slot.split(':');
          scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          await supabase.from('housekeeping_tasks').insert({
            unit_id: schedule.unit_id,
            task_type_id: schedule.task_type_id,
            assigned_to: schedule.assigned_to,
            scheduled_for: scheduledTime.toISOString(),
            created_by: schedule.created_by,
          });
          created++;
        }
      }

      res.json({
        success: true,
        message: `Generated ${created} tasks from schedules`,
      });
    } catch (error: any) {
      console.error('Error generating tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate tasks',
        message: error.message,
      });
    }
  }

  /**
   * Get housekeeping statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const { period = '7' } = req.query;
      const days = parseInt(period as string);
      const supabase = getSupabase();

      const { data: allTasks, error: tasksError } = await supabase
        .from('housekeeping_tasks')
        .select('status, priority, started_at, completed_at, created_at, assigned_to');

      if (tasksError) throw tasksError;

      const tasks = allTasks || [];
      const today = new Date().toISOString().split('T')[0];

      const summary = {
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed_today: tasks.filter(t =>
          t.status === 'completed' && t.completed_at?.startsWith(today)
        ).length,
        total_completed: tasks.filter(t => t.status === 'completed').length,
        on_hold: tasks.filter(t => t.status === 'on_hold').length,
        urgent: tasks.filter(t =>
          t.priority === 'urgent' && ['pending', 'in_progress'].includes(t.status)
        ).length,
      };

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const completedWithTime = tasks.filter(t =>
        t.completed_at && t.started_at &&
        new Date(t.completed_at) > cutoffDate
      );

      let avgMinutes = 0;
      if (completedWithTime.length > 0) {
        const totalMinutes = completedWithTime.reduce((sum, t) => {
          const started = new Date(t.started_at).getTime();
          const completed = new Date(t.completed_at).getTime();
          return sum + (completed - started) / 60000;
        }, 0);
        avgMinutes = Math.round(totalMinutes / completedWithTime.length);
      }

      const staffMap: Record<string, { id: string; tasks_completed: number; total_time: number }> = {};
      tasks.filter(t =>
        t.status === 'completed' &&
        t.assigned_to &&
        t.completed_at &&
        new Date(t.completed_at) > cutoffDate
      ).forEach(t => {
        if (!staffMap[t.assigned_to]) {
          staffMap[t.assigned_to] = { id: t.assigned_to, tasks_completed: 0, total_time: 0 };
        }
        staffMap[t.assigned_to].tasks_completed++;
        if (t.started_at) {
          const time = (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000;
          staffMap[t.assigned_to].total_time += time;
        }
      });

      const staffIds = Object.keys(staffMap);
      let staffPerformance: any[] = [];
      if (staffIds.length > 0) {
        const { data: staffUsers } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', staffIds);

        staffPerformance = Object.values(staffMap)
          .map(s => ({
            id: s.id,
            name: staffUsers?.find(u => u.id === s.id)?.full_name || 'Unknown',
            tasks_completed: s.tasks_completed,
            avg_time_minutes: s.tasks_completed > 0 ? Math.round(s.total_time / s.tasks_completed) : 0,
          }))
          .sort((a, b) => b.tasks_completed - a.tasks_completed)
          .slice(0, 10);
      }

      const dateMap: Record<string, { date: string; created: number; completed: number }> = {};
      tasks.filter(t => new Date(t.created_at) > cutoffDate).forEach(t => {
        const date = t.created_at.split('T')[0];
        if (!dateMap[date]) dateMap[date] = { date, created: 0, completed: 0 };
        dateMap[date].created++;
        if (t.status === 'completed') dateMap[date].completed++;
      });

      const dailyTrend = Object.values(dateMap)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        success: true,
        data: {
          summary,
          avgCompletionMinutes: avgMinutes,
          staffPerformance,
          dailyTrend,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message,
      });
    }
  }

  /**
   * Get available staff for assignment
   */
  async getAvailableStaff(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      const { data: roles } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', ['staff', 'admin', 'super_admin']);

      const roleIds = (roles || []).map(r => r.id);

      const { data: userRoleData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', roleIds);

      if (rolesError) throw rolesError;

      const userIds = [...new Set((userRoleData || []).map(ur => ur.user_id))];

      const { data: staffUsers, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      if (usersError) throw usersError;

      const { data: activeTasks } = await supabase
        .from('housekeeping_tasks')
        .select('assigned_to')
        .in('status', ['pending', 'in_progress']);

      const taskCounts: Record<string, number> = {};
      (activeTasks || []).forEach(t => {
        if (t.assigned_to) taskCounts[t.assigned_to] = (taskCounts[t.assigned_to] || 0) + 1;
      });

      const staff = (staffUsers || []).map(s => ({
        ...s,
        name: s.full_name,
        active_tasks: taskCounts[s.id] || 0,
      })).sort((a, b) => a.active_tasks - b.active_tasks || (a.full_name || '').localeCompare(b.full_name || ''));

      res.json({
        success: true,
        data: staff,
      });
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch staff',
        message: error.message,
      });
    }
  }
}

export const housekeepingController = new HousekeepingController();
