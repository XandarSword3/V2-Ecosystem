/**
 * Email Service with Dependency Injection
 *
 * Provides email sending functionality with template support.
 * Uses DI for transporter and template fetching, enabling easy testing.
 */

import type {
  EmailService,
  EmailOptions,
  EmailAttachment,
  PoolTicket,
  PoolSession,
  LoggerService,
  DatabaseClient,
} from '../container/types.js';

// ============================================
// EMAIL TRANSPORT INTERFACE
// ============================================

export interface EmailTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: EmailAttachment[];
  }): Promise<{ messageId: string }>;
}

// ============================================
// EMAIL TEMPLATE TYPES
// ============================================

export interface EmailTemplate {
  id: string;
  template_name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables: string[];
  is_active: boolean;
}

export interface SiteSettings {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  companyAddress: string;
  chaletCheckIn?: string;
  chaletCheckOut?: string;
}

// ============================================
// ERROR HANDLING
// ============================================

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

// ============================================
// INPUT TYPES
// ============================================

export interface OrderConfirmationData {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  estimatedTime: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  totalAmount: number;
}

export interface BookingConfirmationData {
  customerEmail: string;
  customerName: string;
  bookingNumber: string;
  chaletName: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfNights: number;
  addOns?: Array<{ name: string; price: number }>;
  totalAmount: number;
  paymentStatus: string;
}

// ============================================
// TEMPLATE REPOSITORY INTERFACE
// ============================================

export interface EmailTemplateRepository {
  getTemplate(templateName: string): Promise<EmailTemplate | null>;
  getSiteSettings(): Promise<SiteSettings>;
}

// ============================================
// DEPENDENCIES
// ============================================

export interface EmailServiceDependencies {
  transporter?: EmailTransporter;
  templateRepository?: EmailTemplateRepository;
  logger: LoggerService;
  fromAddress?: string;
  fromName?: string;
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

/**
 * Creates an EmailService instance with injected dependencies.
 */
export function createEmailService(deps: EmailServiceDependencies): EmailService {
  const { transporter, templateRepository, logger, fromAddress, fromName } = deps;

  const defaultFromAddress = fromAddress || 'noreply@v2resort.com';
  const defaultFromName = fromName || 'V2 Resort';

  const defaultSettings: SiteSettings = {
    companyName: 'V2 Resort',
    contactEmail: 'info@v2resort.com',
    contactPhone: '+1-555-123-4567',
    companyAddress: 'V2 Resort, Lebanon',
    chaletCheckIn: '3:00 PM',
    chaletCheckOut: '12:00 PM',
  };

  // ----------------------------------------
  // HELPER FUNCTIONS
  // ----------------------------------------

  function replaceVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    // Remove any unreplaced variables
    result = result.replace(/{{[^}]+}}/g, '');
    return result;
  }

  async function getSettings(): Promise<SiteSettings> {
    if (!templateRepository) {
      return defaultSettings;
    }
    try {
      return await templateRepository.getSiteSettings();
    } catch {
      return defaultSettings;
    }
  }

  async function getTemplate(templateName: string): Promise<EmailTemplate | null> {
    if (!templateRepository) {
      return null;
    }
    try {
      return await templateRepository.getTemplate(templateName);
    } catch (error) {
      logger.error(`Failed to fetch template '${templateName}':`, error);
      return null;
    }
  }

  // ----------------------------------------
  // EMAIL SERVICE METHODS
  // ----------------------------------------

  async function sendEmail(options: EmailOptions): Promise<boolean> {
    if (!transporter) {
      logger.warn('Email not sent - transporter not configured');
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: `"${defaultFromName}" <${defaultFromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      logger.info(`Email sent successfully: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async function sendTemplatedEmail(
    templateName: string,
    to: string,
    variables: Record<string, unknown>
  ): Promise<boolean> {
    const template = await getTemplate(templateName);
    if (!template) {
      logger.warn(`Template '${templateName}' not found`);
      return false;
    }

    const settings = await getSettings();
    const mergedVariables = {
      ...settings,
      ...variables,
    };

    const subject = replaceVariables(template.subject, mergedVariables);
    const html = replaceVariables(template.html_body, mergedVariables);
    const text = template.text_body ? replaceVariables(template.text_body, mergedVariables) : undefined;

    return sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async function sendPoolTicketConfirmation(ticket: PoolTicket, session: PoolSession): Promise<boolean> {
    const template = await getTemplate('pool_ticket_confirmation');
    const settings = await getSettings();

    const variables: Record<string, unknown> = {
      companyName: settings.companyName,
      customerName: ticket.guest_name,
      ticketNumber: ticket.ticket_number,
      sessionName: session.name,
      ticketDate: ticket.date,
      sessionTime: `${session.start_time} - ${session.end_time}`,
      adults: ticket.adults,
      children: ticket.children,
      infants: ticket.infants,
      totalPrice: `$${ticket.total_price.toFixed(2)}`,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      companyAddress: settings.companyAddress,
    };

    if (ticket.qr_code) {
      variables.qrCodeUrl = ticket.qr_code;
    }

    if (template) {
      const subject = replaceVariables(template.subject, variables);
      const html = replaceVariables(template.html_body, variables);

      return sendEmail({
        to: ticket.guest_email || '',
        subject,
        html,
      });
    }

    // Fallback template
    const html = `
      <h1>${settings.companyName}</h1>
      <h2>Pool Ticket Confirmation</h2>
      <p>Dear ${ticket.guest_name},</p>
      <p>Your pool ticket has been confirmed!</p>
      <p><strong>Ticket Number:</strong> ${ticket.ticket_number}</p>
      <p><strong>Session:</strong> ${session.name}</p>
      <p><strong>Date:</strong> ${ticket.date}</p>
      <p><strong>Time:</strong> ${session.start_time} - ${session.end_time}</p>
      <p><strong>Guests:</strong> ${ticket.adults} adults, ${ticket.children} children, ${ticket.infants} infants</p>
      <p><strong>Total:</strong> $${ticket.total_price.toFixed(2)}</p>
      ${ticket.qr_code ? `<img src="${ticket.qr_code}" alt="QR Code" style="max-width: 200px;">` : ''}
      <p>Please show this ticket at the entrance.</p>
      <p>Thank you,<br>${settings.companyName}</p>
    `;

    return sendEmail({
      to: ticket.guest_email || '',
      subject: `Pool Ticket Confirmation - ${ticket.ticket_number}`,
      html,
    });
  }

  async function sendBookingConfirmation(booking: unknown): Promise<boolean> {
    const data = booking as BookingConfirmationData;
    const template = await getTemplate('booking_confirmation');
    const settings = await getSettings();

    const addOnsHtml = data.addOns?.length
      ? data.addOns.map((addon) => `<li>${addon.name} - $${addon.price.toFixed(2)}</li>`).join('')
      : '';

    const variables: Record<string, unknown> = {
      companyName: settings.companyName,
      customerName: data.customerName,
      bookingNumber: data.bookingNumber,
      chaletName: data.chaletName,
      checkInDate: data.checkInDate,
      checkInTime: settings.chaletCheckIn,
      checkOutDate: data.checkOutDate,
      checkOutTime: settings.chaletCheckOut,
      numberOfGuests: data.numberOfGuests,
      numberOfNights: data.numberOfNights,
      addOns: addOnsHtml ? `<ul>${addOnsHtml}</ul>` : '',
      totalAmount: `$${data.totalAmount.toFixed(2)}`,
      paymentStatus: data.paymentStatus,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      companyAddress: settings.companyAddress,
    };

    if (template) {
      const subject = replaceVariables(template.subject, variables);
      const html = replaceVariables(template.html_body, variables);

      return sendEmail({
        to: data.customerEmail,
        subject,
        html,
      });
    }

    // Fallback template
    const html = `
      <h1>${settings.companyName}</h1>
      <h2>Booking Confirmation</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your booking has been confirmed!</p>
      <p><strong>Booking Reference:</strong> ${data.bookingNumber}</p>
      <p><strong>Chalet:</strong> ${data.chaletName}</p>
      <p><strong>Check-in:</strong> ${data.checkInDate} at ${settings.chaletCheckIn}</p>
      <p><strong>Check-out:</strong> ${data.checkOutDate} at ${settings.chaletCheckOut}</p>
      <p><strong>Guests:</strong> ${data.numberOfGuests}</p>
      <p><strong>Nights:</strong> ${data.numberOfNights}</p>
      ${addOnsHtml ? `<p><strong>Add-ons:</strong></p><ul>${addOnsHtml}</ul>` : ''}
      <p><strong>Total:</strong> $${data.totalAmount.toFixed(2)}</p>
      <p><strong>Payment Status:</strong> ${data.paymentStatus}</p>
      <p>We look forward to welcoming you!</p>
      <p>Thank you,<br>${settings.companyName}</p>
    `;

    return sendEmail({
      to: data.customerEmail,
      subject: `Booking Confirmation - ${data.bookingNumber}`,
      html,
    });
  }

  async function sendOrderConfirmation(order: unknown): Promise<boolean> {
    const data = order as OrderConfirmationData;
    const template = await getTemplate('order_confirmation');
    const settings = await getSettings();

    const orderItemsHtml = data.items
      .map((item) => `<div class="item"><span>${item.quantity}x ${item.name}</span><span>$${item.subtotal.toFixed(2)}</span></div>`)
      .join('');

    const variables: Record<string, unknown> = {
      companyName: settings.companyName,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      estimatedTime: data.estimatedTime,
      orderItems: orderItemsHtml,
      totalAmount: `$${data.totalAmount.toFixed(2)}`,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      companyAddress: settings.companyAddress,
    };

    if (template) {
      const subject = replaceVariables(template.subject, variables);
      const html = replaceVariables(template.html_body, variables);

      return sendEmail({
        to: data.customerEmail,
        subject,
        html,
      });
    }

    // Fallback template
    const html = `
      <h1>${settings.companyName}</h1>
      <h2>Order Confirmation</h2>
      <p>Dear ${data.customerName},</p>
      <p>Thank you for your order!</p>
      <p><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p><strong>Order Date:</strong> ${data.orderDate}</p>
      <p><strong>Estimated Ready Time:</strong> ${data.estimatedTime}</p>
      <h3>Order Items:</h3>
      ${orderItemsHtml}
      <p><strong>Total:</strong> $${data.totalAmount.toFixed(2)}</p>
      <p>We will notify you when your order is ready.</p>
      <p>Thank you,<br>${settings.companyName}</p>
    `;

    return sendEmail({
      to: data.customerEmail,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html,
    });
  }

  return {
    sendEmail,
    sendTemplatedEmail,
    sendPoolTicketConfirmation,
    sendBookingConfirmation,
    sendOrderConfirmation,
  };
}

// ============================================
// IN-MEMORY TEMPLATE REPOSITORY FOR TESTING
// ============================================

export function createInMemoryTemplateRepository(): EmailTemplateRepository & {
  addTemplate: (template: EmailTemplate) => void;
  setSettings: (settings: Partial<SiteSettings>) => void;
  clear: () => void;
} {
  const templates = new Map<string, EmailTemplate>();
  let settings: SiteSettings = {
    companyName: 'Test Resort',
    contactEmail: 'test@resort.com',
    contactPhone: '+1-555-000-0000',
    companyAddress: 'Test Address',
    chaletCheckIn: '3:00 PM',
    chaletCheckOut: '12:00 PM',
  };

  return {
    async getTemplate(templateName: string): Promise<EmailTemplate | null> {
      const template = templates.get(templateName);
      if (!template || !template.is_active) {
        return null;
      }
      return template;
    },

    async getSiteSettings(): Promise<SiteSettings> {
      return { ...settings };
    },

    addTemplate(template: EmailTemplate): void {
      templates.set(template.template_name, template);
    },

    setSettings(newSettings: Partial<SiteSettings>): void {
      settings = { ...settings, ...newSettings };
    },

    clear(): void {
      templates.clear();
      settings = {
        companyName: 'Test Resort',
        contactEmail: 'test@resort.com',
        contactPhone: '+1-555-000-0000',
        companyAddress: 'Test Address',
        chaletCheckIn: '3:00 PM',
        chaletCheckOut: '12:00 PM',
      };
    },
  };
}

// ============================================
// MOCK EMAIL TRANSPORTER FOR TESTING
// ============================================

export interface SentEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  messageId: string;
  sentAt: Date;
}

export function createMockEmailTransporter(): EmailTransporter & {
  getSentEmails: () => SentEmail[];
  getLastEmail: () => SentEmail | undefined;
  clear: () => void;
  setShouldFail: (shouldFail: boolean) => void;
} {
  const sentEmails: SentEmail[] = [];
  let shouldFail = false;
  let messageCounter = 1;

  return {
    async sendMail(options): Promise<{ messageId: string }> {
      if (shouldFail) {
        throw new Error('Failed to send email');
      }

      const messageId = `test-message-${messageCounter++}`;
      sentEmails.push({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        messageId,
        sentAt: new Date(),
      });

      return { messageId };
    },

    getSentEmails(): SentEmail[] {
      return [...sentEmails];
    },

    getLastEmail(): SentEmail | undefined {
      return sentEmails[sentEmails.length - 1];
    },

    clear(): void {
      sentEmails.length = 0;
      messageCounter = 1;
    },

    setShouldFail(value: boolean): void {
      shouldFail = value;
    },
  };
}
