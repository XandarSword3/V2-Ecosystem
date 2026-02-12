/**
 * Unit tests for the Simulation System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, EventTypes } from '../src/events/EventBus';
import { ClockManager } from '../src/orchestrator/ClockManager';
import { AssertionEngine, CommonAssertions } from '../src/assertions/AssertionEngine';

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.resetInstance();
  });

  it('should be a singleton', () => {
    const bus1 = EventBus.getInstance();
    const bus2 = EventBus.getInstance();
    expect(bus1).toBe(bus2);
  });

  it('should emit and receive events', () => {
    const bus = EventBus.getInstance();
    const handler = vi.fn();
    
    bus.subscribe('TEST_EVENT', handler);
    bus.emitEvent('TEST_EVENT', 'system', { data: 'test' }, 'test-source');
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TEST_EVENT',
        category: 'system',
        payload: { data: 'test' },
        source: 'test-source',
      })
    );
  });

  it('should track event log', () => {
    const bus = EventBus.getInstance();
    
    bus.emitEvent('EVENT_1', 'system', {}, 'source1');
    bus.emitEvent('EVENT_2', 'system', {}, 'source2');
    bus.emitEvent('EVENT_1', 'system', {}, 'source3');
    
    const log = bus.getEventLog();
    expect(log).toHaveLength(3);
    
    const filteredLog = bus.getEventLog({ types: ['EVENT_1'] });
    expect(filteredLog).toHaveLength(2);
  });

  it('should filter events by category', () => {
    const bus = EventBus.getInstance();
    const handler = vi.fn();
    
    bus.subscribeToCategory('fb', handler);
    bus.emitEvent('ORDER_PLACED', 'fb', {}, 'source');
    bus.emitEvent('CHECK_IN', 'checkin', {}, 'source');
    
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should get correlated events', () => {
    const bus = EventBus.getInstance();
    
    bus.emitEvent('EVENT_1', 'system', {}, 'source', { correlationId: 'corr-123' });
    bus.emitEvent('EVENT_2', 'system', {}, 'source', { correlationId: 'corr-123' });
    bus.emitEvent('EVENT_3', 'system', {}, 'source', { correlationId: 'corr-456' });
    
    const correlated = bus.getCorrelatedEvents('corr-123');
    expect(correlated).toHaveLength(2);
  });

  it('should return statistics', () => {
    const bus = EventBus.getInstance();
    
    bus.emitEvent('ORDER_PLACED', 'fb', {}, 'source');
    bus.emitEvent('ORDER_PLACED', 'fb', {}, 'source');
    bus.emitEvent('CHECK_IN', 'checkin', {}, 'source');
    
    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.eventsByType['ORDER_PLACED']).toBe(2);
    expect(stats.eventsByType['CHECK_IN']).toBe(1);
    expect(stats.eventsByCategory['fb']).toBe(2);
    expect(stats.eventsByCategory['checkin']).toBe(1);
  });
});

describe('ClockManager', () => {
  beforeEach(() => {
    EventBus.resetInstance();
  });

  it('should initialize with default config', () => {
    const clock = new ClockManager();
    const state = clock.getState();
    
    expect(state.isRunning).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.tickCount).toBe(0);
  });

  it('should advance time manually', () => {
    const startTime = new Date('2026-02-02T08:00:00');
    const clock = new ClockManager({ startTime });
    
    clock.advanceTime(30); // 30 minutes
    
    const newTime = clock.getCurrentTime();
    expect(newTime.getTime() - startTime.getTime()).toBe(30 * 60 * 1000);
  });

  it('should detect time periods correctly', () => {
    const clock = new ClockManager({ 
      startTime: new Date('2026-02-02T08:00:00') 
    });
    
    expect(clock.getTimePeriod()).toBe('morning');
    
    clock.advanceTime(5 * 60); // Move to 1 PM
    expect(clock.getTimePeriod()).toBe('afternoon');
    
    clock.advanceTime(5 * 60); // Move to 6 PM
    expect(clock.getTimePeriod()).toBe('evening');
    
    clock.advanceTime(5 * 60); // Move to 11 PM
    expect(clock.getTimePeriod()).toBe('night');
  });

  it('should detect weekends', () => {
    // February 2, 2026 is a Monday
    const mondayClock = new ClockManager({ 
      startTime: new Date('2026-02-02T08:00:00') 
    });
    expect(mondayClock.isWeekend()).toBe(false);
    
    // February 7, 2026 is a Saturday
    const saturdayClock = new ClockManager({ 
      startTime: new Date('2026-02-07T08:00:00') 
    });
    expect(saturdayClock.isWeekend()).toBe(true);
  });

  it('should check time ranges', () => {
    const clock = new ClockManager({ 
      startTime: new Date('2026-02-02T12:00:00') 
    });
    
    expect(clock.isTimeBetween(11, 14)).toBe(true);
    expect(clock.isTimeBetween(14, 18)).toBe(false);
  });
});

describe('AssertionEngine', () => {
  beforeEach(() => {
    EventBus.resetInstance();
  });

  it('should register and run assertions', async () => {
    const engine = new AssertionEngine();
    
    engine.registerAssertion({
      id: 'test-1',
      name: 'Test Assertion',
      description: 'Always passes',
      type: 'custom',
      trigger: 'immediate',
      severity: 'warning',
      condition: () => true,
    });
    
    // Immediate assertions run on registration
    const results = engine.getResults();
    expect(results.total).toBe(1);
    expect(results.passed).toBe(1);
  });

  it('should track failed assertions', async () => {
    const engine = new AssertionEngine();
    
    engine.registerAssertion({
      id: 'fail-1',
      name: 'Failing Assertion',
      description: 'Always fails',
      type: 'custom',
      trigger: 'immediate',
      severity: 'error',
      condition: () => false,
    });
    
    const results = engine.getResults();
    expect(results.failed).toBe(1);
    expect(results.results[0].passed).toBe(false);
  });

  it('should run event-triggered assertions', async () => {
    const engine = new AssertionEngine();
    const bus = EventBus.getInstance();
    
    engine.registerAssertion({
      id: 'event-1',
      name: 'Event Assertion',
      description: 'Triggered by event',
      type: 'event',
      trigger: 'on_event',
      triggerEvent: 'TEST_EVENT',
      severity: 'warning',
      condition: (ctx) => ctx.event?.payload.value === 'expected',
    });
    
    // Trigger the event
    bus.emitEvent('TEST_EVENT', 'system', { value: 'expected' }, 'test');
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const results = engine.getResults();
    expect(results.total).toBe(1);
    expect(results.passed).toBe(1);
  });
});

describe('CommonAssertions', () => {
  beforeEach(() => {
    EventBus.resetInstance();
  });

  it('checkInTimeLimit should validate timing', () => {
    const assertion = CommonAssertions.checkInTimeLimit(15);
    expect(assertion.id).toBe('checkin_time_limit');
    expect(assertion.trigger).toBe('on_event');
  });

  it('orderFulfillmentTime should validate timing', () => {
    const assertion = CommonAssertions.orderFulfillmentTime(25);
    expect(assertion.id).toBe('order_fulfillment_time');
    expect(assertion.severity).toBe('warning');
  });

  it('escalationThreshold should check percentages', () => {
    const assertion = CommonAssertions.escalationThreshold(10);
    expect(assertion.id).toBe('escalation_threshold');
    expect(assertion.trigger).toBe('end_of_simulation');
  });

  it('paymentSuccessRate should check percentages', () => {
    const assertion = CommonAssertions.paymentSuccessRate(98);
    expect(assertion.id).toBe('payment_success_rate');
    expect(assertion.severity).toBe('error');
  });
});

describe('EventTypes', () => {
  it('should have all required event types', () => {
    expect(EventTypes.GUEST_ARRIVED).toBeDefined();
    expect(EventTypes.GUEST_CHECK_IN_STARTED).toBeDefined();
    expect(EventTypes.GUEST_CHECK_IN_COMPLETED).toBeDefined();
    expect(EventTypes.GUEST_CHECK_OUT_STARTED).toBeDefined();
    expect(EventTypes.GUEST_CHECK_OUT_COMPLETED).toBeDefined();
    
    expect(EventTypes.ORDER_PLACED).toBeDefined();
    expect(EventTypes.ORDER_ITEM_READY).toBeDefined();
    expect(EventTypes.ORDER_DELIVERED).toBeDefined();
    
    expect(EventTypes.ROOM_MARKED_DIRTY).toBeDefined();
    expect(EventTypes.ROOM_CLEANING_STARTED).toBeDefined();
    expect(EventTypes.ROOM_CLEANING_COMPLETED).toBeDefined();
    
    expect(EventTypes.COMPLAINT_FILED).toBeDefined();
    expect(EventTypes.COMPLAINT_RESOLVED).toBeDefined();
    
    expect(EventTypes.SIMULATION_TICK).toBeDefined();
    expect(EventTypes.SIMULATION_STARTED).toBeDefined();
    expect(EventTypes.SIMULATION_ENDED).toBeDefined();
  });
});
