import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AvailabilityCalendar from '../../src/components/booking/AvailabilityCalendar';

function toDateKey(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

describe('AvailabilityCalendar behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('supports check-in selection and resets when blocked dates exist in range', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDateSelect = vi.fn();

    const checkInDate = new Date(2026, 0, 12);
    const blockedInBetween = new Date(2026, 0, 13);
    const attemptedCheckOut = new Date(2026, 0, 15);

    const checkInKey = toDateKey(checkInDate);
    const blockedKey = toDateKey(blockedInBetween);
    const attemptedCheckOutKey = toDateKey(attemptedCheckOut);

    const dailyPrices = {
      [checkInKey]: { price: 220, type: 'weekday' as const, ruleName: 'CheckIn Target', isBlocked: false },
      [blockedKey]: { price: 250, type: 'holiday' as const, ruleName: 'Blocked In Between', isBlocked: false },
      [attemptedCheckOutKey]: {
        price: 240,
        type: 'weekend' as const,
        ruleName: 'Attempted CheckOut',
        isBlocked: false,
      },
    };

    function StatefulCalendar() {
      const [selectedCheckIn, setSelectedCheckIn] = useState<string | undefined>();
      const [selectedCheckOut, setSelectedCheckOut] = useState<string | undefined>();

      return (
        <AvailabilityCalendar
          blockedDates={[blockedKey]}
          selectedCheckIn={selectedCheckIn}
          selectedCheckOut={selectedCheckOut}
          dailyPrices={dailyPrices}
          onDateSelect={(checkIn, checkOut) => {
            onDateSelect(checkIn, checkOut);
            setSelectedCheckIn(checkIn);
            setSelectedCheckOut(checkOut ?? undefined);
          }}
          minDate={new Date(2026, 0, 1)}
        />
      );
    }

    render(<StatefulCalendar />);

    expect(screen.getByText('Select check-in')).toBeInTheDocument();

    await user.click(screen.getByTitle('CheckIn Target'));
    expect(onDateSelect).toHaveBeenCalledWith(checkInKey, null);
    expect(screen.getByText('Select check-out')).toBeInTheDocument();

    await user.click(screen.getByTitle('Attempted CheckOut'));

    // A blocked date is in range, so selection resets with new check-in.
    expect(onDateSelect).toHaveBeenLastCalledWith(attemptedCheckOutKey, null);
  });

  it('completes a valid date range and shows total nights', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDateSelect = vi.fn();

    const checkInDate = new Date(2026, 0, 16);
    const checkOutDate = new Date(2026, 0, 19);

    const checkInKey = toDateKey(checkInDate);
    const checkOutKey = toDateKey(checkOutDate);

    const dailyPrices = {
      [checkInKey]: { price: 200, type: 'weekday' as const, ruleName: 'Range CheckIn', isBlocked: false },
      [checkOutKey]: { price: 260, type: 'weekend' as const, ruleName: 'Range CheckOut', isBlocked: false },
    };

    function StatefulCalendar() {
      const [selectedCheckIn, setSelectedCheckIn] = useState<string | undefined>();
      const [selectedCheckOut, setSelectedCheckOut] = useState<string | undefined>();

      return (
        <AvailabilityCalendar
          selectedCheckIn={selectedCheckIn}
          selectedCheckOut={selectedCheckOut}
          dailyPrices={dailyPrices}
          formatPrice={(amount) => `USD ${amount}`}
          onDateSelect={(nextCheckIn, nextCheckOut) => {
            onDateSelect(nextCheckIn, nextCheckOut);
            setSelectedCheckIn(nextCheckIn);
            setSelectedCheckOut(nextCheckOut ?? undefined);
          }}
          minDate={new Date(2026, 0, 1)}
        />
      );
    }

    render(<StatefulCalendar />);

    await user.click(screen.getByTitle('Range CheckIn'));
    await user.click(screen.getByTitle('Range CheckOut'));

    expect(onDateSelect).toHaveBeenLastCalledWith(checkInKey, checkOutKey);
    expect(screen.getByText('3 nights')).toBeInTheDocument();
    expect(screen.getByText('USD 200')).toBeInTheDocument();
    expect(screen.getByText('Select check-in')).toBeInTheDocument();
  });

  it('respects navigation limits and hides weekend legend when disabled', () => {
    render(
      <AvailabilityCalendar
        onDateSelect={() => {}}
        minDate={new Date(2026, 0, 31)}
        maxMonthsAhead={0}
        weekendHighlight={false}
        pricePerNight={{ weekday: 100, weekend: 150 }}
      />
    );

    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.queryByText('Weekend')).not.toBeInTheDocument();
    expect(screen.getAllByText('$100').length).toBeGreaterThan(0);
  });
});
