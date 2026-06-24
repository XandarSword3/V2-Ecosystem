/**
 * Staff Bot - Base class for all staff actors
 * Handles common staff behaviors: shifts, tasks, escalations
 */

import { Actor, ActorConfig, ActionResult } from '../base/Actor';
import { EventTypes, EventCategory } from '../../events/EventBus';

export type StaffDepartment = 
  | 'front_desk' 
  | 'housekeeping' 
  | 'fb_service' 
  | 'fb'
  | 'kitchen' 
  | 'spa' 
  | 'maintenance'
  | 'concierge'
  | 'security'
  | 'accommodation_units'
  | 'kiosk'
  | 'capacity';

export interface StaffProfile {
  skillLevel: 'junior' | 'mid' | 'senior';
  speed: number; // 0.5-2.0, affects task completion time
  accuracy: number; // 0-1, probability of doing task correctly
  multitaskLimit: number; // Max concurrent tasks
  breakPreference: 'regular' | 'flexible' | 'scheduled';
  escalationThreshold: number; // Difficulty level that triggers escalation
}

export interface StaffShift {
  startHour: number;
  endHour: number;
  breakTime?: number; // Hour to take break
  breakDuration?: number; // Minutes
}

export interface StaffState {
  isOnShift: boolean;
  isOnBreak: boolean;
  currentTasks: Task[];
  completedTasks: number;
  escalatedTasks: number;
  shiftStartTime?: Date;
  lastBreakTime?: Date;
  currentLocation: string;
  fatigue: number; // 0-100
}

export interface Task {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  difficulty: number; // 1-10
  estimatedMinutes: number;
  startedAt?: Date;
  data: any;
}

export interface StaffConfig extends ActorConfig {
  department: StaffDepartment;
  profile: StaffProfile;
  shift: StaffShift;
}

export class StaffBot extends Actor {
  protected profile: StaffProfile;
  protected shift: StaffShift;
  protected staffState: StaffState;
  protected taskQueue: Task[] = [];

  constructor(config: Omit<StaffConfig, 'type'>) {
    super({
      ...config,
      type: 'staff',
      department: config.department,
    });

    this.profile = config.profile;
    this.shift = config.shift;

    this.staffState = {
      isOnShift: false,
      isOnBreak: false,
      currentTasks: [],
      completedTasks: 0,
      escalatedTasks: 0,
      currentLocation: config.department,
      fatigue: 0,
    };
  }

  protected registerActions(): void {
    // Start shift
    this.registerAction({
      name: 'start_shift',
      weight: 10,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        return !this.staffState.isOnShift && hour === this.shift.startHour;
      },
      execute: async () => this.startShift(),
    });

    // End shift
    this.registerAction({
      name: 'end_shift',
      weight: 10,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        return this.staffState.isOnShift && hour >= this.shift.endHour;
      },
      execute: async () => this.endShift(),
    });

    // Take break
    this.registerAction({
      name: 'take_break',
      weight: 3,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => {
        if (!this.staffState.isOnShift || this.staffState.isOnBreak) return false;
        const hour = this.eventBus.getSimulationTime().getHours();
        return this.shift.breakTime !== undefined && hour >= this.shift.breakTime;
      },
      execute: async () => this.takeBreak(),
    });

    // Work on current task
    this.registerAction({
      name: 'work_on_task',
      weight: 8,
      preconditions: () => 
        this.staffState.isOnShift && 
        !this.staffState.isOnBreak &&
        this.staffState.currentTasks.length > 0,
      execute: async () => this.workOnTask(),
    });

    // Pick up next task
    this.registerAction({
      name: 'pick_up_task',
      weight: 6,
      preconditions: () => 
        this.staffState.isOnShift && 
        !this.staffState.isOnBreak &&
        this.taskQueue.length > 0 &&
        this.staffState.currentTasks.length < this.profile.multitaskLimit,
      execute: async () => this.pickUpTask(),
    });

    // Escalate difficult task
    this.registerAction({
      name: 'escalate_task',
      weight: 2,
      preconditions: () => {
        const hardTask = this.staffState.currentTasks.find(
          t => t.difficulty > this.profile.escalationThreshold
        );
        return !!hardTask;
      },
      execute: async () => this.escalateTask(),
    });
  }

  protected async startShift(): Promise<ActionResult> {
    this.staffState.isOnShift = true;
    this.staffState.shiftStartTime = this.eventBus.getSimulationTime();
    this.staffState.fatigue = 0;

    this.emitEvent(EventTypes.SHIFT_STARTED, 'staff', {
      staffId: this.id,
      staffName: this.name,
      department: this.department,
      shiftStart: this.shift.startHour,
      shiftEnd: this.shift.endHour,
    });

    return {
      success: true,
      action: 'start_shift',
      data: { shiftStartTime: this.staffState.shiftStartTime },
      cascades: [EventTypes.SHIFT_STARTED],
    };
  }

  protected async endShift(): Promise<ActionResult> {
    this.staffState.isOnShift = false;

    // Hand off any remaining tasks
    const handedOff = this.staffState.currentTasks.length;
    for (const task of this.staffState.currentTasks) {
      this.taskQueue.push(task);
    }
    this.staffState.currentTasks = [];

    this.emitEvent(EventTypes.SHIFT_ENDED, 'staff', {
      staffId: this.id,
      staffName: this.name,
      department: this.department,
      tasksCompleted: this.staffState.completedTasks,
      tasksHandedOff: handedOff,
    });

    return {
      success: true,
      action: 'end_shift',
      data: { 
        tasksCompleted: this.staffState.completedTasks,
        tasksHandedOff: handedOff,
      },
      cascades: [EventTypes.SHIFT_ENDED],
    };
  }

  protected async takeBreak(): Promise<ActionResult> {
    this.staffState.isOnBreak = true;
    this.staffState.lastBreakTime = this.eventBus.getSimulationTime();
    this.staffState.fatigue = Math.max(0, this.staffState.fatigue - 30);

    // Simulate break duration
    setTimeout(() => {
      this.staffState.isOnBreak = false;
    }, (this.shift.breakDuration || 30) * 100); // Scaled for simulation

    return {
      success: true,
      action: 'take_break',
      data: { breakDuration: this.shift.breakDuration || 30 },
    };
  }

  protected async workOnTask(): Promise<ActionResult> {
    const task = this.staffState.currentTasks[0];
    if (!task) {
      return { success: false, action: 'work_on_task', error: 'No current task' };
    }

    // Calculate actual completion time based on skill
    const adjustedTime = task.estimatedMinutes / this.profile.speed;
    
    // Check for accuracy (might need to redo)
    const success = Math.random() < this.profile.accuracy;

    if (success) {
      // Remove from current tasks
      this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== task.id);
      this.staffState.completedTasks++;
      this.staffState.fatigue += task.difficulty;

      this.emitEvent(EventTypes.TASK_COMPLETED, 'staff', {
        staffId: this.id,
        taskId: task.id,
        taskType: task.type,
        duration: adjustedTime,
      });

      return {
        success: true,
        action: 'work_on_task',
        data: { taskId: task.id, duration: adjustedTime },
        cascades: [EventTypes.TASK_COMPLETED],
      };
    } else {
      // Task needs to be redone
      task.estimatedMinutes += 10;
      return {
        success: false,
        action: 'work_on_task',
        error: 'Task needs rework',
        data: { taskId: task.id },
      };
    }
  }

  protected async pickUpTask(): Promise<ActionResult> {
    if (this.taskQueue.length === 0) {
      return { success: false, action: 'pick_up_task', error: 'No tasks in queue' };
    }

    // Sort by priority and pick highest
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const task = this.taskQueue.shift()!;
    task.startedAt = this.eventBus.getSimulationTime();
    this.staffState.currentTasks.push(task);

    this.emitEvent(EventTypes.TASK_ASSIGNED, 'staff', {
      staffId: this.id,
      taskId: task.id,
      taskType: task.type,
      priority: task.priority,
    });

    return {
      success: true,
      action: 'pick_up_task',
      data: { task },
      cascades: [EventTypes.TASK_ASSIGNED],
    };
  }

  protected async escalateTask(): Promise<ActionResult> {
    const hardTask = this.staffState.currentTasks.find(
      t => t.difficulty > this.profile.escalationThreshold
    );

    if (!hardTask) {
      return { success: false, action: 'escalate_task', error: 'No task to escalate' };
    }

    // Remove from current tasks
    this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== hardTask.id);
    this.staffState.escalatedTasks++;

    this.emitEvent(EventTypes.TASK_ESCALATED, 'staff', {
      staffId: this.id,
      taskId: hardTask.id,
      taskType: hardTask.type,
      difficulty: hardTask.difficulty,
      reason: 'Above skill threshold',
    });

    return {
      success: true,
      action: 'escalate_task',
      data: { task: hardTask },
      cascades: [EventTypes.TASK_ESCALATED],
    };
  }

  /**
   * Assign a task to this staff member
   */
  assignTask(task: Task): boolean {
    if (!this.staffState.isOnShift || this.staffState.isOnBreak) {
      return false;
    }

    if (this.staffState.currentTasks.length >= this.profile.multitaskLimit) {
      this.taskQueue.push(task);
    } else {
      task.startedAt = this.eventBus.getSimulationTime();
      this.staffState.currentTasks.push(task);
    }

    return true;
  }

  /**
   * Get staff state
   */
  getStaffState(): StaffState {
    return { ...this.staffState };
  }

  /**
   * Get task queue
   */
  getTaskQueue(): Task[] {
    return [...this.taskQueue];
  }

  /**
   * Check if staff can take more tasks
   */
  canTakeTask(): boolean {
    return this.staffState.isOnShift && 
           !this.staffState.isOnBreak && 
           this.staffState.currentTasks.length < this.profile.multitaskLimit;
  }
}
