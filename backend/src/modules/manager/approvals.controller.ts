import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';
import { getIO } from '../../socket/index.js';

// Validation schemas
const createApprovalSchema = z.object({
  type: z.enum(['refund', 'discount', 'void', 'override', 'price_adjustment', 'comp']),
  amount: z.number().optional(),
  originalAmount: z.number().optional(),
  percentage: z.number().min(0).max(100).optional(),
  description: z.string().min(1).max(500),
  reason: z.string().max(1000).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

const reviewApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).optional(),
});

export class ApprovalsController {
  /**
   * Get all pending approvals for managers
   */
  async getPendingApprovals(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const { page = '1', limit = '20', type } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let query = supabase
        .from('manager_approvals')
        .select('*', { count: 'exact' })
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (type) {
        query = query.eq('type', type as string);
      }

      const { data: approvals, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Enrich with user names
      const userIds = [...new Set((approvals || []).map(a => a.requested_by).filter(Boolean))];
      let usersMap: Record<string, any> = {};
      
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds);
        usersMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      }

      const enrichedApprovals = (approvals || []).map(a => ({
        ...a,
        requested_by_name: usersMap[a.requested_by]?.full_name || 'Unknown',
        requested_by_email: usersMap[a.requested_by]?.email,
      }));

      res.json({
        success: true,
        data: enrichedApprovals,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching pending approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approvals',
        message: error.message,
      });
    }
  }

  /**
   * Get all approvals with filters (history)
   */
  async getApprovals(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const { page = '1', limit = '20', status, type, requestedBy, startDate, endDate } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let query = supabase
        .from('manager_approvals')
        .select('*', { count: 'exact' });

      if (status) query = query.eq('status', status as string);
      if (type) query = query.eq('type', type as string);
      if (requestedBy) query = query.eq('requested_by', requestedBy as string);
      if (startDate) query = query.gte('created_at', startDate as string);
      if (endDate) query = query.lte('created_at', endDate as string);

      const { data: approvals, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Enrich with user names
      const requestedByIds = [...new Set((approvals || []).map(a => a.requested_by).filter(Boolean))];
      const reviewedByIds = [...new Set((approvals || []).map(a => a.reviewed_by).filter(Boolean))];
      const allUserIds = [...new Set([...requestedByIds, ...reviewedByIds])];

      let usersMap: Record<string, any> = {};
      if (allUserIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', allUserIds);
        usersMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {} as Record<string, any>);
      }

      const enrichedApprovals = (approvals || []).map(a => ({
        ...a,
        requested_by_name: usersMap[a.requested_by]?.full_name || 'Unknown',
        reviewed_by_name: a.reviewed_by ? (usersMap[a.reviewed_by]?.full_name || 'Unknown') : null,
      }));

      res.json({
        success: true,
        data: enrichedApprovals,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approvals',
        message: error.message,
      });
    }
  }

  /**
   * Create an approval request (staff)
   */
  async createApproval(req: Request, res: Response) {
    try {
      const validation = createApprovalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const supabase = getSupabase();

      const { data: approval, error } = await supabase
        .from('manager_approvals')
        .insert({
          type: data.type,
          amount: data.amount,
          original_amount: data.originalAmount,
          percentage: data.percentage,
          description: data.description,
          reason: data.reason,
          reference_type: data.referenceType,
          reference_id: data.referenceId,
          requested_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Notify managers via socket
      const io = getIO();
      if (io) {
        // Get requester name
        const { data: requester } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', userId)
          .single();

        io.to('role:admin').to('role:super_admin').to('role:manager').emit('approval:new', {
          approval: {
            ...approval,
            requested_by_name: requester?.full_name || 'Staff Member',
          },
        });
      }

      res.status(201).json({
        success: true,
        data: approval,
      });
    } catch (error: any) {
      logger.error('Error creating approval request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create approval request',
        message: error.message,
      });
    }
  }

  /**
   * Review (approve/reject) an approval request
   */
  async reviewApproval(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = reviewApprovalSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { status, notes } = validation.data;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const supabase = getSupabase();

      // Check if approval exists and is pending
      const { data: existing, error: fetchError } = await supabase
        .from('manager_approvals')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({
          success: false,
          error: 'Approval request not found',
        });
      }

      if (existing.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: 'Approval has already been reviewed',
        });
      }

      // Update approval
      const { data: approval, error } = await supabase
        .from('manager_approvals')
        .update({
          status,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If approved, apply the action
      if (status === 'approved') {
        await this.applyApprovalAction(approval);
      }

      // Notify the requester via socket
      const io = getIO();
      if (io) {
        io.to(`user:${existing.requested_by}`).emit('approval:reviewed', {
          approval,
          status,
        });
      }

      res.json({
        success: true,
        data: approval,
      });
    } catch (error: any) {
      logger.error('Error reviewing approval:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to review approval',
        message: error.message,
      });
    }
  }

  /**
   * Apply the approved action (refund, discount, etc.)
   */
  private async applyApprovalAction(approval: any) {
    const supabase = getSupabase();

    try {
      switch (approval.type) {
        case 'refund':
          // Update order payment status
          if (approval.reference_type === 'restaurant_order') {
            await supabase
              .from('restaurant_orders')
              .update({ 
                payment_status: 'refunded',
                refund_amount: approval.amount,
                refund_approved_at: new Date().toISOString(),
              })
              .eq('id', approval.reference_id);
          }
          break;

        case 'void':
          // Cancel the order
          if (approval.reference_type === 'restaurant_order') {
            await supabase
              .from('restaurant_orders')
              .update({ 
                status: 'cancelled',
                cancellation_reason: approval.description,
                cancelled_at: new Date().toISOString(),
              })
              .eq('id', approval.reference_id);
          }
          break;

        case 'discount':
        case 'price_adjustment':
          // Log the discount applied
          if (approval.reference_id) {
            await supabase
              .from('audit_logs')
              .insert({
                user_id: approval.reviewed_by,
                action: `${approval.type}_applied`,
                resource: approval.reference_type,
                resource_id: approval.reference_id,
                details: {
                  amount: approval.amount,
                  percentage: approval.percentage,
                  original_amount: approval.original_amount,
                  approval_id: approval.id,
                },
              });
          }
          break;

        case 'comp':
          // Mark order as comped
          if (approval.reference_type === 'restaurant_order') {
            await supabase
              .from('restaurant_orders')
              .update({ 
                payment_status: 'comped',
                comp_reason: approval.description,
                comped_at: new Date().toISOString(),
              })
              .eq('id', approval.reference_id);
          }
          break;
      }

      logger.info(`Approval action applied: ${approval.type} for ${approval.reference_type}:${approval.reference_id}`);
    } catch (error: any) {
      logger.error('Error applying approval action:', error.message);
      // Don't throw - approval is still recorded even if action fails
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get counts by status
      const { data: statusCounts } = await supabase
        .from('manager_approvals')
        .select('status')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Get counts by type
      const { data: typeCounts } = await supabase
        .from('manager_approvals')
        .select('type, amount')
        .eq('status', 'approved')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const summary = {
        total: statusCounts?.length || 0,
        pending: statusCounts?.filter(s => s.status === 'pending').length || 0,
        approved: statusCounts?.filter(s => s.status === 'approved').length || 0,
        rejected: statusCounts?.filter(s => s.status === 'rejected').length || 0,
        byType: {} as Record<string, { count: number; totalAmount: number }>,
      };

      (typeCounts || []).forEach(t => {
        if (!summary.byType[t.type]) {
          summary.byType[t.type] = { count: 0, totalAmount: 0 };
        }
        summary.byType[t.type].count++;
        summary.byType[t.type].totalAmount += t.amount || 0;
      });

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Error fetching approval stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approval statistics',
        message: error.message,
      });
    }
  }
}

export const approvalsController = new ApprovalsController();
