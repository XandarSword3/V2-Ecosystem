
// Mock Stripe as a class
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      constructor() {}
      disputes = {
        update: vi.fn().mockResolvedValue({}),
      };
    },
  };
});

// Mock supabase
vi.mock('../../../src/lib/supabase', () => {
  const mockClient = { from: vi.fn() };
  return {
    supabase: mockClient,
    getSupabase: vi.fn().mockReturnValue(mockClient),
    getSupabaseAdmin: vi.fn(),
  };
});

vi.mock('../../../src/services/email.service', () => ({
  emailService: {
    sendTemplatedEmail: vi.fn().mockResolvedValue({ success: true }),
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  activityLogger: {
    logActivity: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { chargebackService } from '../../../src/services/chargeback.service';
import { supabase } from '../../../src/lib/supabase';

describe('ChargebackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDisputeCreated', () => {
    it('should create a chargeback record from dispute and send alert email', async () => {
      const mockPayment = {
        id: 'pm-100',
        user_id: 'user-100',
        amount: 150,
        description: 'Deluxe Room Stay',
      };

      const mockChargeback = {
        id: 'cb-100',
        payment_id: 'pm-100',
        stripe_dispute_id: 'dp_valid',
        amount: 150,
        currency: 'EUR',
        status: 'needs_response',
        due_date: new Date(Date.now() + 86400000).toISOString(),
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'payment_ledger') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockPayment, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'chargebacks') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChargeback, error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const mockDispute = {
        id: 'dp_valid',
        payment_intent: 'pi_valid',
        charge: 'ch_valid',
        amount: 15000,
        currency: 'eur',
        reason: 'fraudulent',
        evidence_details: { due_by: Math.floor(Date.now() / 1000) + 86400 },
      } as any;

      const created = await chargebackService.handleDisputeCreated(mockDispute);
      expect(created.id).toBe('cb-100');
      expect(created.status).toBe('needs_response');
    });
  });

  describe('handleDisputeUpdated', () => {
    it('should update chargeback status and outcome upon dispute resolution', async () => {
      const mockChargeback = {
        id: 'cb-200',
        status: 'needs_response',
      };

      const mockUpdated = {
        id: 'cb-200',
        status: 'won',
        outcome: 'won',
        resolved_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chargebacks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChargeback, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const mockDispute = {
        id: 'dp_resolved',
        status: 'won',
      } as any;

      const updated = await chargebackService.handleDisputeUpdated(mockDispute);
      expect(updated?.status).toBe('won');
      expect(updated?.outcome).toBe('won');
    });

    it('should return null when dispute does not exist in chargebacks table', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      const updated = await chargebackService.handleDisputeUpdated({ id: 'dp_nonexistent' } as any);
      expect(updated).toBeNull();
    });
  });

  describe('submitEvidence', () => {
    it('should submit evidence to Stripe and update chargeback status to under_review', async () => {
      const mockChargeback = {
        id: 'cb-300',
        stripe_dispute_id: 'dp_300',
        status: 'needs_response',
      };

      const mockUpdated = {
        id: 'cb-300',
        status: 'under_review',
        evidence_submitted: {
          customer_name: 'John Doe',
          submitted_at: new Date().toISOString(),
        },
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chargebacks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChargeback, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await chargebackService.submitEvidence(
        'cb-300',
        { customer_name: 'John Doe', product_description: 'Room reservation' },
        'admin-user-1'
      );

      expect(result.status).toBe('under_review');
    });

    it('should reject evidence submission if dispute is not in needs_response state', async () => {
      const mockChargeback = {
        id: 'cb-closed',
        status: 'won',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockChargeback, error: null }),
          }),
        }),
      } as any);

      await expect(
        chargebackService.submitEvidence('cb-closed', {}, 'admin-user-1')
      ).rejects.toThrow('Cannot submit evidence for this dispute');
    });
  });

  describe('evidence templates', () => {
    it('should return appropriate template for given reason', () => {
      const fraudTemplate = chargebackService.getEvidenceTemplate('fraudulent');
      expect(fraudTemplate.uncategorized_text).toBeDefined();

      const generalTemplate = chargebackService.getEvidenceTemplate('unknown_reason');
      expect(generalTemplate.uncategorized_text).toBe('This transaction was legitimate...');
    });

    it('should throw when payment not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      const mockDispute = {
        id: 'dp_test123',
        payment_intent: 'pi_notfound',
        charge: 'ch_test123',
        amount: 10000,
        currency: 'eur',
        reason: 'fraudulent',
        evidence_details: { due_by: Date.now() / 1000 + 86400 },
      } as any;

      await expect(chargebackService.handleDisputeCreated(mockDispute)).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should return chargeback by ID', async () => {
      const mockChargeback = {
        id: 'chargeback-1',
        payment_id: 'payment-1',
        amount: 100,
        status: 'needs_response',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockChargeback, error: null }),
          }),
        }),
      } as any);

      const result = await chargebackService.getById('chargeback-1');

      expect(result?.id).toBe('chargeback-1');
    });

    it('should return null when chargeback not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      const result = await chargebackService.getById('invalid');
      
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return chargebacks with pagination', async () => {
      const mockChargebacks = [
        { id: 'cb-1', status: 'needs_response' },
        { id: 'cb-2', status: 'won' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: mockChargebacks, count: 2, error: null }),
          }),
        }),
      } as any);

      const result = await chargebackService.list({});

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it.skip('should filter by status - complex query builder test', async () => {
      // Skipping complex filter test
    });
  });

  describe('getStats', () => {
    it('should return chargeback statistics', async () => {
      const mockChargebacks = [
        { status: 'needs_response', amount: 100, outcome: null },
        { status: 'under_review', amount: 200, outcome: 'won' },
        { status: 'closed', amount: 50, outcome: 'lost' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: mockChargebacks, error: null }),
        }),
      } as any);

      const result = await chargebackService.getStats();

      expect(result).toBeDefined();
      expect(result.total_count).toBe(3);
      expect(result.total_amount).toBe(350);
      expect(result.needs_response).toBe(1);
      expect(result.won).toBe(1);
      expect(result.lost).toBe(1);
    });
  });
});
