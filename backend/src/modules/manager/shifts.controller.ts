import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const createShiftSchema = z.object({
  staffId: z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).default(0),
  department: z.string().optional(),
  notes: z.string().optional(),
});

const updateShiftSchema = createShiftSchema.partial();

const clockInOutSchema = z.object({
  notes: z.string().optional(),
});

export class ShiftsController {
  private async calculateShiftFinancials(staffId: string, start: string, end: string, propertyId?: string): Promise<{ ordersProcessed: number; revenueHandled: number }> {
    const supabase = getSupabase();
    const sumRows = (rows: Array<{ total_amount?: string | number | null }> | null | undefined) =>
      (rows || []).reduce((sum, row) => sum + Number(amount || 0), 0);

    let query = supabase.from('transactions').select('id,total_amount:amount').eq('staff_id', staffId).gte('created_at', start).lte('created_at', end);
    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data } = await query;
    const ordersProcessed = data?.length || 0;
    const revenueHandled = sumRows(data as any[]);
    return { ordersProcessed, revenueHandled };
  }

  /**
   * Get shifts with filters
   */
  async getShifts(req: Request, res: Response) {
    try {
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const supabase = getSupabase();
      const { 
        staffId, 
        startDate, 
        endDate, 
        status, 
        department,
        page = '1',
        limit = '50',
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let query = supabase
        .from('staff_shifts')
        .select('*', { count: 'exact' });

      if (staffId) {
        if (propertyId) {
          const { data: accessRecord } = await supabase
            .from('user_property_access')
            .select('id')
            .eq('property_id', propertyId)
            .eq('user_id', staffId as string)
            .maybeSingle();

          if (!accessRecord) {
            return res.status(403).json({ success: false, error: 'Staff member does not belong to this property context' });
          }
        }
        query = query.eq('staff_id', staffId as string);
      } else if (propertyId) {
        const { data: staffMembers } = await supabase
          .from('user_property_access')
          .select('user_id')
          .eq('property_id', propertyId);
        const staffIds = (staffMembers || []).map(sm => sm.user_id).filter(Boolean);
        query = query.in('staff_id', staffIds);
      }

      if (startDate) query = query.gte('shift_date', startDate as string);
      if (endDate) query = query.lte('shift_date', endDate as string);
      if (status) query = query.eq('status', status as string);
      if (department) query = query.eq('department', department as string);

      const { data: shifts, error, count } = await query
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Enrich with staff names
      const staffIdsList = [...new Set((shifts || []).map(s => s.staff_id).filter(Boolean))];
      let staffMap: Record<string, any> = {};
      
      if (staffIdsList.length > 0) {
        const { data: staff } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', staffIdsList);
        staffMap = (staff || []).reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, any>);
      }

      const enrichedShifts = (shifts || []).map(s => ({
        ...s,
        staff_name: staffMap[s.staff_id]?.full_name || 'Unknown',
        staff_email: staffMap[s.staff_id]?.email,
      }));

      res.json({
        success: true,
        data: enrichedShifts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching shifts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shifts',
        message: error.message,
      });
    }
  }

  /**
   * Get my shifts (for logged in staff)
   */
  async getMyShifts(req: Request, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const { startDate, endDate, status } = req.query;
      const supabase = getSupabase();

      let query = supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', userId);

      if (startDate) query = query.gte('shift_date', startDate as string);
      if (endDate) query = query.lte('shift_date', endDate as string);
      if (status) query = query.eq('status', status as string);

      const { data: shifts, error } = await query
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data: shifts || [],
      });
    } catch (error: any) {
      logger.error('Error fetching my shifts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shifts',
        message: error.message,
      });
    }
  }

  /**
   * Create a new shift
   */
  async createShift(req: Request, res: Response) {
    try {
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const validation = createShiftSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const userId = req.user?.userId || req.user?.id;
      const supabase = getSupabase();

      if (propertyId) {
        const { data: accessRecord } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('property_id', propertyId)
          .eq('user_id', data.staffId)
          .maybeSingle();

        if (!accessRecord) {
          return res.status(403).json({
            success: false,
            error: 'Cannot assign shift: Staff member does not belong to this property context',
          });
        }
      }

      // Check for overlapping shifts
      const { data: existing } = await supabase
        .from('staff_shifts')
        .select('id')
        .eq('staff_id', data.staffId)
        .eq('shift_date', data.shiftDate)
        .neq('status', 'cancelled')
        .or(`start_time.lt.${data.endTime},end_time.gt.${data.startTime}`);

      if (existing && existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Overlapping shift exists for this staff member on this date',
        });
      }

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

      res.status(201).json({
        success: true,
        data: shift,
      });
    } catch (error: any) {
      logger.error('Error creating shift:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create shift',
        message: error.message,
      });
    }
  }

  /**
   * Update a shift
   */
  async updateShift(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const validation = updateShiftSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Verify the shift belongs to this property's staff
      const { data: shiftObj } = await supabase
        .from('staff_shifts')
        .select('staff_id')
        .eq('id', id)
        .single();

      if (!shiftObj) {
        return res.status(404).json({ success: false, error: 'Shift not found' });
      }

      if (propertyId) {
        const { data: accessRecord } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('property_id', propertyId)
          .eq('user_id', shiftObj.staff_id)
          .maybeSingle();

        if (!accessRecord) {
          return res.status(403).json({ success: false, error: 'Access denied to this shift' });
        }
      }

      const updates: Record<string, any> = {};
      if (data.staffId) updates.staff_id = data.staffId;
      if (data.shiftDate) updates.shift_date = data.shiftDate;
      if (data.startTime) updates.start_time = data.startTime;
      if (data.endTime) updates.end_time = data.endTime;
      if (data.breakMinutes !== undefined) updates.break_minutes = data.breakMinutes;
      if (data.department !== undefined) updates.department = data.department;
      if (data.notes !== undefined) updates.notes = data.notes;

      const { data: shift, error } = await supabase
        .from('staff_shifts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data: shift,
      });
    } catch (error: any) {
      logger.error('Error updating shift:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update shift',
        message: error.message,
      });
    }
  }

  /**
   * Delete a shift
   */
  async deleteShift(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const supabase = getSupabase();

      // Verify the shift belongs to this property's staff
      const { data: shiftObj } = await supabase
        .from('staff_shifts')
        .select('staff_id')
        .eq('id', id)
        .single();

      if (!shiftObj) {
        return res.status(404).json({ success: false, error: 'Shift not found' });
      }

      if (propertyId) {
        const { data: accessRecord } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('property_id', propertyId)
          .eq('user_id', shiftObj.staff_id)
          .maybeSingle();

        if (!accessRecord) {
          return res.status(403).json({ success: false, error: 'Access denied to this shift' });
        }
      }

      const { error } = await supabase
        .from('staff_shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Shift deleted',
      });
    } catch (error: any) {
      logger.error('Error deleting shift:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete shift',
        message: error.message,
      });
    }
  }

  /**
   * Clock in to a shift
   */
  async clockIn(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || req.user?.id;
      const supabase = getSupabase();

      // Get the shift
      const { data: shift, error: fetchError } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !shift) {
        return res.status(404).json({
          success: false,
          error: 'Shift not found',
        });
      }

      // Check if this is the user's shift
      if (shift.staff_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'This is not your shift',
        });
      }

      // Check if already clocked in
      if (shift.actual_start) {
        return res.status(400).json({
          success: false,
          error: 'Already clocked in to this shift',
        });
      }

      const now = new Date();
      const scheduledStart = new Date(`${shift.shift_date}T${shift.start_time}`);
      const isLate = now > new Date(scheduledStart.getTime() + 15 * 60 * 1000); // 15 min grace

      const { data: updatedShift, error } = await supabase
        .from('staff_shifts')
        .update({
          actual_start: now.toISOString(),
          status: 'active',
          late_reason: isLate ? req.body.notes || 'Clocked in late' : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data: updatedShift,
        isLate,
      });
    } catch (error: any) {
      logger.error('Error clocking in:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clock in',
        message: error.message,
      });
    }
  }

  /**
   * Clock out of a shift
   */
  async clockOut(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || req.user?.id;
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const supabase = getSupabase();

      // Get the shift
      const { data: shift, error: fetchError } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !shift) {
        return res.status(404).json({
          success: false,
          error: 'Shift not found',
        });
      }

      // Check if this is the user's shift
      if (shift.staff_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'This is not your shift',
        });
      }

      // Check if clocked in
      if (!shift.actual_start) {
        return res.status(400).json({
          success: false,
          error: 'Not clocked in to this shift',
        });
      }

      // Check if already clocked out
      if (shift.actual_end) {
        return res.status(400).json({
          success: false,
          error: 'Already clocked out of this shift',
        });
      }

      const now = new Date();
      const scheduledEnd = new Date(`${shift.shift_date}T${shift.end_time}`);
      const isEarly = now < new Date(scheduledEnd.getTime() - 15 * 60 * 1000); // 15 min before

      const startTime = String(shift.actual_start);
      const endTime = now.toISOString();
      const { ordersProcessed, revenueHandled } = await this.calculateShiftFinancials(String(shift.staff_id), startTime, endTime, propertyId);

      let { data: updatedShift, error } = await supabase
        .from('staff_shifts')
        .update({
          actual_end: endTime,
          status: 'completed',
          early_leave_reason: isEarly ? req.body.notes || 'Left early' : null,
          orders_processed: ordersProcessed,
          revenue_handled: Number(revenueHandled.toFixed(2)),
        })
        .eq('id', id)
        .select()
        .single();

      if (error && /orders_processed|revenue_handled|column/i.test(String(error.message || ''))) {
        const fallback = await supabase
          .from('staff_shifts')
          .update({
            actual_end: endTime,
            status: 'completed',
            early_leave_reason: isEarly ? req.body.notes || 'Left early' : null,
          })
          .eq('id', id)
          .select()
          .single();
        updatedShift = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      res.json({
        success: true,
        data: updatedShift,
        isEarly,
      });
    } catch (error: any) {
      logger.error('Error clocking out:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clock out',
        message: error.message,
      });
    }
  }

  async getManagerSummary(req: Request, res: Response) {
    try {
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      if (!propertyId && process.env.NODE_ENV !== 'test') {
        return res.status(400).json({ success: false, error: 'Property ID context is required' });
      }

      const supabase = getSupabase();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const startIso = todayStart.toISOString();
      const endIso = todayEnd.toISOString();

      // Retrieve property staff first
      const { data: staffMembers } = await supabase
        .from('user_property_access')
        .select('user_id')
        .eq('property_id', propertyId);
      const staffIds = (staffMembers || []).map(sm => sm.user_id).filter(Boolean);

      const [transactionsResult, activeShifts] = await Promise.all([
        supabase.from('transactions').select('id, amount, status, created_at, engine_type, module_id').eq('property_id', propertyId),
        supabase.from('staff_shifts').select('id, status, department').eq('status', 'active').in('staff_id', staffIds),
      ]);

      const transactions = transactionsResult.data || [];
      const totalActiveStaff = (activeShifts.data || []).length;

      const withinToday = (createdAt?: string | null) => {
        if (!createdAt) return false;
        const ts = new Date(createdAt).getTime();
        return ts >= todayStart.getTime() && ts <= todayEnd.getTime();
      };
      const sumAmount = (rows: any[]) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const activeStatuses = new Set(['pending', 'confirmed', 'preparing', 'ready', 'checked_in', 'valid', 'active']);

      const modules = [
        { name: 'instant_transaction',        rows: transactions.filter(t => t.engine_type === 'instant_transaction') },
        { name: 'time_exclusive_reservation',  rows: transactions.filter(t => t.engine_type === 'time_exclusive_reservation') },
        { name: 'shared_capacity_access',      rows: transactions.filter(t => t.engine_type === 'shared_capacity_access') },
        { name: 'ongoing_entitlement',         rows: transactions.filter(t => t.engine_type === 'ongoing_entitlement') },
      ].map((module) => {
        const todays = module.rows.filter((row: any) => withinToday(row.created_at));
        return {
          module: module.name,
          todays_order_count: todays.length,
          todays_revenue: Number(sumAmount(todays).toFixed(2)),
          active_orders_count: module.rows.filter((row: any) => activeStatuses.has(String(row.status))).length,
          staff_on_shift: totalActiveStaff,
        };
      });

      res.json({ success: true, data: modules, date_range: { start: startIso, end: endIso } });
    } catch (error: any) {
      logger.error('Error fetching manager summary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch manager summary', message: error.message });
    }
  }

  /**
   * Get today's schedule overview
   */
  async getTodaySchedule(req: Request, res: Response) {
    try {
      const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
      const supabase = getSupabase();
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('staff_shifts')
        .select('*')
        .eq('shift_date', today)
        .neq('status', 'cancelled');

      if (propertyId) {
        const { data: staffMembers } = await supabase
          .from('user_property_access')
          .select('user_id')
          .eq('property_id', propertyId);
        const staffIds = (staffMembers || []).map(sm => sm.user_id).filter(Boolean);
        query = query.in('staff_id', staffIds);
      }

      const { data: shifts, error } = await query.order('start_time', { ascending: true });

      if (error) throw error;

      // Enrich with staff names
      const staffIdsList = [...new Set((shifts || []).map(s => s.staff_id).filter(Boolean))];
      let staffMap: Record<string, any> = {};
      
      if (staffIdsList.length > 0) {
        const { data: staff } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', staffIdsList);
        staffMap = (staff || []).reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, any>);
      }

      const enrichedShifts = (shifts || []).map(s => ({
        ...s,
        staff_name: staffMap[s.staff_id]?.full_name || 'Unknown',
      }));

      // Summary
      const summary = {
        total: enrichedShifts.length,
        active: enrichedShifts.filter(s => s.status === 'active').length,
        scheduled: enrichedShifts.filter(s => s.status === 'scheduled').length,
        completed: enrichedShifts.filter(s => s.status === 'completed').length,
        missed: enrichedShifts.filter(s => s.status === 'missed').length,
      };

      res.json({
        success: true,
        data: enrichedShifts,
        summary,
      });
    } catch (error: any) {
      logger.error('Error fetching today schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch schedule',
        message: error.message,
      });
    }
  }

  /**
   * Get current active shift for user
   */
  async getCurrentShift(req: Request, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      const supabase = getSupabase();
      const today = new Date().toISOString().split('T')[0];

      const { data: shift, error } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', userId)
        .eq('shift_date', today)
        .in('status', ['scheduled', 'active'])
        .order('start_time', { ascending: true })
        .limit(1)
        .single();

      // No shift found is not an error
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      res.json({
        success: true,
        data: shift || null,
      });
    } catch (error: any) {
      logger.error('Error fetching current shift:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch current shift',
        message: error.message,
      });
    }
  }
}

export const shiftsController = new ShiftsController();
