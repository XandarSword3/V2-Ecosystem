/**
 * Pool Service - Business Logic Layer
 * 
 * Contains all business logic for pool operations.
 * Receives dependencies via constructor injection for testability.
 * Controllers delegate to this service, keeping them thin.
 */

import type {
  PoolRepository,
  PoolSession,
  PoolTicket,
  EmailService,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
} from '../container/types.js';
import dayjs from 'dayjs';

export interface PoolServiceDeps {
  poolRepository: PoolRepository;
  emailService: EmailService;
  qrCodeService: QRCodeService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

export interface PurchaseTicketInput {
  sessionId: string;
  date: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  adults: number;
  children: number;
  infants: number;
  paymentMethod: 'cash' | 'card' | 'stripe';
  userId?: string;
}

export interface PurchaseTicketResult {
  ticket: PoolTicket;
  qrCode: string;
}

export class PoolService {
  constructor(private readonly deps: PoolServiceDeps) {}

  // ============================================
  // Public Query Methods
  // ============================================

  async getSessions(moduleId?: string): Promise<PoolSession[]> {
    return this.deps.poolRepository.getSessions(moduleId);
  }

  async getSessionById(id: string): Promise<PoolSession | null> {
    return this.deps.poolRepository.getSessionById(id);
  }

  async getAvailability(date: string, sessionId?: string, moduleId?: string) {
    return this.deps.poolRepository.getAvailability(date, sessionId, moduleId);
  }

  async getTicketById(id: string): Promise<PoolTicket | null> {
    return this.deps.poolRepository.getTicketById(id);
  }

  async getTicketByNumber(ticketNumber: string): Promise<PoolTicket | null> {
    return this.deps.poolRepository.getTicketByNumber(ticketNumber);
  }

  async getTicketsByDate(date: string): Promise<PoolTicket[]> {
    return this.deps.poolRepository.getTicketsByDate(date);
  }

  async getTicketsByUser(userId: string): Promise<PoolTicket[]> {
    return this.deps.poolRepository.getTicketsByUser(userId);
  }

  // ============================================
  // Ticket Purchase Flow
  // ============================================

  async purchaseTicket(input: PurchaseTicketInput): Promise<PurchaseTicketResult> {
    const { sessionId, date, guestName, guestEmail, guestPhone, adults, children, infants, paymentMethod, userId } = input;

    // 1. Validate session exists
    const session = await this.deps.poolRepository.getSessionById(sessionId);
    if (!session) {
      throw new PoolServiceError('Session not found', 'SESSION_NOT_FOUND', 404);
    }

    // 2. Check availability
    const availability = await this.deps.poolRepository.getAvailability(date, sessionId);
    const sessionAvailability = availability.find(a => a.session.id === sessionId);
    
    if (!sessionAvailability) {
      throw new PoolServiceError('Session not available', 'SESSION_NOT_AVAILABLE', 400);
    }

    const totalGuests = adults + children;
    if (sessionAvailability.available < totalGuests) {
      throw new PoolServiceError(
        `Only ${sessionAvailability.available} spots available, requested ${totalGuests}`,
        'INSUFFICIENT_CAPACITY',
        400
      );
    }

    // 3. Calculate price
    const adultPrice = session.adult_price ?? session.price;
    const childPrice = session.child_price ?? (session.price * 0.5);
    const totalPrice = (adults * adultPrice) + (children * childPrice);

    // 4. Generate ticket number
    const ticketNumber = this.generateTicketNumber();

    // 5. Generate QR code
    const qrData = JSON.stringify({
      ticketNumber,
      sessionId,
      date,
      guests: totalGuests,
    });
    const qrCode = await this.deps.qrCodeService.generate(qrData);

    // 6. Create ticket in database
    const ticket = await this.deps.poolRepository.createTicket({
      ticket_number: ticketNumber,
      session_id: sessionId,
      date: dayjs(date).format('YYYY-MM-DD'),
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      adults,
      children,
      infants,
      total_price: totalPrice,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'stripe' ? 'pending' : 'paid',
      qr_code: qrCode,
      status: paymentMethod === 'stripe' ? 'pending' : 'valid',
    });

    // 7. Log activity
    await this.deps.activityLogger.log('pool_ticket_purchased', {
      ticketId: ticket.id,
      ticketNumber,
      sessionId,
      date,
      totalGuests,
      totalPrice,
      paymentMethod,
    }, userId);

    // 8. Emit socket event for real-time updates
    this.deps.socketEmitter.emitToUnit('pool', 'ticket_purchased', {
      ticketId: ticket.id,
      sessionId,
      date,
      guestsAdded: totalGuests,
    });

    // 9. Send confirmation email (async, don't await)
    if (guestEmail && this.deps.emailService) {
      this.deps.emailService.sendPoolTicketConfirmation(ticket, session).catch(err => {
        this.deps.logger.error('Failed to send pool ticket confirmation email', err);
      });
    }

    this.deps.logger.info(`Pool ticket purchased: ${ticketNumber} for ${totalGuests} guests`);

    return { ticket, qrCode };
  }

  // ============================================
  // Ticket Validation & Entry/Exit
  // ============================================

  async validateTicket(ticketNumber: string): Promise<{ valid: boolean; ticket?: PoolTicket; reason?: string }> {
    const ticket = await this.deps.poolRepository.getTicketByNumber(ticketNumber);

    if (!ticket) {
      return { valid: false, reason: 'Ticket not found' };
    }

    const today = dayjs().format('YYYY-MM-DD');
    if (ticket.date !== today) {
      return { valid: false, ticket, reason: `Ticket is for ${ticket.date}, not today` };
    }

    if (ticket.status === 'used') {
      return { valid: false, ticket, reason: 'Ticket already used' };
    }

    if (ticket.status === 'cancelled') {
      return { valid: false, ticket, reason: 'Ticket was cancelled' };
    }

    if (ticket.status === 'expired') {
      return { valid: false, ticket, reason: 'Ticket has expired' };
    }

    if (ticket.payment_status !== 'paid') {
      return { valid: false, ticket, reason: 'Payment not completed' };
    }

    return { valid: true, ticket };
  }

  async recordEntry(ticketId: string, staffUserId?: string): Promise<PoolTicket> {
    const ticket = await this.deps.poolRepository.getTicketById(ticketId);
    if (!ticket) {
      throw new PoolServiceError('Ticket not found', 'TICKET_NOT_FOUND', 404);
    }

    if (ticket.entry_time) {
      throw new PoolServiceError('Entry already recorded', 'ALREADY_ENTERED', 400);
    }

    const updated = await this.deps.poolRepository.updateTicket(ticketId, {
      entry_time: new Date().toISOString(),
      status: 'used',
    });

    await this.deps.activityLogger.log('pool_entry_recorded', {
      ticketId,
      ticketNumber: ticket.ticket_number,
    }, staffUserId);

    this.deps.socketEmitter.emitToUnit('pool', 'guest_entered', {
      ticketId,
      sessionId: ticket.session_id,
      guestCount: ticket.adults + ticket.children,
    });

    return updated;
  }

  async recordExit(ticketId: string, staffUserId?: string): Promise<PoolTicket> {
    const ticket = await this.deps.poolRepository.getTicketById(ticketId);
    if (!ticket) {
      throw new PoolServiceError('Ticket not found', 'TICKET_NOT_FOUND', 404);
    }

    if (!ticket.entry_time) {
      throw new PoolServiceError('No entry recorded', 'NO_ENTRY', 400);
    }

    if (ticket.exit_time) {
      throw new PoolServiceError('Exit already recorded', 'ALREADY_EXITED', 400);
    }

    const updated = await this.deps.poolRepository.updateTicket(ticketId, {
      exit_time: new Date().toISOString(),
    });

    await this.deps.activityLogger.log('pool_exit_recorded', {
      ticketId,
      ticketNumber: ticket.ticket_number,
    }, staffUserId);

    this.deps.socketEmitter.emitToUnit('pool', 'guest_exited', {
      ticketId,
      sessionId: ticket.session_id,
      guestCount: ticket.adults + ticket.children,
    });

    return updated;
  }

  // ============================================
  // Admin Operations
  // ============================================

  async createSession(
    session: Omit<PoolSession, 'id' | 'created_at' | 'updated_at'>,
    adminUserId?: string
  ): Promise<PoolSession> {
    const created = await this.deps.poolRepository.createSession(session);

    await this.deps.activityLogger.log('pool_session_created', {
      sessionId: created.id,
      name: created.name,
    }, adminUserId);

    return created;
  }

  async updateSession(
    id: string,
    data: Partial<PoolSession>,
    adminUserId?: string
  ): Promise<PoolSession> {
    const updated = await this.deps.poolRepository.updateSession(id, data);

    await this.deps.activityLogger.log('pool_session_updated', {
      sessionId: id,
      changes: Object.keys(data),
    }, adminUserId);

    return updated;
  }

  async deleteSession(id: string, adminUserId?: string): Promise<void> {
    await this.deps.poolRepository.deleteSession(id);

    await this.deps.activityLogger.log('pool_session_deleted', {
      sessionId: id,
    }, adminUserId);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private generateTicketNumber(): string {
    const date = dayjs().format('YYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `P-${date}-${random}`;
  }
}

/**
 * Custom error class for pool service errors
 */
export class PoolServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PoolServiceError';
  }
}

/**
 * Factory function to create PoolService
 */
export function createPoolService(deps: PoolServiceDeps): PoolService {
  return new PoolService(deps);
}
