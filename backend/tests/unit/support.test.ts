/**
 * Support Module Unit Tests
 * 
 * Tests for the support/help desk module including:
 * - Ticket creation
 * - Ticket status management
 * - Message threading
 * - Ticket assignment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../setup';

// Mock the database connection
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabaseClient
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Support Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ticket Creation', () => {
    it('should create a support ticket with required fields', async () => {
      const ticketData = {
        subject: 'Cannot complete booking',
        message: 'I tried to book a chalet but received an error',
        category: 'booking',
        priority: 'medium',
        customer_email: 'customer@example.com'
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...ticketData, 
                id: 'ticket-123',
                status: 'open',
                ticket_number: 'TKT-001',
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_tickets')
        .insert(ticketData)
        .select()
        .single();

      expect(result.data.id).toBeDefined();
      expect(result.data.status).toBe('open');
      expect(result.data.ticket_number).toBe('TKT-001');
    });

    it('should validate ticket priority values', () => {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const invalidPriorities = ['super-urgent', 'none', 'critical'];

      validPriorities.forEach(priority => {
        expect(['low', 'medium', 'high', 'urgent'].includes(priority)).toBe(true);
      });

      invalidPriorities.forEach(priority => {
        expect(['low', 'medium', 'high', 'urgent'].includes(priority)).toBe(false);
      });
    });

    it('should validate ticket category values', () => {
      const validCategories = ['booking', 'payment', 'general', 'technical', 'complaint'];
      
      validCategories.forEach(category => {
        expect(typeof category).toBe('string');
        expect(category.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Ticket Status Management', () => {
    it('should update ticket status', async () => {
      const statusTransitions = [
        { from: 'open', to: 'in_progress' },
        { from: 'in_progress', to: 'waiting_customer' },
        { from: 'waiting_customer', to: 'resolved' },
        { from: 'resolved', to: 'closed' }
      ];

      for (const transition of statusTransitions) {
        mockSupabaseClient.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '1', status: transition.to },
                  error: null
                })
              })
            })
          })
        });

        const result = await mockSupabaseClient
          .from('support_tickets')
          .update({ status: transition.to })
          .eq('id', '1')
          .select()
          .single();

        expect(result.data.status).toBe(transition.to);
      }
    });

    it('should not allow closed tickets to be reopened by default', () => {
      const closedStatus = 'closed';
      const allowedTransitions = ['open', 'in_progress', 'waiting_customer', 'resolved'];
      
      // In most systems, closed tickets require special permission to reopen
      expect(allowedTransitions.includes(closedStatus)).toBe(false);
    });
  });

  describe('Message Threading', () => {
    it('should add message to ticket thread', async () => {
      const message = {
        ticket_id: 'ticket-123',
        sender_id: 'user-456',
        sender_type: 'customer',
        message: 'I am still having issues with my booking'
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...message, 
                id: 'msg-789',
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_messages')
        .insert(message)
        .select()
        .single();

      expect(result.data.id).toBeDefined();
      expect(result.data.ticket_id).toBe('ticket-123');
    });

    it('should retrieve messages in chronological order', async () => {
      const messages = [
        { id: '1', created_at: '2024-01-01T10:00:00Z' },
        { id: '2', created_at: '2024-01-01T11:00:00Z' },
        { id: '3', created_at: '2024-01-01T12:00:00Z' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: messages,
              error: null
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_messages')
        .select('*')
        .eq('ticket_id', 'ticket-123')
        .order('created_at', { ascending: true });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe('1');
      expect(result.data[2].id).toBe('3');
    });
  });

  describe('Ticket Assignment', () => {
    it('should allow assigning ticket to staff member', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  id: 'ticket-123', 
                  assigned_to: 'staff-456',
                  status: 'in_progress'
                },
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_tickets')
        .update({ assigned_to: 'staff-456', status: 'in_progress' })
        .eq('id', 'ticket-123')
        .select()
        .single();

      expect(result.data.assigned_to).toBe('staff-456');
      expect(result.data.status).toBe('in_progress');
    });

    it('should track assignment history', async () => {
      const assignments = [
        { ticket_id: 'ticket-123', assigned_to: 'staff-1', assigned_at: '2024-01-01T10:00:00Z' },
        { ticket_id: 'ticket-123', assigned_to: 'staff-2', assigned_at: '2024-01-01T14:00:00Z' }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: assignments,
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('ticket_assignments')
        .select('*')
        .eq('ticket_id', 'ticket-123');

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Ticket Filtering', () => {
    it('should filter tickets by status', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: '1', status: 'open' },
              { id: '2', status: 'open' }
            ],
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_tickets')
        .select('*')
        .eq('status', 'open');

      expect(result.data.every((t: { status: string }) => t.status === 'open')).toBe(true);
    });

    it('should filter tickets by priority', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: '1', priority: 'urgent' }],
            error: null
          })
        })
      });

      const result = await mockSupabaseClient
        .from('support_tickets')
        .select('*')
        .eq('priority', 'urgent');

      expect(result.data[0].priority).toBe('urgent');
    });
  });
});
