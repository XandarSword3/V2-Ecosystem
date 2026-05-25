
// Mock Twilio
vi.mock('twilio', () => ({
  Twilio: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Mock supabase
vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  },
}));

// Mock activity logger
vi.mock('../../../src/utils/activityLogger.js', () => ({
  activityLogger: {
    log: vi.fn(),
  },
}));

// We need to set the environment variables BEFORE importing the service
describe('SMS Service', () => {
  let smsService: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Reset environment
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  describe('when SMS is disabled (no Twilio credentials)', () => {
    it('should warn about disabled SMS', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Import module fresh without Twilio credentials
      const { smsService: service } = await import('../../../src/services/sms.service');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Twilio not configured')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('SMS Templates', () => {
    it('should have booking-confirmation template', async () => {
      // Templates are defined within the service module
      // We can test them indirectly by checking template usage
      const { supabase } = await import('../../../src/lib/supabase.js');
      
      // Mock supabase to return successful insert
      vi.mocked(supabase.from).mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sms-1' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { sms_opt_in: true },
              error: null,
            }),
          }),
        }),
      }) as any);

      const { smsService } = await import('../../../src/services/sms.service');
      
      // Try to send templated SMS - will fail at Twilio but validates template exists
      const result = await smsService.sendTemplatedSMS(
        '+1234567890',
        'booking-confirmation',
        {
          booking_id: 'B-001',
          check_in_date: '2024-01-15',
          check_in_time: '15:00',
          resort_phone: '+1-555-0123',
        }
      );

      expect(result).toBeDefined();
      expect(result.to).toBe('+1234567890');
    });

    it('should throw for invalid template', async () => {
      const { smsService } = await import('../../../src/services/sms.service');
      
      await expect(
        smsService.sendTemplatedSMS('+1234567890', 'non-existent-template', {})
      ).rejects.toThrow('SMS template not found');
    });
  });

  describe('Phone Number Validation', () => {
    it('should normalize and validate phone numbers', async () => {
      const { supabase } = await import('../../../src/lib/supabase.js');
      
      vi.mocked(supabase.from).mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sms-1' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }) as any);

      const { smsService } = await import('../../../src/services/sms.service');
      
      // Invalid phone number should throw
      await expect(
        smsService.sendSMS('invalid', 'Test message')
      ).rejects.toThrow('Invalid phone number');
    });
  });

  describe('SMS Consent', () => {
    it('should return failed when SMS service is disabled', async () => {
      vi.resetModules();
      
      const { supabase } = await import('../../../src/lib/supabase.js');
      
      // Mock supabase
      vi.mocked(supabase.from).mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sms-1' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { notification_preferences: { sms: true } },
              error: null,
            }),
          }),
        }),
      }) as any);

      const { smsService } = await import('../../../src/services/sms.service');
      
      const result = await smsService.sendSMS(
        '+1234567890',
        'Test message',
        undefined,
        undefined,
        'user-123'
      );

      // SMS disabled means it returns failed
      expect(result.status).toBe('failed');
      expect(result.error_message).toContain('not configured');
    });
  });
});
