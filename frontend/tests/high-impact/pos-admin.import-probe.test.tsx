import { describe, expect, it } from 'vitest';

import AdminPOSTemplate from '../../src/components/pos-templates/AdminPOSTemplate';

describe('AdminPOSTemplate import probe', () => {
  it('imports as a component function', () => {
    expect(typeof AdminPOSTemplate).toBe('function');
  });
});