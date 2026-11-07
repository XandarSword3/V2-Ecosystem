import { describe, it, expect } from 'vitest';
import { validateApiRoute, normalizeApiPath } from '@/lib/api-contract';

describe('API Route Contract & Drift Guard', () => {
  it('detects and flags invalid route drift to /admin/tenants', () => {
    const result = validateApiRoute('/admin/tenants');
    expect(result.valid).toBe(false);
    expect(result.suggestion?.suggestedPath).toBe('/platform/tenants');
    expect(result.error).toContain('Use "/platform/tenants" instead');
  });

  it('detects and flags invalid route drift to /admin/plans', () => {
    const result = validateApiRoute('/admin/plans');
    expect(result.valid).toBe(false);
    expect(result.suggestion?.suggestedPath).toBe('/platform/plans');
  });

  it('validates canonical Engine E platform routes', () => {
    expect(validateApiRoute('/platform/tenants').valid).toBe(true);
    expect(validateApiRoute('/platform/plans').valid).toBe(true);
    expect(validateApiRoute('/platform/checkout').valid).toBe(true);
    expect(validateApiRoute('/platform/stats').valid).toBe(true);
    expect(validateApiRoute('/platform/subscriptions').valid).toBe(true);
  });

  it('validates canonical Engine A commerce & catalog routes', () => {
    expect(validateApiRoute('/payments/create-intent').valid).toBe(true);
    expect(validateApiRoute('/payments/process').valid).toBe(true);
    expect(validateApiRoute('/admin/modules').valid).toBe(true);
    expect(validateApiRoute('/inventory/items').valid).toBe(true);
    expect(validateApiRoute('/restaurant/menu').valid).toBe(true);
  });

  it('correctly normalizes nested urls, query params, and api/v1 prefixes', () => {
    expect(normalizeApiPath('/api/v1/platform/tenants?active=true')).toBe('/platform/tenants');
    expect(normalizeApiPath('http://localhost:3000/api/v1/platform/plans#heading')).toBe('/platform/plans');
    expect(normalizeApiPath('/admin/modules/123-uuid')).toBe('/admin/modules/123-uuid');
  });
});
