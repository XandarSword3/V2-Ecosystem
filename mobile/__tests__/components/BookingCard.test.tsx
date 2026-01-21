/**
 * BookingCard Component Tests
 * 
 * Tests for BookingCard, EmptyBookings, and BookingSectionHeader components
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { 
  BookingCard, 
  EmptyBookings, 
  BookingSectionHeader,
  BookingData,
} from '../../src/components/ui/BookingCard';

const mockBooking: BookingData = {
  id: 'booking-1',
  type: 'pool',
  title: 'Pool Reservation',
  status: 'confirmed',
  date: '2024-03-15',
  startTime: '10:00 AM',
  endTime: '12:00 PM',
  location: 'Main Pool',
  guestCount: 4,
  totalAmount: 50.00,
  reference: 'POOL-12345',
  notes: 'Please reserve sun loungers',
};

describe('BookingCard', () => {
  describe('default variant', () => {
    it('should render booking title', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('Pool Reservation')).toBeTruthy();
    });

    it('should render booking reference', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('Ref: POOL-12345')).toBeTruthy();
    });

    it('should render booking date', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText(/Fri.*Mar.*15/)).toBeTruthy();
    });

    it('should render time range', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText(/10:00 AM - 12:00 PM/)).toBeTruthy();
    });

    it('should render location', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('Main Pool')).toBeTruthy();
    });

    it('should render guest count', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('4')).toBeTruthy();
    });

    it('should render total amount', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('$50.00')).toBeTruthy();
    });

    it('should render notes', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('Please reserve sun loungers')).toBeTruthy();
    });

    it('should render type icon', () => {
      const { getByText } = render(<BookingCard booking={mockBooking} />);
      expect(getByText('🏊')).toBeTruthy();
    });
  });

  describe('compact variant', () => {
    it('should render booking title', () => {
      const { getByText } = render(
        <BookingCard booking={mockBooking} variant="compact" />
      );
      expect(getByText('Pool Reservation')).toBeTruthy();
    });

    it('should render date and time', () => {
      const { getByText } = render(
        <BookingCard booking={mockBooking} variant="compact" />
      );
      expect(getByText(/Mar.*15.*10:00 AM/)).toBeTruthy();
    });
  });

  describe('status badges', () => {
    const statuses = [
      { status: 'pending', label: 'Pending' },
      { status: 'confirmed', label: 'Confirmed' },
      { status: 'ongoing', label: 'In Progress' },
      { status: 'completed', label: 'Completed' },
      { status: 'cancelled', label: 'Cancelled' },
      { status: 'expired', label: 'Expired' },
    ] as const;

    statuses.forEach(({ status, label }) => {
      it(`should render ${status} status badge`, () => {
        const booking = { ...mockBooking, status };
        const { getByText } = render(<BookingCard booking={booking} />);
        expect(getByText(label)).toBeTruthy();
      });
    });
  });

  describe('type icons', () => {
    const types = [
      { type: 'pool', icon: '🏊' },
      { type: 'chalet', icon: '🏠' },
      { type: 'restaurant', icon: '🍽️' },
      { type: 'snack', icon: '🍿' },
      { type: 'spa', icon: '💆' },
      { type: 'event', icon: '🎉' },
    ] as const;

    types.forEach(({ type, icon }) => {
      it(`should render ${type} icon`, () => {
        const booking = { ...mockBooking, type };
        const { getByText } = render(<BookingCard booking={booking} />);
        expect(getByText(icon)).toBeTruthy();
      });
    });
  });

  describe('currency', () => {
    it('should display custom currency symbol', () => {
      const { getByText } = render(
        <BookingCard booking={mockBooking} currency="€" />
      );
      expect(getByText('€50.00')).toBeTruthy();
    });
  });

  describe('actions', () => {
    it('should show Check In button for confirmed bookings', () => {
      const onCheckIn = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onCheckIn={onCheckIn} />
      );
      expect(getByText('Check In')).toBeTruthy();
    });

    it('should call onCheckIn when Check In is pressed', () => {
      const onCheckIn = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onCheckIn={onCheckIn} />
      );
      fireEvent.press(getByText('Check In'));
      expect(onCheckIn).toHaveBeenCalledWith(mockBooking);
    });

    it('should show Reschedule button for confirmed bookings', () => {
      const onReschedule = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onReschedule={onReschedule} />
      );
      expect(getByText('Reschedule')).toBeTruthy();
    });

    it('should call onReschedule when pressed', () => {
      const onReschedule = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onReschedule={onReschedule} />
      );
      fireEvent.press(getByText('Reschedule'));
      expect(onReschedule).toHaveBeenCalledWith(mockBooking);
    });

    it('should show Cancel button for pending/confirmed bookings', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onCancel={onCancel} />
      );
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('should call onCancel when pressed', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onCancel={onCancel} />
      );
      fireEvent.press(getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledWith(mockBooking);
    });

    it('should not show actions when showActions is false', () => {
      const { queryByText } = render(
        <BookingCard 
          booking={mockBooking} 
          showActions={false}
          onCheckIn={jest.fn()}
          onCancel={jest.fn()}
        />
      );
      expect(queryByText('Check In')).toBeNull();
      expect(queryByText('Cancel')).toBeNull();
    });

    it('should not show Check In for completed bookings', () => {
      const completedBooking = { ...mockBooking, status: 'completed' as const };
      const { queryByText } = render(
        <BookingCard booking={completedBooking} onCheckIn={jest.fn()} />
      );
      expect(queryByText('Check In')).toBeNull();
    });

    it('should not show Cancel for completed bookings', () => {
      const completedBooking = { ...mockBooking, status: 'completed' as const };
      const { queryByText } = render(
        <BookingCard booking={completedBooking} onCancel={jest.fn()} />
      );
      expect(queryByText('Cancel')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('should call onPress when card is pressed', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <BookingCard booking={mockBooking} onPress={onPress} />
      );
      fireEvent.press(getByText('Pool Reservation'));
      expect(onPress).toHaveBeenCalledWith(mockBooking);
    });
  });
});

describe('EmptyBookings', () => {
  it('should show default empty message', () => {
    const { getByText } = render(<EmptyBookings />);
    expect(getByText('No Bookings Yet')).toBeTruthy();
  });

  it('should show pool-specific message', () => {
    const { getByText } = render(<EmptyBookings type="pool" />);
    expect(getByText('No Pool Reservations')).toBeTruthy();
  });

  it('should show chalet-specific message', () => {
    const { getByText } = render(<EmptyBookings type="chalet" />);
    expect(getByText('No Chalet Bookings')).toBeTruthy();
  });

  it('should show restaurant-specific message', () => {
    const { getByText } = render(<EmptyBookings type="restaurant" />);
    expect(getByText('No Restaurant Reservations')).toBeTruthy();
  });

  it('should show Make a Booking button when callback provided', () => {
    const onCreateBooking = jest.fn();
    const { getByText } = render(
      <EmptyBookings onCreateBooking={onCreateBooking} />
    );
    expect(getByText('Make a Booking')).toBeTruthy();
  });

  it('should call onCreateBooking when button pressed', () => {
    const onCreateBooking = jest.fn();
    const { getByText } = render(
      <EmptyBookings onCreateBooking={onCreateBooking} />
    );
    fireEvent.press(getByText('Make a Booking'));
    expect(onCreateBooking).toHaveBeenCalled();
  });
});

describe('BookingSectionHeader', () => {
  it('should render title', () => {
    const { getByText } = render(
      <BookingSectionHeader title="Upcoming" />
    );
    expect(getByText('Upcoming')).toBeTruthy();
  });

  it('should render count when provided', () => {
    const { getByText } = render(
      <BookingSectionHeader title="Upcoming" count={5} />
    );
    expect(getByText('5')).toBeTruthy();
  });

  it('should not render count when not provided', () => {
    const { queryByText } = render(
      <BookingSectionHeader title="Upcoming" />
    );
    // Should only have title, no count
    expect(queryByText('0')).toBeNull();
  });
});
