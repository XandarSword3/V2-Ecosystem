import dayjs, { Dayjs } from 'dayjs';

export interface UnitPriceRuleLike {
  start_date: string;
  end_date: string;
  price?: string | number | null;
  price_multiplier?: string | number | null;
}

/**
 * Computes the total base price for a stay, night by night, applying:
 * 1. An active unit_price_rule for that night (fixed price wins over multiplier), else
 * 2. weekend_price on Fri/Sat, else base_price.
 *
 * Server-side source of truth for accommodation pricing — never trust a
 * client-supplied total (dynamic-module.router.ts POST /bookings).
 */
export function computeStayBaseAmount(
  checkIn: Dayjs,
  checkOut: Dayjs,
  basePrice: number,
  weekendPrice: number,
  priceRules: UnitPriceRuleLike[] = [],
): number {
  let total = 0;
  let cursor = checkIn;

  while (cursor.isBefore(checkOut)) {
    const activeRule = priceRules.find((rule) => {
      const start = dayjs(rule.start_date).startOf('day');
      const end = dayjs(rule.end_date).endOf('day');
      return (cursor.isSame(start) || cursor.isAfter(start)) &&
        (cursor.isSame(end) || cursor.isBefore(end));
    });

    const isWeekend = cursor.day() === 5 || cursor.day() === 6;
    const weekdayBase = basePrice;
    const weekendBase = weekendPrice || basePrice;

    let nightPrice: number;
    if (activeRule?.price) {
      nightPrice = parseFloat(String(activeRule.price));
    } else if (activeRule?.price_multiplier) {
      nightPrice = (isWeekend ? weekendBase : weekdayBase) * parseFloat(String(activeRule.price_multiplier));
    } else {
      nightPrice = isWeekend ? weekendBase : weekdayBase;
    }

    total += nightPrice;
    cursor = cursor.add(1, 'day');
  }

  return total;
}
