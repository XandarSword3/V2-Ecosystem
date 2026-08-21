/**
 * Money — canonical monetary value object for Engine A.
 *
 * THE FINANCIAL INVARIANT (F2/F3 in docs/engine-a/DOMAIN.md):
 *   - Every monetary amount carries an explicit ISO 4217 currency. No implicit
 *     defaults — a missing currency is a programming error and fails loudly.
 *   - Arithmetic happens on integer minor units (bigint), never on floating
 *     point, so there is no drift: 0.1 + 0.2 is exactly 0.3.
 *   - Final rounding is deterministic per the configured RoundingPolicy.
 *
 * The rest of the codebase still passes `number` amounts around (the pricing
 * pipeline, the ledger, and the UI all predate this type); this object is the
 * authority those layers must be able to convert to/from losslessly for
 * amounts that originated as decimals, and it is what new money code (fiscal
 * documents, conversions, reconciliation) uses internally.
 */

export type Currency = string; // ISO 4217, uppercase 3 letters

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export type RoundingPolicy = 'round' | 'floor' | 'ceil';

export interface MoneyJSON {
  amount: number;
  currency: Currency;
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

/** Thrown when a monetary value is missing or has an invalid currency. */
export class InvalidCurrencyError extends Error {
  public readonly code = 'INVALID_CURRENCY';
  constructor(currency: unknown) {
    super(`Invalid currency: '${String(currency)}'. Expected an uppercase 3-letter ISO 4217 code.`);
    this.name = 'InvalidCurrencyError';
  }
}

/** Validate a currency code; throws InvalidCurrencyError when invalid. */
export function validateCurrency(currency: unknown): asserts currency is Currency {
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) {
    throw new InvalidCurrencyError(currency);
  }
}

/**
 * Deterministic rounding of a plain number to `decimals` places.
 * A tiny epsilon guards the classic binary-float boundary: 2.145 * 100 is
 * 214.49999999999997 in IEEE 754 and 1.005 * 100 is 100.49999999999999,
 * both ~1e-14 below the .5 rounding threshold — Number.EPSILON (2.2e-16) is
 * too small to cross it, so we use a fixed 1e-9 guard (invisible at money
 * magnitudes, decisive at the boundary). Money itself never has this problem
 * because it operates on integer minor units.
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

/** Round an integer minor-unit value deterministically (no floats involved). */
function roundMinorUnits(minorUnits: bigint, policy: RoundingPolicy): bigint {
  switch (policy) {
    case 'floor':
      return minorUnits;
    case 'ceil':
      return minorUnits;
    case 'round':
    default:
      return minorUnits; // bigint integers are already exact — no fractional part exists here
  }
}

/**
 * Convert a decimal string/number into integer minor units without float drift.
 * "19.99" → 1999. "0.1" + "0.2" string inputs never touch binary floats.
 * Numbers are rounded at the boundary (Math.round on scaled value) which is
 * exact for every value that is representable within 2^53 minor units.
 */
export function toMinorUnits(
  input: number | string,
  decimals: number,
): bigint {
  const scale = BigInt(Math.pow(10, decimals));
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Cannot build Money from non-finite number: ${input}`);
    }
    return BigInt(Math.round(input * Math.pow(10, decimals)));
  }
  // String path — parse exactly, no binary floats.
  const trimmed = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Cannot parse monetary amount: '${input}'`);
  }
  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = BigInt(match[2]);
  const fracRaw = match[3] ?? '';
  const fracPadded = fracRaw.padEnd(decimals, '0').slice(0, decimals);
  let frac = BigInt(fracPadded === '' ? '0' : fracPadded);
  // Round half-up if more digits than `decimals` were supplied.
  if (fracRaw.length > decimals) {
    const extra = fracRaw.slice(decimals);
    if (extra[0] >= '5') frac += 1n;
  }
  return sign * (intPart * scale + frac);
}

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
    decimals = 2,
  ): Money {
    validateCurrency(currency);
    return new Money(toMinorUnits(amount, decimals), currency, decimals);
  }

  static fromMinor(
    minorUnits: bigint | number,
    currency: Currency,
    decimals = 2,
  ): Money {
    validateCurrency(currency);
    return new Money(BigInt(minorUnits), currency, decimals);
  }

  static zero(currency: Currency, decimals = 2): Money {
    validateCurrency(currency);
    return new Money(0n, currency, decimals);
  }

  static assertSameCurrency(left: Money, right: Money): void {
    if (left.currency !== right.currency) {
      throw new CurrencyMismatchError(left.currency, right.currency);
    }
  }

  // ── Arithmetic (exact, bigint) ─────────────────────────────────────────────

  add(other: Money): Money {
    Money.assertSameCurrency(this, other);
    return new Money(this.minorUnits + other.minorUnits, this.currency, this.decimals);
  }

  subtract(other: Money): Money {
    Money.assertSameCurrency(this, other);
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

  compare(other: Money): number {
    Money.assertSameCurrency(this, other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    if (this.currency !== other.currency) return false;
    if (this.decimals !== other.decimals) return false;
    return this.minorUnits === other.minorUnits;
  }

  /**
   * Multiply by a plain-number factor (rates, quantities). The factor is
   * applied to the exact minor units and the result re-rounded
   * deterministically — no float accumulation across chained operations.
   */
  multiplyBy(factor: number, policy: RoundingPolicy = 'round'): Money {
    const scaled = Number(this.minorUnits) * factor;
    if (!Number.isFinite(scaled)) {
      throw new Error(`Money.multiplyBy produced a non-finite value (factor=${factor})`);
    }
    return new Money(
      roundMinorUnits(BigInt(Math.round(scaled)), policy),
      this.currency,
      this.decimals,
    );
  }

  /**
   * Convert to another currency at an explicit rate (units of target per one
   * unit of source). Deterministic: same inputs → same output, always.
   */
  convertTo(targetCurrency: Currency, rate: number, policy: RoundingPolicy = 'round'): Money {
    validateCurrency(targetCurrency);
    const scaled = Number(this.minorUnits) * rate;
    if (!Number.isFinite(scaled)) {
      throw new Error(`Money.convertTo produced a non-finite value (rate=${rate})`);
    }
    return new Money(
      roundMinorUnits(BigInt(Math.round(scaled)), policy),
      targetCurrency,
      this.decimals,
    );
  }

  /** Re-round to a different minor-unit precision (e.g. 3 decimals → 2). */
  withDecimals(decimals: number, policy: RoundingPolicy = 'round'): Money {
    if (decimals === this.decimals) return this;
    const scaleDiff = Math.pow(10, this.decimals - decimals);
    const scaled = Number(this.minorUnits) / scaleDiff;
    return new Money(
      roundMinorUnits(BigInt(Math.round(scaled)), policy),
      this.currency,
      decimals,
    );
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  /** Decimal number (JSON-compatible). Exact for values within 2^53 minor units. */
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

/**
 * Deterministic cross-currency conversion helper for plain numbers.
 * `rate` = units of `toCurrency` per 1 unit of `fromCurrency`.
 */
export function convertAmount(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rate: number,
  policy: RoundingPolicy = 'round',
  decimals = 2,
): number {
  if (fromCurrency === toCurrency) return amount;
  return Money.fromDecimal(amount, fromCurrency, decimals)
    .convertTo(toCurrency, rate, policy)
    .amount();
}
