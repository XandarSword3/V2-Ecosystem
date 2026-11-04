import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Twilio
const mockCreateMessage = vi.fn();
vi.mock('twilio', () => {
  return {
    Twilio: class MockTwilio {
      messages = {
        create: mockCreateMessage,
      };
    },
  };
});

// Mock supabase
vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock activity logger
vi.mock('../../../src/utils/activityLogger.js', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(true),
  },
}));

import { supabase } from '../../../src/lib/supabase.js';
import { activityLogger } from '../../../src/utils/activityLogger.js';

describe('SMSService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.BACKEND_URL;
    delete process.env.DEFAULT_COUNTRY_CODE;
  });

  describe('Configuration & Initialization', () => {
    it('warns when Twilio credentials are not set and reports isServiceEnabled() false', async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { smsService } = await import('../../../src/services/sms.service.js');

      expect(smsService.isServiceEnabled()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Twilio not configured'));
      warnSpy.mockRestore();
    });

    it('reports isServiceEnabled() true when credentials and phone number exist', async () => {
      vi.resetModules();
      process.env.TWILIO_ACCOUNT_SID = 'AC1234567890';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_secret';
      process.env.TWILIO_PHONE_NUMBER = '+15550001111';

      const { smsService } = await import('../../../src/services/sms.service.js');
      expect(smsService.isServiceEnabled()).toBe(true);
    });
  });

  describe('Templates and Previews', () => {
    it('returns list of available templates', async () => {
      vi.resetModules();
      const { smsService } = await import('../../../src/services/sms.service.js');

      const templates = smsService.getAvailableTemplates();
      expect(templates).toContain('booking-confirmation');
      expect(templates).toContain('booking-reminder');
      expect(templates).toContain('pool-ticket');
      expect(templates).toContain('order-ready');
      expect(templates).toContain('payment-confirmation');
      expect(templates).toContain('password-reset');
      expect(templates).toContain('2fa-code');
      expect(templates).toContain('cancellation');
      expect(templates).toContain('alert');
    });

    it('previews template with sample data or returns null for unknown template', async () => {
      vi.resetModules();
      const { smsService } = await import('../../../src/services/sms.service.js');

      const preview = smsService.previewTemplate('order-ready', {
        order_id: '12345',
        location: 'Cabana 3',
      });
      expect(preview).toContain('#12345 is ready for pickup at Cabana 3!');

      const previewNoLoc = smsService.previewTemplate('order-ready', { order_id: '99' });
      expect(previewNoLoc).toBe('V2 Ecosystem Kitchen: Your order #99 is ready for pickup!');

      const nullPreview = smsService.previewTemplate('non-existent', {});
      expect(nullPreview).toBeNull();
    });

    it('formats all template variants accurately', async () => {
      vi.resetModules();
      const { smsService } = await import('../../../src/services/sms.service.js');

      expect(smsService.previewTemplate('booking-confirmation', {
        booking_id: 'BK-1',
        metadata: { check_in_date: '2026-12-01', check_in_time: '15:00' },
        resort_phone: '555-1234',
      })).toContain('booking #BK-1 is confirmed');

      expect(smsService.previewTemplate('booking-reminder', {
        metadata: { check_in_date: '2026-12-01', check_in_time: '15:00' },
      })).toContain('stay begins 2026-12-01');

      expect(smsService.previewTemplate('pool-ticket', {
        session_date: '2026-08-01',
        session_time: '10:00',
        ticket_id: 'POOL-10',
      })).toContain('Ticket #POOL-10');

      expect(smsService.previewTemplate('payment-confirmation', {
        amount: '$100',
        transaction_id: 'TXN-99',
      })).toContain('Payment of $100 received');

      expect(smsService.previewTemplate('password-reset', { code: '123456' })).toContain('reset code is 123456');
      expect(smsService.previewTemplate('2fa-code', { code: '654321' })).toContain('verification code is 654321');

      expect(smsService.previewTemplate('cancellation', {
        booking_id: 'BK-2',
        refund_amount: '$250',
      })).toContain('Refund of $250 will be processed');

      expect(smsService.previewTemplate('alert', { message: 'Weather warning' })).toContain('Alert: Weather warning');
    });
  });

  describe('Phone normalization & Validation', () => {
    it('normalizes domestic numbers using default country code and validates E.164', async () => {
      vi.resetModules();
      process.env.DEFAULT_COUNTRY_CODE = '44';
      const { smsService } = await import('../../../src/services/sms.service.js');

      // Mock DB insert
      vi.mocked(supabase.from).mockImplementation((table: string) => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'sms-db-1' }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any));

      const res = await smsService.sendSMS('07123456789', 'Hello');
      expect(res.to).toBe('+4407123456789');
    });

    it('rejects invalid phone numbers with descriptive error', async () => {
      vi.resetModules();
      const { smsService } = await import('../../../src/services/sms.service.js');

      await expect(smsService.sendSMS('abc', 'Hello')).rejects.toThrow('Invalid phone number');
    });
  });

  describe('Consent check', () => {
    it('aborts sending if user has opted out of SMS', async () => {
      vi.resetModules();
      const { smsService } = await import('../../../src/services/sms.service.js');

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { notification_preferences: { sms: false } },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await smsService.sendSMS('+15551234567', 'Opt-out test', undefined, undefined, 'user-optout');
      expect(res.status).toBe('failed');
      expect(res.error_message).toContain('User has not opted in to SMS notifications');
    });
  });

  describe('Live Twilio Sending & Activity Logging', () => {
    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = 'AC1234567890';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_secret';
      process.env.TWILIO_PHONE_NUMBER = '+15550001111';
      process.env.BACKEND_URL = 'https://api.resort.com';
    });

    it('sends SMS via Twilio, updates DB and logs activity', async () => {
      vi.resetModules();
      mockCreateMessage.mockResolvedValueOnce({
        sid: 'SM123456789',
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { notification_preferences: { sms: true } },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === 'sms_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'sms-rec-1' }, error: null }),
              }),
            }),
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      const { smsService } = await import('../../../src/services/sms.service.js');

      const res = await smsService.sendTemplatedSMS(
        '+15559998888',
        '2fa-code',
        { code: '998877' },
        'user-active'
      );

      expect(res.status).toBe('sent');
      expect(res.provider_message_id).toBe('SM123456789');
      expect(mockCreateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('998877'),
          to: '+15559998888',
          from: '+15550001111',
          statusCallback: 'https://api.resort.com/webhooks/twilio/status',
        })
      );
      expect(activityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sms_sent',
          entity_type: 'sms',
          user_id: 'user-active',
        })
      );
    });

    it('captures Twilio errors, records failure in DB, and returns failed status', async () => {
      vi.resetModules();
      mockCreateMessage.mockRejectedValueOnce(new Error('Twilio Network Error'));

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'sms_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'sms-rec-err' }, error: null }),
              }),
            }),
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      const { smsService } = await import('../../../src/services/sms.service.js');

      const res = await smsService.sendSMS('+15559998888', 'Fail payload');
      expect(res.status).toBe('failed');
      expect(res.error_message).toBe('Twilio Network Error');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Twilio Network Error',
        })
      );
    });
  });

  describe('Webhooks, Statistics, and History', () => {
    it('handleStatusWebhook maps all statuses accurately and updates delivered_at', async () => {
      vi.resetModules();
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any);

      const { smsService } = await import('../../../src/services/sms.service.js');

      // Delivered status
      await smsService.handleStatusWebhook({
        MessageSid: 'SM_DELIVERED',
        MessageStatus: 'delivered',
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          delivered_at: expect.any(String),
        })
      );

      // Failed status with error message
      await smsService.handleStatusWebhook({
        MessageSid: 'SM_FAILED',
        MessageStatus: 'undelivered',
        ErrorMessage: 'Carrier blocked',
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'undelivered',
          error_message: 'Carrier blocked',
        })
      );
    });

    it('getStatistics computes sent, delivered, failed, and rates correctly', async () => {
      vi.resetModules();
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({
          data: [
            { status: 'delivered', template: '2fa-code' },
            { status: 'delivered', template: 'order-ready' },
            { status: 'failed', template: 'booking-reminder' },
            { status: 'pending', template: 'booking-reminder' },
          ],
          error: null,
        }),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const { smsService } = await import('../../../src/services/sms.service.js');

      const stats = await smsService.getStatistics('week');
      expect(stats.total_sent).toBe(3); // excludes pending
      expect(stats.delivered).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.delivery_rate).toBeCloseTo(66.66, 1);
      expect(stats.by_template['2fa-code']).toBe(1);
      expect(stats.by_template['booking-reminder']).toBe(2);
    });

    it('getUserSMSHistory retrieves ordered SMS history for user', async () => {
      vi.resetModules();
      const mockLimit = vi.fn().mockResolvedValue({
        data: [{ id: 'sms-h-1', to: '+1555123', body: 'Code: 123' }],
        error: null,
      });

      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      } as any);

      const { smsService } = await import('../../../src/services/sms.service.js');

      const history = await smsService.getUserSMSHistory('user-abc', 10);
      expect(history).toHaveLength(1);
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-abc');
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });
});
