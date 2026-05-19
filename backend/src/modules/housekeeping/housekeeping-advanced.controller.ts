import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

// Validation schemas
const createTaskSchema = z.object({
  chaletId: z.string().uuid(),
  taskType: z.enum(['standard_cleaning', 'deep_cleaning', 'turnover', 'inspection', 'maintenance']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

const completeTaskSchema = z.object({
  notes: z.string().optional(),
  issuesFound: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
});

const inspectionSchema = z.object({
  taskId: z.string().uuid(),
  checklistItems: z.array(z.object({
    item: z.string(),
    passed: z.boolean(),
    notes: z.string().optional(),
  })),
  overallRating: z.number().min(1).max(5),
  requiresRework: z.boolean().default(false),
  notes: z.string().optional(),
});

const blockChaletSchema = z.object({
  reason: z.string(),
  expectedClearDate: z.string().optional(),
});

export class HousekeepingAdvancedController {
  /**
   * Get SLA configuration
   */
  async getSLAConfig(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      const { data: slas, error } = await supabase
        .from('housekeeping_sla')
        .select('*')
        .order('task_type');

      if (error) throw error;

      res.json({ success: true, data: slas || [] });
    } catch (error: any) {
      logger.error('Error fetching SLA config:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch SLA config', message: error.message });
    }
  }

  /**
   * Update SLA configuration
   */
  async updateSLAConfig(req: Request, res: Response) {
    try {
      const { taskType, targetMinutes, warningMinutes, criticalMinutes } = req.body;
      const supabase = getSupabase();

      const { data: sla, error } = await supabase
        .from('housekeeping_sla')
        .upsert({
          task_type: taskType,
          target_minutes: targetMinutes,
          warning_minutes: warningMinutes,
          critical_minutes: criticalMinutes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: sla });
    } catch (error: any) {
      logger.error('Error updating SLA config:', error);
      res.status(500).json({ success: false, error: 'Failed to update SLA config', message: error.message });
    }
  }

  /**
   * Create housekeeping task
   */
  async createTask(req: Request, res: Response) {
    try {
      const validation = createTaskSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Get SLA for this task type
      const { data: sla } = await supabase
        .from('housekeeping_sla')
        .select('*')
        .eq('task_type', data.taskType)
        .single();

      // Calculate SLA deadline
      const now = new Date();
      const slaDue = sla ? new Date(now.getTime() + sla.target_minutes * 60 * 1000) : null;

      // Create task
      const { data: task, error } = await supabase
        .from('housekeeping_tasks')
        .insert({
          chalet_id: data.chaletId,
          task_type: data.taskType,
          priority: data.priority,
          status: 'pending',
          notes: data.notes,
          scheduled_for: data.scheduledFor,
          assigned_to: data.assignedTo,
          created_by: userId,
          sla_due: slaDue?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update chalet status
      await supabase
        .from('chalets')
        .update({ cleaning_status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', data.chaletId);

      res.status(201).json({ success: true, data: task });
    } catch (error: any) {
      logger.error('Error creating task:', error);
      res.status(500).json({ success: false, error: 'Failed to create task', message: error.message });
    }
  }

  /**
   * Start a housekeeping task
   */
  async startTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      const { data: task, error: fetchError } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      if (task.status !== 'pending' && task.status !== 'assigned') {
        return res.status(400).json({ success: false, error: `Cannot start task in ${task.status} status` });
      }

      const { data: updated, error } = await supabase
        .from('housekeeping_tasks')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          assigned_to: task.assigned_to || userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update chalet status
      await supabase
        .from('chalets')
        .update({ cleaning_status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', task.chalet_id);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error starting task:', error);
      res.status(500).json({ success: false, error: 'Failed to start task', message: error.message });
    }
  }

  /**
   * Complete a housekeeping task
   */
  async completeTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = completeTaskSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      const { data: task, error: fetchError } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      if (task.status !== 'in_progress') {
        return res.status(400).json({ success: false, error: 'Task must be in progress to complete' });
      }

      const completedAt = new Date();
      const startedAt = new Date(task.started_at);
      const durationMinutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);

      // Check SLA status
      let slaStatus = 'met';
      if (task.sla_due) {
        const slaDue = new Date(task.sla_due);
        if (completedAt > slaDue) {
          slaStatus = 'breached';
        }
      }

      const { data: updated, error } = await supabase
        .from('housekeeping_tasks')
        .update({
          status: 'completed',
          completed_at: completedAt.toISOString(),
          duration_minutes: durationMinutes,
          completion_notes: data.notes,
          issues_found: data.issuesFound,
          photo_urls: data.photoUrls,
          sla_status: slaStatus,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update chalet status - needs inspection or clean
      const newStatus = task.task_type === 'turnover' ? 'pending_inspection' : 'clean';
      await supabase
        .from('chalets')
        .update({
          cleaning_status: newStatus,
          last_cleaned: completedAt.toISOString(),
          updated_at: completedAt.toISOString(),
        })
        .eq('id', task.chalet_id);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error completing task:', error);
      res.status(500).json({ success: false, error: 'Failed to complete task', message: error.message });
    }
  }

  /**
   * Submit inspection
   */
  async submitInspection(req: Request, res: Response) {
    try {
      const validation = inspectionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const data = validation.data;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Get task
      const { data: task, error: taskError } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('id', data.taskId)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Create inspection record
      const { data: inspection, error } = await supabase
        .from('housekeeping_inspections')
        .insert({
          task_id: data.taskId,
          chalet_id: task.chalet_id,
          inspector_id: userId,
          checklist_items: data.checklistItems,
          overall_rating: data.overallRating,
          passed: !data.requiresRework,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Update task status
      const newStatus = data.requiresRework ? 'rework_needed' : 'inspected';
      await supabase
        .from('housekeeping_tasks')
        .update({
          status: newStatus,
          inspection_id: inspection.id,
          inspection_passed: !data.requiresRework,
        })
        .eq('id', data.taskId);

      // Update chalet status
      const chaletStatus = data.requiresRework ? 'dirty' : 'clean';
      await supabase
        .from('chalets')
        .update({
          cleaning_status: chaletStatus,
          last_inspected: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.chalet_id);

      // If rework needed, create new task
      if (data.requiresRework) {
        await supabase.from('housekeeping_tasks').insert({
          chalet_id: task.chalet_id,
          task_type: task.task_type,
          priority: 'high',
          status: 'pending',
          notes: `Rework required after failed inspection: ${data.notes || 'No notes'}`,
          assigned_to: task.assigned_to,
          created_by: userId,
          parent_task_id: task.id,
        });
      }

      res.status(201).json({ success: true, data: inspection });
    } catch (error: any) {
      logger.error('Error submitting inspection:', error);
      res.status(500).json({ success: false, error: 'Failed to submit inspection', message: error.message });
    }
  }

  /**
   * Check if chalet can accept check-in
   */
  async canCheckIn(req: Request, res: Response) {
    try {
      const { chaletId } = req.params;
      const supabase = getSupabase();

      const { data: result, error } = await supabase.rpc('can_check_in', {
        p_chalet_id: chaletId,
      });

      if (error) throw error;

      // Get chalet details
      const { data: chalet } = await supabase
        .from('chalets')
        .select('id, name, cleaning_status, is_blocked, block_reason')
        .eq('id', chaletId)
        .single();

      // Get pending tasks
      const { data: pendingTasks } = await supabase
        .from('housekeeping_tasks')
        .select('id, task_type, status, priority')
        .eq('chalet_id', chaletId)
        .in('status', ['pending', 'in_progress', 'rework_needed']);

      res.json({
        success: true,
        data: {
          canCheckIn: result,
          chalet,
          blockingIssues: result ? [] : [
            ...(chalet?.is_blocked ? [`Blocked: ${chalet.block_reason}`] : []),
            ...(chalet?.cleaning_status !== 'clean' ? [`Cleaning status: ${chalet?.cleaning_status}`] : []),
            ...((pendingTasks || []).map(t => `Pending ${t.task_type} (${t.status})`)),
          ],
        },
      });
    } catch (error: any) {
      logger.error('Error checking check-in status:', error);
      res.status(500).json({ success: false, error: 'Failed to check status', message: error.message });
    }
  }

  /**
   * Block a chalet
   */
  async blockChalet(req: Request, res: Response) {
    try {
      const { chaletId } = req.params;
      const validation = blockChaletSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const data = validation.data;
      const supabase = getSupabase();

      const { data: chalet, error } = await supabase
        .from('chalets')
        .update({
          is_blocked: true,
          block_reason: data.reason,
          blocked_until: data.expectedClearDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chaletId)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: chalet });
    } catch (error: any) {
      logger.error('Error blocking chalet:', error);
      res.status(500).json({ success: false, error: 'Failed to block chalet', message: error.message });
    }
  }

  /**
   * Unblock a chalet
   */
  async unblockChalet(req: Request, res: Response) {
    try {
      const { chaletId } = req.params;
      const supabase = getSupabase();

      const { data: chalet, error } = await supabase
        .from('chalets')
        .update({
          is_blocked: false,
          block_reason: null,
          blocked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chaletId)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data: chalet });
    } catch (error: any) {
      logger.error('Error unblocking chalet:', error);
      res.status(500).json({ success: false, error: 'Failed to unblock chalet', message: error.message });
    }
  }

  /**
   * Get SLA performance report
   */
  async getSLAReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, taskType } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('status', 'completed');

      if (startDate) query = query.gte('completed_at', startDate);
      if (endDate) query = query.lte('completed_at', endDate);
      if (taskType) query = query.eq('task_type', taskType);

      const { data: tasks, error } = await query;

      if (error) throw error;

      const totalTasks = (tasks || []).length;
      const slaMet = (tasks || []).filter(t => t.sla_status === 'met').length;
      const slaBreached = (tasks || []).filter(t => t.sla_status === 'breached').length;

      const avgDuration = totalTasks > 0
        ? (tasks || []).reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / totalTasks
        : 0;

      // Group by task type
      const byTaskType = (tasks || []).reduce((acc: any, t) => {
        if (!acc[t.task_type]) {
          acc[t.task_type] = { total: 0, met: 0, breached: 0, avgDuration: 0, totalDuration: 0 };
        }
        acc[t.task_type].total++;
        if (t.sla_status === 'met') acc[t.task_type].met++;
        if (t.sla_status === 'breached') acc[t.task_type].breached++;
        acc[t.task_type].totalDuration += (t.duration_minutes || 0);
        return acc;
      }, {});

      Object.keys(byTaskType).forEach(type => {
        byTaskType[type].avgDuration = byTaskType[type].totalDuration / byTaskType[type].total;
        byTaskType[type].slaRate = (byTaskType[type].met / byTaskType[type].total * 100).toFixed(1);
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalTasks,
            slaMet,
            slaBreached,
            slaRate: totalTasks > 0 ? ((slaMet / totalTasks) * 100).toFixed(1) : '0',
            avgDurationMinutes: Math.round(avgDuration),
          },
          byTaskType,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching SLA report:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch SLA report', message: error.message });
    }
  }

  /**
   * Get room state machine status
   */
  async getRoomStates(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      const { data: chalets, error } = await supabase
        .from('chalets')
        .select(`
          id, name, cleaning_status, is_blocked, block_reason, blocked_until,
          last_cleaned, last_inspected,
          current_tasks:housekeeping_tasks(id, task_type, status, priority, sla_due)
        `)
        .order('name');

      if (error) throw error;

      // Categorize chalets
      const states = {
        clean: (chalets || []).filter(c => c.cleaning_status === 'clean' && !c.is_blocked),
        dirty: (chalets || []).filter(c => c.cleaning_status === 'dirty' && !c.is_blocked),
        pending: (chalets || []).filter(c => c.cleaning_status === 'pending' && !c.is_blocked),
        in_progress: (chalets || []).filter(c => c.cleaning_status === 'in_progress' && !c.is_blocked),
        pending_inspection: (chalets || []).filter(c => c.cleaning_status === 'pending_inspection' && !c.is_blocked),
        blocked: (chalets || []).filter(c => c.is_blocked),
      };

      res.json({
        success: true,
        data: {
          states,
          summary: Object.fromEntries(
            Object.entries(states).map(([key, value]) => [key, value.length])
          ),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching room states:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch room states', message: error.message });
    }
  }

  /**
   * Override inspection (manager only)
   */
  async overrideInspection(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const { reason, newStatus } = req.body;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Get task
      const { data: task, error: taskError } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      // Update task with override
      const { data: updated, error } = await supabase
        .from('housekeeping_tasks')
        .update({
          status: newStatus || 'inspected',
          inspection_passed: true,
          override_reason: reason,
          overridden_by: userId,
          overridden_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Update chalet to clean
      await supabase
        .from('chalets')
        .update({
          cleaning_status: 'clean',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.chalet_id);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error overriding inspection:', error);
      res.status(500).json({ success: false, error: 'Failed to override inspection', message: error.message });
    }
  }

  // ============================================
  // BOOKING INTEGRATION - Auto-create tasks on checkout
  // ============================================
  
  /**
   * Trigger housekeeping for checkout (called by booking service)
   */
  async triggerCheckoutClean(req: Request, res: Response) {
    try {
      const { bookingId, chaletId, checkoutTime, urgency } = req.body;
      const supabase = getSupabase();

      // Check if next booking exists (to determine urgency)
      const today = new Date().toISOString().split('T')[0];
      const { data: nextBooking } = await supabase
        .from('transactions')
        .select('id, check_in')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('unit_id', chaletId)
        .filter('metadata->>check_in_date', 'gte',, today)
        .order('check_in', { ascending: true })
        .limit(1)
        .single();

      // Determine priority based on next booking
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      if (nextBooking) {
        const nextCheckIn = new Date(nextBooking.check_in);
        const hoursUntilCheckIn = (nextCheckIn.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilCheckIn < 4) priority = 'urgent';
        else if (hoursUntilCheckIn < 8) priority = 'high';
        else if (hoursUntilCheckIn < 24) priority = 'medium';
        else priority = 'low';
      }

      // Get available staff based on workload
      const assignedStaff = await this.getLowestWorkloadStaff(supabase);

      // Get SLA for turnover
      const { data: sla } = await supabase
        .from('housekeeping_sla')
        .select('*')
        .eq('task_type', 'turnover')
        .single();

      const now = new Date();
      const slaDue = sla ? new Date(now.getTime() + sla.target_minutes * 60 * 1000) : null;

      // Create turnover task
      const { data: task, error } = await supabase
        .from('housekeeping_tasks')
        .insert({
          chalet_id: chaletId,
          task_type: 'turnover',
          priority,
          status: assignedStaff ? 'assigned' : 'pending',
          notes: `Auto-generated from checkout. Booking #${bookingId}. ${nextBooking ? `Next check-in at ${nextBooking.check_in}` : 'No upcoming booking'}`,
          assigned_to: assignedStaff?.id,
          scheduled_for: checkoutTime || now.toISOString(),
          booking_id: bookingId,
          sla_due: slaDue?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update chalet status
      await supabase
        .from('chalets')
        .update({ cleaning_status: 'dirty', updated_at: now.toISOString() })
        .eq('id', chaletId);

      // If assigned, notify staff
      if (assignedStaff) {
        await this.notifyStaff(supabase, assignedStaff.id, task);
      }

      res.status(201).json({ 
        success: true, 
        data: { task, assignedStaff: assignedStaff?.full_name, priority }
      });
    } catch (error: any) {
      logger.error('Error triggering checkout clean:', error);
      res.status(500).json({ success: false, error: 'Failed to trigger checkout clean', message: error.message });
    }
  }

  /**
   * Get staff with lowest workload
   */
  private async getLowestWorkloadStaff(supabase: any) {
    // Get all housekeeping staff
    const { data: staff } = await supabase
      .from('users')
      .select('id, full_name, shift_start, shift_end')
      .contains('roles', ['staff'])
      .eq('department', 'housekeeping')
      .eq('is_active', true);

    if (!staff || staff.length === 0) return null;

    // Get current task counts for each staff member
    const staffIds = staff.map((s: any) => s.id);
    const { data: taskCounts } = await supabase
      .from('housekeeping_tasks')
      .select('assigned_to')
      .in('assigned_to', staffIds)
      .in('status', ['pending', 'assigned', 'in_progress']);

    // Count tasks per staff
    const counts = (taskCounts || []).reduce((acc: Record<string, number>, t: any) => {
      acc[t.assigned_to] = (acc[t.assigned_to] || 0) + 1;
      return acc;
    }, {});

    // Find staff with lowest count
    let lowestStaff = staff[0];
    let lowestCount = counts[staff[0].id] || 0;

    for (const s of staff) {
      const count = counts[s.id] || 0;
      if (count < lowestCount) {
        lowestCount = count;
        lowestStaff = s;
      }
    }

    return lowestStaff;
  }

  /**
   * Notify staff of new task
   */
  private async notifyStaff(supabase: any, staffId: string, task: any) {
    try {
      await supabase.from('notifications').insert({
        user_id: staffId,
        type: 'housekeeping_task',
        title: 'New Housekeeping Task',
        message: `You have been assigned a ${task.task_type} task (${task.priority} priority)`,
        metadata: { taskId: task.id, chaletId: task.chalet_id },
      });
    } catch (e) {
      logger.error('Failed to notify staff:', e);
    }
  }

  // ============================================
  // INVENTORY INTEGRATION - Consume supplies on task completion
  // ============================================

  /**
   * Get supplies needed for a task type
   */
  async getTaskSupplies(req: Request, res: Response) {
    try {
      const { taskType } = req.params;
      const supabase = getSupabase();

      const { data: supplies, error } = await supabase
        .from('housekeeping_supplies')
        .select(`
          id, inventory_item_id, quantity_per_task,
          inventory_item:inventory_items(id, name, current_stock, unit)
        `)
        .eq('task_type', taskType)
        .eq('is_active', true);

      if (error) throw error;

      res.json({ success: true, data: supplies || [] });
    } catch (error: any) {
      logger.error('Error fetching task supplies:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch task supplies', message: error.message });
    }
  }

  /**
   * Configure supplies for a task type
   */
  async configureTaskSupplies(req: Request, res: Response) {
    try {
      const { taskType, supplies } = req.body;
      const supabase = getSupabase();

      // Delete existing config for this task type
      await supabase
        .from('housekeeping_supplies')
        .delete()
        .eq('task_type', taskType);

      // Insert new config
      if (supplies && supplies.length > 0) {
        const { error } = await supabase
          .from('housekeeping_supplies')
          .insert(supplies.map((s: any) => ({
            task_type: taskType,
            inventory_item_id: s.inventoryItemId,
            quantity_per_task: s.quantity,
            is_active: true,
          })));

        if (error) throw error;
      }

      res.json({ success: true, message: 'Supplies configured' });
    } catch (error: any) {
      logger.error('Error configuring task supplies:', error);
      res.status(500).json({ success: false, error: 'Failed to configure supplies', message: error.message });
    }
  }

  /**
   * Consume inventory when task completes (called internally)
   */
  async consumeSuppliesForTask(taskId: string, taskType: string) {
    try {
      const supabase = getSupabase();

      // Get supplies for this task type
      const { data: supplies } = await supabase
        .from('housekeeping_supplies')
        .select('inventory_item_id, quantity_per_task')
        .eq('task_type', taskType)
        .eq('is_active', true);

      if (!supplies || supplies.length === 0) return;

      // Deduct each supply item
      for (const supply of supplies) {
        // Create transaction record
        await supabase.from('inventory_transactions').insert({
          item_id: supply.inventory_item_id,
          transaction_type: 'consume',
          quantity: -supply.quantity_per_task,
          reference_type: 'housekeeping_task',
          reference_id: taskId,
          notes: `Consumed for housekeeping task ${taskId}`,
        });

        // Update stock
        await supabase.rpc('deduct_stock_fifo', {
          p_item_id: supply.inventory_item_id,
          p_quantity: supply.quantity_per_task,
          p_reason: 'housekeeping',
          p_user_id: null,
        });
      }

      logger.info(`Consumed supplies for task ${taskId}`);
    } catch (error) {
      logger.error('Error consuming supplies:', error);
    }
  }

  // ============================================
  // REAL-TIME ROOM READINESS DASHBOARD
  // ============================================

  /**
   * Get real-time room readiness dashboard
   */
  async getRoomReadinessDashboard(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get all chalets with their current status
      const { data: chalets, error } = await supabase
        .from('chalets')
        .select(`
          id, name, cleaning_status, is_blocked, block_reason,
          last_cleaned, last_inspected
        `)
        .order('name');

      if (error) throw error;

      // Get today's bookings for context
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const { data: todayBookings } = await supabase
        .from('transactions')
        .select('unit_id, check_in, check_out, status')
        .eq('engine_type', 'time_exclusive_reservation')
        .or(`check_in.gte.${today},check_out.gte.${today}`)
        .filter('metadata->>check_in_date', 'lte',, tomorrow);

      // Get active tasks
      const { data: activeTasks } = await supabase
        .from('housekeeping_tasks')
        .select('id, chalet_id, task_type, status, priority, assigned_to, sla_due, started_at')
        .in('status', ['pending', 'assigned', 'in_progress', 'pending_inspection']);

      // Get staff on duty
      const { data: staffOnDuty } = await supabase
        .from('users')
        .select('id, full_name')
        .contains('roles', ['staff'])
        .eq('department', 'housekeeping')
        .eq('is_active', true);

      // Calculate metrics
      const totalRooms = (chalets || []).length;
      const readyRooms = (chalets || []).filter(c => c.cleaning_status === 'clean' && !c.is_blocked).length;
      const dirtyRooms = (chalets || []).filter(c => c.cleaning_status === 'dirty').length;
      const inProgress = (chalets || []).filter(c => c.cleaning_status === 'in_progress').length;
      const pendingInspection = (chalets || []).filter(c => c.cleaning_status === 'pending_inspection').length;
      const blocked = (chalets || []).filter(c => c.is_blocked).length;

      // SLA at risk tasks
      const now = new Date();
      const slaAtRisk = (activeTasks || []).filter(t => {
        if (!t.sla_due) return false;
        const slaDue = new Date(t.sla_due);
        const timeRemaining = slaDue.getTime() - now.getTime();
        return timeRemaining < 30 * 60 * 1000 && timeRemaining > 0; // Less than 30 mins
      });

      const slaBreached = (activeTasks || []).filter(t => {
        if (!t.sla_due) return false;
        return new Date(t.sla_due) < now;
      });

      // Map chalets with booking status
      const chaletStatus = (chalets || []).map(chalet => {
        const bookings = (todayBookings || []).filter(b => b.unit_id === chalet.id);
        const checkingOut = bookings.find(b => (b.metadata as any)?.check_out_date === today);
        const checkingIn = bookings.find(b => (b.metadata as any)?.check_in_date === today);
        const tasks = (activeTasks || []).filter(t => t.chalet_id === chalet.id);

        return {
          ...chalet,
          checkingOut: !!checkingOut,
          checkingIn: !!checkingIn,
          activeTasks: tasks,
          urgency: checkingIn && chalet.cleaning_status !== 'clean' 
            ? 'critical' 
            : tasks.some(t => t.priority === 'urgent') 
              ? 'urgent' 
              : 'normal',
        };
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalRooms,
            readyRooms,
            dirtyRooms,
            inProgress,
            pendingInspection,
            blocked,
            readinessRate: totalRooms > 0 ? ((readyRooms / totalRooms) * 100).toFixed(1) : '0',
            slaAtRiskCount: slaAtRisk.length,
            slaBreachedCount: slaBreached.length,
            staffOnDuty: (staffOnDuty || []).length,
          },
          chalets: chaletStatus,
          slaAtRisk,
          slaBreached,
          staffOnDuty,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching room readiness dashboard:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard', message: error.message });
    }
  }

  // ============================================
  // WORKLOAD-BASED AUTO-ASSIGNMENT
  // ============================================

  /**
   * Get staff workload analysis
   */
  async getStaffWorkload(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get all housekeeping staff
      const { data: staff } = await supabase
        .from('users')
        .select('id, full_name, department')
        .contains('roles', ['staff'])
        .eq('department', 'housekeeping')
        .eq('is_active', true);

      if (!staff || staff.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Get tasks for today
      const today = new Date().toISOString().split('T')[0];
      const staffIds = staff.map(s => s.id);

      const { data: tasks } = await supabase
        .from('housekeeping_tasks')
        .select('id, assigned_to, status, task_type, duration_minutes, started_at, completed_at')
        .in('assigned_to', staffIds)
        .gte('created_at', `${today}T00:00:00`);

      // Calculate workload for each staff member
      const workload = staff.map(s => {
        const staffTasks = (tasks || []).filter(t => t.assigned_to === s.id);
        const pendingTasks = staffTasks.filter(t => ['pending', 'assigned'].includes(t.status));
        const inProgressTasks = staffTasks.filter(t => t.status === 'in_progress');
        const completedTasks = staffTasks.filter(t => t.status === 'completed');

        const totalDuration = completedTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
        const avgDuration = completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;

        return {
          staffId: s.id,
          staffName: s.full_name,
          pending: pendingTasks.length,
          inProgress: inProgressTasks.length,
          completed: completedTasks.length,
          totalTasks: staffTasks.length,
          avgDurationMinutes: Math.round(avgDuration),
          totalDurationMinutes: totalDuration,
          availableCapacity: Math.max(0, 8 - pendingTasks.length - inProgressTasks.length), // Assume 8 tasks/day capacity
        };
      });

      res.json({
        success: true,
        data: workload.sort((a, b) => b.availableCapacity - a.availableCapacity),
      });
    } catch (error: any) {
      logger.error('Error fetching staff workload:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch workload', message: error.message });
    }
  }

  /**
   * Auto-assign all unassigned tasks
   */
  async autoAssignTasks(req: Request, res: Response) {
    try {
      const supabase = getSupabase();

      // Get unassigned tasks
      const { data: unassignedTasks } = await supabase
        .from('housekeeping_tasks')
        .select('id, chalet_id, task_type, priority, scheduled_for')
        .is('assigned_to', null)
        .in('status', ['pending'])
        .order('priority', { ascending: false }) // Urgent first
        .order('scheduled_for', { ascending: true }); // Earlier first

      if (!unassignedTasks || unassignedTasks.length === 0) {
        return res.json({ success: true, message: 'No unassigned tasks', assigned: 0 });
      }

      let assignedCount = 0;

      for (const task of unassignedTasks) {
        const staff = await this.getLowestWorkloadStaff(supabase);
        if (!staff) break;

        const { error } = await supabase
          .from('housekeeping_tasks')
          .update({ assigned_to: staff.id, status: 'assigned' })
          .eq('id', task.id);

        if (!error) {
          assignedCount++;
          await this.notifyStaff(supabase, staff.id, task);
        }
      }

      res.json({ success: true, message: `Assigned ${assignedCount} tasks`, assigned: assignedCount });
    } catch (error: any) {
      logger.error('Error auto-assigning tasks:', error);
      res.status(500).json({ success: false, error: 'Failed to auto-assign tasks', message: error.message });
    }
  }
}

export const housekeepingAdvancedController = new HousekeepingAdvancedController();


