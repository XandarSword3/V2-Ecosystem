import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { computeStayBaseAmount } from '../../../src/utils/stay-pricing.js';

describe('computeStayBaseAmount', () => {
  it('charges base_price for weekday-only stays', () => {
    // Mon 2026-07-06 -> Wed 2026-07-08 = 2 nights, both weekdays
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-08'),
      100,
      150,
      [],
    );
    expect(total).toBe(200);
  });

  it('charges weekend_price on Fri/Sat nights', () => {
    // Fri 2026-07-10 -> Sun 2026-07-12 = Fri + Sat nights, both weekend
    const total = computeStayBaseAmount(
      dayjs('2026-07-10'),
      dayjs('2026-07-12'),
      100,
      150,
      [],
    );
    expect(total).toBe(300);
  });

  it('mixes weekday and weekend rates within one stay', () => {
    // Thu 2026-07-09 -> Sun 2026-07-12 = Thu(wd) + Fri(we) + Sat(we)
    const total = computeStayBaseAmount(
      dayjs('2026-07-09'),
      dayjs('2026-07-12'),
      100,
      150,
      [],
    );
    expect(total).toBe(100 + 150 + 150);
  });

  it('applies a fixed-price rule over base/weekend price', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-08'),
      100,
      150,
      [{ start_date: '2026-07-06', end_date: '2026-07-08', price: '75' }],
    );
    expect(total).toBe(150); // 2 nights @ 75
  });

  it('applies a multiplier rule against the correct weekday/weekend base', () => {
    // Fri night should use weekend_price(150) * multiplier
    const total = computeStayBaseAmount(
      dayjs('2026-07-10'),
      dayjs('2026-07-11'),
      100,
      150,
      [{ start_date: '2026-07-10', end_date: '2026-07-11', price_multiplier: '2' }],
    );
    expect(total).toBe(300); // 150 * 2
  });

  it('falls back to base_price when weekend_price is missing', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-10'), // Friday
      dayjs('2026-07-11'),
      100,
      0,
      [],
    );
    expect(total).toBe(100);
  });

  it('never trusts a client total — result is derived purely from rate inputs', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-07'),
      100,
      150,
      [],
    );
    expect(total).not.toBe(1); // sanity: not some arbitrary client-supplied number
    expect(total).toBe(100);
  });
});

describe('computeStayBaseAmount — edge cases', () => {
  it('charges nothing for a same-day (zero-night) stay', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-10'),
      dayjs('2026-07-10'),
      100,
      150,
      [],
    );
    expect(total).toBe(0);
  });

  it('applies a rule on its exact end-date night (end boundary is inclusive)', () => {
    // Rule spans 07-06 → 07-07; both nights inside it
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-08'),
      100,
      150,
      [{ start_date: '2026-07-06', end_date: '2026-07-07', price: '80' }],
    );
    expect(total).toBe(160); // 2 nights @ 80
  });

  it('stops applying a rule the night AFTER its end date', () => {
    // Rule ends 07-06; stay is 07-06 → 07-08 → second night is outside the rule
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-08'),
      100,
      150,
      [{ start_date: '2026-07-05', end_date: '2026-07-06', price: '80' }],
    );
    expect(total).toBe(180); // 80 (rule night) + 100 (base night)
  });

  it('first matching rule wins when two rules overlap', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-07'),
      100,
      150,
      [
        { start_date: '2026-07-01', end_date: '2026-07-31', price: '60' },
        { start_date: '2026-07-06', end_date: '2026-07-07', price: '999' },
      ],
    );
    expect(total).toBe(60);
  });

  it('a rule with neither price nor multiplier leaves the night at base/weekend rates', () => {
    // Friday night inside a bare rule: weekend base still applies
    const total = computeStayBaseAmount(
      dayjs('2026-07-10'),
      dayjs('2026-07-11'),
      100,
      150,
      [{ start_date: '2026-07-01', end_date: '2026-07-31' }],
    );
    expect(total).toBe(150);
  });

  it('treats a 0 multiplier as absent (falls back to base/weekend)', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-07'),
      100,
      150,
      [{ start_date: '2026-07-06', end_date: '2026-07-06', price_multiplier: 0 }],
    );
    expect(total).toBe(100);
  });

  it('accepts numeric price and multiplier values, not just strings', () => {
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-08'),
      100,
      150,
      [
        { start_date: '2026-07-06', end_date: '2026-07-06', price: 90 },
        { start_date: '2026-07-07', end_date: '2026-07-07', price_multiplier: 1.5 },
      ],
    );
    expect(total).toBe(90 + 150); // fixed 90 + multiplier on weekday base
  });

  it('handles a rule that starts mid-stay (nights before it use base rates)', () => {
    // Stay 07-06 → 07-09 = 3 nights (Mon, Tue, Wed); rule applies Wed → Thu-end
    // (inclusive), fixing the last night at 120
    const total = computeStayBaseAmount(
      dayjs('2026-07-06'),
      dayjs('2026-07-09'),
      100,
      150,
      [{ start_date: '2026-07-08', end_date: '2026-07-09', price: '120' }],
    );
    expect(total).toBe(100 + 100 + 120); // Mon + Tue base, Wed @ 120
  });

  it('partial-stay weekend mix with multiplier applies multiplier against the right base', () => {
    // Rule spans the whole month, so ALL nights are multiplied: Thu (wd base
    // 100 → 120), Fri (we base 150 → 180), Sat (we base 150 → 180)
    const total = computeStayBaseAmount(
      dayjs('2026-07-09'),
      dayjs('2026-07-12'),
      100,
      150,
      [{ start_date: '2026-07-01', end_date: '2026-07-31', price_multiplier: 1.2 }],
    );
    expect(total).toBe(120 + 180 + 180);
  });
});
