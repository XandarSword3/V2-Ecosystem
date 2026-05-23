import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// -------------------------------------------------------
// Validation schemas
// -------------------------------------------------------

const createTicketSchema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email(),
  phone:   z.string().optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  tags:    z.array(z.string()).optional(),
});

const updateTicketSchema = z.object({
  status:      z.enum(['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
  priority:    z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  tags:        z.array(z.string()).optional(),
});

const addNoteSchema = z.object({
  note:       z.string().min(1).max(5000),
  is_private: z.boolean().default(true),
});

// SLA minutes by priority
const SLA_MINUTES: Record<string, number> = {
  urgent: 60,
  high:   240,
  normal: 1440,  // 24 h
  low:    4320,  // 72 h
};

function computeSla(priority: string): string {
  const minutes = SLA_MINUTES[priority] ?? SLA_MINUTES.normal;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// -------------------------------------------------------
// Admin — list all tickets
// -------------------------------------------------------
export async function listTickets(req: Request, res: Response) {
  try {
    const supabase = getSupabase();
    const {
      status, priority, assigned_to,
      limit = '50', offset = '0',
      overdue,
    } = req.query as Record<string, string | undefined>;

    let q = supabase
      .from('support_inquiries')
      .select(`
        id, name, email, phone, subject, message, status, priority,
        assigned_to, resolved_at, closed_at, sla_due_at, tags,
        created_at, updated_at,
        assignee:users!assigned_to(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status)      q = q.eq('status', status);
    if (priority)    q = q.eq('priority', priority);
    if (assigned_to) q = q.eq('assigned_to', assigned_to);
    if (overdue === 'true') {
      q = q.lt('sla_due_at', new Date().toISOString()).is('resolved_at', null);
    }

    const { data, error } = await q;
    if (error) throw error;

    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    logger.error('listTickets error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
}

// -------------------------------------------------------
// Admin — get single ticket with full history
// -------------------------------------------------------
export async function getTicket(req: Request, res: Response) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('support_inquiries')
      .select(`
        id, name, email, phone, subject, message, status, priority,
        assigned_to, resolved_at, closed_at, sla_due_at, tags,
        internal_notes, created_at, updated_at,
        assignee:users!assigned_to(id, full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Ticket not found' });

    // Flag if SLA breached
    const slaBreached = data.sla_due_at && !data.resolved_at
      ? new Date(data.sla_due_at) < new Date()
      : false;

    res.json({ success: true, data: { ...data, sla_breached: slaBreached } });
  } catch (err) {
    logger.error('getTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
  }
}

// -------------------------------------------------------
// Admin — update ticket status / priority / assignment
// -------------------------------------------------------
export async function updateTicket(req: Request, res: Response) {
  try {
    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
    }

    const supabase = getSupabase();
    const { id } = req.params;
    const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

    // Auto-set resolved_at / closed_at timestamps
    if (parsed.data.status === 'resolved' && !patch.resolved_at) patch.resolved_at = new Date().toISOString();
    if (parsed.data.status === 'closed'   && !patch.closed_at)   patch.closed_at   = new Date().toISOString();

    // Recompute SLA when priority changes
    if (parsed.data.priority) patch.sla_due_at = computeSla(parsed.data.priority);

    const { data, error } = await supabase
      .from('support_inquiries')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user!.userId,
      action: 'SUPPORT_TICKET_UPDATED',
      resource: 'support_inquiries',
      resource_id: id,
      new_value: JSON.stringify(patch),
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('updateTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to update ticket' });
  }
}

// -------------------------------------------------------
// Admin — assign ticket to a staff member
// -------------------------------------------------------
export async function assignTicket(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { staff_id } = req.body;

    if (!staff_id || typeof staff_id !== 'string') {
      return res.status(400).json({ success: false, error: 'staff_id is required' });
    }

    const supabase = getSupabase();

    // Verify staff exists
    const { data: staff } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', staff_id)
      .single();

    if (!staff) return res.status(404).json({ success: false, error: 'Staff member not found' });

    const { data, error } = await supabase
      .from('support_inquiries')
      .update({
        assigned_to: staff_id,
        status:      'in_progress',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id:     req.user!.userId,
      action:      'SUPPORT_TICKET_ASSIGNED',
      resource:    'support_inquiries',
      resource_id: id,
      new_value:   JSON.stringify({ assigned_to: staff_id, staff_name: staff.full_name }),
      created_at:  new Date().toISOString(),
    });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('assignTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign ticket' });
  }
}

// -------------------------------------------------------
// Admin — add internal note
// -------------------------------------------------------
export async function addInternalNote(req: Request, res: Response) {
  try {
    const parsed = addNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid input' });
    }

    const supabase = getSupabase();
    const { id } = req.params;

    const { data: ticket, error: fetchErr } = await supabase
      .from('support_inquiries')
      .select('internal_notes')
      .eq('id', id)
      .single();

    if (fetchErr || !ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const existing: unknown[] = Array.isArray(ticket.internal_notes) ? ticket.internal_notes : [];
    const newNote = {
      id:         crypto.randomUUID(),
      author_id:  req.user!.userId,
      note:       parsed.data.note,
      is_private: parsed.data.is_private,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('support_inquiries')
      .update({
        internal_notes: [...existing, newNote],
        updated_at:     new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: newNote });
  } catch (err) {
    logger.error('addInternalNote error:', err);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
}

// -------------------------------------------------------
// Admin — escalate ticket
// -------------------------------------------------------
export async function escalateTicket(req: Request, res: Response) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: ticket } = await supabase
      .from('support_inquiries')
      .select('priority, status')
      .eq('id', id)
      .single();

    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const escalatedPriority =
      ticket.priority === 'low'    ? 'normal' :
      ticket.priority === 'normal' ? 'high'   :
      ticket.priority === 'high'   ? 'urgent' :
                                     'urgent';

    const { data, error } = await supabase
      .from('support_inquiries')
      .update({
        priority:   escalatedPriority,
        status:     'open',
        sla_due_at: computeSla(escalatedPriority),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id:     req.user!.userId,
      action:      'SUPPORT_TICKET_ESCALATED',
      resource:    'support_inquiries',
      resource_id: id,
      new_value:   JSON.stringify({ from: ticket.priority, to: escalatedPriority }),
      created_at:  new Date().toISOString(),
    });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('escalateTicket error:', err);
    res.status(500).json({ success: false, error: 'Failed to escalate ticket' });
  }
}

// -------------------------------------------------------
// Admin — dashboard stats
// -------------------------------------------------------
export async function getTicketStats(req: Request, res: Response) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('support_inquiries')
      .select('status, priority, sla_due_at, resolved_at');

    if (error) throw error;

    const rows = data ?? [];
    const now   = new Date();

    const stats = {
      total:       rows.length,
      by_status:   {} as Record<string, number>,
      by_priority: {} as Record<string, number>,
      sla_breached: rows.filter(r => r.sla_due_at && !r.resolved_at && new Date(r.sla_due_at) < now).length,
      resolved_today: rows.filter(r => {
        if (!r.resolved_at) return false;
        const d = new Date(r.resolved_at);
        return d.toDateString() === now.toDateString();
      }).length,
    };

    for (const row of rows) {
      stats.by_status[row.status]     = (stats.by_status[row.status]     ?? 0) + 1;
      stats.by_priority[row.priority] = (stats.by_priority[row.priority] ?? 0) + 1;
    }

    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('getTicketStats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
}
