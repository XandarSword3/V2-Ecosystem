import { describe, it, expect } from 'vitest';
import { validateApiRoute } from '@/lib/api-contract';

describe('Tenant Admin Page API Route Contract', () => {
  it('confirms the corrected endpoint /platform/tenants is valid according to backend contract', () => {
    const route = '/platform/tenants';
    const validation = validateApiRoute(route);
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('rejects the legacy erroneous endpoint /admin/tenants with a specific remediation suggestion', () => {
    const brokenRoute = '/admin/tenants';
    const validation = validateApiRoute(brokenRoute);
    expect(validation.valid).toBe(false);
    expect(validation.suggestion?.suggestedPath).toBe('/platform/tenants');
    expect(validation.error).toContain('Use "/platform/tenants" instead');
  });
});
