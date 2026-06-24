import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredPropertyId,
  isValidPropertyId,
  setStoredPropertyId,
} from '@/lib/property-id';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DEFAULT_PROPERTY_UUID = '00000000-0000-0000-0000-000000000001';

describe('property-id', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts valid UUID values', () => {
    expect(isValidPropertyId(VALID_UUID)).toBe(true);
  });

  it('accepts the seeded default property UUID (not v4)', () => {
    expect(isValidPropertyId(DEFAULT_PROPERTY_UUID)).toBe(true);
  });

  it('rejects null, undefined, and garbage strings', () => {
    expect(isValidPropertyId(null)).toBe(false);
    expect(isValidPropertyId(undefined)).toBe(false);
    expect(isValidPropertyId('null')).toBe(false);
    expect(isValidPropertyId('undefined')).toBe(false);
    expect(isValidPropertyId('')).toBe(false);
    expect(isValidPropertyId('not-a-uuid')).toBe(false);
  });

  it('purges invalid stored values on read', () => {
    localStorage.setItem('activePropertyId', 'null');
    expect(getStoredPropertyId()).toBeNull();
    expect(localStorage.getItem('activePropertyId')).toBeNull();
  });

  it('round-trips valid UUIDs through storage helpers', () => {
    setStoredPropertyId(VALID_UUID);
    expect(getStoredPropertyId()).toBe(VALID_UUID);
  });

  it('removes storage when setting null or invalid id', () => {
    setStoredPropertyId(VALID_UUID);
    setStoredPropertyId(null);
    expect(getStoredPropertyId()).toBeNull();
  });
});
