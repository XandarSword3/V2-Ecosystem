/**
 * Chargeback Service Tests
 *
 * Tests src/services/chargeback.service.ts.
 * Mocks Stripe, database/connection, email.service, activityLogger, logger.
 */


vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    disputes: {
      update: vi.fn().mockResolvedValue({ id: 'dp_mock' }),
    },
  }));
  return { default: MockStripe };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/activityLogger.js', () => ({
  activityLogger: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../src/services/email.service.js', () => ({
  emailService: { sendEmail: vi.fn().mockResolvedValue(true) },
}));

const mockChain = {
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  lte: vi.fn(),
  gte: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  filter: vi.fn(),
};
Object.keys(mockChain).forEach((k) => {
  (mockChain as any)[k].mockReturnValue(mockChain);
});

vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

import { chargebackService, type Chargeback } from '../../src/services/chargeback.service.js';

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockChain).forEach((k) => {
    (mockChain as any)[k].mockReturnValue(mockChain);
  });
});

const fakeChargeback: Chargeback = {
  id: 'cb-1',
  payment_id: 'pay-1',
  stripe_dispute_id: 'dp_abc123',
  stripe_charge_id: 'ch_abc123',
  amount: 150,
  currency: 'EUR',
  reason: 'fraudulent',
  status: 'needs_response',
  evidence_submitted: null,
  due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  resolved_at: null,
  outcome: null,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('getEvidenceTemplate (pure)', () => {
  it('returns a template for fraudulent', () => {
    const template = chargebackService.getEvidenceTemplate('fraudulent');
    expect(template).toBeDefined();
    expect(typeof template.uncategorized_text).toBe('string');
  });

  it('returns a template for duplicate', () => {
    const template = chargebackService.getEvidenceTemplate('duplicate');
    expect(template.product_description).toBeDefined();
  });

  it('returns general template for unknown reason', () => {
    const template = chargebackService.getEvidenceTemplate('some_unknown_reason');
    expect(template.uncategorized_text).toBeDefined();
  });

  it('returns a template for subscription_canceled', () => {
    const template = chargebackService.getEvidenceTemplate('subscription_canceled');
    expect(template.refund_policy).toBeDefined();
  });

  it('returns a template for product_not_received', () => {
    const template = chargebackService.getEvidenceTemplate('product_not_received');
    expect(template.service_date).toBeDefined();
  });

  it('returns a template for credit_not_processed', () => {
    const template = chargebackService.getEvidenceTemplate('credit_not_processed');
    expect(template.refund_policy).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getById', () => {
  it('returns the chargeback when found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: fakeChargeback, error: null });

    const result = await chargebackService.getById('cb-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cb-1');
    expect(mockChain.from).toHaveBeenCalledWith('chargebacks');
  });

  it('returns null when DB returns an error', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const result = await chargebackService.getById('cb-x');

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('calculates win rate and average amount', async () => {
    const rows = [
      { status: 'won', outcome: 'won', amount: 200 },
      { status: 'won', outcome: 'won', amount: 100 },
      { status: 'lost', outcome: 'lost', amount: 50 },
      { status: 'needs_response', outcome: null, amount: 300 },
      { status: 'under_review', outcome: null, amount: 150 },
    ];
    mockChain.gte.mockResolvedValueOnce({ data: rows, error: null });

    const stats = await chargebackService.getStats('month');

    expect(stats.total_count).toBe(5);
    expect(stats.won).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.needs_response).toBe(1);
    expect(stats.under_review).toBe(1);
    // win_rate = 2 / (2+1) * 100 ≈ 66.67
    expect(stats.win_rate).toBeCloseTo(66.67, 1);
    // total = 200+100+50+300+150 = 800, average = 160
    expect(stats.average_amount).toBe(160);
  });

  it('returns zero win_rate when no resolved chargebacks', async () => {
    const rows = [{ status: 'needs_response', outcome: null, amount: 100 }];
    mockChain.gte.mockResolvedValueOnce({ data: rows, error: null });

    const stats = await chargebackService.getStats();

    expect(stats.win_rate).toBe(0);
    expect(stats.won).toBe(0);
    expect(stats.lost).toBe(0);
  });

  it('returns zeros on empty data', async () => {
    mockChain.gte.mockResolvedValueOnce({ data: [], error: null });

    const stats = await chargebackService.getStats();

    expect(stats.total_count).toBe(0);
    expect(stats.average_amount).toBe(0);
    expect(stats.win_rate).toBe(0);
  });

  it('throws on DB error', async () => {
    mockChain.gte.mockResolvedValueOnce({ data: null, error: new Error('db error') });

    await expect(chargebackService.getStats()).rejects.toThrow('db error');
  });

  it('accepts quarter and year periods', async () => {
    mockChain.gte.mockResolvedValue({ data: [], error: null });

    await expect(chargebackService.getStats('quarter')).resolves.toBeDefined();
    await expect(chargebackService.getStats('year')).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('list', () => {
  it('returns data and total with no filters', async () => {
    mockChain.range.mockResolvedValueOnce({
      data: [fakeChargeback],
      count: 1,
      error: null,
    });

    const result = await chargebackService.list({});

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by status', async () => {
    mockChain.range.mockResolvedValueOnce({ data: [], count: 0, error: null });

    const result = await chargebackService.list({ status: 'won' });

    expect(result.total).toBe(0);
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'won');
  });

  it('returns empty result when nothing matches', async () => {
    mockChain.range.mockResolvedValueOnce({ data: [], count: 0, error: null });

    const result = await chargebackService.list({ status: 'lost' });

    expect(result.data).toEqual([]);
  });

  it('throws on DB error', async () => {
    mockChain.range.mockResolvedValueOnce({ data: null, count: null, error: new Error('db err') });

    await expect(chargebackService.list({})).rejects.toThrow('db err');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('submitEvidence', () => {
  it('throws when chargeback is not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    await expect(
      chargebackService.submitEvidence('cb-x', {}, 'admin-1')
    ).rejects.toThrow('Chargeback not found');
  });

  it('throws when status is not needs_response', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { ...fakeChargeback, status: 'under_review' },
      error: null,
    });

    await expect(
      chargebackService.submitEvidence('cb-1', {}, 'admin-1')
    ).rejects.toThrow('Cannot submit evidence');
  });

  it('submits evidence and moves status to under_review', async () => {
    // getById
    mockChain.single.mockResolvedValueOnce({ data: fakeChargeback, error: null });
    // update result
    mockChain.single.mockResolvedValueOnce({
      data: { ...fakeChargeback, status: 'under_review', evidence_submitted: { customer_name: 'Test' } },
      error: null,
    });

    const result = await chargebackService.submitEvidence(
      'cb-1',
      { customer_name: 'Test User', customer_email: 'test@test.com' },
      'admin-1'
    );

    expect(result.status).toBe('under_review');
    expect(result.evidence_submitted).toBeDefined();
  });
});
