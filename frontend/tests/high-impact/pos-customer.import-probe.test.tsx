import { describe, expect, it } from 'vitest';

import CustomerPOSTemplate from '../../src/components/pos-templates/CustomerPOSTemplate';

describe('CustomerPOSTemplate import probe', () => {
  it('imports as a component function', () => {
    expect(typeof CustomerPOSTemplate).toBe('function');
  });
});