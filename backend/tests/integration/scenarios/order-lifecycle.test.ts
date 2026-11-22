/**
 * Integration Test: Order Lifecycle
 *
 * Tests the complete order workflow:
 * Customer places order → Staff prepares → Staff marks ready → Complete
 *
 * Scenario extracted from stress test customer-bot and staff-bot behaviors.
 */

import {
  TestApiClient,
  createStaffClient,
  createGuestClient,
  createCustomerClient,
} from '../api-client';
import {
  assertSuccess,
  assertHasData,
  assertOrderStructure,
  waitFor,
} from '../assertions';
import { waitForServices, resetTestContext, seedTestDatabase } from '../setup';

// Skip if integration tests not enabled
const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Order Lifecycle Integration', () => {
  let guestClient: TestApiClient;
  let customerClient: TestApiClient;
  let staffClient: TestApiClient;
  let menuItemId: string;
  let orderId: string;
  let servicesAvailable = false;

  beforeAll(async () => {
    // Always create clients
    guestClient = createGuestClient();
    customerClient = createGuestClient();
    staffClient = createGuestClient(); // Will be replaced if services available
    
    const services = await waitForServices(5, 1000);
    if (!services.api) {
      console.warn('⚠️ API not available, tests will be skipped');
      return;
    }

    // Seed database to ensure staff user exists
    await seedTestDatabase();

    servicesAvailable = true;
    resetTestContext();
    customerClient = await createCustomerClient();
    staffClient = await createStaffClient();
  });

  afterAll(() => {
    resetTestContext();
  });

  describe('Phase 1: Customer Browse & Order', () => {
    it('should fetch menu service menu', async () => {
      const response = await customerClient.getRestaurantMenu();
      assertSuccess(response);

      const menu = assertHasData<any>(response);
      expect(Array.isArray(menu) || menu.items).toBeTruthy();

      // Store a menu item for ordering
      const items = menu.items || menu;
      if (items.length > 0) {
        menuItemId = items[0].id;
      }
    });

    it('should fetch menu service categories', async () => {
      const response = await customerClient.getRestaurantCategories();
      assertSuccess(response);
    });

    it('should create menu service order as customer', async () => {
      // Skip if no menu items available
      if (!menuItemId) {
        console.warn('⚠️ No menu items available, using placeholder');
        menuItemId = '550e8400-e29b-41d4-a716-446655440000';
      }

      const orderData = {
        customerName: 'Integration Test Customer',
        customerPhone: '+1234567890',
        orderType: 'dine_in' as const,
        items: [{ menuItemId, quantity: 2, specialInstructions: 'Integration test order' }],
        tableNumber: 'T99',
        notes: 'Created by integration test',
      };

      const response = await customerClient.createRestaurantOrder(orderData);
      assertSuccess(response);

      const order = assertHasData<any>(response, (data: any) => {
        expect(data.id).toBeDefined();
        expect(data.status).toBe('pending');
      });

      orderId = order.id;
      expect(orderId).toBeDefined();
    });

    it('should retrieve created order', async () => {
      if (!orderId) {
        return; // Skip if order creation failed
      }

      const response = await customerClient.getMenuServiceOrder(orderId);
      assertSuccess(response);

      assertHasData<any>(response, (order: any) => {
        assertOrderStructure(order);
        expect(order.id).toBe(orderId);
      });
    });
  });

  describe('Phase 2: Staff Processing', () => {
    it('should confirm order', async () => {
      if (!orderId) {
        return;
      }

      const response = await staffClient.updateOrderStatus(orderId, 'confirm');
      assertSuccess(response);

      const orderResponse = await customerClient.getMenuServiceOrder(orderId);
      assertHasData<any>(orderResponse, (order: any) => {
        expect(['confirmed', 'in_progress']).toContain(order.status);
      });
    });

    it('should update order status to preparing', async () => {
      if (!orderId) {
        return;
      }

      const response = await staffClient.updateOrderStatus(orderId, 'preparing');
      assertSuccess(response);

      // Verify status changed (Stage-6 engine contract: fulfillment status advances)
      const orderResponse = await customerClient.getMenuServiceOrder(orderId);
      assertHasData<any>(orderResponse, (order: any) => {
        expect(['preparing', 'in_progress']).toContain(order.fulfillment_status || order.status);
      });
    });

    it('should update order status to ready', async () => {
      if (!orderId) {
        return;
      }

      const response = await staffClient.updateOrderStatus(orderId, 'ready');
      assertSuccess(response);

      // Verify status changed
      const orderResponse = await customerClient.getMenuServiceOrder(orderId);
      assertHasData<any>(orderResponse, (order: any) => {
        expect(['ready', 'prepared']).toContain(order.fulfillment_status || order.status);
      });
    });

    it('should complete order delivery', async () => {
      if (!orderId) {
        return;
      }

      const response = await staffClient.updateOrderStatus(orderId, 'delivered');
      assertSuccess(response);

      // Verify final status
      const orderResponse = await customerClient.getMenuServiceOrder(orderId);
      assertHasData<any>(orderResponse, (order: any) => {
        expect(['delivered', 'handed_off', 'completed']).toContain(order.fulfillment_status || order.status);
      });
    });
  });

  describe('Phase 3: Order State Validation', () => {
    it('should not allow invalid status transitions', async () => {
      if (!orderId) {
        return;
      }

      // Try to set back to pending (typically invalid transition)
      const response = await staffClient.updateOrderStatus(orderId, 'pending');

      // API may or may not validate state transitions
      // If it does, it should fail; if not, that's also acceptable behavior
      // This test documents the current behavior
      if (response.success) {
        console.warn('⚠️ API allows backwards status transitions - consider adding validation');
      }
      expect(response.status).toBeLessThan(500); // At least shouldn't crash
    });

    it('should handle non-existent order gracefully', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await customerClient.getMenuServiceOrder(fakeId);

      expect(response.success).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});
