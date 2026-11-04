import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createChainableMock } from '../utils';

// Shared mock sendMail
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-msg-id-123' });

// Mock nodemailer before imports
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockImplementation(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/config/index', () => ({
  config: {
    frontendUrl: 'https://test-resort.com',
  },
}));

vi.mock('../../../src/modules/platform/tenant-integrations.service.js', () => ({
  getTenantIntegration: vi.fn(),
}));

import nodemailer from 'nodemailer';
import { getSupabase } from '../../../src/database/connection.js';
import { getTenantIntegration } from '../../../src/modules/platform/tenant-integrations.service.js';

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secretpass';
    process.env.SMTP_FROM = 'no-reply@example.com';
    process.env.SMTP_FROM_NAME = 'Test Resort';
  });

  describe('Initialization and Configuration', () => {
    it('initializes transporter when SMTP env vars are present', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');
      expect(emailService.isReady()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: { user: 'user@example.com', pass: 'secretpass' },
        })
      );
    });

    it('initializes secure mode on port 465', async () => {
      vi.resetModules();
      process.env.SMTP_PORT = '465';
      const { emailService } = await import('../../../src/services/email.service.js');
      expect(emailService.isReady()).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        })
      );
    });

    it('remains unconfigured when SMTP_HOST or credentials are missing', async () => {
      vi.resetModules();
      delete process.env.SMTP_HOST;
      const { emailService } = await import('../../../src/services/email.service.js');
      expect(emailService.isReady()).toBe(false);

      const sent = await emailService.sendEmail({
        to: 'guest@example.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
      });
      expect(sent).toBe(false);
    });
  });

  describe('Core sendEmail functionality', () => {
    it('sends email successfully with valid html and options', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        to: 'guest@example.com',
        subject: 'Welcome',
        html: '<p>Hello world</p>',
        text: 'Hello world',
        attachments: [
          { filename: 'test.pdf', content: 'test-content', contentType: 'application/pdf' },
        ],
      });

      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@example.com',
          subject: 'Welcome',
          html: '<p>Hello world</p>',
          text: 'Hello world',
          from: '"Test Resort" <no-reply@example.com>',
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'test.pdf' }),
          ]),
        })
      );
    });

    it('returns false when missing HTML and no valid template', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        to: 'guest@example.com',
        subject: 'Welcome',
      });

      expect(sent).toBe(false);
    });

    it('handles sendMail exception gracefully and returns false', async () => {
      vi.resetModules();
      mockSendMail.mockRejectedValueOnce(new Error('Connection timed out'));
      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        to: 'guest@example.com',
        subject: 'Hello',
        html: '<p>Fail</p>',
      });

      expect(sent).toBe(false);
    });

    it('resolves tenant transporter when tenantId is provided and valid', async () => {
      vi.resetModules();
      vi.mocked(getTenantIntegration).mockResolvedValueOnce({
        config: { host: 'tenant-smtp.com', port: 465, user: 'tenant_user' },
        credential: 'tenant_password',
      } as any);

      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        tenantId: 'tenant-123',
        to: 'client@example.com',
        subject: 'Tenant Email',
        html: '<p>Tenant Content</p>',
      });

      expect(sent).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'tenant-smtp.com',
          port: 465,
          secure: true,
          auth: { user: 'tenant_user', pass: 'tenant_password' },
        })
      );
    });

    it('falls back to default transporter if tenant SMTP is missing or incomplete', async () => {
      vi.resetModules();
      vi.mocked(getTenantIntegration).mockResolvedValueOnce(null);

      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        tenantId: 'tenant-none',
        to: 'client@example.com',
        subject: 'Fallback Email',
        html: '<p>Fallback Content</p>',
      });

      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('Template and Site Settings resolution', () => {
    it('loads template from database and replaces variables with site settings and context', async () => {
      vi.resetModules();
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Notice for {{name}}',
              html_body: '<h1>Welcome to {{companyName}}, {{name}}!</h1><p>Contact us at {{contactEmail}}</p>',
              variables: ['name'],
            });
          }
          if (table === 'site_settings') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { key: 'general', value: { businessName: 'Pine Resort' } },
                  { key: 'contact', value: { email: 'contact@pine.com', phone: '555-1234', address: '123 Pine St' } },
                  { key: 'accommodation', value: { checkIn: '2:00 PM', checkOut: '11:00 AM' } },
                ],
                error: null,
              }),
            };
          }
          return createChainableMock(null);
        }),
      })) as any);

      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        to: 'guest@example.com',
        subject: '',
        template: 'user_notice',
        data: { name: 'Alice' },
      });

      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Notice for Alice',
          html: '<h1>Welcome to Pine Resort, Alice!</h1><p>Contact us at contact@pine.com</p>',
        })
      );
    });

    it('falls back to default settings when site_settings table query fails', async () => {
      vi.resetModules();
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Hello',
              html_body: '<p>{{companyName}}</p>',
              variables: [],
            });
          }
          if (table === 'site_settings') {
            return {
              select: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database unreachable' },
              }),
            };
          }
          return createChainableMock(null);
        }),
      })) as any);

      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Hello',
        template: 'test_template',
      });
      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>Your Business</p>',
        })
      );
    });

    it('returns false from sendTemplatedEmail if template does not exist', async () => {
      vi.resetModules();
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn(() => createChainableMock(null, { message: 'Template not found' })),
      })) as any);

      const { emailService } = await import('../../../src/services/email.service.js');
      const sent = await emailService.sendTemplatedEmail('missing_template', 'test@example.com', {});
      expect(sent).toBe(false);
    });
  });

  describe('Specialized Email Methods', () => {
    beforeEach(() => {
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'site_settings') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [
                  { key: 'general', value: { siteName: 'Grand Resort' } },
                  { key: 'contact', value: { email: 'info@grand.com', phone: '555-9999', address: 'Ocean Ave' } },
                  { key: 'accommodation', value: { checkIn: '3:00 PM', checkOut: '11:00 AM' } },
                ],
                error: null,
              }),
            };
          }
          // Default: template not found in DB to exercise fallback templates
          return createChainableMock(null, { message: 'Not found' });
        }),
      })) as any);
    });

    it('sendAccessTicketConfirmation sends templated ticket confirmation', async () => {
      vi.resetModules();
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Ticket {{ticketNumber}}',
              html_body: '<p>Guest: {{guestName}}, Session: {{sessionName}}</p>',
              variables: [],
            });
          }
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      })) as any);

      const { emailService } = await import('../../../src/services/email.service.js');

      // Without email
      const noEmail = await emailService.sendAccessTicketConfirmation(
        { ticket_number: 'TCK-1', guest_name: 'Bob' },
        { name: 'Morning Pool', start_time: '09:00' }
      );
      expect(noEmail).toBe(false);

      // With email
      const sent = await emailService.sendAccessTicketConfirmation(
        { ticket_number: 'TCK-1', guest_name: 'Bob', guest_email: 'bob@example.com' },
        { name: 'Morning Pool', start_time: '09:00' }
      );
      expect(sent).toBe(true);

      // sendPoolTicketConfirmation alias
      const sentPool = await emailService.sendPoolTicketConfirmation(
        { ticket_number: 'TCK-2', guest_name: 'Bob', guest_email: 'bob@example.com' },
        { name: 'Morning Pool', start_time: '09:00' }
      );
      expect(sentPool).toBe(true);
    });

    it('sendOrderConfirmation uses DB template when present, else fallback', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback path
      const sentFallback = await emailService.sendOrderConfirmation({
        customerEmail: 'order@customer.com',
        customerName: 'Sam',
        orderNumber: 'ORD-999',
        orderDate: '2026-11-04',
        estimatedTime: '20 mins',
        items: [{ name: 'Burger', quantity: 2, price: 10, subtotal: 20 }],
        totalAmount: 20,
      });

      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'order@customer.com',
          subject: 'Order Confirmation - ORD-999',
          html: expect.stringContaining('ORD-999'),
        })
      );

      // Template path
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Receipt: {{orderNumber}}',
              html_body: '<div>Items: {{orderItems}} Total: {{totalAmount}}</div>',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendOrderConfirmation({
        customerEmail: 'order2@customer.com',
        customerName: 'Sam',
        orderNumber: 'ORD-1000',
        orderDate: '2026-11-04',
        estimatedTime: '20 mins',
        items: [{ name: 'Fries', quantity: 1, price: 5, subtotal: 5 }],
        totalAmount: 5,
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Receipt: ORD-1000',
          html: expect.stringContaining('1x Fries'),
        })
      );
    });

    it('sendBookingConfirmation handles both template and fallback with add-ons', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback
      const sentFallback = await emailService.sendBookingConfirmation({
        customerEmail: 'booker@example.com',
        customerName: 'Clara',
        bookingNumber: 'BK-100',
        unitName: 'Villa Sunset',
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-05',
        numberOfGuests: 4,
        numberOfNights: 4,
        totalAmount: 1200,
        paymentStatus: 'paid',
      });
      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Booking Confirmation - BK-100',
          html: expect.stringContaining('Villa Sunset'),
        })
      );

      // Template path with addOns
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Confirmed: {{bookingNumber}}',
              html_body: '<div>{{chaletName}} with add-ons: {{addOns}}</div>',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendBookingConfirmation({
        customerEmail: 'booker@example.com',
        customerName: 'Clara',
        bookingNumber: 'BK-101',
        unitName: 'Villa Sunset',
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-05',
        numberOfGuests: 4,
        numberOfNights: 4,
        addOns: [{ name: 'Breakfast', price: 50 }],
        totalAmount: 1250,
        paymentStatus: 'paid',
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Confirmed: BK-101',
          html: expect.stringContaining('Breakfast - $50.00'),
        })
      );
    });

    it('sendBookingCancellation sends formatted cancellation email', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendBookingCancellation({
        customerEmail: 'cancel@example.com',
        customerName: 'David',
        bookingNumber: 'BK-999',
        unitName: 'Chalet 4',
        reason: 'Emergency travel changes',
      });

      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Booking Cancellation - BK-999',
          html: expect.stringContaining('Emergency travel changes'),
        })
      );
    });

    it('sendAccessTicketWithQR handles both template and fallback delivery', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback
      const sentFallback = await emailService.sendAccessTicketWithQR({
        customerEmail: 'qr@example.com',
        customerName: 'Ella',
        ticketNumber: 'TKT-888',
        sessionName: 'VIP Spa',
        ticketDate: '2026-11-10',
        sessionTime: '14:00',
        numberOfGuests: 2,
        qrCodeDataUrl: 'data:image/png;base64,mockqr',
      });
      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Access Ticket - TKT-888',
          html: expect.stringContaining('data:image/png;base64,mockqr'),
        })
      );

      // Template
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'QR Delivery: {{ticketNumber}}',
              html_body: '<div>Session: {{sessionName}}, QR: {{qrCodeUrl}}</div>',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendAccessTicketWithQR({
        customerEmail: 'qr@example.com',
        customerName: 'Ella',
        ticketNumber: 'TKT-889',
        sessionName: 'VIP Spa',
        ticketDate: '2026-11-10',
        sessionTime: '14:00',
        numberOfGuests: 2,
        qrCodeDataUrl: 'data:image/png;base64,mockqr2',
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'QR Delivery: TKT-889',
          html: expect.stringContaining('data:image/png;base64,mockqr2'),
        })
      );
    });

    it('sendWelcomeEmail sends welcome message with template or fallback', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback
      const sentFallback = await emailService.sendWelcomeEmail({
        customerEmail: 'newbie@example.com',
        customerName: 'Frank',
      });
      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Welcome to Grand Resort!',
          html: expect.stringContaining('https://test-resort.com'),
        })
      );

      // Template
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Hi {{customerName}}',
              html_body: '<h1>Welcome to {{companyName}}</h1>',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendWelcomeEmail({
        customerEmail: 'newbie2@example.com',
        customerName: 'Frank',
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hi Frank',
        })
      );
    });

    it('sendPreArrivalReminder formats check-in reminders properly', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback with special instructions
      const sentFallback = await emailService.sendPreArrivalReminder({
        customerEmail: 'guest@example.com',
        customerName: 'Grace',
        bookingNumber: 'BK-555',
        unitName: 'Lakeside Cabin',
        checkInDate: '2026-11-05',
        numberOfNights: 2,
        specialInstructions: 'Feather-free pillows requested',
      });
      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reminder: Your Stay at Grand Resort Begins Tomorrow!',
          html: expect.stringContaining('Feather-free pillows requested'),
        })
      );

      // Template
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'See you soon {{customerName}}',
              html_body: '<p>Unit {{chaletName}} ready on {{checkInDate}}</p>',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendPreArrivalReminder({
        customerEmail: 'guest@example.com',
        customerName: 'Grace',
        bookingNumber: 'BK-556',
        unitName: 'Lakeside Cabin',
        checkInDate: '2026-11-05',
        numberOfNights: 2,
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'See you soon Grace',
          html: expect.stringContaining('Lakeside Cabin'),
        })
      );
    });

    it('sendGiftCard formats gift card code and expiration', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      // Fallback
      const sentFallback = await emailService.sendGiftCard({
        recipientEmail: 'friend@example.com',
        recipientName: 'Hannah',
        senderName: 'George',
        code: 'ABCD1234EFGH5678',
        amount: 150,
        message: 'Enjoy your vacation!',
        expiresAt: '2027-11-04T00:00:00Z',
      });
      expect(sentFallback).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '🎁 You\'ve received a $150.00 gift card from Grand Resort!',
          html: expect.stringContaining('ABCD-1234-EFGH-5678'),
        })
      );

      // Template
      vi.mocked(getSupabase).mockImplementation((() => ({
        from: vi.fn((table: string) => {
          if (table === 'email_templates') {
            return createChainableMock({
              subject: 'Gift from {{senderName}}',
              html_body: '<code>{{giftCardCode}}</code> - {{amount}}',
              variables: [],
            });
          }
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }),
      })) as any);

      const sentTemplate = await emailService.sendGiftCard({
        recipientEmail: 'friend@example.com',
        recipientName: 'Hannah',
        code: 'ABCD1234EFGH5678',
        amount: 50,
        expiresAt: '2027-11-04T00:00:00Z',
      });
      expect(sentTemplate).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Gift from Someone special',
          html: expect.stringContaining('ABCD-1234-EFGH-5678'),
        })
      );
    });

    it('sendAccountExistsNotification sends anti-enumeration registration notification', async () => {
      vi.resetModules();
      const { emailService } = await import('../../../src/services/email.service.js');

      const sent = await emailService.sendAccountExistsNotification('user@example.com', 'Ian Malcolm');
      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Account registration at Grand Resort',
          html: expect.stringContaining('Ian Malcolm'),
        })
      );
    });
  });
});
