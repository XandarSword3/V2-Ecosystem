/**
 * Money — canonical monetary value object tests.
 *
 * Proves the DOMAIN.md F2/F3 invariants:
 *   - explicit currency on every value
 *   - no floating-point drift (0.1 + 0.2 === 0.3)
 *   - deterministic rounding
 *   - reproducible conversion
 *   - currency mismatch is a hard error
 */
import { describe, it, expect } from 'vitest';
import {
  Money,
  CurrencyMismatchError,
  InvalidCurrencyError,
  convertAmount,
  roundMoney,
  toMinorUnits,
} from '../../../src/engines/money.js';

describe('Money', () => {
  describe('construction', () => {
    it('builds from decimal strings without float drift', () => {
      const m = Money.fromDecimal('0.1', 'EUR');
      expect(m.minorUnits).toBe(10n);
      expect(m.amount()).toBe(0.1);
    });

    it('builds from decimal numbers', () => {
      expect(Money.fromDecimal(19.99, 'USD').amount()).toBe(19.99);
      expect(Money.fromDecimal(0.1, 'EUR').amount()).toBe(0.1);
    });

    it('rejects invalid currencies', () => {
      expect(() => Money.fromDecimal(1, 'eur')).toThrow(InvalidCurrencyError);
      expect(() => Money.fromDecimal(1, 'EU')).toThrow(InvalidCurrencyError);
      expect(() => Money.fromDecimal(1, '')).toThrow(InvalidCurrencyError);
      expect(() => Money.fromDecimal(1, 123 as unknown as string)).toThrow(InvalidCurrencyError);
    });

    it('rejects non-finite amounts', () => {
      expect(() => Money.fromDecimal(NaN, 'EUR')).toThrow();
      expect(() => Money.fromDecimal(Infinity, 'EUR')).toThrow();
    });

    it('rounds half-up on excess precision', () => {
      expect(Money.fromDecimal('19.995', 'EUR').minorUnits).toBe(2000n); // 19.995 → 20.00
      expect(Money.fromDecimal('19.994', 'EUR').minorUnits).toBe(1999n); // 19.994 → 19.99
    });

    it('handles negative values and signs', () => {
      expect(Money.fromDecimal('-5.50', 'EUR').amount()).toBe(-5.5);
      expect(Money.fromDecimal('+5', 'EUR').amount()).toBe(5);
    });
  });

  describe('arithmetic (no float drift)', () => {
    it('adds exactly', () => {
      const a = Money.fromDecimal('0.1', 'EUR');
      const b = Money.fromDecimal('0.2', 'EUR');
      expect(a.add(b).amount()).toBe(0.3);
      expect(a.add(b).minorUnits).toBe(30n);
    });

    it('subtracts exactly', () => {
      expect(Money.fromDecimal('1.00', 'USD').subtract(Money.fromDecimal('0.33', 'USD')).amount()).toBe(0.67);
    });

    it('negates and abs', () => {
      const m = Money.fromDecimal('3.14', 'EUR');
      expect(m.negate().amount()).toBe(-3.14);
      expect(m.negate().abs().equals(m)).toBe(true);
    });

    it('compares', () => {
      expect(Money.fromDecimal('1', 'EUR').compare(Money.fromDecimal('2', 'EUR'))).toBe(-1);
      expect(Money.fromDecimal('2', 'EUR').compare(Money.fromDecimal('1', 'EUR'))).toBe(1);
      expect(Money.fromDecimal('1', 'EUR').compare(Money.fromDecimal('1.00', 'EUR'))).toBe(0);
    });

    it('throws on currency mismatch', () => {
      expect(() =>
        Money.fromDecimal('1', 'EUR').add(Money.fromDecimal('1', 'USD')),
      ).toThrow(CurrencyMismatchError);
    });
  });

  describe('rounding and conversion', () => {
    it('multiplies deterministically', () => {
      const m = Money.fromDecimal('10.00', 'EUR');
      expect(m.multiplyBy(0.1).amount()).toBe(1);
      expect(m.multiplyBy(0.333).amount()).toBe(3.33);
    });

    it('converts with explicit rate', () => {
      const eur = Money.fromDecimal('10.00', 'EUR');
      const usd = eur.convertTo('USD', 1.08);
      expect(usd.currency).toBe('USD');
      expect(usd.amount()).toBe(10.8);
    });

    it('conversion is reproducible (same input → same output)', () => {
      const rate = 0.9255;
      const first = Money.fromDecimal('123.45', 'USD').convertTo('EUR', rate);
      const second = Money.fromDecimal('123.45', 'USD').convertTo('EUR', rate);
      expect(first.equals(second)).toBe(true);
      expect(first.amount()).toBe(second.amount());
    });

    it('convertAmount helper keeps same-currency identity', () => {
      expect(convertAmount(5, 'EUR', 'EUR', 1)).toBe(5);
    });
  });

  describe('roundMoney', () => {
    it('rounds per policy', () => {
      expect(roundMoney(1.005, 'round', 2)).toBe(1.01);
      expect(roundMoney(1.005, 'floor', 2)).toBe(1);
      expect(roundMoney(1.001, 'ceil', 2)).toBe(1.01);
    });
  });

  describe('toMinorUnits', () => {
    it('parses strings exactly', () => {
      expect(toMinorUnits('19.99', 2)).toBe(1999n);
      expect(toMinorUnits('0.01', 2)).toBe(1n);
      expect(toMinorUnits('100', 2)).toBe(10000n);
      expect(toMinorUnits('100.', 2)).toBe(10000n);
    });

    it('supports 3-decimal currencies', () => {
      expect(toMinorUnits('0.123', 3)).toBe(123n);
      expect(Money.fromDecimal('1.234', 'KWD', 3).amount()).toBe(1.234);
    });

    it('rejects garbage', () => {
      expect(() => toMinorUnits('abc', 2)).toThrow();
      expect(() => toMinorUnits('1.2.3', 2)).toThrow();
    });
  });
});
