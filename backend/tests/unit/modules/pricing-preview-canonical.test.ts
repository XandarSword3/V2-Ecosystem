import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const { mockSupabase, mockCalculatePricing } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn(),
    },
    mockCalculatePricing: vi.fn(),
  };
});

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
  supabase: mockSupabase,
}));

vi.mock('../../../src/database/supabase.js', () => ({
  getSupabase: () => mockSupabase,
  getSupabaseAdmin: () => mockSupabase,
}));

vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: mockSupabase,
  getSupabase: () => mockSupabase,
  supabaseAdmin: mockSupabase,
}));

vi.mock('../../../src/engines/currency-resolver.js', () => ({
  resolveModuleCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('../../../src/services/tax.service.js', () => ({
  TaxService: class {
    getTaxRate = vi.fn().mockResolvedValue(0.1);
    computeTaxBreakdown = vi.fn().mockResolvedValue([]);
    computeFeeBreakdown = vi.fn().mockResolvedValue([]);
  },
  getModuleTaxCategory: vi.fn().mockResolvedValue('food'),
  resolveTaxCategory: vi.fn().mockReturnValue('food'),
}));

vi.mock('../../../src/services/catalog-pricing.service.js', () => ({
  resolveAndPriceCatalogItems: vi.fn().mockResolvedValue({
    resolvedItems: [
      {
        itemId: 'item-pizza-1',
        name: 'Margherita Pizza',
        basePrice: 20.0,
        quantity: 1,
        modifierAdjustment: 0,
        taxCategory: 'food',
        metadata: {},
      },
    ],
    nameMap: new Map(),
    priceMap: new Map(),
    validationErrors: [],
  }),
}));

vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({
    calculatePricing: (...args: any[]) => mockCalculatePricing(...args),
  }),
}));

import pricingRouter from '../../../src/modules/admin/pricing.controller.js';

describe('Pricing Preview Controller — Canonical Fulfillment & Property Resolution Hardening', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/pricing', pricingRouter);
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('EXPRESS_ERROR:', err);
      res.status(err.statusCode || 500).json({ success: false, error: err.message });
    });

    // Mock module fetch
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'modules') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  template_type: 'instant_transaction',
                  property_id: 'prop-canonical-a',
                  tax_category: 'food',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockCalculatePricing.mockImplementation(async (templateType, lineItems, context) => {
      // Simulate mode-dependent pricing: delivery fee applied when fulfillmentMode is local_delivery
      const isDelivery = context.conditions?.fulfillmentMode === 'local_delivery';
      const subtotal = 20.0;
      const deliveryFee = isDelivery ? 5.0 : 0.0;
      const taxAmount = 2.0;
      const totalAmount = subtotal + taxAmount + deliveryFee;

      return {
        subtotal,
        taxAmount,
        taxBreakdown: [{ name: 'VAT', rate: 10, amount: taxAmount }],
        feeBreakdown: isDelivery ? [{ name: 'Delivery Surcharge', amount: 5.0 }] : [],
        serviceCharge: 0,
        deliveryFee,
        totalDiscount: 0,
        discounts: [],
        totalAmount,
        currency: context.currency || 'USD',
      };
    });
  });

  it('aligns pricing preview with canonical fulfillmentMode and produces mode-dependent pricing', async () => {
    // 1. Preview with pickup
    const pickupRes = await request(app)
      .post('/pricing/preview')
      .send({
        moduleId: 'mod-pizza-1',
        items: [{ itemId: 'item-pizza-1', quantity: 1 }],
        conditions: { fulfillmentMode: 'pickup', paymentMethod: 'card' },
      });

    expect(pickupRes.status).toBe(200);
    expect(pickupRes.body.success).toBe(true);
    expect(pickupRes.body.data.deliveryFee).toBe(0.0);
    expect(pickupRes.body.data.totalAmount).toBe(22.0);

    // 2. Preview same cart with local_delivery
    const deliveryRes = await request(app)
      .post('/pricing/preview')
      .send({
        moduleId: 'mod-pizza-1',
        items: [{ itemId: 'item-pizza-1', quantity: 1 }],
        conditions: { fulfillmentMode: 'local_delivery', paymentMethod: 'card' },
      });

    expect(deliveryRes.status).toBe(200);
    expect(deliveryRes.body.success).toBe(true);
    expect(deliveryRes.body.data.deliveryFee).toBe(5.0);
    expect(deliveryRes.body.data.totalAmount).toBe(27.0);

    // Verify engine calculation received canonical fulfillmentMode in conditions
    expect(mockCalculatePricing).toHaveBeenLastCalledWith(
      'instant_transaction',
      expect.any(Array),
      expect.objectContaining({
        conditions: expect.objectContaining({
          fulfillmentMode: 'local_delivery',
          paymentMethod: 'card',
        }),
      })
    );
  });

  it('tightens property resolution: module belongs to Property A, spoofed body.propertyId=Property B is ignored', async () => {
    const res = await request(app)
      .post('/pricing/preview')
      .send({
        moduleId: 'mod-pizza-1',
        items: [{ itemId: 'item-pizza-1', quantity: 1 }],
        propertyId: 'prop-malicious-b', // Attempt to spoof Property B settings
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Engine service MUST receive canonical property_id from module ('prop-canonical-a'), not spoofed body.propertyId
    expect(mockCalculatePricing).toHaveBeenCalledWith(
      'instant_transaction',
      expect.any(Array),
      expect.objectContaining({
        propertyId: 'prop-canonical-a',
      })
    );
  });
});
