/**
 * Support Service Unit Tests
 * 
 * Tests for the DI-based SupportService.
 * Uses in-memory repository for testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSupportService,
  SupportService,
  SupportServiceError,
  ContactFormInput,
  CreateFAQInput,
} from '../../src/lib/services/support.service.js';
import { createInMemorySupportRepository } from '../../src/lib/repositories/support.repository.memory.js';
import type { 
  LoggerService, 
  ActivityLoggerService, 
  EmailService,
  SupportInquiry,
  FAQ,
} from '../../src/lib/container/types.js';

describe('SupportService', () => {
  let supportService: SupportService;
  let supportRepo: ReturnType<typeof createInMemorySupportRepository>;
  let mockLogger: LoggerService;
  let mockActivityLogger: ActivityLoggerService;
  let mockEmailService: EmailService;

  beforeEach(() => {
    supportRepo = createInMemorySupportRepository();
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
      supportRepository: supportRepo,
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
      });

      expect(inquiry.name).toBe('John Doe');
      expect(inquiry.subject).toBe('General Inquiry');
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

    // Validation tests
    it('should throw error for name too short', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, name: 'J' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for name too long', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, name: 'A'.repeat(101) })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for invalid email', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, email: 'invalid-email' })
      ).rejects.toThrow(SupportServiceError);
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
    });

    it('should throw error for message too long', async () => {
      await expect(
        supportService.submitContactForm({ ...validInput, message: 'A'.repeat(2001) })
      ).rejects.toThrow(SupportServiceError);
    });
  });

  describe('getInquiries', () => {
    beforeEach(async () => {
      // Add sample inquiries
      supportRepo.addInquiry({
        id: 'inq-1',
        name: 'User 1',
        email: 'user1@test.com',
        phone: null,
        subject: 'Inquiry 1',
        message: 'Message 1',
        status: 'new',
        assigned_to: null,
        resolved_at: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });
      supportRepo.addInquiry({
        id: 'inq-2',
        name: 'User 2',
        email: 'user2@test.com',
        phone: null,
        subject: 'Inquiry 2',
        message: 'Message 2',
        status: 'in_progress',
        assigned_to: 'staff-1',
        resolved_at: null,
        created_at: '2024-01-15T11:00:00Z',
        updated_at: '2024-01-15T11:00:00Z',
      });
      supportRepo.addInquiry({
        id: 'inq-3',
        name: 'User 3',
        email: 'user3@test.com',
        phone: null,
        subject: 'Inquiry 3',
        message: 'Message 3',
        status: 'resolved',
        assigned_to: 'staff-1',
        resolved_at: '2024-01-15T12:00:00Z',
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
      });
    });

    it('should return all inquiries', async () => {
      const inquiries = await supportService.getInquiries();
      expect(inquiries).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const newInquiries = await supportService.getInquiries({ status: 'new' });
      expect(newInquiries).toHaveLength(1);
      expect(newInquiries[0].id).toBe('inq-1');
    });

    it('should return empty array when no matches', async () => {
      const closed = await supportService.getInquiries({ status: 'closed' });
      expect(closed).toHaveLength(0);
    });
  });

  describe('getInquiryById', () => {
    it('should return inquiry by ID', async () => {
      supportRepo.addInquiry({
        id: 'inq-test',
        name: 'Test User',
        email: 'test@test.com',
        phone: null,
        subject: 'Test',
        message: 'Test message here.',
        status: 'new',
        assigned_to: null,
        resolved_at: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });

      const inquiry = await supportService.getInquiryById('inq-test');
      expect(inquiry).not.toBeNull();
      expect(inquiry?.name).toBe('Test User');
    });

    it('should return null for non-existent inquiry', async () => {
      const inquiry = await supportService.getInquiryById('nonexistent');
      expect(inquiry).toBeNull();
    });
  });

  describe('updateInquiryStatus', () => {
    beforeEach(() => {
      supportRepo.addInquiry({
        id: 'inq-update',
        name: 'Test User',
        email: 'test@test.com',
        phone: null,
        subject: 'Test',
        message: 'Test message here.',
        status: 'new',
        assigned_to: null,
        resolved_at: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });
    });

    it('should update status to in_progress', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'in_progress');
      expect(updated.status).toBe('in_progress');
    });

    it('should update status to resolved and set resolved_at', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'resolved');
      expect(updated.status).toBe('resolved');
      expect(updated.resolved_at).not.toBeNull();
    });

    it('should update status to closed', async () => {
      const updated = await supportService.updateInquiryStatus('inq-update', 'closed');
      expect(updated.status).toBe('closed');
    });

    it('should throw error for non-existent inquiry', async () => {
      await expect(
        supportService.updateInquiryStatus('nonexistent', 'in_progress')
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for invalid status', async () => {
      await expect(
        supportService.updateInquiryStatus('inq-update', 'invalid' as any)
      ).rejects.toThrow(SupportServiceError);
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
  });

  // ============================================
  // FAQ Tests
  // ============================================

  describe('getPublishedFAQs', () => {
    beforeEach(() => {
      supportRepo.addFAQ({
        id: 'faq-1',
        question: 'What are your hours?',
        answer: 'We are open 24/7.',
        category: 'General',
        sort_order: 1,
        is_published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      supportRepo.addFAQ({
        id: 'faq-2',
        question: 'Draft question?',
        answer: 'Draft answer here.',
        category: 'General',
        sort_order: 2,
        is_published: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      supportRepo.addFAQ({
        id: 'faq-3',
        question: 'How do I book?',
        answer: 'Visit our booking page.',
        category: 'Booking',
        sort_order: 0,
        is_published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
    });

    it('should return only published FAQs', async () => {
      const faqs = await supportService.getPublishedFAQs();
      expect(faqs).toHaveLength(2);
      expect(faqs.every(f => f.is_published)).toBe(true);
    });

    it('should sort by sort_order', async () => {
      const faqs = await supportService.getPublishedFAQs();
      expect(faqs[0].id).toBe('faq-3'); // sort_order: 0
      expect(faqs[1].id).toBe('faq-1'); // sort_order: 1
    });

    it('should return empty array when no published FAQs', async () => {
      supportRepo.clear();
      const faqs = await supportService.getPublishedFAQs();
      expect(faqs).toHaveLength(0);
    });
  });

  describe('getFAQById', () => {
    it('should return FAQ by ID', async () => {
      supportRepo.addFAQ({
        id: 'faq-test',
        question: 'Test question?',
        answer: 'Test answer here.',
        category: null,
        sort_order: 0,
        is_published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const faq = await supportService.getFAQById('faq-test');
      expect(faq).not.toBeNull();
      expect(faq?.question).toBe('Test question?');
    });

    it('should return null for non-existent FAQ', async () => {
      const faq = await supportService.getFAQById('nonexistent');
      expect(faq).toBeNull();
    });
  });

  describe('createFAQ', () => {
    const validInput: CreateFAQInput = {
      question: 'What are your check-in times?',
      answer: 'Check-in is at 3:00 PM and check-out is at 12:00 PM.',
      category: 'Accommodation',
      sortOrder: 5,
      isPublished: true,
    };

    it('should create FAQ successfully', async () => {
      const faq = await supportService.createFAQ(validInput);

      expect(faq.id).toBeDefined();
      expect(faq.question).toBe('What are your check-in times?');
      expect(faq.answer).toBe('Check-in is at 3:00 PM and check-out is at 12:00 PM.');
      expect(faq.category).toBe('Accommodation');
      expect(faq.sort_order).toBe(5);
      expect(faq.is_published).toBe(true);
    });

    it('should create FAQ with default values', async () => {
      const faq = await supportService.createFAQ({
        question: 'Simple question?',
        answer: 'Simple answer here.',
      });

      expect(faq.sort_order).toBe(0);
      expect(faq.is_published).toBe(false);
      expect(faq.category).toBeNull();
    });

    it('should trim whitespace', async () => {
      const faq = await supportService.createFAQ({
        question: '  Question?  ',
        answer: '  Answer here.  ',
        category: '  Category  ',
      });

      expect(faq.question).toBe('Question?');
      expect(faq.answer).toBe('Answer here.');
      expect(faq.category).toBe('Category');
    });

    it('should log activity with user ID', async () => {
      await supportService.createFAQ(validInput, 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'faq_created',
        expect.objectContaining({
          question: validInput.question,
        }),
        'admin-123'
      );
    });

    it('should throw error for question too short', async () => {
      await expect(
        supportService.createFAQ({ ...validInput, question: 'Hi?' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for question too long', async () => {
      await expect(
        supportService.createFAQ({ ...validInput, question: 'A'.repeat(501) + '?' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for answer too short', async () => {
      await expect(
        supportService.createFAQ({ ...validInput, answer: 'Short' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should throw error for answer too long', async () => {
      await expect(
        supportService.createFAQ({ ...validInput, answer: 'A'.repeat(5001) })
      ).rejects.toThrow(SupportServiceError);
    });
  });

  describe('updateFAQ', () => {
    beforeEach(() => {
      supportRepo.addFAQ({
        id: 'faq-update',
        question: 'Original question?',
        answer: 'Original answer here.',
        category: 'General',
        sort_order: 1,
        is_published: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
    });

    it('should update question', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        question: 'Updated question?',
      });

      expect(updated.question).toBe('Updated question?');
      expect(updated.answer).toBe('Original answer here.');
    });

    it('should update answer', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        answer: 'Updated answer here.',
      });

      expect(updated.answer).toBe('Updated answer here.');
    });

    it('should update multiple fields', async () => {
      const updated = await supportService.updateFAQ('faq-update', {
        question: 'New question?',
        answer: 'New answer here.',
        category: 'New Category',
        sortOrder: 10,
        isPublished: true,
      });

      expect(updated.question).toBe('New question?');
      expect(updated.answer).toBe('New answer here.');
      expect(updated.category).toBe('New Category');
      expect(updated.sort_order).toBe(10);
      expect(updated.is_published).toBe(true);
    });

    it('should throw error for non-existent FAQ', async () => {
      await expect(
        supportService.updateFAQ('nonexistent', { question: 'New?' })
      ).rejects.toThrow(SupportServiceError);
    });

    it('should log activity', async () => {
      await supportService.updateFAQ('faq-update', { question: 'New question here?' }, 'admin-123');

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        'faq_updated',
        expect.objectContaining({
          faqId: 'faq-update',
          changes: expect.arrayContaining(['question']),
        }),
        'admin-123'
      );
    });
  });

  describe('deleteFAQ', () => {
    beforeEach(() => {
      supportRepo.addFAQ({
        id: 'faq-delete',
        question: 'To be deleted?',
        answer: 'This will be deleted.',
        category: null,
        sort_order: 0,
        is_published: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
    });

    it('should delete FAQ', async () => {
      await supportService.deleteFAQ('faq-delete');

      const faq = await supportService.getFAQById('faq-delete');
      expect(faq).toBeNull();
    });

    it('should throw error for non-existent FAQ', async () => {
      await expect(
        supportService.deleteFAQ('nonexistent')
      ).rejects.toThrow(SupportServiceError);
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
  });

  // ============================================
  // Error Class Tests
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
      const error = new SupportServiceError('Test', 'CODE');
      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should work without email service', async () => {
      const serviceWithoutEmail = createSupportService({
        supportRepository: supportRepo,
        logger: mockLogger,
      });

      const inquiry = await serviceWithoutEmail.submitContactForm({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Test Subject',
        message: 'Test message here.',
      });

      expect(inquiry.id).toBeDefined();
    });

    it('should work without activity logger', async () => {
      const serviceWithoutLogger = createSupportService({
        supportRepository: supportRepo,
        logger: mockLogger,
      });

      const inquiry = await serviceWithoutLogger.submitContactForm({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Test Subject',
        message: 'Test message here.',
      });

      expect(inquiry.id).toBeDefined();
    });

    it('should handle email service failure gracefully', async () => {
      mockEmailService.sendEmail = vi.fn().mockRejectedValue(new Error('Email failed'));

      const inquiry = await supportService.submitContactForm({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Test Subject',
        message: 'Test message here.',
      });

      // Should still create the inquiry
      expect(inquiry.id).toBeDefined();
      
      // Wait for async email attempt
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
