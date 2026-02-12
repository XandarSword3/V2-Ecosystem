/**
 * Manager Bot - Handles escalations, approvals, and oversight
 */

import { Actor, ActorConfig, ActionResult } from '../base/Actor';
import { EventTypes, SimulationEvent } from '../../events/EventBus';

export type ManagerRole = 'front_office_manager' | 'fb_manager' | 'spa_manager' | 'housekeeping_supervisor' | 'duty_manager';

export interface ManagerProfile {
  decisionStyle: 'strict' | 'balanced' | 'generous';
  responseSpeed: number; // 0.5-2.0
  compAuthority: number; // Max comp amount
  approvalThreshold: number; // Auto-approve below this
}

export interface ManagerState {
  isOnDuty: boolean;
  pendingDecisions: Decision[];
  decisionsToday: number;
  compsApproved: number;
  escalationsHandled: number;
  totalCompValue: number;
}

export interface Decision {
  id: string;
  type: 'comp' | 'complaint' | 'upgrade' | 'exception' | 'refund';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  amount?: number;
  requestedBy: string;
  guestId?: string;
  reason: string;
  data: any;
  receivedAt: Date;
}

export interface ManagerConfig extends ActorConfig {
  managerRole: ManagerRole;
  profile: ManagerProfile;
  shiftHours: { start: number; end: number };
}

export class ManagerBot extends Actor {
  protected managerRole: ManagerRole;
  protected profile: ManagerProfile;
  protected managerState: ManagerState;
  protected shiftHours: { start: number; end: number };

  constructor(config: Omit<ManagerConfig, 'type' | 'role'>) {
    super({
      ...config,
      type: 'manager',
      role: config.managerRole,
    });

    this.managerRole = config.managerRole;
    this.profile = config.profile;
    this.shiftHours = config.shiftHours;

    this.managerState = {
      isOnDuty: false,
      pendingDecisions: [],
      decisionsToday: 0,
      compsApproved: 0,
      escalationsHandled: 0,
      totalCompValue: 0,
    };
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for escalations
    this.eventBus.subscribe(EventTypes.TASK_ESCALATED, (event) => {
      const payload = event.payload as { staffId: string; reason: string; department: string; [key: string]: any };
      if (this.shouldHandleEscalation(payload)) {
        this.receiveDecision({
          id: `esc_${Date.now()}`,
          type: 'exception',
          priority: 'high',
          requestedBy: payload.staffId,
          reason: payload.reason,
          data: payload,
          receivedAt: this.eventBus.getSimulationTime(),
        });
      }
    });

    // Listen for complaints
    this.eventBus.subscribe(EventTypes.COMPLAINT_FILED, (event) => {
      const payload = event.payload as { severity: string; guestId: string; category: string; [key: string]: any };
      if (this.shouldHandleComplaint(payload)) {
        this.receiveDecision({
          id: `comp_${Date.now()}`,
          type: 'complaint',
          priority: payload.severity === 'high' ? 'urgent' : 'normal',
          requestedBy: 'system',
          guestId: payload.guestId,
          reason: payload.category,
          data: payload,
          receivedAt: this.eventBus.getSimulationTime(),
        });
      }
    });
  }

  protected shouldHandleEscalation(payload: { department: string; [key: string]: any }): boolean {
    // Check if this manager handles this type of escalation
    const departmentMap: Record<ManagerRole, string[]> = {
      front_office_manager: ['front_desk', 'concierge'],
      fb_manager: ['kitchen', 'fb_service'],
      spa_manager: ['spa'],
      housekeeping_supervisor: ['housekeeping'],
      duty_manager: ['front_desk', 'housekeeping', 'fb_service', 'concierge'], // Handles all
    };

    return departmentMap[this.managerRole]?.includes(payload.department) || 
           this.managerRole === 'duty_manager';
  }

  protected shouldHandleComplaint(payload: { category?: string; [key: string]: any }): boolean {
    const categoryMap: Record<ManagerRole, string[]> = {
      front_office_manager: ['room', 'billing', 'service'],
      fb_manager: ['food', 'restaurant', 'service'],
      spa_manager: ['spa'],
      housekeeping_supervisor: ['cleanliness'],
      duty_manager: ['room', 'billing', 'service', 'food', 'cleanliness'], // All
    };

    return (payload.category && categoryMap[this.managerRole]?.includes(payload.category)) ||
           this.managerRole === 'duty_manager';
  }

  protected registerActions(): void {
    // Check duty status
    this.registerAction({
      name: 'check_duty_status',
      weight: 5,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        const shouldBeOnDuty = hour >= this.shiftHours.start && hour < this.shiftHours.end;
        return shouldBeOnDuty !== this.managerState.isOnDuty;
      },
      execute: async () => this.updateDutyStatus(),
    });

    // Handle pending decision
    this.registerAction({
      name: 'handle_decision',
      weight: 10,
      preconditions: () => 
        this.managerState.isOnDuty && 
        this.managerState.pendingDecisions.length > 0,
      execute: async () => this.handleNextDecision(),
    });

    // Floor walk
    this.registerAction({
      name: 'floor_walk',
      weight: 2,
      cooldown: 60 * 60 * 1000,
      preconditions: () => 
        this.managerState.isOnDuty &&
        this.managerState.pendingDecisions.length === 0,
      execute: async () => this.floorWalk(),
    });

    // Check metrics
    this.registerAction({
      name: 'check_metrics',
      weight: 1,
      cooldown: 30 * 60 * 1000,
      preconditions: () => this.managerState.isOnDuty,
      execute: async () => this.checkMetrics(),
    });
  }

  protected async updateDutyStatus(): Promise<ActionResult> {
    const hour = this.eventBus.getSimulationTime().getHours();
    this.managerState.isOnDuty = hour >= this.shiftHours.start && hour < this.shiftHours.end;

    if (this.managerState.isOnDuty) {
      this.emitEvent(EventTypes.SHIFT_STARTED, 'manager', {
        managerId: this.id,
        managerName: this.name,
        role: this.managerRole,
      });
    } else {
      this.emitEvent(EventTypes.SHIFT_ENDED, 'manager', {
        managerId: this.id,
        managerName: this.name,
        role: this.managerRole,
        decisionsToday: this.managerState.decisionsToday,
        totalCompValue: this.managerState.totalCompValue,
      });
      // Reset daily counters
      this.managerState.decisionsToday = 0;
      this.managerState.totalCompValue = 0;
    }

    return {
      success: true,
      action: 'check_duty_status',
      data: { isOnDuty: this.managerState.isOnDuty },
    };
  }

  protected async handleNextDecision(): Promise<ActionResult> {
    // Sort by priority
    this.managerState.pendingDecisions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const decision = this.managerState.pendingDecisions.shift()!;
    const result = await this.makeDecision(decision);

    this.managerState.decisionsToday++;
    if (decision.type === 'comp' && result.approved) {
      this.managerState.compsApproved++;
      this.managerState.totalCompValue += decision.amount || 0;
    }

    this.emitEvent(EventTypes.MANAGER_DECISION, 'manager', {
      managerId: this.id,
      decisionId: decision.id,
      decisionType: decision.type,
      approved: result.approved,
      amount: result.amount,
      reason: result.reason,
    });

    return {
      success: true,
      action: 'handle_decision',
      data: { decision: decision.id, result },
      cascades: [EventTypes.MANAGER_DECISION],
    };
  }

  protected async makeDecision(decision: Decision): Promise<{ approved: boolean; amount?: number; reason: string }> {
    // Decision logic based on profile
    switch (decision.type) {
      case 'comp':
        return this.decideComp(decision);
      case 'complaint':
        return this.decideComplaint(decision);
      case 'upgrade':
        return this.decideUpgrade(decision);
      case 'refund':
        return this.decideRefund(decision);
      default:
        return this.decideException(decision);
    }
  }

  protected decideComp(decision: Decision): { approved: boolean; amount?: number; reason: string } {
    const requestedAmount = decision.amount || 0;

    // Auto-approve small amounts
    if (requestedAmount <= this.profile.approvalThreshold) {
      return { approved: true, amount: requestedAmount, reason: 'Auto-approved under threshold' };
    }

    // Check authority
    if (requestedAmount > this.profile.compAuthority) {
      return { approved: false, reason: 'Exceeds authority - escalate to GM' };
    }

    // Decision based on style
    switch (this.profile.decisionStyle) {
      case 'generous':
        return { approved: true, amount: requestedAmount, reason: 'Approved for guest satisfaction' };
      case 'strict':
        return { 
          approved: requestedAmount <= this.profile.compAuthority * 0.5, 
          amount: Math.min(requestedAmount, this.profile.compAuthority * 0.5),
          reason: 'Partial approval per policy',
        };
      default:
        return { 
          approved: true, 
          amount: requestedAmount * 0.8, 
          reason: 'Approved with adjustment',
        };
    }
  }

  protected decideComplaint(decision: Decision): { approved: boolean; amount?: number; reason: string } {
    // Acknowledge complaint
    this.emitEvent(EventTypes.COMPLAINT_ACKNOWLEDGED, 'manager', {
      complaintId: decision.data.complaintId,
      managerId: this.id,
      guestId: decision.guestId,
    });

    // Determine resolution
    const compAmount = this.calculateComplaintComp(decision);

    if (compAmount > 0) {
      this.emitEvent(EventTypes.COMP_APPROVED, 'manager', {
        guestId: decision.guestId,
        amount: compAmount,
        reason: `Complaint resolution: ${decision.reason}`,
        approvedBy: this.id,
      });
    }

    // Mark resolved
    this.emitEvent(EventTypes.COMPLAINT_RESOLVED, 'manager', {
      complaintId: decision.data.complaintId,
      resolution: compAmount > 0 ? 'compensated' : 'acknowledged',
      managerId: this.id,
    });

    return {
      approved: true,
      amount: compAmount,
      reason: 'Complaint resolved',
    };
  }

  protected calculateComplaintComp(decision: Decision): number {
    const severityMultiplier = decision.priority === 'urgent' ? 2 : decision.priority === 'high' ? 1.5 : 1;
    const baseComp = this.profile.decisionStyle === 'generous' ? 50 : 
                     this.profile.decisionStyle === 'strict' ? 20 : 35;
    
    return Math.min(baseComp * severityMultiplier, this.profile.compAuthority);
  }

  protected decideUpgrade(decision: Decision): { approved: boolean; reason: string } {
    // Check availability would happen via API
    const approved = this.profile.decisionStyle !== 'strict' && Math.random() > 0.3;
    
    return {
      approved,
      reason: approved ? 'Upgrade approved based on availability' : 'No suitable upgrade available',
    };
  }

  protected decideRefund(decision: Decision): { approved: boolean; amount?: number; reason: string } {
    const requestedAmount = decision.amount || 0;

    if (requestedAmount > this.profile.compAuthority) {
      return { approved: false, reason: 'Exceeds authority' };
    }

    return {
      approved: true,
      amount: requestedAmount,
      reason: 'Refund approved',
    };
  }

  protected decideException(decision: Decision): { approved: boolean; reason: string } {
    this.managerState.escalationsHandled++;
    
    // Handle exception request
    return {
      approved: this.profile.decisionStyle !== 'strict',
      reason: 'Exception handled',
    };
  }

  protected async floorWalk(): Promise<ActionResult> {
    // Manager walks the floor, might spot issues
    const foundIssue = Math.random() < 0.2;

    if (foundIssue) {
      this.emitEvent(EventTypes.ISSUE_REPORTED, 'manager', {
        reportedBy: this.id,
        type: 'observation',
        location: this.managerRole.replace('_manager', ''),
      });
    }

    return {
      success: true,
      action: 'floor_walk',
      data: { foundIssue },
    };
  }

  protected async checkMetrics(): Promise<ActionResult> {
    // Pull metrics from API
    const result = await this.apiCall<any>('GET', `/api/v1/dashboard/metrics?department=${this.managerRole}`);

    // Check for alerts
    if (result.success && result.data) {
      // Check for SLA breaches
      if (result.data.avgWaitTime > 15) {
        this.emitEvent(EventTypes.SLA_BREACH, 'manager', {
          metric: 'wait_time',
          value: result.data.avgWaitTime,
          threshold: 15,
          department: this.managerRole,
        });
      }
    }

    return {
      success: true,
      action: 'check_metrics',
      data: result.data,
    };
  }

  /**
   * Receive a decision request
   */
  receiveDecision(decision: Decision): void {
    this.managerState.pendingDecisions.push(decision);
  }

  /**
   * Get manager state
   */
  getManagerState(): ManagerState {
    return { ...this.managerState };
  }
}

/**
 * Front Office Manager
 */
export class FrontOfficeManager extends ManagerBot {
  constructor(config: Omit<ManagerConfig, 'managerRole' | 'type' | 'role' | 'profile'> & { profile?: Partial<ManagerProfile> }) {
    const defaultProfile: ManagerProfile = {
      decisionStyle: 'balanced',
      responseSpeed: 1.0,
      compAuthority: 200,
      approvalThreshold: 50,
    };

    super({
      ...config,
      managerRole: 'front_office_manager',
      profile: { ...defaultProfile, ...config.profile },
    });
  }
}

/**
 * F&B Manager
 */
export class FBManager extends ManagerBot {
  constructor(config: Omit<ManagerConfig, 'managerRole' | 'type' | 'role' | 'profile'> & { profile?: Partial<ManagerProfile> }) {
    const defaultProfile: ManagerProfile = {
      decisionStyle: 'generous', // F&B often comps for guest recovery
      responseSpeed: 1.2,
      compAuthority: 150,
      approvalThreshold: 30,
    };

    super({
      ...config,
      managerRole: 'fb_manager',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Check kitchen
    this.registerAction({
      name: 'check_kitchen',
      weight: 3,
      cooldown: 45 * 60 * 1000,
      preconditions: () => this.managerState.isOnDuty,
      execute: async () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        const isMealTime = (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21);
        
        // More likely to find issues during rush
        if (isMealTime && Math.random() < 0.3) {
          this.emitEvent(EventTypes.ALERT_TRIGGERED, 'manager', {
            type: 'kitchen_backup',
            managerId: this.id,
          });
        }

        return { success: true, action: 'check_kitchen', data: { isMealTime } };
      },
    });
  }
}

/**
 * Duty Manager (General Manager on duty)
 */
export class DutyManager extends ManagerBot {
  constructor(config: Omit<ManagerConfig, 'managerRole' | 'type' | 'role' | 'profile'> & { profile?: Partial<ManagerProfile> }) {
    const defaultProfile: ManagerProfile = {
      decisionStyle: 'balanced',
      responseSpeed: 1.0,
      compAuthority: 500, // Higher authority
      approvalThreshold: 100,
    };

    super({
      ...config,
      managerRole: 'duty_manager',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected shouldHandleEscalation(payload: { department: string; [key: string]: any }): boolean {
    // Duty manager handles everything
    return true;
  }

  protected shouldHandleComplaint(payload: { category?: string; severity?: string; [key: string]: any }): boolean {
    // Duty manager handles all high-severity complaints
    return payload.severity === 'high' || payload.severity === 'critical';
  }
}

// Factory function
export function createManagerBot(
  type: 'front_office' | 'fb' | 'duty',
  config: Omit<ManagerConfig, 'managerRole' | 'type' | 'role' | 'profile'> & { profile?: Partial<ManagerProfile> }
): ManagerBot {
  switch (type) {
    case 'front_office':
      return new FrontOfficeManager(config);
    case 'fb':
      return new FBManager(config);
    case 'duty':
      return new DutyManager(config);
    default:
      throw new Error(`Unknown manager type: ${type}`);
  }
}
