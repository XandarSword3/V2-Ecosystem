/**
 * Support Service Unit Tests
 *
 * Tests for the DI-based SupportService with Vitest chainable Supabase mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSupportService,
  SupportService,
  SupportServiceError,
  ContactFormInput,
  CreateFAQInput,
  UpdateFAQInput,
} from '../../src/lib/services/support.service.js';
import type {
  LoggerService,
  ActivityLoggerService,
  EmailService,
  SupportRepository,
  SupportInquiry,
  SupportInquiryStatus,
  FAQ,
} from '../../src/lib/container/types.js';

// ============================================
// CHAINABLE SUPABASE MOCK PATTERN
// ============================================

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// ============================================
// MOCK DATA
// ============================================

const mockInquiry: SupportInquiry = {
  id: 'inquiry-1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1-555-1234',
  subject: 'General Inquiry',
  message: 'I have a question about your services.',
  status: 'new' as SupportInquiryStatus,
  assigned_to: null,
  resolved_at: null,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
};

const mockFAQ: FAQ = {
  id: 'faq-1',
  question: 'What are the check-in hours?',
  answer: 'Check-in is available from 3:00 PM onwards.',
  category: 'General',
  sort_order: 1,
  is_published: true,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
};

// ============================================
// TEST SUITE
// ============================================

describe('SupportService', () => {
  let supportService: SupportService;
  let mockRepository: SupportRepository;
  let mockLogger: LoggerService;
  let mockActivityLogger: ActivityLoggerService;
  let mockEmailService: EmailService;

  // Storage for repository mock data
  let inquiriesStore: SupportInquiry[] = [];
  let faqsStore: FAQ[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    inquiriesStore = [];
    faqsStore = [];

    // Create query mocks for tables
    const inquiriesQueryMock = createQueryMock(() => inquiriesStore);
    const faqsQueryMock = createQueryMock(() => faqsStore);

    // Mock repository with chainable Supabase-style methods
    mockRepository = {
      createInquiry: vi.fn().mockImplementation(async (data) => {
        const newInquiry: SupportInquiry = {
          id: `inquiry-${Date.now()}`,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inquiriesStore.push(newInquiry);
        return newInquiry;
      }),
      getInquiries: vi.fn().mockImplementation(async (filters) => {
        let results = [...inquiriesStore];
        if (filters?.status) {
          results = results.filter(i => i.status === filters.status);
        }
        return results;
      }),
      getInquiryById: vi.fn().mockImplementation(async (id) => {
        const inquiry = inquiriesStore.find(i => i.id === id);
        return inquiry ? { ...inquiry } : null;  // Return a copy to prevent mutation issues
      }),
      updateInquiryStatus: vi.fn().mockImplementation(async (id, status) => {
        const inquiry = inquiriesStore.find(i => i.id === id);
        if (inquiry) {
          inquiry.status = status;
          inquiry.updated_at = new Date().toISOString();
          if (status === 'resolved') {
            inquiry.resolved_at = new Date().toISOString();
          }
        }
        return inquiry!;
      }),
      getPublishedFAQs: vi.fn().mockImplementation(async () => {
        return faqsStore.filter(f => f.is_published).sort((a, b) => a.sort_order - b.sort_order);
      }),
      getFAQById: vi.fn().mockImplementation(async (id) => {
        return faqsStore.find(f => f.id === id) || null;
      }),
      createFAQ: vi.fn().mockImplementation(async (data) => {
        const newFAQ: FAQ = {
          id: `faq-${Date.now()}`,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        faqsStore.push(newFAQ);
        return newFAQ;
      }),
      updateFAQ: vi.fn().mockImplementation(async (id, data) => {
        const faq = faqsStore.find(f => f.id === id);
        if (faq) {
          Object.assign(faq, data, { updated_at: new Date().toISOString() });
        }
        return faq!;
      }),
      deleteFAQ: vi.fn().mockImplementation(async (id) => {
        const index = faqsStore.findIndex(f => f.id === id);
        if (index !== -1) {
          faqsStore.splice(index, 1);
        }
      }),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockActivityLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue(true),
      sendTemplatedEmail: vi.fn().mockResolvedValue(true),
      sendPoolTicketConfirmation: vi.fn().mockResolvedValue(true),
      sendBookingConfirmation: vi.fn().mockResolvedValue(true),
      sendOrderConfirmation: vi.fn().mockResolvedValue(true),
    };

    supportService = createSupportService({
      supportRepository: mockRepository,
      emailService: mockEmailService,
      logger: mockLogger,
      activityLogger: mockActivityLogger,
      adminEmail: 'admin@test.com',
    });
  });

  // ============================================
  // Contact Form / Inquiry Tests
  // ============================================

  describe('submitContactForm', () => {
    const validInput: ContactFormInput = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1-555-1234',
      subject: 'General Inquiry',
      message: 'I have a question about your services.',
    };

    it('should submit contact form successfully', async () => {
      const inquiry = await supportService.submitContactForm(validInput);

      expect(inquiry.id).toBeDefined();
      expect(inquiry.name).toBe('John Doe');
      expect(inquiry.email).toBe('john@example.com');
      expect(inquiry.phone).toBe('+1-555-1234');
      expect(inquiry.subject).toBe('General Inquiry');
      expect(inquiry.message).toBe('I have a question about your services.');
      expect(inquiry.status).toBe('new');
    });

    it('should call repository createInquiry with correct data', async () => {
      await supportService.submitContactForm(validInput);

      expect(mockRepository.createInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-1234',
          subject: 'General Inquiry',
          message: 'I have a question about your services.',
          status: 'new',
        })
      );
    });

    it('should normalize email to lowercase', async () => {
      const inquiry = await supportService.submitContactForm({
        ...validInput,
        email: 'JOHN@EXAMPLE.COM',
      });

      expect(inquiry.email).toBe('john@example.com');
    });

    it('should trim whitespace from fields', async () => {
      const inquiry = await supportService.submitContactForm({
        ...validInput,
        name: '  John Doe  ',
        subject: '  General Inquiry  ',
        message: '  I have a question about your services.  ',
      });

      expect(inquiry.name).toBe('John Doe');
      expect(inquiry.subject).toBe('General Inquiry');
      expect(inquiry.message).toBe('I have a question about your services.');
    });

    it('should handle missing phone number', async () => {
      const inquiry = await supportService.submitContactForm({
        ...validInput,
        phone: undefined,
      });

      expect(inquiry.phone).toBeNull();
    });

    it('should send admin notification email', async () => {
      await supportService.submitContactForm(validInput);

      // Wait for async email
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
          subject: expect.stringContaining('General Inquiry'),
        })
      );
    });

    it('should send confirmation email to user', async () => {
      await supportService.submitContactForm(validInput);

      // Wait for async email
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: 'Thank you for contacting V2 Resort',
        })
      );
    });

    it('should use default admin email when not configured', async () => {
      const serviceWithoutAdmin = createSupportService({
        supportRepository: mockRepository,
        emailService: mockEmailService,
        logger: mockLogger,
      });

      await serviceWithoutAdmin.submitContactForm(validInput);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@v2resort.com',
        })
      );
    });

    it('should handle email sending failures gracefully', async () => {
      mockEmailService.sendEmail = vi.fn().mockRejectedValue(new Error('Email failed'));

      const inquiry = await supportService.submitContactForm(validInput);

      expect(inquiry.id).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log activity', async () => {
      await supportService.submitContactForm(validInput);

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'support_inquiry_created',
        expect.objectContaining({
          email: 'john@example.com',
          subject: 'General Inquiry',
        })
      );
    });

    it('should work without activity logger', async () => {
      const serviceWithoutActivityLogger = createSupportService({
        supportRepository: mockRepository,
        logger: mockLogger,
      });

      const inquiry = await serviceWithoutActivityLogger.submitContactForm(validInput);
      expect(inquiry.id).toBeDefined();
    });

    it('should work without email service', async () => {
      const serviceWithoutEmail = createSupportService({
        supportRepository: mockRepository,
        logger: mockLogger,
      });

      const inquiry = await serviceWithoutEmail.submitContactForm(validInput);
      expect(inquiry.id).toBeDefined();
    });

    // Validation tests
    it('should throw error for name too short', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, name: 'J' })
      ).rejects.toThrow(SupportServiceError);
      
      try {
        await supportService.submitContactForm({ ...validInput, name: 'J' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_NAME');
      }
    });

    it('should throw error for name too long', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, name: 'A'.repeat(101) })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for empty name', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, name: '' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for invalid email', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, email: 'invalid-email' })
      ).rejects.toThrow(SupportServiceError);
      
      try {
        await supportService.submitContactForm({ ...validInput, email: 'invalid' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_EMAIL');
      }
    });

    it('should throw error for missing email', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, email: '' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for subject too short', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, subject: 'Hi' })
      ).rejects.toThrow(SupportServiceError);
      
      try {
        await supportService.submitContactForm({ ...validInput, subject: 'Hi' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_SUBJECT');
      }
    });

    it('should throw error for subject too long', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, subject: 'A'.repeat(201) })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for message too short', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, message: 'Short' })
      ).rejects.toThrow(SupportServiceError);
      
      try {
        await supportService.submitContactForm({ ...validInput, message: 'Hi' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_MESSAGE');
      }
    });

    it('should throw error for message too long', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, message: 'A'.repeat(2001) })
      ).rejects.toThrow(SupportServiceError);
    });
  });

  // ============================================
  // getInquiries Tests
  // ============================================

  describe('getInquiries', () => {
    it('should return all inquiries', async () => {
      // Add inquiries directly to store
      inquiriesStore.push(
        { ...mockInquiry, id: 'inq-1', status: 'new' as SupportInquiryStatus },
        { ...mockInquiry, id: 'inq-2', status: 'in_progress' as SupportInquiryStatus },
        { ...mockInquiry, id: 'inq-3', status: 'resolved' as SupportInquiryStatus }
      );

      const inquiries = await supportService.getInquiries();
      
      expect(inquiries).toHaveLength(3);
      expect(mockRepository.getInquiries).toHaveBeenCalled();
    });

    it('should filter inquiries by status', async () => {
      inquiriesStore.push(
        { ...mockInquiry, id: 'inq-1', status: 'new' as SupportInquiryStatus },
        { ...mockInquiry, id: 'inq-2', status: 'in_progress' as SupportInquiryStatus },
        { ...mockInquiry, id: 'inq-3', status: 'new' as SupportInquiryStatus }
      );

      const newInquiries = await supportService.getInquiries({ status: 'new' });
      
      expect(newInquiries).toHaveLength(2);
      expect(mockRepository.getInquiries).toHaveBeenCalledWith({ status: 'new' });
    });

    it('should return empty array when no matches', async () => {
      const closedInquiries = await supportService.getInquiries({ status: 'closed' });
      expect(closedInquiries).toHaveLength(0);
    });

    it('should return empty array when no inquiries exist', async () => {
      const inquiries = await supportService.getInquiries();
      expect(inquiries).toHaveLength(0);
    });
  });

  // ============================================
  // getInquiryById Tests
  // ============================================

  describe('getInquiryById', () => {
    it('should return inquiry by ID', async () => {
      inquiriesStore.push({ ...mockInquiry, id: 'inq-test' });

      const inquiry = await supportService.getInquiryById('inq-test');
      
      expect(inquiry).not.toBeNull();
      expect(inquiry?.id).toBe('inq-test');
      expect(inquiry?.name).toBe('John Doe');
      expect(mockRepository.getInquiryById).toHaveBeenCalledWith('inq-test');
    });

    it('should return null for non-existent inquiry', async () => {
      const inquiry = await supportService.getInquiryById('nonexistent');
      
      expect(inquiry).toBeNull();
    });
  });

  // ============================================
  // updateInquiryStatus Tests
  // ============================================

  describe('updateInquiryStatus', () => {
    beforeEach(() => {
      inquiriesStore.push({
        ...mockInquiry,
        id: 'inq-update',
        status: 'new' as SupportInquiryStatus,
      });
    });

    it('should update inquiry status to in_progress', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'in_progress');

      expect(updated.status).toBe('in_progress');
      expect(mockRepository.updateInquiryStatus).toHaveBeenCalledWith('inq-update', 'in_progress');
    });

    it('should update inquiry status to resolved and set resolved_at', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'resolved');

      expect(updated.status).toBe('resolved');
      expect(updated.resolved_at).not.toBeNull();
    });

    it('should update inquiry status to closed', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'closed');

      expect(updated.status).toBe('closed');
    });

    it('should throw error for non-existent inquiry', async () => {
      await expect(
        supportService.updateInquiryStatus('nonexistent', 'in_progress')
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.updateInquiryStatus('nonexistent', 'in_progress');
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INQUIRY_NOT_FOUND');
        expect((e as SupportServiceError).statusCode).toBe(404);
      }
    });

    it('should throw error for invalid status', async () => {
      await expect(
        supportService.updateInquiryStatus('inq-update', 'invalid' as SupportInquiryStatus)
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.updateInquiryStatus('inq-update', 'invalid' as SupportInquiryStatus);
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_STATUS');
      }
    });

    it('should log activity with user ID', async () => {
      await supportService.updateInquiryStatus('inq-update', 'in_progress', 'staff-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'support_inquiry_status_updated',
        expect.objectContaining({
          inquiryId: 'inq-update',
          oldStatus: 'new',
          newStatus: 'in_progress',
        }),
        'staff-123'
      );
    });

    it('should log info message on status update', async () => {
      await supportService.updateInquiryStatus('inq-update', 'in_progress');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('inq-update')
      );
    });
  });

  // ============================================
  // FAQ Tests - getPublishedFAQs
  // ============================================

  describe('getPublishedFAQs', () => {
    it('should return only published FAQs', async () => {
      faqsStore.push(
        { ...mockFAQ, id: 'faq-1', is_published: true, sort_order: 2 },
        { ...mockFAQ, id: 'faq-2', is_published: false, sort_order: 1 },
        { ...mockFAQ, id: 'faq-3', is_published: true, sort_order: 0 }
      );

      const faqs = await supportService.getPublishedFAQs();

      expect(faqs).toHaveLength(2);
      expect(faqs.every(f => f.is_published)).toBe(true);
      expect(mockRepository.getPublishedFAQs).toHaveBeenCalled();
    });

    it('should sort FAQs by sort_order', async () => {
      faqsStore.push(
        { ...mockFAQ, id: 'faq-1', is_published: true, sort_order: 2 },
        { ...mockFAQ, id: 'faq-2', is_published: true, sort_order: 0 },
        { ...mockFAQ, id: 'faq-3', is_published: true, sort_order: 1 }
      );

      const faqs = await supportService.getPublishedFAQs();

      expect(faqs[0].id).toBe('faq-2'); // sort_order: 0
      expect(faqs[1].id).toBe('faq-3'); // sort_order: 1
      expect(faqs[2].id).toBe('faq-1'); // sort_order: 2
    });

    it('should return empty array when no published FAQs', async () => {
      faqsStore.push({ ...mockFAQ, is_published: false });

      const faqs = await supportService.getPublishedFAQs();

      expect(faqs).toHaveLength(0);
    });

    it('should return empty array when no FAQs exist', async () => {
      const faqs = await supportService.getPublishedFAQs();
      expect(faqs).toHaveLength(0);
    });
  });

  // ============================================
  // FAQ Tests - getFAQById
  // ============================================

  describe('getFAQById', () => {
    it('should return FAQ by ID', async () => {
      faqsStore.push({ ...mockFAQ, id: 'faq-test' });

      const faq = await supportService.getFAQById('faq-test');

      expect(faq).not.toBeNull();
      expect(faq?.id).toBe('faq-test');
      expect(faq?.question).toBe('What are the check-in hours?');
      expect(mockRepository.getFAQById).toHaveBeenCalledWith('faq-test');
    });

    it('should return null for non-existent FAQ', async () => {
      const faq = await supportService.getFAQById('nonexistent');

      expect(faq).toBeNull();
    });
  });

  // ============================================
  // FAQ Tests - createFAQ
  // ============================================

  describe('createFAQ', () => {
    const validFAQInput: CreateFAQInput = {
      question: 'What are your check-in times?',
      answer: 'Check-in is at 3:00 PM and check-out is at 12:00 PM.',
      category: 'Accommodation',
      sortOrder: 5,
      isPublished: true,
    };

    it('should create FAQ successfully', async () => {
      const faq = await supportService.createFAQ(validFAQInput);

      expect(faq.id).toBeDefined();
      expect(faq.question).toBe('What are your check-in times?');
      expect(faq.answer).toBe('Check-in is at 3:00 PM and check-out is at 12:00 PM.');
      expect(faq.category).toBe('Accommodation');
      expect(faq.sort_order).toBe(5);
      expect(faq.is_published).toBe(true);
    });

    it('should call repository createFAQ with correct data', async () => {
      await supportService.createFAQ(validFAQInput);

      expect(mockRepository.createFAQ).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'What are your check-in times?',
          answer: 'Check-in is at 3:00 PM and check-out is at 12:00 PM.',
          category: 'Accommodation',
          sort_order: 5,
          is_published: true,
        })
      );
    });

    it('should create FAQ with default values', async () => {
      const faq = await supportService.createFAQ({
        question: 'Simple question here?',
        answer: 'Simple answer here for the FAQ.',
      });

      expect(faq.sort_order).toBe(0);
      expect(faq.is_published).toBe(false);
      expect(faq.category).toBeNull();
    });

    it('should trim whitespace from fields', async () => {
      const faq = await supportService.createFAQ({
        question: '  Question here?  ',
        answer: '  Answer here for the FAQ.  ',
        category: '  Category  ',
      });

      expect(faq.question).toBe('Question here?');
      expect(faq.answer).toBe('Answer here for the FAQ.');
      expect(faq.category).toBe('Category');
    });

    it('should handle empty category as null', async () => {
      const faq = await supportService.createFAQ({
        question: 'Question here?',
        answer: 'Answer here for the FAQ.',
        category: '   ',
      });

      expect(faq.category).toBeNull();
    });

    it('should log activity with user ID', async () => {
      await supportService.createFAQ(validFAQInput, 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'faq_created',
        expect.objectContaining({
          question: validFAQInput.question,
        }),
        'admin-123'
      );
    });

    it('should log info message on creation', async () => {
      await supportService.createFAQ(validFAQInput);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('FAQ created')
      );
    });

    // Validation tests
    it('should throw error for question too short', async () => {
      await expect(
        supportService.createFAQ({ ...validFAQInput, question: 'Hi?' })
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.createFAQ({ ...validFAQInput, question: 'Hi?' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_QUESTION');
      }
    });

    it('should throw error for question too long', async () => {
      await expect(
        supportService.createFAQ({ ...validFAQInput, question: 'A'.repeat(501) + '?' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for answer too short', async () => {
      await expect(
        supportService.createFAQ({ ...validFAQInput, answer: 'Short' })
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.createFAQ({ ...validFAQInput, answer: 'Short' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('INVALID_ANSWER');
      }
    });

    it('should throw error for answer too long', async () => {
      await expect(
        supportService.createFAQ({ ...validFAQInput, answer: 'A'.repeat(5001) })
      ).rejects.toThrow(SupportServiceError);
    });
  });

  // ============================================
  // FAQ Tests - updateFAQ
  // ============================================

  describe('updateFAQ', () => {
    beforeEach(() => {
      faqsStore.push({
        ...mockFAQ,
        id: 'faq-update',
        question: 'Original question?',
        answer: 'Original answer here.',
        category: 'General',
        sort_order: 1,
        is_published: false,
      });
    });

    it('should update FAQ question', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        question: 'Updated question here?',
      });

      expect(updated.question).toBe('Updated question here?');
      expect(mockRepository.updateFAQ).toHaveBeenCalledWith(
        'faq-update',
        expect.objectContaining({ question: 'Updated question here?' })
      );
    });

    it('should update FAQ answer', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        answer: 'Updated answer here.',
      });

      expect(updated.answer).toBe('Updated answer here.');
    });

    it('should update multiple fields', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        question: 'New question here?',
        answer: 'New answer here.',
        category: 'New Category',
        sortOrder: 10,
        isPublished: true,
      });

      expect(updated.question).toBe('New question here?');
      expect(updated.answer).toBe('New answer here.');
      expect(updated.category).toBe('New Category');
      expect(updated.sort_order).toBe(10);
      expect(updated.is_published).toBe(true);
    });

    it('should update only sortOrder', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        sortOrder: 99,
      });

      expect(updated.sort_order).toBe(99);
    });

    it('should update only isPublished', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        isPublished: true,
      });

      expect(updated.is_published).toBe(true);
    });

    it('should trim whitespace from updated fields', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        question: '  Updated question?  ',
        answer: '  Updated answer here.  ',
      });

      expect(updated.question).toBe('Updated question?');
      expect(updated.answer).toBe('Updated answer here.');
    });

    it('should set category to null for empty string', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        category: '   ',
      });

      expect(updated.category).toBeNull();
    });

    it('should throw error for non-existent FAQ', async () => {
      await expect(
        supportService.updateFAQ('nonexistent', { question: 'New question?' })
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.updateFAQ('nonexistent', { question: 'New?' });
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('FAQ_NOT_FOUND');
        expect((e as SupportServiceError).statusCode).toBe(404);
      }
    });

    it('should throw error for question too short in update', async () => {
      await expect(
        supportService.updateFAQ('faq-update', { question: 'Hi?' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for question too long in update', async () => {
      await expect(
        supportService.updateFAQ('faq-update', { question: 'A'.repeat(501) })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for answer too short in update', async () => {
      await expect(
        supportService.updateFAQ('faq-update', { answer: 'Short' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for answer too long in update', async () => {
      await expect(
        supportService.updateFAQ('faq-update', { answer: 'A'.repeat(5001) })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should log activity with user ID', async () => {
      await supportService.updateFAQ('faq-update', { question: 'Updated?' }, 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'faq_updated',
        expect.objectContaining({
          faqId: 'faq-update',
          changes: expect.arrayContaining(['question']),
        }),
        'admin-123'
      );
    });

    it('should log info message on update', async () => {
      await supportService.updateFAQ('faq-update', { question: 'Updated?' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('FAQ updated')
      );
    });
  });

  // ============================================
  // FAQ Tests - deleteFAQ
  // ============================================

  describe('deleteFAQ', () => {
    beforeEach(() => {
      faqsStore.push({
        ...mockFAQ,
        id: 'faq-delete',
        question: 'To be deleted?',
      });
    });

    it('should delete FAQ successfully', async () => {
      await supportService.deleteFAQ('faq-delete');

      expect(mockRepository.deleteFAQ).toHaveBeenCalledWith('faq-delete');
      
      const faq = await supportService.getFAQById('faq-delete');
      expect(faq).toBeNull();
    });

    it('should throw error for non-existent FAQ', async () => {
      await expect(
        supportService.deleteFAQ('nonexistent')
      ).rejects.toThrow(SupportServiceError);

      try {
        await supportService.deleteFAQ('nonexistent');
      } catch (e) {
        expect((e as SupportServiceError).code).toBe('FAQ_NOT_FOUND');
        expect((e as SupportServiceError).statusCode).toBe(404);
      }
    });

    it('should log activity with user ID', async () => {
      await supportService.deleteFAQ('faq-delete', 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'faq_deleted',
        expect.objectContaining({
          faqId: 'faq-delete',
          question: 'To be deleted?',
        }),
        'admin-123'
      );
    });

    it('should log info message on deletion', async () => {
      await supportService.deleteFAQ('faq-delete');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('FAQ deleted')
      );
    });
  });

  // ============================================
  // SupportServiceError Tests
  // ============================================

  describe('SupportServiceError', () => {
    it('should create error with correct properties', () => {
      const error = new SupportServiceError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('SupportServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new SupportServiceError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });

    it('should be instanceof Error', () => {
      const error = new SupportServiceError('Test', 'CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SupportServiceError);
    });
  });

  // ============================================
  // Edge Cases and Integration Tests  
  // ============================================

  describe('Edge Cases', () => {
    it('should handle concurrent inquiry submissions', async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@test.com`,
        subject: `Subject ${i}`,
        message: `This is message number ${i}.`,
      }));

      const inquiries = await Promise.all(
        inputs.map(input => supportService.submitContactForm(input))
      );

      expect(inquiries).toHaveLength(5);
      inquiries.forEach((inquiry, i) => {
        expect(inquiry.email).toBe(`user${i}@test.com`);
      });
    });

    it('should handle concurrent FAQ creations', async () => {
      const inputs = Array.from({ length: 3 }, (_, i) => ({
        question: `Question number ${i}?`,
        answer: `Answer number ${i} here.`,
        sortOrder: i,
      }));

      const faqs = await Promise.all(
        inputs.map(input => supportService.createFAQ(input))
      );

      expect(faqs).toHaveLength(3);
    });

    it('should maintain data integrity across operations', async () => {
      // Create an inquiry
      const inquiry = await supportService.submitContactForm({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Test Subject',
        message: 'Test message here.',
      });

      // Update its status
      await supportService.updateInquiryStatus(inquiry.id, 'in_progress');

      // Retrieve and verify
      const retrieved = await supportService.getInquiryById(inquiry.id);
      expect(retrieved?.status).toBe('in_progress');

      // Update to resolved
      await supportService.updateInquiryStatus(inquiry.id, 'resolved');
      
      const final = await supportService.getInquiryById(inquiry.id);
      expect(final?.status).toBe('resolved');
      expect(final?.resolved_at).not.toBeNull();
    });

    it('should maintain data integrity for FAQ lifecycle', async () => {
      // Create FAQ
      const faq = await supportService.createFAQ({
        question: 'Test question here?',
        answer: 'Test answer here.',
        isPublished: false,
      });

      // Update to publish
      await supportService.updateFAQ(faq.id, { isPublished: true });

      // Verify it appears in published FAQs
      const publishedFAQs = await supportService.getPublishedFAQs();
      expect(publishedFAQs.some(f => f.id === faq.id)).toBe(true);

      // Delete it
      await supportService.deleteFAQ(faq.id);

      // Verify it's gone
      const deleted = await supportService.getFAQById(faq.id);
      expect(deleted).toBeNull();
    });

    it('should handle special characters in input', async () => {
      const inquiry = await supportService.submitContactForm({
        name: "O'Brien & Co.",
        email: 'test@test.com',
        subject: 'Question about "special" <characters>',
        message: 'Message with émojis 🎉 and ácçénts!',
      });

      expect(inquiry.name).toBe("O'Brien & Co.");
      expect(inquiry.subject).toBe('Question about "special" <characters>');
    });

    it('should handle unicode in FAQ content', async () => {
      const faq = await supportService.createFAQ({
        question: '¿Cómo puedo reservar? 🏨',
        answer: 'Visite nuestra página de reservas. ¡Gracias!',
        category: 'Español',
      });

      expect(faq.question).toBe('¿Cómo puedo reservar? 🏨');
      expect(faq.answer).toBe('Visite nuestra página de reservas. ¡Gracias!');
    });
  });
});
