/**
 * Money — canonical monetary value object tests (adversarial).
 *
 * Proves the DOMAIN.md F2/F3 hardening requirements:
 *   - authoritative arithmetic NEVER goes through unsafe Number (bigint minor units)
 *   - real rounding policies applied to the bigint remainder (not float approximations)
 *   - FX conversion consumes IMMUTABLE exchange-rate facts, never arbitrary numbers
 *   - currency validation is SEMANTIC (ISO 4217 registry), not merely /^[A-Z]{3}$/
 *   - target currency precision derives from ISO 4217 metadata
 *   - currency mismatch and invalid/missing configuration fail closed (loud errors)
 */
import { describe, it, expect } from 'vitest';
import {
  Money,
  CurrencyMismatchError,
  InvalidCurrencyError,
  MissingExchangeRateFactError,
  convertAmount,
  currencyDecimals,
  divideAndRound,
  rational,
  rationalEqual,
  rationalFromDecimal,
  roundMoney,
  toMinorUnits,
  validateCurrency,
  type ExchangeRateFact,
} from '../../../src/engines/money.js';

// A canonical immutable fact used across conversion tests.
const USD_TO_EUR: ExchangeRateFact = {
  fromCurrency: 'USD',
  toCurrency: 'EUR',
  rate: rationalFromDecimal('0.9255'),
  asOf: '2026-08-20T00:00:00Z',
  provider: 'test',
};

const EUR_TO_USD: ExchangeRateFact = {
  fromCurrency: 'EUR',
  toCurrency: 'USD',
  rate: rationalFromDecimal('1.08'),
  asOf: '2026-08-20T00:00:00Z',
  provider: 'test',
};

describe('Money — exact arithmetic (no unsafe Number)', () => {
  it('0.1 + 0.2 === 0.3 exactly (bigint minor units)', () => {
    const sum = Money.fromDecimal('0.1', 'EUR').add(Money.fromDecimal('0.2', 'EUR'));
    expect(sum.minorUnits).toBe(30n);
    expect(sum.amount()).toBe(0.3);
  });

  it('accumulates many small amounts without drift', () => {
    let acc = Money.zero('EUR');
    for (let i = 0; i < 1000; i++) acc = acc.add(Money.fromDecimal('0.01', 'EUR'));
    expect(acc.minorUnits).toBe(1000n); // 1000 × 1 minor unit
    expect(acc.amount()).toBe(10);
  });

  it('stays exact far beyond 2^53 (Number precision limit)', () => {
    // 9,007,199,254,740,993 = 2^53 + 1 — representable in bigint, NOT in Number minor units.
    const huge = Money.fromDecimal('9007199254740993.00', 'EUR');
    const sum = huge.add(Money.fromDecimal('1.00', 'EUR'));
    expect(sum.minorUnits).toBe(900719925474099400n);
    // Number-based addition would silently lose this (900719925474099400 vs …392);
    // bigint addition is exact.
    expect(sum.minorUnits - 900719925474099400n).toBe(0n);
  });

  it('multiplies by exact rationals with real remainder rounding', () => {
    const ten = Money.fromDecimal('10.00', 'EUR');
    expect(ten.multiplyBy(rational(1n, 3n)).amount()).toBe(3.33);      // round
    expect(ten.multiplyBy(rational(1n, 3n), 'ceil').amount()).toBe(3.34); // ceil
    expect(ten.multiplyBy(rational(1n, 3n), 'floor').amount()).toBe(3.33); // floor
    expect(ten.multiplyBy(rational(2n, 3n)).amount()).toBe(6.67);
    expect(Money.fromDecimal('0.01', 'EUR').multiplyBy(rational(1n, 3n)).amount()).toBe(0);
  });

  it('rounds negative remainders half away from zero', () => {
    expect(divideAndRound(-5n, 2n, 'round')).toBe(-3n); // half away from zero
    expect(divideAndRound(5n, 2n, 'round')).toBe(3n);
    expect(divideAndRound(-5n, 2n, 'floor')).toBe(-3n); // floor toward −∞
    expect(divideAndRound(5n, 2n, 'floor')).toBe(2n);
    expect(divideAndRound(-5n, 2n, 'ceil')).toBe(-2n);  // ceil toward +∞
    expect(divideAndRound(5n, 2n, 'ceil')).toBe(3n);
    expect(divideAndRound(-4n, 2n, 'round')).toBe(-2n); // exact division
  });

  it('subtract / negate / abs / compare are exact and currency-safe', () => {
    expect(Money.fromDecimal('1.00', 'USD').subtract(Money.fromDecimal('0.33', 'USD')).amount()).toBe(0.67);
    expect(Money.fromDecimal('3.14', 'EUR').negate().amount()).toBe(-3.14);
    expect(Money.fromDecimal('-3.14', 'EUR').abs().amount()).toBe(3.14);
    expect(Money.fromDecimal('1', 'EUR').compare(Money.fromDecimal('1.00', 'EUR'))).toBe(0);
    expect(() => Money.fromDecimal('1', 'EUR').add(Money.fromDecimal('1', 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('boundary numbers convert via their exact decimal representation', () => {
    expect(Money.fromDecimal(19.99, 'USD').minorUnits).toBe(1999n);
    expect(Money.fromDecimal(0.1, 'EUR').minorUnits).toBe(10n);
    expect(() => Money.fromDecimal(NaN, 'EUR')).toThrow();
    expect(() => Money.fromDecimal(Infinity, 'USD')).toThrow();
  });
});

describe('Money — real rounding policies', () => {
  it('rounds 1.005 to 1.01 (half away from zero, not banker\u2019s)', () => {
    expect(Money.fromDecimal('1.005', 'USD').minorUnits).toBe(101n);
    expect(roundMoney(1.005, 'round', 2)).toBe(1.01);
    expect(roundMoney(1.005, 'floor', 2)).toBe(1);
    expect(roundMoney(1.004, 'ceil', 2)).toBe(1.01);
  });

  it('withDecimals applies the real policy to the exact remainder', () => {
    const m = Money.fromDecimal('100.55', 'USD');
    expect(m.withDecimals(0, 'round').amount()).toBe(101);
    expect(m.withDecimals(0, 'floor').amount()).toBe(100);
    expect(m.withDecimals(0, 'ceil').amount()).toBe(101);
    expect(Money.fromDecimal('100.50', 'USD').withDecimals(0, 'round').amount()).toBe(101); // half away
    expect(Money.fromDecimal('100.49', 'USD').withDecimals(0, 'round').amount()).toBe(100);
    expect(Money.fromDecimal('100.55', 'USD').withDecimals(0).minorUnits).toBe(101n);
  });
});

describe('Money — semantic currency validation (not just /^[A-Z]{3}$/)', () => {
  it('accepts real ISO 4217 codes', () => {
    for (const code of ['USD', 'EUR', 'JPY', 'KWD', 'BHD', 'CLP', 'CHF']) {
      expect(() => validateCurrency(code)).not.toThrow();
    }
  });

  it('rejects malformed and non-registry codes', () => {
    for (const bad of ['eur', 'EU', 'EURO', '', 'US1', 'USD ', 'ZZZ', 'ABC', 'XXX', 123 as unknown as string, null as unknown as string]) {
      expect(() => validateCurrency(bad), `expected ${String(bad)} to be rejected`).toThrow(InvalidCurrencyError);
    }
  });

  it('derives minor-unit precision from ISO 4217 metadata', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
    expect(currencyDecimals('BHD')).toBe(3);
    expect(currencyDecimals('CLP')).toBe(0);
  });

  it('Money construction uses the currency\u2019s own precision', () => {
    expect(Money.fromDecimal('1.234', 'USD').amount()).toBe(1.23);   // 2 decimals
    expect(Money.fromDecimal('1.234', 'KWD').amount()).toBe(1.234);  // 3 decimals
    expect(Money.fromDecimal('12.99', 'JPY').amount()).toBe(13);     // 0 decimals (round half-up at boundary)
    expect(Money.fromDecimal('12.49', 'JPY').amount()).toBe(12);
    expect(Money.zero('JPY').decimals).toBe(0);
  });

  it('toMinorUnits parses exactly and rounds half-up on excess digits', () => {
    expect(toMinorUnits('19.99', 2)).toBe(1999n);
    expect(toMinorUnits('19.995', 2)).toBe(2000n);
    expect(toMinorUnits('19.994', 2)).toBe(1999n);
    expect(toMinorUnits('0.123', 3)).toBe(123n);
    expect(toMinorUnits('-5.50', 2)).toBe(-550n);
    expect(() => toMinorUnits('abc', 2)).toThrow();
    expect(() => toMinorUnits('1.2.3', 2)).toThrow();
  });
});

describe('Money — FX conversion consumes immutable facts only', () => {
  it('converts using an immutable fact, never an arbitrary number', () => {
    const usd = Money.fromDecimal('123.45', 'USD').convertUsingFact(USD_TO_EUR);
    expect(usd.currency).toBe('EUR');
    // 123.45 * 0.9255 = 114.252975 → round half away → 114.25
    expect(usd.minorUnits).toBe(11425n);
    expect(usd.amount()).toBe(114.25);
  });

  it('rejects conversion with a fact for the wrong source currency', () => {
    expect(() => Money.fromDecimal('10.00', 'EUR').convertUsingFact(USD_TO_EUR)).toThrow(CurrencyMismatchError);
  });

  it('derives the TARGET precision from the target currency metadata', () => {
    // JPY has 0 minor units: 10.00 USD * 150 = 1,500 JPY (integer, no decimals).
    const jpy = Money.fromDecimal('10.00', 'USD').convertUsingFact({
      fromCurrency: 'USD',
      toCurrency: 'JPY',
      rate: rationalFromDecimal('150'),
      asOf: '2026-08-20T00:00:00Z',
      provider: 'test',
    });
    expect(jpy.currency).toBe('JPY');
    expect(jpy.decimals).toBe(0);
    expect(jpy.minorUnits).toBe(1500n);
    expect(jpy.amount()).toBe(1500);

    // KWD has 3 minor units: 1.00 USD * 0.308 = 0.308 KWD.
    const kwd = Money.fromDecimal('1.00', 'USD').convertUsingFact({
      fromCurrency: 'USD',
      toCurrency: 'KWD',
      rate: rationalFromDecimal('0.308'),
      asOf: '2026-08-20T00:00:00Z',
      provider: 'test',
    });
    expect(kwd.decimals).toBe(3);
    expect(kwd.minorUnits).toBe(308n);
  });

  it('conversion is reproducible from the same fact', () => {
    const first = Money.fromDecimal('123.45', 'USD').convertUsingFact(USD_TO_EUR);
    const second = Money.fromDecimal('123.45', 'USD').convertUsingFact(USD_TO_EUR);
    expect(first.equals(second)).toBe(true);
    expect(first.amount()).toBe(second.amount());
  });

  it('a rounding policy applies to the exact remainder of a conversion', () => {
    // 1.00 USD * 0.9255 = 0.9255 EUR → round 0.93, floor 0.92, ceil 0.93.
    const one = Money.fromDecimal('1.00', 'USD');
    expect(one.convertUsingFact(USD_TO_EUR).amount()).toBe(0.93);
    expect(one.convertUsingFact(USD_TO_EUR, 'floor').amount()).toBe(0.92);
    expect(one.convertUsingFact(USD_TO_EUR, 'ceil').amount()).toBe(0.93);
  });

  it('convertAmount helper requires a fact and keeps same-currency identity', () => {
    expect(convertAmount(5, 'EUR', 'EUR', EUR_TO_USD)).toBe(5);
    expect(convertAmount(10, 'EUR', 'USD', EUR_TO_USD)).toBe(10.8);
    // No raw-number overload exists: the helper signature forces a fact.
    expect(() => (convertAmount as unknown as (a: number, f: string, t: string, r: number) => number)(10, 'EUR', 'USD', 1.08)).toThrow();
  });

  it('MissingExchangeRateFactError is the contract when no fact exists', () => {
    expect(() => {
      throw new MissingExchangeRateFactError('USD', 'JPY');
    }).toThrow(/No exchange-rate fact from USD to JPY/);
  });

  it('rates parse from decimal strings exactly', () => {
    expect(rationalFromDecimal('1.08').n).toBe(108n);
    expect(rationalFromDecimal('1.08').d).toBe(100n);
    // rationals are not reduced; equality is cross-multiplication.
    expect(rationalFromDecimal('-0.5').n).toBe(-5n);
    expect(rationalFromDecimal('-0.5').d).toBe(10n);
    expect(rationalEqual(rationalFromDecimal('-0.5'), rational(-1n, 2n))).toBe(true);
    expect(() => rationalFromDecimal('abc')).toThrow();
  });
});

describe('Money — construction edge cases', () => {
  it('handles negative and signed values', () => {
    expect(Money.fromDecimal('-5.50', 'EUR').amount()).toBe(-5.5);
    expect(Money.fromDecimal('+5', 'EUR').amount()).toBe(5);
  });

  it('zero is currency-bound and compares equal across spellings', () => {
    expect(Money.zero('EUR').isZero()).toBe(true);
    expect(Money.zero('EUR').add(Money.fromDecimal('0.00', 'EUR')).equals(Money.zero('EUR'))).toBe(true);
  });

  it('JSON serialization is a boundary with explicit currency', () => {
    const m = Money.fromDecimal('19.99', 'USD');
    expect(m.toJSON()).toEqual({ amount: 19.99, currency: 'USD' });
    expect(JSON.parse(JSON.stringify(m))).toEqual({ amount: 19.99, currency: 'USD' });
  });
});
