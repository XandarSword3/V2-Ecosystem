import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationsBoard } from '../../src/components/staff/operations/OperationsBoard';
import { WorkItem } from '../../src/components/staff/operations/WorkItem';
import { ExceptionAction } from '../../src/components/staff/operations/ExceptionAction';
import type { WorkItemData } from '../../src/components/staff/operations/types';

// ============================================
// MOCKS
// ============================================

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/authorization', () => ({
  useAuthorization: () => ({
    hasPermission: () => true,
    propertyId: 'prop-1',
  }),
  Perm: {
    ORDER_UPDATE: 'order:update',
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

// ============================================
// TEST FIXTURES
// ============================================

const mockOrders: WorkItemData[] = [
  {
    id: 'ord-1',
    orderNumber: '101',
    status: 'confirmed',
    fulfillmentStatus: 'queued',
    fulfillmentMode: 'on_premise',
    priority: 'rush',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(), // 12 mins ago (warning)
    totalAmount: 32.5,
    customerName: 'Alice Smith',
    customerPhone: '+1 555-0100',
    isVip: true,
    tableNumber: 'Table 4',
    staffName: 'Server Mark',
    items: [
      { id: 'item-1', name: 'Steak Frites', quantity: 1, status: 'pending' },
      { id: 'item-2', name: 'Sparkling Water', quantity: 2, status: 'pending' },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: '102',
    status: 'confirmed',
    fulfillmentStatus: 'in_progress',
    fulfillmentMode: 'local_delivery',
    priority: 'normal',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago
    totalAmount: 48.0,
    customerName: 'Bob Jones',
    destinationType: 'address',
    deliveryAddress: '123 Harbor View Blvd, Apt 4B',
    driverName: 'Driver Sam',
    items: [
      { id: 'item-3', name: 'Sushi Combo', quantity: 2, status: 'preparing' },
    ],
  },
  {
    id: 'ord-3',
    orderNumber: '103',
    status: 'confirmed',
    fulfillmentStatus: 'ready',
    fulfillmentMode: 'pickup',
    priority: 'normal',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(), // 25 mins ago (critical)
    totalAmount: 18.0,
    customerName: 'Charlie Brown',
    items: [
      { id: 'item-4', name: 'Cheeseburger', quantity: 1, status: 'ready' },
    ],
  },
];

// ============================================
// TESTS
// ============================================

describe('Phase F8: Staff Engine A Operations Surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketListeners = {};
    socketEmits = [];
  });

  // --------------------------------------------------
  // 1. OperationsBoard Core Rendering & Work Queues
  // --------------------------------------------------
  describe('OperationsBoard', () => {
    it('fetches orders on mount, derives workflow columns, and computes stats', async () => {
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrders },
      });

      render(
        <OperationsBoard
          slug="restaurant"
          moduleName="Seaside Grill"
          moduleId="mod-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('operations-board')).toBeInTheDocument();
      });

      // Header and Module Name
      expect(screen.getByText('Seaside Grill Operations')).toBeInTheDocument();

      // Stats Bar calculations
      expect(screen.getByTestId('stats-total-orders')).toHaveTextContent('3 Active');
      expect(screen.getByTestId('stats-rush-orders')).toHaveTextContent('1 Rush');
      expect(screen.getByTestId('stats-ready-orders')).toHaveTextContent('1 Ready');

      // Canonical hospitality queues derived dynamically
      expect(screen.getByTestId('work-queue-queued')).toBeInTheDocument();
      expect(screen.getByTestId('work-queue-in_progress')).toBeInTheDocument();
      expect(screen.getByTestId('work-queue-ready')).toBeInTheDocument();

      // Counts per queue
      expect(screen.getByTestId('queue-count-queued')).toHaveTextContent('1');
      expect(screen.getByTestId('queue-count-in_progress')).toHaveTextContent('1');
      expect(screen.getByTestId('queue-count-ready')).toHaveTextContent('1');
    });

    it('filters work items by search query across order number, customer name, and table', async () => {
      const user = userEvent.setup();
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrders },
      });

      render(
        <OperationsBoard
          slug="restaurant"
          moduleName="Seaside Grill"
          moduleId="mod-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('operations-board')).toBeInTheDocument();
      });

      // Filter by customer name 'Alice'
      const searchInput = screen.getByTestId('operations-search-input');
      await user.type(searchInput, 'Alice');

      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.queryByText('#102')).toBeNull();
      expect(screen.queryByText('#103')).toBeNull();

      // Clear search
      await user.clear(searchInput);
      expect(screen.getByText('#102')).toBeInTheDocument();
      expect(screen.getByText('#103')).toBeInTheDocument();
    });

    it('advances canonical order fulfillment state via API on advance button click', async () => {
      const user = userEvent.setup();
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrders },
      });
      apiPatchMock.mockResolvedValueOnce({
        data: { success: true, data: { ...mockOrders[0], fulfillmentStatus: 'in_progress' } },
      });

      render(
        <OperationsBoard
          slug="restaurant"
          moduleName="Seaside Grill"
          moduleId="mod-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('operations-board')).toBeInTheDocument();
      });

      // Advance ord-1 from queued -> in_progress ("Start Prep")
      const advanceBtn = screen.getByTestId('advance-order-ord-1');
      await user.click(advanceBtn);

      expect(apiPatchMock).toHaveBeenCalledWith(
        '/staff/modules/restaurant/orders/ord-1/status',
        { status: 'in_progress' }
      );
    });

    it('updates work items live upon WebSocket order:status push without page reload', async () => {
      apiGetMock.mockResolvedValueOnce({
        data: { success: true, data: mockOrders },
      });

      render(
        <OperationsBoard
          slug="restaurant"
          moduleName="Seaside Grill"
          moduleId="mod-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('operations-board')).toBeInTheDocument();
      });

      // ord-1 is currently in queued
      expect(screen.getByTestId('queue-count-queued')).toHaveTextContent('1');
      expect(screen.getByTestId('queue-count-ready')).toHaveTextContent('1');

      // Simulate staff completing cooking on KDS: ord-1 moves to 'ready'
      const statusCallbacks = socketListeners['order:status'] || [];
      expect(statusCallbacks.length).toBeGreaterThan(0);

      statusCallbacks.forEach((cb) =>
        cb({
          id: 'ord-1',
          status: 'confirmed',
          fulfillmentStatus: 'ready',
        })
      );

      // Verify real-time queue migration
      await waitFor(() => {
        expect(screen.getByTestId('queue-count-queued')).toHaveTextContent('0');
        expect(screen.getByTestId('queue-count-ready')).toHaveTextContent('2');
      });
    });
  });

  // --------------------------------------------------
  // 2. WorkItem Context & Urgency
  // --------------------------------------------------
  describe('WorkItem Component', () => {
    it('renders customer context, VIP badge, elapsed badge, and line item chips', () => {
      const onAdvanceOrder = vi.fn();
      render(
        <WorkItem
          item={mockOrders[0]}
          actionLabel="Start Prep"
          nextState="in_progress"
          onAdvanceOrder={onAdvanceOrder}
        />
      );

      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.getByTestId('rush-badge')).toBeInTheDocument();
      expect(screen.getByTestId('vip-badge')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Table 4')).toBeInTheDocument();
      expect(screen.getByText('Steak Frites')).toBeInTheDocument();
      expect(screen.getByTestId('elapsed-badge')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start prep/i })).toBeInTheDocument();
    });

    it('advances individual line item status when advance chip clicked', async () => {
      const user = userEvent.setup();
      const onAdvanceItem = vi.fn();

      render(
        <WorkItem
          item={mockOrders[0]}
          onAdvanceItem={onAdvanceItem}
        />
      );

      const advanceLineBtn = screen.getByTestId('advance-line-item-1');
      await user.click(advanceLineBtn);

      expect(onAdvanceItem).toHaveBeenCalledWith('ord-1', 'item-1');
    });
  });

  // --------------------------------------------------
  // 3. ExceptionAction Component
  // --------------------------------------------------
  describe('ExceptionAction Component', () => {
    it('toggles rush priority and triggers cancellation modal with audit reason', async () => {
      const user = userEvent.setup();
      const onTogglePriority = vi.fn();
      const onCancelOrder = vi.fn();

      render(
        <ExceptionAction
          orderId="ord-99"
          orderNumber="99"
          currentPriority="normal"
          onTogglePriority={onTogglePriority}
          onCancelOrder={onCancelOrder}
        />
      );

      // Open exception menu
      await user.click(screen.getByTestId('exception-actions-button'));
      expect(screen.getByTestId('exception-actions-menu')).toBeInTheDocument();

      // Toggle Rush
      await user.click(screen.getByTestId('action-toggle-rush'));
      expect(onTogglePriority).toHaveBeenCalledWith('rush');

      // Re-open menu to test cancel
      await user.click(screen.getByTestId('exception-actions-button'));
      await user.click(screen.getByTestId('action-cancel-order'));

      // Cancel modal opens
      expect(screen.getByText(/cancel order #99/i)).toBeInTheDocument();
      await user.click(screen.getByTestId('confirm-cancel-button'));

      expect(onCancelOrder).toHaveBeenCalledWith('Customer Request');
    });
  });
});
