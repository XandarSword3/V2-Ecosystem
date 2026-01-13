/**
 * Test Assertions Helpers
 *
 * Common assertion patterns for integration tests.
 */

import { expect } from 'vitest';

interface ApiResponse {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}

/**
 * Assert API response is successful (2xx status)
 */
export function assertSuccess(response: ApiResponse, message?: string): void {
  expect(response.success, message || `Expected success but got error: ${response.error}`).toBe(true);
  expect(response.status, `Expected 2xx status but got ${response.status}`).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
}

/**
 * Assert API response indicates failure
 */
export function assertFailure(response: ApiResponse, expectedStatus?: number, message?: string): void {
  expect(response.success, message || 'Expected failure but got success').toBe(false);
  if (expectedStatus) {
    expect(response.status).toBe(expectedStatus);
  }
}

/**
 * Assert response has expected data shape
 */
export function assertHasData<T = any>(response: ApiResponse, validator?: (data: T) => void): T {
  assertSuccess(response);
  expect(response.data).toBeDefined();

  if (validator) {
    validator(response.data as T);
  }

  return response.data as T;
}

/**
 * Assert response data contains expected fields
 */
export function assertHasFields(data: any, fields: string[]): void {
  for (const field of fields) {
    expect(data, `Expected field "${field}" to exist`).toHaveProperty(field);
  }
}

/**
 * Assert response is paginated list
 */
export function assertPaginatedList(response: ApiResponse, options?: {
  minItems?: number;
  maxItems?: number;
  itemValidator?: (item: any) => void;
}): any[] {
  assertSuccess(response);

  const data = response.data;
  expect(Array.isArray(data.items) || Array.isArray(data.data) || Array.isArray(data)).toBe(true);

  const items = data.items || data.data || data;

  if (options?.minItems !== undefined) {
    expect(items.length).toBeGreaterThanOrEqual(options.minItems);
  }
  if (options?.maxItems !== undefined) {
    expect(items.length).toBeLessThanOrEqual(options.maxItems);
  }
  if (options?.itemValidator) {
    for (const item of items) {
      options.itemValidator(item);
    }
  }

  return items;
}

/**
 * Assert unauthorized response (401)
 */
export function assertUnauthorized(response: ApiResponse): void {
  assertFailure(response, 401);
}

/**
 * Assert forbidden response (403)
 */
export function assertForbidden(response: ApiResponse): void {
  assertFailure(response, 403);
}

/**
 * Assert not found response (404)
 */
export function assertNotFound(response: ApiResponse): void {
  assertFailure(response, 404);
}

/**
 * Assert bad request response (400)
 */
export function assertBadRequest(response: ApiResponse): void {
  assertFailure(response, 400);
}

/**
 * Assert validation error (422)
 */
export function assertValidationError(response: ApiResponse): void {
  assertFailure(response, 422);
}

/**
 * Assert order data structure
 */
export function assertOrderStructure(order: any): void {
  assertHasFields(order, [
    'id',
    'status',
    'created_at',
  ]);
  expect(['pending', 'preparing', 'ready', 'delivered', 'cancelled', 'completed']).toContain(order.status);
}

/**
 * Assert booking data structure
 */
export function assertBookingStructure(booking: any): void {
  assertHasFields(booking, [
    'id',
    'status',
    'check_in_date',
    'check_out_date',
  ]);
  expect(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']).toContain(booking.status);
}

/**
 * Assert user data structure
 */
export function assertUserStructure(user: any): void {
  assertHasFields(user, ['id', 'email']);
  // Should NOT contain sensitive fields
  expect(user).not.toHaveProperty('password_hash');
}

/**
 * Assert ticket data structure
 */
export function assertTicketStructure(ticket: any): void {
  assertHasFields(ticket, [
    'id',
    'status',
    'visit_date',
  ]);
  expect(['valid', 'used', 'expired', 'cancelled']).toContain(ticket.status);
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 10000, interval = 500, message = 'Condition not met within timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(message);
}

/**
 * Retry action until success or max attempts
 */
export async function retry<T>(
  action: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Action failed after max attempts');
}
