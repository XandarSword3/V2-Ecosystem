/**
 * Support Service with Dependency Injection
 *
 * Handles support inquiries (contact forms) and FAQs.
 * Uses DI for repository and email service, enabling easy testing.
 */

import type {
  SupportRepository,
  SupportInquiry,
  SupportInquiryStatus,
  FAQ,
  EmailService,
  LoggerService,
  ActivityLoggerService,
} from '../container/types.js';

// ============================================
// ERROR HANDLING
// ============================================

export class SupportServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SupportServiceError';
  }
}

// ============================================
// INPUT TYPES
// ============================================

export interface ContactFormInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface CreateFAQInput {
  question: string;
  answer: string;
  category?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface UpdateFAQInput {
  question?: string;
  answer?: string;
  category?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface SupportService {
  // Contact/Inquiry operations
  submitContactForm(input: ContactFormInput): Promise<SupportInquiry>;
  getInquiries(filters?: { status?: SupportInquiryStatus }): Promise<SupportInquiry[]>;
  getInquiryById(id: string): Promise<SupportInquiry | null>;
  updateInquiryStatus(id: string, status: SupportInquiryStatus, userId?: string): Promise<SupportInquiry>;
  
  // FAQ operations
  getPublishedFAQs(): Promise<FAQ[]>;
  getFAQById(id: string): Promise<FAQ | null>;
  createFAQ(input: CreateFAQInput, userId?: string): Promise<FAQ>;
  updateFAQ(id: string, input: UpdateFAQInput, userId?: string): Promise<FAQ>;
  deleteFAQ(id: string, userId?: string): Promise<void>;
}

// ============================================
// DEPENDENCIES
// ============================================

export interface SupportServiceDeps {
  supportRepository: SupportRepository;
  emailService?: EmailService;
  logger: LoggerService;
  activityLogger?: ActivityLoggerService;
  adminEmail?: string;
}

// ============================================
// VALIDATION
// ============================================

function validateContactForm(input: ContactFormInput): void {
  if (!input.name || input.name.trim().length < 2) {
    throw new SupportServiceError('Name must be at least 2 characters', 'INVALID_NAME');
  }
  if (input.name.length > 100) {
    throw new SupportServiceError('Name must be at most 100 characters', 'INVALID_NAME');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.email || !emailRegex.test(input.email)) {
    throw new SupportServiceError('Valid email is required', 'INVALID_EMAIL');
  }
  
  if (!input.subject || input.subject.trim().length < 3) {
    throw new SupportServiceError('Subject must be at least 3 characters', 'INVALID_SUBJECT');
  }
  if (input.subject.length > 200) {
    throw new SupportServiceError('Subject must be at most 200 characters', 'INVALID_SUBJECT');
  }
  
  if (!input.message || input.message.trim().length < 10) {
    throw new SupportServiceError('Message must be at least 10 characters', 'INVALID_MESSAGE');
  }
  if (input.message.length > 2000) {
    throw new SupportServiceError('Message must be at most 2000 characters', 'INVALID_MESSAGE');
  }
}

function validateFAQInput(input: CreateFAQInput | UpdateFAQInput): void {
  if ('question' in input && input.question !== undefined) {
    if (input.question.trim().length < 5) {
      throw new SupportServiceError('Question must be at least 5 characters', 'INVALID_QUESTION');
    }
    if (input.question.length > 500) {
      throw new SupportServiceError('Question must be at most 500 characters', 'INVALID_QUESTION');
    }
  }
  
  if ('answer' in input && input.answer !== undefined) {
    if (input.answer.trim().length < 10) {
      throw new SupportServiceError('Answer must be at least 10 characters', 'INVALID_ANSWER');
    }
    if (input.answer.length > 5000) {
      throw new SupportServiceError('Answer must be at most 5000 characters', 'INVALID_ANSWER');
    }
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createSupportService(deps: SupportServiceDeps): SupportService {
  const { supportRepository, emailService, logger, activityLogger, adminEmail } = deps;

  // ----------------------------------------
  // CONTACT/INQUIRY OPERATIONS
  // ----------------------------------------

  async function submitContactForm(input: ContactFormInput): Promise<SupportInquiry> {
    validateContactForm(input);

    const inquiry = await supportRepository.createInquiry({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: 'new',
      assigned_to: null,
      resolved_at: null,
    });

    logger.info(`Contact form submitted: ${inquiry.id} from ${input.email}`);

    // Send admin notification (async, don't await)
    if (emailService) {
      const notifyEmail = adminEmail || 'admin@v2resort.com';
      emailService.sendEmail({
        to: notifyEmail,
        subject: `New Contact Form: ${input.subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${input.name} (${input.email})</p>
          <p><strong>Phone:</strong> ${input.phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${input.subject}</p>
          <hr>
          <p><strong>Message:</strong></p>
          <p>${input.message.replace(/\n/g, '<br>')}</p>
        `,
      }).catch(err => {
        logger.warn('Failed to send admin notification:', err);
      });

      // Send confirmation to user
      emailService.sendEmail({
        to: input.email,
        subject: 'Thank you for contacting V2 Resort',
        html: `
          <h2>Thank you for reaching out!</h2>
          <p>Dear ${input.name},</p>
          <p>We have received your message and will get back to you as soon as possible.</p>
          <p><strong>Subject:</strong> ${input.subject}</p>
          <p>Best regards,<br>V2 Resort Team</p>
        `,
      }).catch(err => {
        logger.warn('Failed to send confirmation email:', err);
      });
    }

    if (activityLogger) {
      await activityLogger.log('support_inquiry_created', {
        inquiryId: inquiry.id,
        subject: input.subject,
        email: input.email,
      });
    }

    return inquiry;
  }

  async function getInquiries(filters?: { status?: SupportInquiryStatus }): Promise<SupportInquiry[]> {
    return supportRepository.getInquiries(filters);
  }

  async function getInquiryById(id: string): Promise<SupportInquiry | null> {
    return supportRepository.getInquiryById(id);
  }

  async function updateInquiryStatus(
    id: string,
    status: SupportInquiryStatus,
    userId?: string
  ): Promise<SupportInquiry> {
    const inquiry = await supportRepository.getInquiryById(id);
    if (!inquiry) {
      throw new SupportServiceError('Inquiry not found', 'INQUIRY_NOT_FOUND', 404);
    }

    const validStatuses: SupportInquiryStatus[] = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new SupportServiceError('Invalid status', 'INVALID_STATUS');
    }

    const updated = await supportRepository.updateInquiryStatus(id, status);

    logger.info(`Inquiry ${id} status updated to ${status}`);

    if (activityLogger) {
      await activityLogger.log('support_inquiry_status_updated', {
        inquiryId: id,
        oldStatus: inquiry.status,
        newStatus: status,
      }, userId);
    }

    return updated;
  }

  // ----------------------------------------
  // FAQ OPERATIONS
  // ----------------------------------------

  async function getPublishedFAQs(): Promise<FAQ[]> {
    return supportRepository.getPublishedFAQs();
  }

  async function getFAQById(id: string): Promise<FAQ | null> {
    return supportRepository.getFAQById(id);
  }

  async function createFAQ(input: CreateFAQInput, userId?: string): Promise<FAQ> {
    validateFAQInput(input);

    const faq = await supportRepository.createFAQ({
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      is_published: input.isPublished ?? false,
    });

    logger.info(`FAQ created: ${faq.id}`);

    if (activityLogger) {
      await activityLogger.log('faq_created', {
        faqId: faq.id,
        question: input.question,
      }, userId);
    }

    return faq;
  }

  async function updateFAQ(id: string, input: UpdateFAQInput, userId?: string): Promise<FAQ> {
    const existing = await supportRepository.getFAQById(id);
    if (!existing) {
      throw new SupportServiceError('FAQ not found', 'FAQ_NOT_FOUND', 404);
    }

    validateFAQInput(input);

    const updateData: Partial<FAQ> = {};
    if (input.question !== undefined) updateData.question = input.question.trim();
    if (input.answer !== undefined) updateData.answer = input.answer.trim();
    if (input.category !== undefined) updateData.category = input.category.trim() || null;
    if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
    if (input.isPublished !== undefined) updateData.is_published = input.isPublished;

    const updated = await supportRepository.updateFAQ(id, updateData);

    logger.info(`FAQ updated: ${id}`);

    if (activityLogger) {
      await activityLogger.log('faq_updated', {
        faqId: id,
        changes: Object.keys(updateData),
      }, userId);
    }

    return updated;
  }

  async function deleteFAQ(id: string, userId?: string): Promise<void> {
    const existing = await supportRepository.getFAQById(id);
    if (!existing) {
      throw new SupportServiceError('FAQ not found', 'FAQ_NOT_FOUND', 404);
    }

    await supportRepository.deleteFAQ(id);

    logger.info(`FAQ deleted: ${id}`);

    if (activityLogger) {
      await activityLogger.log('faq_deleted', {
        faqId: id,
        question: existing.question,
      }, userId);
    }
  }

  return {
    submitContactForm,
    getInquiries,
    getInquiryById,
    updateInquiryStatus,
    getPublishedFAQs,
    getFAQById,
    createFAQ,
    updateFAQ,
    deleteFAQ,
  };
}
