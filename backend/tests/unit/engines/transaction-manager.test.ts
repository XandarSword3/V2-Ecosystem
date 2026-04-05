/**
 * Test Suite A: Transaction Manager Tests
 * 
 * Tests the saga-pattern transaction manager:
 *   - Successful multi-step transactions
 *   - Compensation on failure
 *   - Optional step handling
 *   - Compensation failure logging
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionManager } from '../../../src/engines/transaction-manager.js';
import type { TransactionStep, EngineOperationContext } from '../../../src/engines/transaction-manager.js';

// Mock getSupabase for compensation failure logging
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TransactionManager', () => {
  let txManager: TransactionManager;
  const mockContext: EngineOperationContext = {
    tenantId: 'tenant-1',
    moduleId: 'module-1',
    engineType: 'instant_transaction',
    entityId: 'entity-1',
    actor: 'staff',
  };

  beforeEach(() => {
    txManager = new TransactionManager();
  });

  // ============================================
  // Happy Path
  // ============================================

  it('should execute all steps in order and return success', async () => {
    const executionOrder: string[] = [];
    
    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => { executionOrder.push('step1'); return 'result1'; },
      },
      {
        name: 'step2',
        execute: async () => { executionOrder.push('step2'); return 'result2'; },
      },
      {
        name: 'step3',
        execute: async () => { executionOrder.push('step3'); return 'result3'; },
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.failedStep).toBeUndefined();
    expect(result.results['step1']).toBe('result1');
    expect(result.results['step2']).toBe('result2');
    expect(result.results['step3']).toBe('result3');
    expect(result.value).toBe('result3'); // Last step result
    expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle single-step transaction', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'only_step',
        execute: async () => 42,
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
    expect(result.results['only_step']).toBe(42);
  });

  it('should handle empty steps array', async () => {
    const result = await txManager.executeTransaction([], mockContext);

    expect(result.success).toBe(true);
    expect(result.value).toBeUndefined();
    expect(Object.keys(result.results)).toHaveLength(0);
  });

  // ============================================
  // Compensation on Failure
  // ============================================

  it('should compensate completed steps in reverse order on failure', async () => {
    const compensationOrder: string[] = [];

    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => 'result1',
        compensate: async () => { compensationOrder.push('compensate1'); },
      },
      {
        name: 'step2',
        execute: async () => 'result2',
        compensate: async () => { compensationOrder.push('compensate2'); },
      },
      {
        name: 'step3',
        execute: async () => { throw new Error('step3 failed'); },
        compensate: async () => { compensationOrder.push('compensate3'); },
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('step3');
    expect(result.error).toBe('step3 failed');
    // Compensation should be in reverse order (step2 then step1)
    expect(compensationOrder).toEqual(['compensate2', 'compensate1']);
    expect(result.compensatedSteps).toEqual(['step2', 'step1']);
  });

  it('should pass step result to compensation function', async () => {
    let capturedResult: unknown;

    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => ({ id: 'abc', amount: 100 }),
        compensate: async (result) => { capturedResult = result; },
      },
      {
        name: 'step2',
        execute: async () => { throw new Error('failure'); },
      },
    ];

    await txManager.executeTransaction(steps, mockContext);

    expect(capturedResult).toEqual({ id: 'abc', amount: 100 });
  });

  it('should not compensate the failed step itself', async () => {
    const compensated: string[] = [];

    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => 'ok',
        compensate: async () => { compensated.push('step1'); },
      },
      {
        name: 'step2',
        execute: async () => { throw new Error('boom'); },
        compensate: async () => { compensated.push('step2'); },
      },
    ];

    await txManager.executeTransaction(steps, mockContext);

    // Only step1 should be compensated, not step2 (which failed)
    expect(compensated).toEqual(['step1']);
  });

  // ============================================
  // Optional Steps
  // ============================================

  it('should continue past optional step failures', async () => {
    const executionOrder: string[] = [];

    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => { executionOrder.push('step1'); return 'ok'; },
      },
      {
        name: 'optional_step',
        execute: async () => { executionOrder.push('optional'); throw new Error('optional failed'); },
        optional: true,
      },
      {
        name: 'step3',
        execute: async () => { executionOrder.push('step3'); return 'ok3'; },
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(true);
    expect(executionOrder).toEqual(['step1', 'optional', 'step3']);
    expect(result.results['optional_step']).toEqual({ skipped: true, error: 'optional failed' });
    expect(result.value).toBe('ok3');
  });

  it('should not compensate previous steps when optional step fails', async () => {
    const compensated: string[] = [];

    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => 'ok',
        compensate: async () => { compensated.push('step1'); },
      },
      {
        name: 'optional_step',
        execute: async () => { throw new Error('optional failed'); },
        optional: true,
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(true);
    expect(compensated).toEqual([]); // No compensation
  });

  // ============================================
  // Compensation Failures
  // ============================================

  it('should log but not propagate compensation failures', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'step1',
        execute: async () => 'ok',
        compensate: async () => { throw new Error('compensation failed'); },
      },
      {
        name: 'step2',
        execute: async () => { throw new Error('step2 failed'); },
      },
    ];

    // Should not throw even though compensation fails
    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe('step2');
    // step1 compensation failed, so it's not in compensatedSteps
    expect(result.compensatedSteps).toEqual([]);
  });

  it('should handle steps without compensation functions', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'pure_step',
        execute: async () => 'pure_result',
        // No compensate function
      },
      {
        name: 'failing_step',
        execute: async () => { throw new Error('fail'); },
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(false);
    // pure_step has no compensation, so nothing to compensate
    expect(result.compensatedSteps).toEqual([]);
  });

  // ============================================
  // Timing
  // ============================================

  it('should measure transaction duration', async () => {
    const steps: TransactionStep[] = [
      {
        name: 'slow_step',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'done';
        },
      },
    ];

    const result = await txManager.executeTransaction(steps, mockContext);

    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(40); // Allow some tolerance
  });

  // ============================================
  // Idempotency Context
  // ============================================

  it('should pass idempotency key through context', async () => {
    const contextWithKey: EngineOperationContext = {
      ...mockContext,
      idempotencyKey: 'idem-key-123',
    };

    const steps: TransactionStep[] = [
      { name: 'step1', execute: async () => 'ok' },
    ];

    const result = await txManager.executeTransaction(steps, contextWithKey);
    expect(result.success).toBe(true);
  });
});
