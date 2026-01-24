import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { logActivity } from '../../utils/activityLogger.js';
import { z } from 'zod';

// Validation schemas
const createShiftSchema = z.object({
  staffId: z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().min(0).default(0),
  department: z.string().optional(),
  notes: z.string().optional(),
});

const updateShiftSchema = createShiftSchema.partial().extend({
  status: z.enum(['scheduled', 'active', 'completed', 'missed', 'cancelled']).optional(),
  overtimeApproved: z.boolean().optional(),
});

const swapRequestSchema = z.object({
  shiftId: z.string().uuid(),
  targetStaffId: z.string().uuid().optional(), // Optional - can be open request
  reason: z.string().min(1),
});

const assignmentSchema = z.object({
  department: z.string(),
  area: z.string().optional(),
  tasks: z.array(z.string()).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

// ============================================
// Shifts Management
// ============================================

/**
 * GET /api/staff/shifts/me
 * Get my upcoming and recent shifts
 */
export async function getMyShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const { startDate, endDate } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', userId)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Default to last 7 days + next 14 days
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 7);
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 14);

    query = query
      .gte('shift_date', startDate || defaultStart.toISOString().split('T')[0])
      .lte('shift_date', endDate || defaultEnd.toISOString().split('T')[0]);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    logger.error('Error fetching my shifts', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/staff/shifts
 * Get all shifts (filtered by date range, department, staff)
 */
export async function getAllShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate, department, staffId, status } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('staff_shifts')
      .select('*, staff:staff_id(id, full_name, email)')
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (startDate) query = query.gte('shift_date', startDate);
    if (endDate) query = query.lte('shift_date', endDate);
    if (department) query = query.eq('department', department);
    if (staffId) query = query.eq('staff_id', staffId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    logger.error('Error fetching all shifts', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/staff/shifts/staff/:staffId
 * Get shifts for a specific staff member
 */
export async function getStaffShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', staffId)
      .order('shift_date', { ascending: true });

    if (startDate) query = query.gte('shift_date', startDate);
    if (endDate) query = query.lte('shift_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    logger.error('Error fetching staff shifts', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/staff/shifts
 * Create a new shift
 */
export async function createShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validation = createShiftSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const userId = (req as any).user?.userId;
    const supabase = getSupabase();
    const data = validation.data;

    const { data: shift, error } = await supabase
      .from('staff_shifts')
      .insert({
        staff_id: data.staffId,
        shift_date: data.shiftDate,
        start_time: data.startTime,
        end_time: data.endTime,
        break_minutes: data.breakMinutes,
        department: data.department,
        notes: data.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: userId,
      action: 'CREATE_SHIFT',
      resource: 'staff_shifts',
      resource_id: shift.id,
      details: { staff_id: data.staffId, date: data.shiftDate },
    });

    res.status(201).json({ success: true, data: shift });
  } catch (error: any) {
    logger.error('Error creating shift', { error: error.message });
    next(error);
  }
}

/**
 * PUT /api/staff/shifts/:id
 * Update a shift
 */
export async function updateShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const validation = updateShiftSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const userId = (req as any).user?.userId;
    const supabase = getSupabase();
    const data = validation.data;

    const updateData: any = {};
    if (data.staffId) updateData.staff_id = data.staffId;
    if (data.shiftDate) updateData.shift_date = data.shiftDate;
    if (data.startTime) updateData.start_time = data.startTime;
    if (data.endTime) updateData.end_time = data.endTime;
    if (data.breakMinutes !== undefined) updateData.break_minutes = data.breakMinutes;
    if (data.department) updateData.department = data.department;
    if (data.notes) updateData.notes = data.notes;
    if (data.status) updateData.status = data.status;
    if (data.overtimeApproved !== undefined) updateData.overtime_approved = data.overtimeApproved;

    const { data: shift, error } = await supabase
      .from('staff_shifts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: shift });
  } catch (error: any) {
    logger.error('Error updating shift', { error: error.message });
    next(error);
  }
}

/**
 * DELETE /api/staff/shifts/:id
 * Delete a shift
 */
export async function deleteShift(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { error } = await supabase.from('staff_shifts').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: 'Shift deleted' });
  } catch (error: any) {
    logger.error('Error deleting shift', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/staff/shifts/:id/clock-in
 * Clock in to a shift
 */
export async function clockIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Verify the shift belongs to this user
    const { data: shift, error: fetchError } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !shift) {
      res.status(404).json({ success: false, error: 'Shift not found' });
      return;
    }

    if (shift.staff_id !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized for this shift' });
      return;
    }

    if (shift.actual_start) {
      res.status(400).json({ success: false, error: 'Already clocked in' });
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('staff_shifts')
      .update({ actual_start: now, status: 'active' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Check if late
    const scheduledStart = new Date(`${shift.shift_date}T${shift.start_time}`);
    const actualStart = new Date(now);
    const lateMinutes = Math.floor((actualStart.getTime() - scheduledStart.getTime()) / 60000);

    res.json({
      success: true,
      data: updated,
      lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
      message: lateMinutes > 0 ? `Clocked in ${lateMinutes} minutes late` : 'Clocked in on time',
    });
  } catch (error: any) {
    logger.error('Error clocking in', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/staff/shifts/:id/clock-out
 * Clock out of a shift
 */
export async function clockOut(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { breakMinutes } = req.body;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    const { data: shift, error: fetchError } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !shift) {
      res.status(404).json({ success: false, error: 'Shift not found' });
      return;
    }

    if (shift.staff_id !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized for this shift' });
      return;
    }

    if (!shift.actual_start) {
      res.status(400).json({ success: false, error: 'Not clocked in' });
      return;
    }

    if (shift.actual_end) {
      res.status(400).json({ success: false, error: 'Already clocked out' });
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('staff_shifts')
      .update({
        actual_end: now,
        actual_break_minutes: breakMinutes || shift.break_minutes,
        status: 'completed',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Calculate worked hours
    const actualStart = new Date(shift.actual_start);
    const actualEnd = new Date(now);
    const totalMinutes = Math.floor((actualEnd.getTime() - actualStart.getTime()) / 60000) - (breakMinutes || shift.break_minutes);
    const workedHours = (totalMinutes / 60).toFixed(2);

    res.json({
      success: true,
      data: updated,
      workedHours,
      message: `Clocked out. Total worked: ${workedHours} hours`,
    });
  } catch (error: any) {
    logger.error('Error clocking out', { error: error.message });
    next(error);
  }
}

// ============================================
// Staff Assignments
// ============================================

/**
 * GET /api/staff/assignments
 * Get all staff assignments
 */
export async function getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { department, date } = req.query;
    const supabase = getSupabase();

    // Staff assignments might be stored in staff_shifts with department field
    // or in a separate assignments table. Using shifts for now.
    let query = supabase
      .from('staff_shifts')
      .select('*, staff:staff_id(id, full_name, email)')
      .eq('status', 'scheduled')
      .order('shift_date', { ascending: true });

    if (department) query = query.eq('department', department);
    if (date) query = query.eq('shift_date', date);

    const { data, error } = await query;
    if (error) throw error;

    // Group by department
    const grouped = (data || []).reduce((acc: any, shift: any) => {
      const dept = shift.department || 'unassigned';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push({
        id: shift.id,
        staff: shift.staff,
        shiftDate: shift.shift_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
      });
      return acc;
    }, {});

    res.json({ success: true, data: grouped });
  } catch (error: any) {
    logger.error('Error fetching assignments', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/staff/assignments/me
 * Get my current assignment
 */
export async function getMyAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('staff_id', userId)
      .eq('shift_date', today)
      .in('status', ['scheduled', 'active'])
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, data: data || null });
  } catch (error: any) {
    logger.error('Error fetching my assignment', { error: error.message });
    next(error);
  }
}

/**
 * PUT /api/staff/staff/:staffId/assignments
 * Update staff member's assignments/department
 */
export async function updateStaffAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { staffId } = req.params;
    const validation = assignmentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const userId = (req as any).user?.userId;
    const supabase = getSupabase();
    const data = validation.data;

    // Update today's and future shifts for this staff member
    const today = new Date().toISOString().split('T')[0];
    
    const { data: updated, error } = await supabase
      .from('staff_shifts')
      .update({
        department: data.department,
        notes: data.area ? `Area: ${data.area}` : undefined,
      })
      .eq('staff_id', staffId)
      .gte('shift_date', today)
      .eq('status', 'scheduled')
      .select();

    if (error) throw error;

    await logActivity({
      user_id: userId,
      action: 'UPDATE_STAFF_ASSIGNMENT',
      resource: 'staff_shifts',
      resource_id: staffId,
      details: { department: data.department, area: data.area },
    });

    res.json({
      success: true,
      message: `Updated ${updated?.length || 0} shifts`,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error updating staff assignment', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/staff/assignments/bulk
 * Bulk assign multiple staff members
 */
export async function bulkAssignStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { assignments } = req.body; // Array of { staffId, department, date, startTime, endTime }
    
    if (!Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ success: false, error: 'Assignments array required' });
      return;
    }

    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    const shifts = assignments.map((a: any) => ({
      staff_id: a.staffId,
      shift_date: a.date,
      start_time: a.startTime,
      end_time: a.endTime,
      department: a.department,
      created_by: userId,
    }));

    const { data, error } = await supabase
      .from('staff_shifts')
      .insert(shifts)
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: `Created ${data?.length || 0} shifts`,
      data,
    });
  } catch (error: any) {
    logger.error('Error bulk assigning staff', { error: error.message });
    next(error);
  }
}

// ============================================
// Shift Swap Workflow
// ============================================

/**
 * POST /api/staff/shifts/swap
 * Request a shift swap
 */
export async function requestShiftSwap(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validation = swapRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.errors });
      return;
    }

    const userId = (req as any).user?.userId;
    const supabase = getSupabase();
    const data = validation.data;

    // Verify the shift belongs to this user
    const { data: shift, error: shiftError } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('id', data.shiftId)
      .single();

    if (shiftError || !shift) {
      res.status(404).json({ success: false, error: 'Shift not found' });
      return;
    }

    if (shift.staff_id !== userId) {
      res.status(403).json({ success: false, error: 'Can only request swap for your own shifts' });
      return;
    }

    // Create swap request
    const { data: swapRequest, error } = await supabase
      .from('shift_swap_requests')
      .insert({
        original_shift_id: data.shiftId,
        requesting_staff_id: userId,
        target_staff_id: data.targetStaffId || null,
        reason: data.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: swapRequest });
  } catch (error: any) {
    logger.error('Error requesting shift swap', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/staff/shifts/swap/me
 * Get my swap requests
 */
export async function getMySwapRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('shift_swap_requests')
      .select(`
        *,
        original_shift:original_shift_id(*, staff:staff_id(full_name)),
        target:target_staff_id(full_name)
      `)
      .or(`requesting_staff_id.eq.${userId},target_staff_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    logger.error('Error fetching my swap requests', { error: error.message });
    next(error);
  }
}

/**
 * GET /api/staff/shifts/swap
 * Get all swap requests (managers)
 */
export async function getAllSwapRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('shift_swap_requests')
      .select(`
        *,
        original_shift:original_shift_id(*),
        requester:requesting_staff_id(full_name, email),
        target:target_staff_id(full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    logger.error('Error fetching all swap requests', { error: error.message });
    next(error);
  }
}

/**
 * PUT /api/staff/shifts/swap/:id/respond
 * Accept or decline a swap request (target staff)
 */
export async function respondToSwapRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { accept } = req.body;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Get the swap request
    const { data: request, error: fetchError } = await supabase
      .from('shift_swap_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      res.status(404).json({ success: false, error: 'Swap request not found' });
      return;
    }

    // Check if user is the target (or can accept open requests)
    if (request.target_staff_id && request.target_staff_id !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized to respond to this request' });
      return;
    }

    const { data, error } = await supabase
      .from('shift_swap_requests')
      .update({
        status: accept ? 'accepted' : 'rejected',
        accepted_by: accept ? userId : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: accept ? 'Swap request accepted - pending manager approval' : 'Swap request declined',
    });
  } catch (error: any) {
    logger.error('Error responding to swap request', { error: error.message });
    next(error);
  }
}

/**
 * PUT /api/staff/shifts/swap/:id/approve
 * Approve or reject a swap request (managers only)
 */
export async function approveSwapRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { approve } = req.body;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Get the swap request
    const { data: request, error: fetchError } = await supabase
      .from('shift_swap_requests')
      .select('*, original_shift:original_shift_id(*)')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      res.status(404).json({ success: false, error: 'Swap request not found' });
      return;
    }

    if (request.status !== 'accepted') {
      res.status(400).json({ success: false, error: 'Swap request must be accepted by target staff first' });
      return;
    }

    if (approve) {
      // Perform the actual swap - update the shift's staff_id
      await supabase
        .from('staff_shifts')
        .update({ staff_id: request.accepted_by })
        .eq('id', request.original_shift_id);
    }

    const { data, error } = await supabase
      .from('shift_swap_requests')
      .update({
        status: approve ? 'approved' : 'rejected',
        approved_by: approve ? userId : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: approve ? 'Shift swap approved and completed' : 'Shift swap rejected by manager',
    });
  } catch (error: any) {
    logger.error('Error approving swap request', { error: error.message });
    next(error);
  }
}

/**
 * DELETE /api/staff/shifts/swap/:id
 * Cancel a swap request
 */
export async function cancelSwapRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Verify ownership
    const { data: request, error: fetchError } = await supabase
      .from('shift_swap_requests')
      .select('requesting_staff_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      res.status(404).json({ success: false, error: 'Swap request not found' });
      return;
    }

    if (request.requesting_staff_id !== userId) {
      res.status(403).json({ success: false, error: 'Can only cancel your own requests' });
      return;
    }

    if (request.status === 'approved') {
      res.status(400).json({ success: false, error: 'Cannot cancel approved swap' });
      return;
    }

    const { error } = await supabase
      .from('shift_swap_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Swap request cancelled' });
  } catch (error: any) {
    logger.error('Error cancelling swap request', { error: error.message });
    next(error);
  }
}

// ============================================
// Time Tracking
// ============================================

/**
 * GET /api/staff/time-tracking
 * Get time tracking report
 */
export async function getTimeTrackingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { staffId, startDate, endDate, department } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('staff_shifts')
      .select('*, staff:staff_id(id, full_name)')
      .eq('status', 'completed')
      .not('actual_start', 'is', null)
      .not('actual_end', 'is', null);

    if (staffId) query = query.eq('staff_id', staffId);
    if (department) query = query.eq('department', department);
    if (startDate) query = query.gte('shift_date', startDate);
    if (endDate) query = query.lte('shift_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    // Calculate summaries
    const summary = (data || []).reduce((acc: any, shift: any) => {
      const staffId = shift.staff_id;
      if (!acc[staffId]) {
        acc[staffId] = {
          staffId,
          staffName: shift.staff?.full_name,
          totalShifts: 0,
          totalScheduledMinutes: 0,
          totalWorkedMinutes: 0,
          lateArrivals: 0,
          overtimeMinutes: 0,
        };
      }

      // Calculate scheduled vs actual
      const scheduledStart = new Date(`${shift.shift_date}T${shift.start_time}`);
      const scheduledEnd = new Date(`${shift.shift_date}T${shift.end_time}`);
      const actualStart = new Date(shift.actual_start);
      const actualEnd = new Date(shift.actual_end);

      const scheduledMinutes = (scheduledEnd.getTime() - scheduledStart.getTime()) / 60000 - shift.break_minutes;
      const workedMinutes = (actualEnd.getTime() - actualStart.getTime()) / 60000 - shift.actual_break_minutes;

      acc[staffId].totalShifts++;
      acc[staffId].totalScheduledMinutes += scheduledMinutes;
      acc[staffId].totalWorkedMinutes += workedMinutes;

      if (actualStart > scheduledStart) {
        acc[staffId].lateArrivals++;
      }

      if (workedMinutes > scheduledMinutes) {
        acc[staffId].overtimeMinutes += workedMinutes - scheduledMinutes;
      }

      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        shifts: data,
        summary: Object.values(summary),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching time tracking report', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/staff/shifts/:shiftId/adjustments
 * Add a time adjustment to a shift
 */
export async function addTimeAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { shiftId } = req.params;
    const { adjustmentType, originalTime, adjustedTime, reason } = req.body;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    if (!adjustmentType || !adjustedTime || !reason) {
      res.status(400).json({ success: false, error: 'adjustmentType, adjustedTime, and reason are required' });
      return;
    }

    const { data, error } = await supabase
      .from('time_clock_adjustments')
      .insert({
        shift_id: shiftId,
        adjustment_type: adjustmentType,
        original_time: originalTime,
        adjusted_time: adjustedTime,
        reason,
        adjusted_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Also update the shift if needed
    if (['clock_in', 'clock_out'].includes(adjustmentType)) {
      const updateField = adjustmentType === 'clock_in' ? 'actual_start' : 'actual_end';
      await supabase
        .from('staff_shifts')
        .update({ [updateField]: adjustedTime })
        .eq('id', shiftId);
    }

    res.status(201).json({ success: true, data });
  } catch (error: any) {
    logger.error('Error adding time adjustment', { error: error.message });
    next(error);
  }
}
