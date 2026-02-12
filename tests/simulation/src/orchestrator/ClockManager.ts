/**
 * Clock Manager - Controls simulation time
 * Allows running faster than real-time
 */

import { EventBus, EventTypes } from '../events/EventBus';

export interface ClockConfig {
  startTime: Date;
  endTime?: Date;
  timeMultiplier: number; // 1 = real-time, 60 = 1 min = 1 sec real
  tickIntervalMs: number; // How often to tick in real ms
  simulatedTickMinutes: number; // How many simulated minutes per tick
}

export interface ClockState {
  currentTime: Date;
  startTime: Date;
  endTime?: Date;
  isRunning: boolean;
  isPaused: boolean;
  tickCount: number;
  timeMultiplier: number;
  elapsedSimulatedMs: number;
  elapsedRealMs: number;
}

export class ClockManager {
  private config: ClockConfig;
  private currentTime: Date;
  private startTime: Date;
  private isRunning = false;
  private isPaused = false;
  private tickCount = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private eventBus: EventBus;
  private startRealTime: number = 0;
  private pausedAt: number = 0;
  private totalPausedTime: number = 0;

  constructor(config: Partial<ClockConfig> = {}) {
    this.config = {
      startTime: config.startTime || new Date(),
      endTime: config.endTime,
      timeMultiplier: config.timeMultiplier || 1,
      tickIntervalMs: config.tickIntervalMs || 1000,
      simulatedTickMinutes: config.simulatedTickMinutes || 1,
    };
    
    this.currentTime = new Date(this.config.startTime);
    this.startTime = new Date(this.config.startTime);
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Start the simulation clock
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.startRealTime = Date.now();
    this.totalPausedTime = 0;

    this.eventBus.setSimulationTime(this.currentTime);

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.tickIntervalMs);

    console.log(`[Clock] Started at ${this.currentTime.toISOString()}`);
    console.log(`[Clock] Time multiplier: ${this.config.timeMultiplier}x`);
    console.log(`[Clock] Tick interval: ${this.config.tickIntervalMs}ms (${this.config.simulatedTickMinutes} simulated minutes per tick)`);
  }

  /**
   * Stop the simulation clock
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.isPaused = false;

    console.log(`[Clock] Stopped at ${this.currentTime.toISOString()}`);
    console.log(`[Clock] Total ticks: ${this.tickCount}`);
  }

  /**
   * Pause the simulation clock
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;

    this.isPaused = true;
    this.pausedAt = Date.now();

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log(`[Clock] Paused at ${this.currentTime.toISOString()}`);
  }

  /**
   * Resume the simulation clock
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;

    this.totalPausedTime += Date.now() - this.pausedAt;
    this.isPaused = false;

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.tickIntervalMs);

    console.log(`[Clock] Resumed at ${this.currentTime.toISOString()}`);
  }

  /**
   * Advance time by one tick
   */
  private tick(): void {
    if (this.isPaused) return;

    // Advance simulated time
    const advanceMs = this.config.simulatedTickMinutes * 60 * 1000;
    this.currentTime = new Date(this.currentTime.getTime() + advanceMs);
    this.tickCount++;

    // Update event bus time
    this.eventBus.setSimulationTime(this.currentTime);

    // Check for end time
    if (this.config.endTime && this.currentTime >= this.config.endTime) {
      this.stop();
      this.eventBus.emitEvent(
        EventTypes.SIMULATION_ENDED,
        'system',
        { 
          endTime: this.currentTime,
          tickCount: this.tickCount,
          reason: 'end_time_reached'
        },
        'ClockManager'
      );
      return;
    }

    // Emit tick event
    this.eventBus.emitEvent(
      EventTypes.SIMULATION_TICK,
      'system',
      {
        simulationTime: this.currentTime,
        tickNumber: this.tickCount,
        timeMultiplier: this.config.timeMultiplier,
        hour: this.currentTime.getHours(),
        minute: this.currentTime.getMinutes(),
        dayOfWeek: this.currentTime.getDay(),
      },
      'ClockManager'
    );
  }

  /**
   * Manually advance time (for testing)
   */
  advanceTime(minutes: number): void {
    const advanceMs = minutes * 60 * 1000;
    this.currentTime = new Date(this.currentTime.getTime() + advanceMs);
    this.eventBus.setSimulationTime(this.currentTime);
  }

  /**
   * Get current simulation time
   */
  getCurrentTime(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Get clock state
   */
  getState(): ClockState {
    const elapsedRealMs = this.isRunning 
      ? Date.now() - this.startRealTime - this.totalPausedTime
      : 0;
    const elapsedSimulatedMs = this.currentTime.getTime() - this.startTime.getTime();

    return {
      currentTime: new Date(this.currentTime),
      startTime: new Date(this.startTime),
      endTime: this.config.endTime ? new Date(this.config.endTime) : undefined,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      tickCount: this.tickCount,
      timeMultiplier: this.config.timeMultiplier,
      elapsedSimulatedMs,
      elapsedRealMs,
    };
  }

  /**
   * Set time multiplier (speed up/slow down)
   */
  setTimeMultiplier(multiplier: number): void {
    this.config.timeMultiplier = multiplier;
    
    // Adjust tick interval to maintain smooth updates
    // More frequent ticks at higher multipliers
    if (multiplier > 10) {
      this.config.tickIntervalMs = 100;
    } else if (multiplier > 1) {
      this.config.tickIntervalMs = 500;
    } else {
      this.config.tickIntervalMs = 1000;
    }

    // Restart interval if running
    if (this.isRunning && !this.isPaused && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.tick(), this.config.tickIntervalMs);
    }

    console.log(`[Clock] Time multiplier set to ${multiplier}x`);
  }

  /**
   * Format current time for display
   */
  formatCurrentTime(): string {
    return this.currentTime.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Check if it's a specific time of day
   */
  isTimeBetween(startHour: number, endHour: number): boolean {
    const hour = this.currentTime.getHours();
    if (startHour <= endHour) {
      return hour >= startHour && hour < endHour;
    } else {
      // Handle overnight ranges (e.g., 22:00 to 06:00)
      return hour >= startHour || hour < endHour;
    }
  }

  /**
   * Get time period name
   */
  getTimePeriod(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = this.currentTime.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Check if weekend
   */
  isWeekend(): boolean {
    const day = this.currentTime.getDay();
    return day === 0 || day === 6;
  }
}
