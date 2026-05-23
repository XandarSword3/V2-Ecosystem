import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/roleGuard.middleware.js';
import { z } from 'zod';
import {
  listTickets,
  getTicket,
  updateTicket,
  assignTicket,
  addInternalNote,
  escalateTicket,
  getTicketStats,
} from './support.controller.js';

const router = Router();

// -------------------------------------------------------
// Public — contact form (submit a ticket)
// -------------------------------------------------------
const contactFormSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  phone:    z.string().optional(),
  subject:  z.string().min(3).max(200),
  message:  z.string().min(10).max(5000),
  priority: z.enum(['low','normal','high','urgent']).default('normal'),
  tags:     z.array(z.string()).optional(),
});

const SLA_MINUTES: Record<string, number> = { urgent: 60, high: 240, normal: 1440, low: 4320 };
function computeSla(priority: string) {
  return new Date(Date.now() + (SLA_MINUTES[priority] ?? 1440) * 60 * 1000).toISOString();
}

router.post('/contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = contactFormSchema.parse(req.body);
    const supabase  = getSupabase();

    const { data: inquiry, error } = await supabase
      .from('support_inquiries')
      .insert({
        name:       validated.name,
        email:      validated.email,
        phone:      validated.phone ?? null,
        subject:    validated.subject,
        message:    validated.message,
        priority:   validated.priority,
        tags:       validated.tags ?? [],
        status:     'new',
        sla_due_at: computeSla(validated.priority),
      })
      .select()
      .single();

    if (error) { logger.error('Failed to store support inquiry:', error); throw error; }

    // Pull white-label settings
    let adminEmail: string | null = process.env.ADMIN_EMAIL ?? null;
    let siteName = 'Our Team';
    try {
      const { data: siteSettings } = await supabase
        .from('site_settings')
        .select('key, value');
      for (const s of siteSettings ?? []) {
        if (s.key === 'general' && s.value?.siteName) siteName = s.value.siteName;
        if (s.key === 'contact' && s.value?.email && !adminEmail) adminEmail = s.value.email;
      }
    } catch { /* non-fatal */ }

    // Notify admin
    try {
      if (adminEmail) {
        await emailService.sendEmail({
          to:      adminEmail,
          subject: `[${validated.priority.toUpperCase()}] New Support Ticket: ${validated.subject}`,
          html: `
            <h2>New Support Ticket</h2>
            <p><strong>From:</strong> ${validated.name} (${validated.email})</p>
            <p><strong>Priority:</strong> ${validated.priority}</p>
            <p><strong>Subject:</strong> ${validated.subject}</p>
            <hr>
            <p>${validated.message.replace(/\n/g, '<br>')}</p>
            <p><small>SLA due: ${computeSla(validated.priority)}</small></p>
          `,
        });
      }
    } catch (e) { logger.warn('Admin notification email failed:', e); }

    // Confirm to user
    try {
      await emailService.sendEmail({
        to:      validated.email,
        subject: `We received your message — ${siteName}`,
        html: `
          <h2>Thank you, ${validated.name}!</h2>
          <p>Your support request has been received (ticket #${inquiry.id}).</p>
          <p>We aim to respond within ${SLA_MINUTES[validated.priority] / 60} hour(s).</p>
          <hr>
          <p><strong>Subject:</strong> ${validated.subject}</p>
          <p>${validated.message.replace(/\n/g, '<br>')}</p>
          <p>Best regards,<br>${siteName}</p>
        `,
      });
    } catch (e) { logger.warn('Confirmation email failed:', e); }

    res.status(201).json({
      success: true,
      data:    { id: inquiry.id },
      message: 'Your message has been received. We will get back to you soon.',
    });
  } catch (err: unknown) {
    const e = err as Error & { name?: string; errors?: unknown };
    if (e.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid form data', details: e.errors });
    }
    next(err);
  }
});

// -------------------------------------------------------
// Public — FAQs
// -------------------------------------------------------
router.get('/faq', asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data: faqs, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  res.json({ success: true, data: faqs ?? [] });
}));

// -------------------------------------------------------
// Staff/Admin — ticket management (authenticated)
// -------------------------------------------------------
const staffRoles = ['admin', 'super_admin', 'manager', 'staff'];

router.get(   '/tickets',              authenticate, requireRole(staffRoles), asyncHandler(listTickets));
router.get(   '/tickets/stats',        authenticate, requireRole(staffRoles), asyncHandler(getTicketStats));
router.get(   '/tickets/:id',          authenticate, requireRole(staffRoles), asyncHandler(getTicket));
router.patch( '/tickets/:id',          authenticate, requireRole(staffRoles), asyncHandler(updateTicket));
router.post(  '/tickets/:id/assign',   authenticate, requireRole(staffRoles), asyncHandler(assignTicket));
router.post(  '/tickets/:id/escalate', authenticate, requireRole(staffRoles), asyncHandler(escalateTicket));
router.post(  '/tickets/:id/notes',    authenticate, requireRole(staffRoles), asyncHandler(addInternalNote));

export default router;
