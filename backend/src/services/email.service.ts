import nodemailer from 'nodemailer';
import { getSupabase } from '../database/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    contentType?: string;
  }>;
}

interface TemplateVariables {
  [key: string]: string | number | undefined;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      logger.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.isConfigured = true;
      logger.info('Email service initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize email service:', error.message);
      this.isConfigured = false;
    }
  }

  private async getTemplate(templateName: string): Promise<{ subject: string; html_body: string; variables: string[] } | null> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('email_templates')
        .select('subject, html_body, variables')
        .eq('template_name', templateName)
        .eq('is_active', true)
        .single();

      if (error) {
        logger.error(`Failed to fetch email template '${templateName}':`, error.message);
        return null;
      }
      return data;
    } catch (error: any) {
      logger.error(`Error fetching template '${templateName}':`, error.message);
      return null;
    }
  }

  private async getSiteSettings(): Promise<Record<string, string>> {
    try {
      const supabase = getSupabase();
      // Existing site_settings table uses 'key' and 'value' (JSONB) columns
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value');

      if (error) {
        logger.warn('Failed to fetch site settings for email:', error.message);
        return this.getDefaultSettings();
      }

      // Extract relevant fields from JSONB values
      const settings: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (s.key === 'general' && s.value) {
          settings.company_name = s.value.resortName || 'V2 Resort';
          settings.companyName = s.value.resortName || 'V2 Resort';
        }
        if (s.key === 'contact' && s.value) {
          settings.contact_email = s.value.email || 'info@v2resort.com';
          settings.contactEmail = s.value.email || 'info@v2resort.com';
          settings.contact_phone = s.value.phone || '+961 XX XXX XXX';
          settings.contactPhone = s.value.phone || '+961 XX XXX XXX';
          settings.contact_address = s.value.address || 'V2 Resort, Lebanon';
          settings.companyAddress = s.value.address || 'V2 Resort, Lebanon';
        }
        if (s.key === 'chalets' && s.value) {
          settings.chalet_check_in = s.value.checkIn || s.value.check_in_time || '3:00 PM';
          settings.chalet_check_out = s.value.checkOut || s.value.check_out_time || '12:00 PM';
        }
      });
      return { ...this.getDefaultSettings(), ...settings };
    } catch {
      return this.getDefaultSettings();
    }
  }

  private getDefaultSettings(): Record<string, string> {
    return {
      company_name: 'V2 Resort',
      contact_email: 'info@v2resort.com',
      contact_phone: '+961 XX XXX XXX',
      contact_address: 'V2 Resort, Lebanon',
      companyName: 'V2 Resort',
      contactEmail: 'info@v2resort.com',
      contactPhone: '+961 XX XXX XXX',
      companyAddress: 'V2 Resort, Lebanon',
    };
  }

  private replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    // Remove any unreplaced variables
    result = result.replace(/{{[^}]+}}/g, '');
    return result;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logger.warn('Email not sent - service not configured');
      return false;
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@v2resort.com';
    const fromName = process.env.SMTP_FROM_NAME || 'V2 Resort';

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      logger.info(`Email sent successfully: ${info.messageId}`);
      return true;
    } catch (error: any) {
      logger.error('Failed to send email:', error.message);
      return false;
    }
  }

  async sendOrderConfirmation(data: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    orderDate: string;
    estimatedTime: string;
    items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
    totalAmount: number;
  }): Promise<boolean> {
    const template = await this.getTemplate('order_confirmation');
    const settings = await this.getSiteSettings();

    if (!template) {
      logger.warn('Order confirmation template not found, using fallback');
      return this.sendFallbackOrderConfirmation(data);
    }

    // Format order items as HTML
    const orderItemsHtml = data.items
      .map((item) => `<div class="item"><span>${item.quantity}x ${item.name}</span><span>$${item.subtotal.toFixed(2)}</span></div>`)
      .join('');

    const variables: TemplateVariables = {
      companyName: settings.company_name,
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      estimatedTime: data.estimatedTime,
      orderItems: orderItemsHtml,
      totalAmount: `$${data.totalAmount.toFixed(2)}`,
      contactPhone: settings.contact_phone,
      contactEmail: settings.contact_email,
      companyAddress: settings.contact_address,
    };

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_body, variables);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  private async sendFallbackOrderConfirmation(data: {
    customerEmail: string;
    customerName: string;
    orderNumber: string;
    totalAmount: number;
  }): Promise<boolean> {
    const settings = await this.getSiteSettings();
    const html = `
      <h1>${settings.company_name}</h1>
      <h2>Order Confirmation</h2>
      <p>Dear ${data.customerName},</p>
      <p>Thank you for your order! Your order number is <strong>${data.orderNumber}</strong>.</p>
      <p>Total: <strong>$${data.totalAmount.toFixed(2)}</strong></p>
      <p>We will notify you when your order is ready.</p>
      <p>Thank you,<br>${settings.company_name}</p>
    `;

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html,
    });
  }

  async sendBookingConfirmation(data: {
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
  }): Promise<boolean> {
    const template = await this.getTemplate('booking_confirmation');
    const settings = await this.getSiteSettings();

    if (!template) {
      logger.warn('Booking confirmation template not found, using fallback');
      return this.sendFallbackBookingConfirmation(data);
    }

    // Format add-ons as HTML
    const addOnsHtml = data.addOns?.length
      ? data.addOns.map((addon) => `<li>${addon.name} - $${addon.price.toFixed(2)}</li>`).join('')
      : '';

    const variables: TemplateVariables = {
      companyName: settings.company_name,
      customerName: data.customerName,
      bookingNumber: data.bookingNumber,
      chaletName: data.chaletName,
      checkInDate: data.checkInDate,
      checkInTime: settings.chalet_check_in || '3:00 PM',
      checkOutDate: data.checkOutDate,
      checkOutTime: settings.chalet_check_out || '12:00 PM',
      numberOfGuests: data.numberOfGuests,
      numberOfNights: data.numberOfNights,
      addOns: addOnsHtml ? `<ul>${addOnsHtml}</ul>` : '',
      totalAmount: `$${data.totalAmount.toFixed(2)}`,
      paymentStatus: data.paymentStatus,
      contactPhone: settings.contact_phone,
      contactEmail: settings.contact_email,
      companyAddress: settings.contact_address,
    };

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_body, variables);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  private async sendFallbackBookingConfirmation(data: {
    customerEmail: string;
    customerName: string;
    bookingNumber: string;
    chaletName: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
  }): Promise<boolean> {
    const settings = await this.getSiteSettings();
    const html = `
      <h1>${settings.company_name}</h1>
      <h2>Booking Confirmation</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your booking has been confirmed!</p>
      <p><strong>Booking Reference:</strong> ${data.bookingNumber}</p>
      <p><strong>Chalet:</strong> ${data.chaletName}</p>
      <p><strong>Check-in:</strong> ${data.checkInDate}</p>
      <p><strong>Check-out:</strong> ${data.checkOutDate}</p>
      <p><strong>Total:</strong> $${data.totalAmount.toFixed(2)}</p>
      <p>We look forward to welcoming you!</p>
      <p>Thank you,<br>${settings.company_name}</p>
    `;

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Booking Confirmation - ${data.bookingNumber}`,
      html,
    });
  }

  async sendBookingCancellation(data: {
    customerEmail: string;
    customerName: string;
    bookingNumber: string;
    chaletName: string;
    reason?: string;
  }): Promise<boolean> {
    const settings = await this.getSiteSettings();
    const html = `
      <h1>${settings.company_name}</h1>
      <h2>Booking Cancellation</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your booking <strong>${data.bookingNumber}</strong> for <strong>${data.chaletName}</strong> has been cancelled.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      <p>If you have any questions, please contact us.</p>
      <p>Thank you,<br>${settings.company_name}</p>
    `;

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Booking Cancellation - ${data.bookingNumber}`,
      html,
    });
  }

  async sendTicketWithQR(data: {
    customerEmail: string;
    customerName: string;
    ticketNumber: string;
    sessionName: string;
    ticketDate: string;
    sessionTime: string;
    numberOfGuests: number;
    qrCodeDataUrl: string;
  }): Promise<boolean> {
    const template = await this.getTemplate('ticket_delivery');
    const settings = await this.getSiteSettings();

    if (!template) {
      logger.warn('Ticket delivery template not found, using fallback');
      return this.sendFallbackTicketDelivery(data);
    }

    const variables: TemplateVariables = {
      companyName: settings.company_name,
      customerName: data.customerName,
      ticketNumber: data.ticketNumber,
      qrCodeUrl: data.qrCodeDataUrl,
      sessionName: data.sessionName,
      ticketDate: data.ticketDate,
      sessionTime: data.sessionTime,
      numberOfGuests: data.numberOfGuests,
      contactPhone: settings.contact_phone,
      contactEmail: settings.contact_email,
      companyAddress: settings.contact_address,
    };

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_body, variables);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  private async sendFallbackTicketDelivery(data: {
    customerEmail: string;
    customerName: string;
    ticketNumber: string;
    sessionName: string;
    ticketDate: string;
    qrCodeDataUrl: string;
  }): Promise<boolean> {
    const settings = await this.getSiteSettings();
    const html = `
      <h1>${settings.company_name}</h1>
      <h2>Your Pool Ticket</h2>
      <p>Dear ${data.customerName},</p>
      <p>Your pool ticket is ready!</p>
      <p><strong>Ticket Number:</strong> ${data.ticketNumber}</p>
      <p><strong>Session:</strong> ${data.sessionName}</p>
      <p><strong>Date:</strong> ${data.ticketDate}</p>
      <img src="${data.qrCodeDataUrl}" alt="QR Code" style="max-width: 200px;">
      <p>Please show this QR code at the entrance.</p>
      <p>Thank you,<br>${settings.company_name}</p>
    `;

    return this.sendEmail({
      to: data.customerEmail,
      subject: `Your Pool Ticket - ${data.ticketNumber}`,
      html,
    });
  }

  async sendWelcomeEmail(data: {
    customerEmail: string;
    customerName: string;
  }): Promise<boolean> {
    const template = await this.getTemplate('welcome');
    const settings = await this.getSiteSettings();
    const siteUrl = config.frontendUrl || 'https://v2resort.com';

    if (!template) {
      const html = `
        <h1>Welcome to ${settings.company_name}!</h1>
        <p>Dear ${data.customerName},</p>
        <p>Thank you for joining us. We're excited to have you!</p>
        <p>Visit us at <a href="${siteUrl}">${siteUrl}</a></p>
      `;
      return this.sendEmail({
        to: data.customerEmail,
        subject: `Welcome to ${settings.company_name}!`,
        html,
      });
    }

    const variables: TemplateVariables = {
      companyName: settings.company_name,
      customerName: data.customerName,
      siteUrl,
      companyAddress: settings.contact_address,
    };

    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html_body, variables);

    return this.sendEmail({
      to: data.customerEmail,
      subject,
      html,
    });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
