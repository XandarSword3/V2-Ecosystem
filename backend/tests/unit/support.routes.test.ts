/**
 * Support Routes Unit Tests
 * 
 * Comprehensive tests for support.routes.ts HTTP handlers.
 * Tests contact form submission and FAQ retrieval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockReqRes, createChainableMock } from './utils.js';
import express from 'express';
import request from 'supertest';

// Mock dependencies before importing routes
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Support Routes', () => {
  let getSupabase: typeof import('../../src/database/connection.js').getSupabase;
  let emailService: typeof import('../../src/services/email.service.js').emailService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const connectionModule = await import('../../src/database/connection.js');
    getSupabase = connectionModule.getSupabase;
    const emailModule = await import('../../src/services/email.service.js');
    emailService = emailModule.emailService;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // CONTACT FORM TESTS
  // ============================================

  describe('POST /contact', () => {
    it('should submit contact form successfully', async () => {
      const mockInquiry = {
        id: 'inquiry-123',
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Booking Question',
        message: 'I have a question about booking a chalet.',
        status: 'new',
      };

      const queryMock = createChainableMock(mockInquiry);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);
      vi.mocked(emailService.sendEmail).mockResolvedValue(undefined);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Booking Question',
          message: 'I have a question about booking a chalet.',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'inquiry-123' },
        message: 'Your message has been received. We will get back to you soon.',
      });
    });

    it('should send admin notification email', async () => {
      const mockInquiry = { id: 'inquiry-123' };
      const queryMock = createChainableMock(mockInquiry);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);
      vi.mocked(emailService.sendEmail).mockResolvedValue(undefined);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      await request(app)
        .post('/support/contact')
        .send({
          name: 'Jane Smith',
          email: 'jane@example.com',
          subject: 'Pool Inquiry',
          message: 'What are the pool opening hours?',
        });

      // Check admin email was sent
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Pool Inquiry'),
        })
      );
    });

    it('should send confirmation email to user', async () => {
      const mockInquiry = { id: 'inquiry-123' };
      const queryMock = createChainableMock(mockInquiry);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);
      vi.mocked(emailService.sendEmail).mockResolvedValue(undefined);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      await request(app)
        .post('/support/contact')
        .send({
          name: 'Jane Smith',
          email: 'jane@example.com',
          subject: 'Pool Inquiry',
          message: 'What are the pool opening hours?',
        });

      // Check confirmation email was sent to user
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@example.com',
          subject: 'Thank you for contacting V2 Resort',
        })
      );
    });

    it('should succeed even if email sending fails', async () => {
      const mockInquiry = { id: 'inquiry-123' };
      const queryMock = createChainableMock(mockInquiry);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);
      vi.mocked(emailService.sendEmail).mockRejectedValue(new Error('SMTP error'));

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message content.',
        });

      // Should still succeed
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid email format', async () => {
      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'not-an-email',
          subject: 'Test Subject',
          message: 'Test message content.',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid form data');
    });

    it('should return 400 for name too short', async () => {
      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'J', // Too short
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message content.',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for subject too short', async () => {
      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Hi', // Too short
          message: 'Test message content.',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for message too short', async () => {
      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Valid Subject',
          message: 'Short', // Too short
        });

      expect(response.status).toBe(400);
    });

    it('should handle optional phone field', async () => {
      const mockInquiry = { id: 'inquiry-123' };
      const queryMock = createChainableMock(mockInquiry);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);
      vi.mocked(emailService.sendEmail).mockResolvedValue(undefined);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          subject: 'Test Subject',
          message: 'Test message content.',
        });

      expect(response.status).toBe(201);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);
      app.use((err: any, req: any, res: any, next: any) => {
        res.status(500).json({ success: false, error: err.message });
      });

      const response = await request(app)
        .post('/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message content.',
        });

      expect(response.status).toBe(500);
    });
  });

  // ============================================
  // FAQ TESTS
  // ============================================

  describe('GET /faq', () => {
    it('should return published FAQs', async () => {
      const mockFaqs = [
        {
          id: 'faq-1',
          question: 'What are the check-in times?',
          answer: 'Check-in is at 2:00 PM.',
          sort_order: 1,
          is_published: true,
        },
        {
          id: 'faq-2',
          question: 'Is parking available?',
          answer: 'Yes, free parking is available.',
          sort_order: 2,
          is_published: true,
        },
      ];

      const queryMock = createChainableMock(mockFaqs);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app).get('/support/faq');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockFaqs,
      });
    });

    it('should only return published FAQs', async () => {
      const queryMock = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      await request(app).get('/support/faq');

      expect(queryMock.eq).toHaveBeenCalledWith('is_published', true);
    });

    it('should order FAQs by sort_order', async () => {
      const queryMock = createChainableMock([]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      await request(app).get('/support/faq');

      expect(queryMock.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    });

    it('should return empty array when no FAQs', async () => {
      const queryMock = createChainableMock(null);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);

      const response = await request(app).get('/support/faq');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      const queryMock = createChainableMock(null, dbError);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryMock),
      } as any);

      const supportRouter = (await import('../../src/modules/support/support.routes.js')).default;
      const app = express();
      app.use(express.json());
      app.use('/support', supportRouter);
      app.use((err: any, req: any, res: any, next: any) => {
        res.status(500).json({ success: false, error: err.message });
      });

      const response = await request(app).get('/support/faq');

      expect(response.status).toBe(500);
    });
  });
});
