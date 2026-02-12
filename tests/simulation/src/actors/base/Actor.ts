/**
 * Base Actor Class
 * Foundation for all simulation actors (guests, staff, managers, admins)
 */

import { EventBus, SimulationEvent, EventTypes, EventCategory } from '../../events/EventBus';
import { v4 as uuidv4 } from 'uuid';

export type ActorType = 'guest' | 'staff' | 'manager' | 'admin';
export type ActorStatus = 'idle' | 'busy' | 'waiting' | 'offline';

export interface ActorState {
  [key: string]: any;
}

export interface ActorAction {
  name: string;
  execute: () => Promise<ActionResult>;
  preconditions?: () => boolean;
  weight?: number; // For weighted random selection
  cooldown?: number; // Minimum ms between executions
}

export interface ActionResult {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  duration?: number;
  cascades?: string[]; // Events triggered by this action
}

export interface ActorConfig {
  id?: string;
  name: string;
  type: ActorType;
  role: string;
  department?: string;
  apiBaseUrl: string;
  authToken?: string;
}

export abstract class Actor {
  readonly id: string;
  readonly name: string;
  readonly type: ActorType;
  readonly role: string;
  readonly department?: string;

  protected eventBus: EventBus;
  protected status: ActorStatus = 'idle';
  protected state: ActorState = {};
  protected actions: Map<string, ActorAction> = new Map();
  protected actionHistory: ActionResult[] = [];
  protected lastActionTime: Map<string, number> = new Map();
  protected apiBaseUrl: string;
  protected authToken?: string;

  // Metrics
  protected metrics = {
    actionsPerformed: 0,
    actionsSucceeded: 0,
    actionsFailed: 0,
    totalWaitTime: 0,
    eventsEmitted: 0,
  };

  constructor(config: ActorConfig) {
    this.id = config.id || `${config.type}_${uuidv4().slice(0, 8)}`;
    this.name = config.name;
    this.type = config.type;
    this.role = config.role;
    this.department = config.department;
    this.apiBaseUrl = config.apiBaseUrl;
    this.authToken = config.authToken;
    this.eventBus = EventBus.getInstance();

    this.registerActions();
    this.subscribeToEvents();
  }

  /**
   * Register available actions for this actor
   * Must be implemented by subclasses
   */
  protected abstract registerActions(): void;

  /**
   * Subscribe to relevant events
   * Can be overridden by subclasses
   */
  protected subscribeToEvents(): void {
    // Subscribe to simulation tick to decide next action
    this.eventBus.subscribe(EventTypes.SIMULATION_TICK, (event) => {
      this.onTick(event);
    });
  }

  /**
   * Called on each simulation tick
   * Subclasses can override for custom behavior
   */
  protected async onTick(event: SimulationEvent): Promise<void> {
    if (this.status === 'offline') return;
    
    // Default: try to perform an action if idle
    if (this.status === 'idle') {
      await this.decideAndAct();
    }
  }

  /**
   * Decide what action to take and execute it
   */
  protected async decideAndAct(): Promise<ActionResult | null> {
    const availableActions = this.getAvailableActions();
    if (availableActions.length === 0) return null;

    const action = this.selectAction(availableActions);
    if (!action) return null;

    return this.performAction(action.name);
  }

  /**
   * Get actions that can currently be performed
   */
  protected getAvailableActions(): ActorAction[] {
    const now = Date.now();
    const available: ActorAction[] = [];

    for (const [name, action] of this.actions) {
      // Check cooldown
      if (action.cooldown) {
        const lastTime = this.lastActionTime.get(name) || 0;
        if (now - lastTime < action.cooldown) continue;
      }

      // Check preconditions
      if (action.preconditions && !action.preconditions()) continue;

      available.push(action);
    }

    return available;
  }

  /**
   * Select an action using weighted random selection
   */
  protected selectAction(actions: ActorAction[]): ActorAction | null {
    if (actions.length === 0) return null;
    if (actions.length === 1) return actions[0];

    const totalWeight = actions.reduce((sum, a) => sum + (a.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const action of actions) {
      random -= action.weight || 1;
      if (random <= 0) return action;
    }

    return actions[0];
  }

  /**
   * Perform a specific action
   */
  async performAction(actionName: string): Promise<ActionResult> {
    const action = this.actions.get(actionName);
    if (!action) {
      return {
        success: false,
        action: actionName,
        error: `Action '${actionName}' not found`,
      };
    }

    // Check preconditions
    if (action.preconditions && !action.preconditions()) {
      return {
        success: false,
        action: actionName,
        error: 'Preconditions not met',
      };
    }

    const previousStatus = this.status;
    this.status = 'busy';
    const startTime = Date.now();

    try {
      const result = await action.execute();
      result.duration = Date.now() - startTime;

      // Update metrics
      this.metrics.actionsPerformed++;
      if (result.success) {
        this.metrics.actionsSucceeded++;
      } else {
        this.metrics.actionsFailed++;
      }

      // Update action history
      this.actionHistory.push(result);
      if (this.actionHistory.length > 100) {
        this.actionHistory.shift();
      }

      // Update last action time
      this.lastActionTime.set(actionName, Date.now());

      this.status = previousStatus === 'busy' ? 'idle' : previousStatus;
      return result;
    } catch (error) {
      this.status = previousStatus === 'busy' ? 'idle' : previousStatus;
      this.metrics.actionsFailed++;
      
      const result: ActionResult = {
        success: false,
        action: actionName,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
      this.actionHistory.push(result);
      return result;
    }
  }

  /**
   * Register an action
   */
  protected registerAction(action: ActorAction): void {
    this.actions.set(action.name, action);
  }

  /**
   * Emit an event
   */
  protected emitEvent<T>(
    type: string,
    category: EventCategory,
    payload: T,
    options?: { correlationId?: string; severity?: 'info' | 'warning' | 'error' | 'critical' }
  ): SimulationEvent<T> {
    this.metrics.eventsEmitted++;
    return this.eventBus.emitEvent(type, category, payload, this.id, options);
  }

  /**
   * Make an API call
   */
  protected async apiCall<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      const responseData = await response.json().catch(() => null) as Record<string, any> | null;

      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message ?? `HTTP ${response.status}`,
          status: response.status,
        };
      }

      return {
        success: true,
        data: responseData as T,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Wait for a simulated duration
   */
  protected async wait(simulatedMinutes: number): Promise<void> {
    // In fast-forward mode, we don't actually wait
    // This is a hook for future implementation
    this.metrics.totalWaitTime += simulatedMinutes;
  }

  /**
   * Set actor state
   */
  setState(key: string, value: any): void {
    this.state[key] = value;
  }

  /**
   * Get actor state
   */
  getState(key: string): any {
    return this.state[key];
  }

  /**
   * Get all state
   */
  getAllState(): ActorState {
    return { ...this.state };
  }

  /**
   * Set actor status
   */
  setStatus(status: ActorStatus): void {
    this.status = status;
  }

  /**
   * Get actor status
   */
  getStatus(): ActorStatus {
    return this.status;
  }

  /**
   * Get actor info
   */
  getInfo(): {
    id: string;
    name: string;
    type: ActorType;
    role: string;
    status: ActorStatus;
    metrics: {
      actionsPerformed: number;
      actionsSucceeded: number;
      actionsFailed: number;
      totalWaitTime: number;
      eventsEmitted: number;
    };
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      role: this.role,
      status: this.status,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get action history
   */
  getActionHistory(): ActionResult[] {
    return [...this.actionHistory];
  }

  /**
   * Go online
   */
  goOnline(): void {
    this.status = 'idle';
  }

  /**
   * Go offline
   */
  goOffline(): void {
    this.status = 'offline';
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.eventBus.removeAllListeners();
    this.actions.clear();
    this.actionHistory = [];
  }
}
