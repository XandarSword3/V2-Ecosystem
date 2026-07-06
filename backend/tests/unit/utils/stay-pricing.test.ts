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
