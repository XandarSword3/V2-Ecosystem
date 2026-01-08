import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../database/connection';
import { emailService } from '../../services/email.service';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const router = Router();

// Contact form validation schema
const contactFormSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(2000),
});

// Submit contact form
router.post('/contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = contactFormSchema.parse(req.body);
    const supabase = getSupabase();

    // Store in database
    const { data: inquiry, error } = await supabase
      .from('support_inquiries')
      .insert({
        name: validated.name,
        email: validated.email,
        phone: validated.phone || null,
        subject: validated.subject,
        message: validated.message,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to store support inquiry:', error);
      throw error;
    }

    // Send notification email to admin
    try {
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@v2resort.com',
        subject: `New Contact Form Submission: ${validated.subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${validated.name} (${validated.email})</p>
          <p><strong>Phone:</strong> ${validated.phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${validated.subject}</p>
          <hr>
          <p><strong>Message:</strong></p>
          <p>${validated.message.replace(/\n/g, '<br>')}</p>
        `,
      });
    } catch (emailError) {
      logger.warn('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    // Send confirmation email to user
    try {
      await emailService.sendEmail({
        to: validated.email,
        subject: 'Thank you for contacting V2 Resort',
        html: `
          <h2>Thank you for reaching out!</h2>
          <p>Dear ${validated.name},</p>
          <p>We have received your message and will get back to you as soon as possible.</p>
          <p>Here's a copy of your inquiry:</p>
          <hr>
          <p><strong>Subject:</strong> ${validated.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${validated.message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p>Best regards,<br>V2 Resort Team</p>
        `,
      });
    } catch (emailError) {
      logger.warn('Failed to send confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      data: { id: inquiry.id },
      message: 'Your message has been received. We will get back to you soon.',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid form data',
        details: error.errors,
      });
    }
    next(error);
  }
});

// Get FAQs
router.get('/faq', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabase();

    const { data: faqs, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: faqs || [] });
  } catch (error) {
    next(error);
  }
});

export default router;
