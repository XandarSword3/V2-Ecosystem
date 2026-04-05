import { describe, expect, it } from 'vitest';

import StaffPOSTemplate from '../../src/components/pos-templates/StaffPOSTemplate';

describe('StaffPOSTemplate import probe', () => {
  it('imports as a component function', () => {
    expect(typeof StaffPOSTemplate).toBe('function');
  });
});