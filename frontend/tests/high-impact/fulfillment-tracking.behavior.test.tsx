import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FulfillmentSelector } from '../../src/components/customer/FulfillmentSelector';
import { DestinationSelector } from '../../src/components/customer/DestinationSelector';
import { FulfillmentTimeline } from '../../src/components/customer/FulfillmentTimeline';
import { FulfillmentSummary } from '../../src/components/customer/FulfillmentSummary';
import { OrderTracking } from '../../src/components/customer/OrderTracking';
import type { FulfillmentOption } from '../../src/lib/engine-a/types';

// ============================================
// MOCKS
// ============================================

const apiGetMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key
      );
    }
    return key;
  },
}));

let socketListeners: Record<string, Function[]> = {};
let socketEmits: Array<{ event: string; data: any }> = [];

vi.mock('@/lib/socket', () => ({
  useSocket: () => ({
    isConnected: true,
    socket: {
      emit: (event: string, data: any) => {
        socketEmits.push({ event, data });
      },
      on: (event: string, callback: Function) => {
        if (!socketListeners[event]) socketListeners[event] = [];
        socketListeners[event].push(callback);
      },
      off: (event: string, callback: Function) => {
        if (socketListeners[event]) {
          socketListeners[event] = socketListeners[event].filter((cb) => cb !== callback);
        }
      },
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ============================================
// TESTS
// ============================================

describe('Phase F7: Fulfillment Selection & Customer Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketListeners = {};
    socketEmits = [];
  });

  // --------------------------------------------------
  // 1. FulfillmentSelector & Capability Constraints
  // --------------------------------------------------
  describe('FulfillmentSelector', () => {
    const mockOptions: FulfillmentOption[] = [
      { mode: 'pickup', destinations: ['pickup_location'] },
      { mode: 'on_premise', destinations: ['on_premise_location'] },
      { mode: 'local_delivery', destinations: ['address'] },
    ];

    it('renders offered capability options and fails closed when options are empty', () => {
      const onSelectMode = vi.fn();
      const onChangeDestination = vi.fn();

      const { rerender } = render(
        <FulfillmentSelector
          options={mockOptions}
          selectedMode="pickup"
          destinationType="pickup_location"
          destinationRef={null}
          onSelectMode={onSelectMode}
          onChangeDestination={onChangeDestination}
        />
      );

      // Renders all 3 offered options
      expect(screen.getByTestId('mode-option-pickup')).toBeInTheDocument();
      expect(screen.getByTestId('mode-option-on_premise')).toBeInTheDocument();
      expect(screen.getByTestId('mode-option-local_delivery')).toBeInTheDocument();

      // Digital delivery was not in options, so it must NOT be rendered
      expect(screen.queryByTestId('mode-option-digital_delivery')).toBeNull();

      // Fails closed when options empty
      rerender(
        <FulfillmentSelector
          options={[]}
          selectedMode="none"
          destinationType="none"
          destinationRef={null}
          onSelectMode={onSelectMode}
          onChangeDestination={onChangeDestination}
        />
      );
      expect(screen.getByTestId('fulfillment-modes-unavailable')).toBeInTheDocument();
    });

    it('propagates mode changes and automatically synchronizes legal default destination', async () => {
      const user = userEvent.setup();
      const onSelectMode = vi.fn();
      const onChangeDestination = vi.fn();

      render(
        <FulfillmentSelector
          options={mockOptions}
          selectedMode="pickup"
          destinationType="pickup_location"
          destinationRef={null}
          onSelectMode={onSelectMode}
          onChangeDestination={onChangeDestination}
        />
      );

      // Click on Local Delivery option
      const localDeliveryBtn = screen.getByTestId('mode-option-local_delivery');
      await user.click(localDeliveryBtn);

      expect(onSelectMode).toHaveBeenCalledWith('local_delivery');
      expect(onChangeDestination).toHaveBeenCalledWith('address', null);
    });
  });

  // --------------------------------------------------
  // 2. DestinationSelector Inputs
  // --------------------------------------------------
  describe('DestinationSelector', () => {
    it('renders service locations for on_premise and allows selection of available tables', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const serviceLocations = [
        { id: 'tbl-1', name: 'Table 1', is_active: true, is_occupied: false },
        { id: 'tbl-2', name: 'Table 2', is_active: true, is_occupied: true },
      ];

      render(
        <DestinationSelector
          mode="on_premise"
          destinationType="on_premise_location"
          destinationRef={null}
          serviceLocations={serviceLocations}
          onChange={onChange}
        />
      );

      expect(screen.getByTestId('destination-selector-on-premise')).toBeInTheDocument();
      const table1Btn = screen.getByTestId('location-option-tbl-1');
      const table2Btn = screen.getByTestId('location-option-tbl-2');

      expect(table1Btn).not.toBeDisabled();
      expect(table2Btn).toBeDisabled();

      await user.click(table1Btn);
      expect(onChange).toHaveBeenCalledWith('on_premise_location', 'tbl-1');
    });

    it('renders delivery address textarea for shipment and propagates changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <DestinationSelector
          mode="shipment"
          destinationType="address"
          destinationRef=""
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '742 Evergreen Terrace');
      expect(onChange).toHaveBeenCalledWith('address', expect.any(String));
    });

    it('renders digital account handle input for digital_delivery', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <DestinationSelector
          mode="digital_delivery"
          destinationType="digital_account"
          destinationRef=""
          onChange={onChange}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'guest@example.com');
      expect(onChange).toHaveBeenCalledWith('digital_account', expect.any(String));
    });
  });

  // --------------------------------------------------
  // 3. FulfillmentTimeline State Transitions
  // --------------------------------------------------
  describe('FulfillmentTimeline', () => {
    it('renders ordered hospitality states and marks past/current steps accurately', () => {
      render(
        <FulfillmentTimeline
          mode="pickup"
          currentState="in_progress"
          estimatedReadyTime="12:45 PM"
        />
      );

      expect(screen.getByTestId('fulfillment-timeline')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-queued')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-in_progress')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-ready')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-handed_off')).toBeInTheDocument();

      expect(screen.getByText(/ready ~12:45 pm/i)).toBeInTheDocument();
      expect(screen.getByText(/being prepared fresh right now/i)).toBeInTheDocument();
    });

    it('renders shipment mode states dynamically from domain model', () => {
      render(
        <FulfillmentTimeline
          mode="shipment"
          currentState="packed"
        />
      );

      expect(screen.getByTestId('timeline-step-allocated')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-picking')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-packed')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-shipped')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-in_transit')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-step-delivered')).toBeInTheDocument();
    });

    it('displays cancelled banner when order is cancelled', () => {
      render(
        <FulfillmentTimeline
          mode="on_premise"
          currentState="cancelled"
          isCancelled={true}
        />
      );

      expect(screen.getByTestId('fulfillment-timeline-cancelled')).toBeInTheDocument();
      expect(screen.getByText(/order fulfillment cancelled/i)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------
  // 4. FulfillmentSummary Presentation
  // --------------------------------------------------
  describe('FulfillmentSummary', () => {
    it('renders compact mode with badge and destination text', () => {
      render(
        <FulfillmentSummary
          mode="on_premise"
          destinationType="on_premise_location"
          destinationRef="Table 5"
          fulfillmentStatus="ready"
          compact={true}
        />
      );

      expect(screen.getByTestId('fulfillment-summary-compact')).toBeInTheDocument();
      expect(screen.getByText(/on-premise/i)).toBeInTheDocument();
      expect(screen.getByText(/table \/ location: table 5/i)).toBeInTheDocument();
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    it('renders full mode with carrier tracking info', () => {
      render(
        <FulfillmentSummary
          mode="shipment"
          destinationType="address"
          destinationRef="100 Ocean Blvd"
          fulfillmentStatus="shipped"
          carrierName="DHL Express"
          trackingNumber="DHL-987654"
          trackingUrl="https://track.dhl.com/987654"
        />
      );

      expect(screen.getByTestId('fulfillment-summary-full')).toBeInTheDocument();
      expect(screen.getByText(/courier shipment/i)).toBeInTheDocument();
      expect(screen.getByText(/100 ocean blvd/i)).toBeInTheDocument();
      expect(screen.getByText(/dhl express:/i)).toBeInTheDocument();
      expect(screen.getByText('DHL-987654')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /track carrier/i })).toHaveAttribute(
        'href',
        'https://track.dhl.com/987654'
      );
    });
  });

  // --------------------------------------------------
  // 5. OrderTracking & Real-Time Socket Updates
  // --------------------------------------------------
  describe('OrderTracking', () => {
    const mockOrder = {
      id: 'ord-abc-123',
      order_number: 'ORD-101',
      status: 'confirmed',
      fulfillment_status: 'queued',
      fulfillmentMode: 'on_premise',
      customer_name: 'David Guest',
      table_id: '4',
      total_amount: 42.0,
      currency: 'USD',
      qr_code: 'data:image/png;base64,mockqr',
      line_items: [
        { name: 'Burger', quantity: 2, lineTotal: 30.0 },
        { name: 'Fries', quantity: 1, lineTotal: 12.0 },
      ],
    };

    it('joins order room on mount and displays initial order state', async () => {
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrder },
      });

      render(
        <OrderTracking
          orderId="ord-abc-123"
          moduleSlug="dining"
          propertySlug="grand-resort"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('order-tracking-container')).toBeInTheDocument();
      });

      expect(screen.getByText('#ORD-101')).toBeInTheDocument();
      expect(screen.getByText('Order for David Guest')).toBeInTheDocument();
      expect(screen.getByAltText('Order QR Code')).toBeInTheDocument();

      // Check socket room join
      expect(socketEmits).toContainEqual({
        event: 'order:join',
        data: { orderId: 'ord-abc-123' },
      });
    });

    it('updates live fulfillment status when receiving WebSocket order:status event', async () => {
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrder },
      });

      render(
        <OrderTracking
          orderId="ord-abc-123"
          moduleSlug="dining"
          propertySlug="grand-resort"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('order-tracking-container')).toBeInTheDocument();
      });

      // Initial state description: Queued
      expect(screen.getByText(/order received and waiting in queue/i)).toBeInTheDocument();

      // Simulate staff advancing order to 'ready' on KDS/POS
      const statusCallbacks = socketListeners['order:status'] || [];
      expect(statusCallbacks.length).toBeGreaterThan(0);

      statusCallbacks.forEach((cb) =>
        cb({
          id: 'ord-abc-123',
          status: 'confirmed',
          fulfillmentStatus: 'ready',
        })
      );

      // Verify real-time UI reaction without page reload
      await waitFor(() => {
        expect(screen.getByText(/order is ready for collection \/ service/i)).toBeInTheDocument();
      });
    });
  });
});
