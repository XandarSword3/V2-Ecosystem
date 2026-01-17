/**
 * Pool Controller Factory
 * 
 * Creates thin controllers that delegate to PoolService.
 * All business logic is in the service layer.
 * Controllers only handle:
 * - Request parsing
 * - Input validation
 * - Response formatting
 * - Error handling delegation
 */

import { Request, Response, NextFunction } from 'express';
import type { PoolService, PoolServiceError } from '../services/pool.service.js';
import { purchasePoolTicketSchema } from '../../validation/schemas.js';
import { z } from 'zod';

export interface PoolControllerDeps {
  poolService: PoolService;
}

export interface PoolController {
  // Public
  getSessions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getSession: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getAvailability: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  
  // Customer
  purchaseTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getMyTickets: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  
  // Staff
  validateTicket: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  recordEntry: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  recordExit: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getTodayTickets: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  
  // Admin
  createSession: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  updateSession: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  deleteSession: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

/**
 * Create pool controller with injected dependencies
 */
export function createPoolController(deps: PoolControllerDeps): PoolController {
  const { poolService } = deps;

  // Helper to handle service errors
  const handleError = (error: unknown, next: NextFunction) => {
    if ((error as PoolServiceError).code) {
      const serviceError = error as PoolServiceError;
      return next({
        status: serviceError.statusCode,
        message: serviceError.message,
        code: serviceError.code,
      });
    }
    next(error);
  };

  return {
    // ============================================
    // Public Routes
    // ============================================

    async getSessions(req, res, next) {
      try {
        const { moduleId } = req.query;
        const sessions = await poolService.getSessions(moduleId as string);
        res.json({ success: true, data: sessions });
      } catch (error) {
        handleError(error, next);
      }
    },

    async getSession(req, res, next) {
      try {
        const session = await poolService.getSessionById(req.params.id);
        if (!session) {
          res.status(404).json({ success: false, error: 'Session not found' });
          return;
        }
        res.json({ success: true, data: session });
      } catch (error) {
        handleError(error, next);
      }
    },

    async getAvailability(req, res, next) {
      try {
        const { date, sessionId, moduleId } = req.query;
        if (!date) {
          res.status(400).json({ success: false, error: 'date required' });
          return;
        }
        const availability = await poolService.getAvailability(
          date as string,
          sessionId as string,
          moduleId as string
        );
        res.json({ success: true, data: availability });
      } catch (error) {
        handleError(error, next);
      }
    },

    // ============================================
    // Customer Routes
    // ============================================

    async purchaseTicket(req, res, next) {
      try {
        // Validate input
        const validated = purchasePoolTicketSchema.parse(req.body);
        
        const result = await poolService.purchaseTicket({
          sessionId: validated.sessionId,
          date: validated.ticketDate,
          guestName: validated.customerName,
          guestEmail: validated.customerEmail,
          guestPhone: validated.customerPhone ?? undefined,
          adults: validated.numberOfAdults,
          children: validated.numberOfChildren,
          infants: 0,
          paymentMethod: validated.paymentMethod as 'cash' | 'card' | 'stripe',
          userId: (req as unknown as { user?: { id: string } }).user?.id,
        });

        res.status(201).json({
          success: true,
          data: result.ticket,
          qrCode: result.qrCode,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: error.errors,
          });
          return;
        }
        handleError(error, next);
      }
    },

    async getTicket(req, res, next) {
      try {
        const ticket = await poolService.getTicketById(req.params.id);
        if (!ticket) {
          res.status(404).json({ success: false, error: 'Ticket not found' });
          return;
        }
        res.json({ success: true, data: ticket });
      } catch (error) {
        handleError(error, next);
      }
    },

    async getMyTickets(req, res, next) {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const tickets = await poolService.getTicketsByUser(userId);
        res.json({ success: true, data: tickets });
      } catch (error) {
        handleError(error, next);
      }
    },

    // ============================================
    // Staff Routes
    // ============================================

    async validateTicket(req, res, next) {
      try {
        const { ticketNumber, qrCode } = req.body;
        const numberToValidate = ticketNumber || (qrCode ? JSON.parse(qrCode).ticketNumber : null);
        
        if (!numberToValidate) {
          res.status(400).json({ success: false, error: 'ticketNumber or qrCode required' });
          return;
        }

        const result = await poolService.validateTicket(numberToValidate);
        res.json({ success: true, ...result });
      } catch (error) {
        handleError(error, next);
      }
    },

    async recordEntry(req, res, next) {
      try {
        const staffUserId = (req as unknown as { user?: { id: string } }).user?.id;
        const ticket = await poolService.recordEntry(req.params.id, staffUserId);
        res.json({ success: true, data: ticket });
      } catch (error) {
        handleError(error, next);
      }
    },

    async recordExit(req, res, next) {
      try {
        const staffUserId = (req as unknown as { user?: { id: string } }).user?.id;
        const ticket = await poolService.recordExit(req.params.id, staffUserId);
        res.json({ success: true, data: ticket });
      } catch (error) {
        handleError(error, next);
      }
    },

    async getTodayTickets(req, res, next) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const tickets = await poolService.getTicketsByDate(today);
        res.json({ success: true, data: tickets });
      } catch (error) {
        handleError(error, next);
      }
    },

    // ============================================
    // Admin Routes
    // ============================================

    async createSession(req, res, next) {
      try {
        const adminUserId = (req as unknown as { user?: { id: string } }).user?.id;
        const session = await poolService.createSession(req.body, adminUserId);
        res.status(201).json({ success: true, data: session });
      } catch (error) {
        handleError(error, next);
      }
    },

    async updateSession(req, res, next) {
      try {
        const adminUserId = (req as unknown as { user?: { id: string } }).user?.id;
        const session = await poolService.updateSession(req.params.id, req.body, adminUserId);
        res.json({ success: true, data: session });
      } catch (error) {
        handleError(error, next);
      }
    },

    async deleteSession(req, res, next) {
      try {
        const adminUserId = (req as unknown as { user?: { id: string } }).user?.id;
        await poolService.deleteSession(req.params.id, adminUserId);
        res.json({ success: true, message: 'Session deleted' });
      } catch (error) {
        handleError(error, next);
      }
    },
  };
}
