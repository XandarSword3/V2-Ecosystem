/**
 * Money — canonical monetary value object for Engine A.
 *
 * THE FINANCIAL INVARIANTS (DOMAIN.md F2/F3), enforced here:
 *   - Every monetary value carries a SEMANTICALLY valid ISO 4217 currency —
 *     not just 3 uppercase letters. The currency must exist in the ISO 4217
 *     registry and its minor-unit precision comes from that registry.
 *   - Authoritative arithmetic NEVER goes through unsafe `Number`: addition,
 *     subtraction, multiplication and conversion operate on integer minor
 *     units (bigint) with rational (numerator/denominator) rates, so there is
 *     no float drift at any magnitude, including far beyond 2^53.
 *   - Rounding policies are REAL: the remainder of an exact division is
 *     rounded per the policy (round half away from zero / floor / ceil),
 *     applied to the bigint remainder — never to a float approximation.
 *   - Cross-currency conversion consumes an IMMUTABLE exchange-rate fact
 *     (from, to, rational rate, as-of, provider). Arbitrary float rates are
 *     not accepted.
 *
 * Boundary notes: `number` inputs/outputs are only conversions AT the edge
 * (JSON serialization, legacy callers). Input numbers are converted to their
 * exact decimal string representation first (bounded to 12 digits) — they are
 * never part of arithmetic. Output `amount()` divides bigint minor units by a
 * power of ten, exact within 2^53 minor units.
 */

export type Currency = string; // ISO 4217 alphabetic code, uppercase

export type RoundingPolicy = 'round' | 'floor' | 'ceil';

export interface MoneyJSON {
  amount: number;
  currency: Currency;
}

// ============================================================
// 1. ISO 4217 registry — semantic currency validation (F2)
// ============================================================

/**
 * Minor-unit digits per ISO 4217 code (the authoritative precision for every
 * monetary value and the target precision for conversions — item 8). Most
 * currencies use 2; several use 0 (no minor unit) or 3.
 */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  // 3 minor units
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // 0 minor units
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 2 minor units — all remaining active ISO 4217 codes
  AED: 2, AFN: 2, ALL: 2, AMD: 2, ANG: 2, AOA: 2, ARS: 2, AUD: 2, AWG: 2,
  AZN: 2, BAM: 2, BBD: 2, BDT: 2, BGN: 2, BMD: 2, BND: 2, BOB: 2, BRL: 2,
  BSD: 2, BTN: 2, BWP: 2, BYN: 2, BZD: 2, CAD: 2, CDF: 2, CHF: 2, CNY: 2,
  COP: 2, CRC: 2, CUP: 2, CVE: 2, CZK: 2, DKK: 2, DOP: 2, DZD: 2, EGP: 2,
  ERN: 2, ETB: 2, EUR: 2, FJD: 2, FKP: 2, GBP: 2, GEL: 2, GHS: 2, GIP: 2,
  GMD: 2, GYD: 2, HKD: 2, HNL: 2, HRK: 2, HTG: 2, HUF: 2, IDR: 2, ILS: 2,
  INR: 2, IRR: 2, JMD: 2, KES: 2, KGS: 2, KHR: 2, KID: 2, KPW: 2, KYD: 2,
  KZT: 2, LAK: 2, LBP: 2, LKR: 2, LRD: 2, LSL: 2, MAD: 2, MDL: 2, MGA: 2,
  MKD: 2, MMK: 2, MNT: 2, MOP: 2, MRU: 2, MUR: 2, MVR: 2, MWK: 2, MXN: 2,
  MYR: 2, MZN: 2, NAD: 2, NGN: 2, NIO: 2, NOK: 2, NPR: 2, NZD: 2, PAB: 2,
  PEN: 2, PGK: 2, PHP: 2, PKR: 2, PLN: 2, QAR: 2, RON: 2, RSD: 2, RUB: 2,
  SAR: 2, SBD: 2, SCR: 2, SDG: 2, SEK: 2, SGD: 2, SHP: 2, SLE: 2, SLL: 2,
  SOS: 2, SRD: 2, SSP: 2, STN: 2, SVC: 2, SYP: 2, SZL: 2, THB: 2, TJS: 2,
  TMT: 2, TOP: 2, TRY: 2, TTD: 2, TWD: 2, TZS: 2, UAH: 2, USD: 2, UYU: 2,
  UZS: 2, VES: 2, WST: 2, XCD: 2, YER: 2, ZAR: 2, ZMW: 2, ZWG: 2,
};

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Thrown when a currency code is missing, malformed, or not a real ISO 4217 code. */
export class InvalidCurrencyError extends Error {
  public readonly code = 'INVALID_CURRENCY';
  constructor(currency: unknown) {
    super(
      `Invalid currency: '${String(currency)}'. Expected a valid ISO 4217 alphabetic code (e.g. EUR, USD, KWD).`,
    );
    this.name = 'InvalidCurrencyError';
  }
}

/** Thrown when a monetary operation crosses currencies. */
export class CurrencyMismatchError extends Error {
  public readonly code = 'CURRENCY_MISMATCH';
  public readonly left: Currency;
  public readonly right: Currency;
  constructor(left: Currency, right: Currency) {
    super(`Currency mismatch: cannot combine ${left} and ${right}`);
    this.name = 'CurrencyMismatchError';
    this.left = left;
    this.right = right;
  }
}

/**
 * Validate a currency SEMANTICALLY: pattern + ISO 4217 registry membership.
 * A code that is 3 uppercase letters but not a real currency fails closed.
 */
export function validateCurrency(currency: unknown): asserts currency is Currency {
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency) || !(currency in CURRENCY_DECIMALS)) {
    throw new InvalidCurrencyError(currency);
  }
}

/** Minor-unit precision for a currency, from ISO 4217 metadata (never hardcoded 2). */
export function currencyDecimals(currency: Currency): number {
  validateCurrency(currency);
  return CURRENCY_DECIMALS[currency];
}

// ============================================================
// 2. Exact rational numbers for rates
// ============================================================

/**
 * An exact rate as a fraction. Rates come from immutable exchange-rate facts
 * (or decimal strings) — never from float multiplication.
 */
export interface Rational {
  n: bigint; // numerator
  d: bigint; // denominator, always > 0
}

export function rational(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new Error('Rational denominator cannot be zero');
  if (d < 0n) return { n: -n, d: -d };
  return { n, d };
}

/** Parse a decimal string into an exact rational ("1.08" → 108/100). */
export function rationalFromDecimal(input: string): Rational {
  const trimmed = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match) throw new Error(`Cannot parse rate: '${input}'`);
  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = BigInt(match[2]);
  const frac = match[3] ?? '';
  const den = BigInt(Math.pow(10, frac.length));
  const num = intPart * den + (frac === '' ? 0n : BigInt(frac));
  return rational(sign * num, den);
}

/**
 * Convert a number rate to an exact rational via its decimal representation
 * (bounded to 12 significant digits). Deterministic; used only at the legacy
 * boundary. Prefer rationalFromDecimal for authoritative input.
 */
export function rationalFromNumber(rate: number): Rational {
  if (!Number.isFinite(rate)) throw new Error(`Cannot build a rational rate from non-finite number: ${rate}`);
  return rationalFromDecimal(rate.toFixed(12).replace(/0+$/, '') || '0');
}

export function rationalEqual(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d;
}

// ============================================================
// 3. Exact minor-unit conversion
// ============================================================

/**
 * Round a bigint division result per policy — the REAL remainder rounding,
 * with correct SIGNED semantics (floor rounds toward −∞, ceil toward +∞):
 *
 *   divideAndRound( 5, 2, 'round') =  3   (half away from zero)
 *   divideAndRound(-5, 2, 'round') = -3
 *   divideAndRound( 5, 2, 'floor') =  2
 *   divideAndRound(-5, 2, 'floor') = -3
 *   divideAndRound( 5, 2, 'ceil')  =  3
 *   divideAndRound(-5, 2, 'ceil')  = -2
 */
export function divideAndRound(
  num: bigint,
  den: bigint,
  policy: RoundingPolicy,
): bigint {
  if (den === 0n) throw new Error('Division by zero');
  const quotient = num / den; // bigint division truncates toward zero
  const remainder = num % den; // sign follows the dividend
  if (policy === 'round') {
    // Half away from zero on the exact remainder.
    if (remainder < 0n ? -remainder * 2n >= den : remainder * 2n >= den) {
      return num < 0n ? quotient - 1n : quotient + 1n;
    }
    return quotient;
  }
  if (policy === 'floor') {
    return remainder !== 0n && num < 0n ? quotient - 1n : quotient;
  }
  if (policy === 'ceil') {
    return remainder !== 0n && num > 0n ? quotient + 1n : quotient;
  }
  return quotient;
}

// ============================================================
// 4. Exchange-rate facts (immutable, authoritative)
// ============================================================

/**
 * An immutable exchange-rate fact: units of `toCurrency` per 1 unit of
 * `fromCurrency`, at a point in time, from a provider. Conversion NEVER takes
 * an arbitrary number — it consumes one of these (persisted append-only).
 */
export interface ExchangeRateFact {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: Rational; // units of toCurrency per 1 unit of fromCurrency
  asOf: string;   // ISO timestamp
  provider: string;
  source?: string | null;
}

export class MissingExchangeRateFactError extends Error {
  public readonly code = 'EXCHANGE_RATE_FACT_REQUIRED';
  constructor(from: Currency, to: Currency) {
    super(`No exchange-rate fact from ${from} to ${to} — conversion requires an immutable fact`);
    this.name = 'MissingExchangeRateFactError';
  }
}

// ============================================================
// 5. Money
// ============================================================

export class Money {
  readonly currency: Currency;
  readonly minorUnits: bigint;
  readonly decimals: number;

  private constructor(minorUnits: bigint, currency: Currency, decimals: number) {
    this.minorUnits = minorUnits;
    this.currency = currency;
    this.decimals = decimals;
  }

  // ── Factories ──────────────────────────────────────────────────────────────

  static fromDecimal(
    amount: number | string,
    currency: Currency,
    decimals?: number,
  ): Money {
    validateCurrency(currency);
    return new Money(toMinorUnits(amount, decimals ?? currencyDecimals(currency)), currency, decimals ?? currencyDecimals(currency));
  }

  static fromMinor(
    minorUnits: bigint | number,
    currency: Currency,
    decimals?: number,
  ): Money {
    validateCurrency(currency);
    return new Money(BigInt(minorUnits), currency, decimals ?? currencyDecimals(currency));
  }

  static zero(currency: Currency, decimals?: number): Money {
    validateCurrency(currency);
    return new Money(0n, currency, decimals ?? currencyDecimals(currency));
  }

  static assertSameCurrency(left: Money, right: Money): void {
    if (left.currency !== right.currency) {
      throw new CurrencyMismatchError(left.currency, right.currency);
    }
  }

  // ── Exact arithmetic (bigint only) ─────────────────────────────────────────

  add(other: Money): Money {
    Money.assertSameCurrency(this, other);
    if (this.decimals !== other.decimals) {
      throw new Error(`Cannot add ${this.currency} amounts with different precisions (${this.decimals} vs ${other.decimals})`);
    }
    return new Money(this.minorUnits + other.minorUnits, this.currency, this.decimals);
  }

  subtract(other: Money): Money {
    Money.assertSameCurrency(this, other);
    if (this.decimals !== other.decimals) {
      throw new Error(`Cannot subtract ${this.currency} amounts with different precisions (${this.decimals} vs ${other.decimals})`);
    }
    return new Money(this.minorUnits - other.minorUnits, this.currency, this.decimals);
  }

  negate(): Money {
    return new Money(-this.minorUnits, this.currency, this.decimals);
  }

  abs(): Money {
    return this.minorUnits < 0n ? this.negate() : this;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  compare(other: Money): number {
    Money.assertSameCurrency(this, other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.decimals === other.decimals && this.minorUnits === other.minorUnits;
  }

  /**
   * Multiply by an EXACT rational. The remainder of the bigint division is
   * rounded per the REAL rounding policy — no floats anywhere.
   */
  multiplyBy(rate: Rational, policy: RoundingPolicy = 'round'): Money {
    if (rate.d === 0n) throw new Error('Money.multiplyBy: zero denominator');
    const product = this.minorUnits * rate.n;
    return new Money(divideAndRound(product, rate.d, policy), this.currency, this.decimals);
  }

  /**
   * Convert to another currency using an IMMUTABLE exchange-rate fact.
   * Target precision derives from the target currency's ISO 4217 metadata.
   * The exact conversion is:
   *
   *   targetMinor = round( sourceMinor * rate * 10^(targetDecimals - sourceDecimals) )
   *
   * where the exponent is folded into the rational and the division remainder
   * is rounded per policy — all bigint.
   */
  convertUsingFact(fact: ExchangeRateFact, policy: RoundingPolicy = 'round'): Money {
    if (fact.fromCurrency !== this.currency) {
      throw new CurrencyMismatchError(fact.fromCurrency, this.currency);
    }
    validateCurrency(fact.toCurrency);
    if (fact.rate.d === 0n) throw new Error('Money.convertUsingFact: zero denominator in rate');
    const targetDecimals = currencyDecimals(fact.toCurrency);
    const exponent = targetDecimals - this.decimals;

    let numerator = this.minorUnits * fact.rate.n;
    let denominator = fact.rate.d;
    if (exponent > 0) numerator *= BigInt(Math.pow(10, exponent));
    if (exponent < 0) denominator *= BigInt(Math.pow(10, -exponent));

    return new Money(
      divideAndRound(numerator, denominator, policy),
      fact.toCurrency,
      targetDecimals,
    );
  }

  /** Re-round to a different minor-unit precision (exact bigint remainder rounding). */
  withDecimals(decimals: number, policy: RoundingPolicy = 'round'): Money {
    if (decimals === this.decimals) return this;
    const scaleDiff = Math.pow(10, this.decimals - decimals);
    if (scaleDiff >= 1) {
      const rounded = divideAndRound(this.minorUnits, BigInt(scaleDiff), policy);
      return new Money(rounded, this.currency, decimals);
    }
    return new Money(this.minorUnits * BigInt(1 / scaleDiff), this.currency, decimals);
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  /** Decimal number (JSON-compatible). Exact within 2^53 minor units. */
  amount(): number {
    return Number(this.minorUnits) / Math.pow(10, this.decimals);
  }

  toJSON(): MoneyJSON {
    return { amount: this.amount(), currency: this.currency };
  }

  toString(): string {
    return `${this.amount().toFixed(this.decimals)} ${this.currency}`;
  }
}

// ============================================================
// 6. Boundaries — number ↔ minor units
// ============================================================

/**
 * Convert a decimal string/number into integer minor units without float
 * drift. Strings parse exactly. Numbers are converted to their decimal string
 * representation (bounded to 12 significant digits) first — the float is only
 * ever a source of digits, never a participant in arithmetic.
 */
export function toMinorUnits(input: number | string, decimals: number): bigint {
  if (decimals < 0 || decimals > 12) throw new Error(`Unsupported precision: ${decimals}`);
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Cannot build Money from non-finite number: ${input}`);
    }
    // toFixed never produces exponential notation and is deterministic.
    return toMinorUnits(input.toFixed(12), decimals);
  }
  const trimmed = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Cannot parse monetary amount: '${input}'`);
  }
  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = BigInt(match[2]);
  const fracRaw = match[3] ?? '';
  const scale = BigInt(Math.pow(10, decimals));
  const fracPadded = fracRaw.padEnd(decimals, '0').slice(0, decimals);
  let frac = BigInt(fracPadded === '' ? '0' : fracPadded);
  if (fracRaw.length > decimals) {
    const extra = fracRaw.slice(decimals);
    if (extra[0] >= '5') frac += 1n; // round half-up at the boundary
  }
  return sign * (intPart * scale + frac);
}

/** Minor units → decimal number. Exact within 2^53 minor units. */
export function numberFromMinor(minorUnits: bigint, decimals: number): number {
  return Number(minorUnits) / Math.pow(10, decimals);
}

/**
 * Deterministic rounding of a plain number to `decimals` places (legacy
 * boundary only — Money arithmetic never needs it). A tiny epsilon guards the
 * classic binary-float boundary; see the roundMoney doc for the rationale.
 */
export function roundMoney(
  amount: number,
  policy: RoundingPolicy = 'round',
  decimals = 2,
): number {
  const factor = Math.pow(10, decimals);
  const scaled = amount * factor;
  switch (policy) {
    case 'floor':
      return Math.floor(scaled + 1e-9) / factor;
    case 'ceil':
      return Math.ceil(scaled - 1e-9) / factor;
    case 'round':
    default:
      return Math.round(scaled + 1e-9) / factor;
  }
}

/**
 * Legacy cross-currency conversion helper for plain numbers. Requires an
 * immutable exchange-rate fact — never an arbitrary rate.
 */
export function convertAmount(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  fact: ExchangeRateFact,
  policy: RoundingPolicy = 'round',
): number {
  if (fromCurrency === toCurrency) return amount;
  return Money.fromDecimal(amount, fromCurrency)
    .convertUsingFact(fact, policy)
    .amount();
}
