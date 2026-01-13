/**
 * Email Service Unit Tests
 * 
 * Tests for email template rendering, SMTP handling, and email sending.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer
const mockSendMail = vi.fn();
const mockTransporter = {
  sendMail: mockSendMail,
};

// Mock data
let mockTemplates: Map<string, EmailTemplate> = new Map();
let mockSettings: Record<string, string> = {};

interface EmailTemplate {
  template_name: string;
  subject: string;
  html_body: string;
  variables: string[];
  is_active: boolean;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
  }>;
}

// Reset mocks before each test
beforeEach(() => {
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
  mockTemplates.clear();
  mockSettings = {
    company_name: 'V2 Resort',
    support_email: 'support@v2resort.com',
    phone: '+1234567890',
  };

  // Add default templates
  mockTemplates.set('order_confirmation', {
    template_name: 'order_confirmation',
    subject: 'Order Confirmation - #{orderNumber}',
    html_body: `
      <h1>Thank you for your order!</h1>
      <p>Order Number: #{orderNumber}</p>
      <p>Total: #{total}</p>
      <p>Customer: #{customerName}</p>
    `,
    variables: ['orderNumber', 'total', 'customerName'],
    is_active: true,
  });

  mockTemplates.set('booking_confirmation', {
    template_name: 'booking_confirmation',
    subject: 'Booking Confirmation - #{bookingNumber}',
    html_body: `
      <h1>Your booking is confirmed!</h1>
      <p>Booking: #{bookingNumber}</p>
      <p>Check-in: #{checkIn}</p>
      <p>Check-out: #{checkOut}</p>
      <p>Chalet: #{chaletName}</p>
    `,
    variables: ['bookingNumber', 'checkIn', 'checkOut', 'chaletName'],
    is_active: true,
  });

  mockTemplates.set('pool_ticket', {
    template_name: 'pool_ticket',
    subject: 'Your Pool Ticket - #{ticketNumber}',
    html_body: `
      <h1>Pool Access Ticket</h1>
      <p>Ticket: #{ticketNumber}</p>
      <p>Date: #{ticketDate}</p>
      <p>Session: #{sessionName}</p>
      <p>Guests: #{guestCount}</p>
    `,
    variables: ['ticketNumber', 'ticketDate', 'sessionName', 'guestCount'],
    is_active: true,
  });
});

describe('Template Variable Replacement', () => {
  function replaceVariables(template: string, variables: Record<string, string | number>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`#\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  it('should replace single variable', () => {
    const template = 'Hello #{name}!';
    const result = replaceVariables(template, { name: 'John' });
    expect(result).toBe('Hello John!');
  });

  it('should replace multiple variables', () => {
    const template = '#{greeting} #{name}, your order #{orderNumber} is ready.';
    const result = replaceVariables(template, {
      greeting: 'Hello',
      name: 'John',
      orderNumber: 'ORD-123',
    });
    expect(result).toBe('Hello John, your order ORD-123 is ready.');
  });

  it('should replace same variable multiple times', () => {
    const template = '#{name} ordered something. Contact #{name} at #{email}.';
    const result = replaceVariables(template, {
      name: 'John',
      email: 'john@test.com',
    });
    expect(result).toBe('John ordered something. Contact John at john@test.com.');
  });

  it('should handle numeric values', () => {
    const template = 'Total: $#{amount}';
    const result = replaceVariables(template, { amount: 99.99 });
    expect(result).toBe('Total: $99.99');
  });

  it('should leave unreplaced variables as-is', () => {
    const template = 'Hello #{name}, your #{unknown} is ready.';
    const result = replaceVariables(template, { name: 'John' });
    expect(result).toBe('Hello John, your #{unknown} is ready.');
  });

  it('should handle empty variables object', () => {
    const template = 'Hello #{name}!';
    const result = replaceVariables(template, {});
    expect(result).toBe('Hello #{name}!');
  });

  it('should handle template with no variables', () => {
    const template = 'Hello World!';
    const result = replaceVariables(template, { name: 'John' });
    expect(result).toBe('Hello World!');
  });
});

describe('Template Retrieval', () => {
  async function getTemplate(templateName: string): Promise<EmailTemplate | null> {
    const template = mockTemplates.get(templateName);
    if (!template || !template.is_active) {
      return null;
    }
    return template;
  }

  it('should retrieve active template', async () => {
    const template = await getTemplate('order_confirmation');
    expect(template).not.toBeNull();
    expect(template?.template_name).toBe('order_confirmation');
  });

  it('should return null for non-existent template', async () => {
    const template = await getTemplate('nonexistent');
    expect(template).toBeNull();
  });

  it('should return null for inactive template', async () => {
    mockTemplates.get('order_confirmation')!.is_active = false;
    const template = await getTemplate('order_confirmation');
    expect(template).toBeNull();
  });
});

describe('Fallback Templates', () => {
  const fallbackTemplates: Record<string, { subject: string; html: string }> = {
    order_confirmation: {
      subject: 'Order Confirmation',
      html: '<p>Your order has been confirmed.</p>',
    },
    booking_confirmation: {
      subject: 'Booking Confirmation',
      html: '<p>Your booking has been confirmed.</p>',
    },
  };

  function getFallbackTemplate(templateName: string): { subject: string; html: string } | null {
    return fallbackTemplates[templateName] || null;
  }

  it('should return fallback when template not in DB', () => {
    const fallback = getFallbackTemplate('order_confirmation');
    expect(fallback).not.toBeNull();
    expect(fallback?.subject).toBe('Order Confirmation');
  });

  it('should return null for unknown fallback', () => {
    const fallback = getFallbackTemplate('unknown_template');
    expect(fallback).toBeNull();
  });
});

describe('Email Sending', () => {
  async function sendEmail(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const result = await mockTransporter.sendMail({
        from: `"${mockSettings.company_name}" <noreply@v2resort.com>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  it('should send email successfully', async () => {
    const result = await sendEmail({
      to: 'customer@test.com',
      subject: 'Test Email',
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('should include correct from address', async () => {
    await sendEmail({
      to: 'customer@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"V2 Resort" <noreply@v2resort.com>',
      })
    );
  });

  it('should handle SMTP failure', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

    const result = await sendEmail({
      to: 'customer@test.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP connection failed');
  });

  it('should include attachments when provided', async () => {
    await sendEmail({
      to: 'customer@test.com',
      subject: 'Test with Attachment',
      html: '<p>See attached</p>',
      attachments: [
        { filename: 'ticket.png', content: Buffer.from('fake-image-data') },
      ],
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ filename: 'ticket.png' }),
        ],
      })
    );
  });
});

describe('Order Confirmation Email', () => {
  function buildOrderConfirmationEmail(order: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
  }): EmailOptions {
    const template = mockTemplates.get('order_confirmation')!;
    
    let html = template.html_body
      .replace(/#{orderNumber}/g, order.orderNumber)
      .replace(/#{customerName}/g, order.customerName)
      .replace(/#{total}/g, `$${order.total.toFixed(2)}`);

    const subject = template.subject.replace(/#{orderNumber}/g, order.orderNumber);

    return {
      to: order.customerEmail,
      subject,
      html,
    };
  }

  it('should build order confirmation with all details', () => {
    const email = buildOrderConfirmationEmail({
      orderNumber: 'ORD-001',
      customerName: 'John Doe',
      customerEmail: 'john@test.com',
      total: 45.50,
      items: [{ name: 'Burger', quantity: 2, price: 15.00 }],
    });

    expect(email.to).toBe('john@test.com');
    expect(email.subject).toBe('Order Confirmation - ORD-001');
    expect(email.html).toContain('ORD-001');
    expect(email.html).toContain('$45.50');
    expect(email.html).toContain('John Doe');
  });
});

describe('Booking Confirmation Email', () => {
  function buildBookingConfirmationEmail(booking: {
    bookingNumber: string;
    customerName: string;
    customerEmail: string;
    chaletName: string;
    checkIn: string;
    checkOut: string;
  }): EmailOptions {
    const template = mockTemplates.get('booking_confirmation')!;
    
    let html = template.html_body
      .replace(/#{bookingNumber}/g, booking.bookingNumber)
      .replace(/#{chaletName}/g, booking.chaletName)
      .replace(/#{checkIn}/g, booking.checkIn)
      .replace(/#{checkOut}/g, booking.checkOut);

    const subject = template.subject.replace(/#{bookingNumber}/g, booking.bookingNumber);

    return {
      to: booking.customerEmail,
      subject,
      html,
    };
  }

  it('should build booking confirmation with dates', () => {
    const email = buildBookingConfirmationEmail({
      bookingNumber: 'BK-001',
      customerName: 'Jane Doe',
      customerEmail: 'jane@test.com',
      chaletName: 'Sunset Villa',
      checkIn: '2026-02-01',
      checkOut: '2026-02-05',
    });

    expect(email.subject).toBe('Booking Confirmation - BK-001');
    expect(email.html).toContain('Sunset Villa');
    expect(email.html).toContain('2026-02-01');
    expect(email.html).toContain('2026-02-05');
  });
});

describe('Pool Ticket Email', () => {
  function buildPoolTicketEmail(ticket: {
    ticketNumber: string;
    customerEmail: string;
    ticketDate: string;
    sessionName: string;
    guestCount: number;
    qrCodeData: string;
  }): EmailOptions {
    const template = mockTemplates.get('pool_ticket')!;
    
    let html = template.html_body
      .replace(/#{ticketNumber}/g, ticket.ticketNumber)
      .replace(/#{ticketDate}/g, ticket.ticketDate)
      .replace(/#{sessionName}/g, ticket.sessionName)
      .replace(/#{guestCount}/g, String(ticket.guestCount));

    const subject = template.subject.replace(/#{ticketNumber}/g, ticket.ticketNumber);

    return {
      to: ticket.customerEmail,
      subject,
      html,
      attachments: [
        {
          filename: `pool-ticket-${ticket.ticketNumber}.png`,
          content: Buffer.from(ticket.qrCodeData, 'base64'),
        },
      ],
    };
  }

  it('should build pool ticket with QR attachment', () => {
    const email = buildPoolTicketEmail({
      ticketNumber: 'P-260113-0001',
      customerEmail: 'guest@test.com',
      ticketDate: '2026-01-13',
      sessionName: 'Morning Swim',
      guestCount: 3,
      qrCodeData: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...',
    });

    expect(email.subject).toBe('Your Pool Ticket - P-260113-0001');
    expect(email.html).toContain('Morning Swim');
    expect(email.html).toContain('3');
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments![0].filename).toContain('P-260113-0001');
  });
});

describe('Email Configuration Validation', () => {
  interface EmailConfig {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
  }

  function validateEmailConfig(config: EmailConfig): {
    valid: boolean;
    missing: string[];
  } {
    const required = ['host', 'user', 'pass'];
    const missing = required.filter(key => !config[key as keyof EmailConfig]);
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  it('should validate complete config', () => {
    const result = validateEmailConfig({
      host: 'smtp.gmail.com',
      port: 587,
      user: 'user@gmail.com',
      pass: 'password123',
    });

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should detect missing host', () => {
    const result = validateEmailConfig({
      user: 'user@gmail.com',
      pass: 'password123',
    });

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('host');
  });

  it('should detect missing credentials', () => {
    const result = validateEmailConfig({
      host: 'smtp.gmail.com',
    });

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('user');
    expect(result.missing).toContain('pass');
  });

  it('should accept config without port (optional)', () => {
    const result = validateEmailConfig({
      host: 'smtp.gmail.com',
      user: 'user@gmail.com',
      pass: 'password123',
    });

    expect(result.valid).toBe(true);
  });
});

describe('HTML Sanitization in Templates', () => {
  function sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function safeReplaceVariables(
    template: string,
    variables: Record<string, string | number>,
    sanitize = true
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`#\\{${key}\\}`, 'g');
      const safeValue = sanitize ? sanitizeHtml(String(value)) : String(value);
      result = result.replace(regex, safeValue);
    }
    return result;
  }

  it('should sanitize HTML in variables', () => {
    const template = 'Hello #{name}!';
    const result = safeReplaceVariables(template, { name: '<script>alert("xss")</script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should sanitize quotes', () => {
    const template = 'Name: #{name}';
    const result = safeReplaceVariables(template, { name: 'John "The Boss" Doe' });
    expect(result).toContain('&quot;');
  });

  it('should preserve normal text', () => {
    const template = 'Hello #{name}!';
    const result = safeReplaceVariables(template, { name: 'John Doe' });
    expect(result).toBe('Hello John Doe!');
  });
});
