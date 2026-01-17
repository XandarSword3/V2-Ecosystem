/**
 * Task/Work Order Service
 *
 * Manages maintenance tasks, work orders, and assignments.
 * Follows DI pattern for testability.
 */

import type { Container, Task, TaskComment, TaskFilters, TaskCategory, TaskPriority, TaskStatus } from '../container/types.js';

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TASK_STATUSES: TaskStatus[] = ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'];
const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const TASK_CATEGORIES: TaskCategory[] = ['maintenance', 'cleaning', 'repair', 'inspection', 'delivery', 'setup', 'other'];

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 200;

// ============================================
// TYPES
// ============================================

export interface CreateTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  createdBy: string;
  createdByName: string;
  location: string;
  dueDate?: string;
  estimatedMinutes?: number;
  assignedTo?: string;
  assignedToName?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  location?: string;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  tags?: string[];
  notes?: string | null;
}

export interface AssignTaskInput {
  assignedTo: string;
  assignedToName: string;
}

export interface CompleteTaskInput {
  actualMinutes?: number;
  notes?: string;
}

export interface AddCommentInput {
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
}

export interface TaskStats {
  totalTasks: number;
  openTasks: number;
  assignedTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  onHoldTasks: number;
  overdueTasks: number;
  avgCompletionMinutes: number;
  byCategory: Record<TaskCategory, number>;
  byPriority: Record<TaskPriority, number>;
}

export interface TaskService {
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  assignTask(id: string, input: AssignTaskInput): Promise<Task>;
  unassignTask(id: string): Promise<Task>;
  startTask(id: string): Promise<Task>;
  completeTask(id: string, input?: CompleteTaskInput): Promise<Task>;
  cancelTask(id: string, reason?: string): Promise<Task>;
  putOnHold(id: string, reason?: string): Promise<Task>;
  reopenTask(id: string): Promise<Task>;
  listTasks(filters?: TaskFilters): Promise<Task[]>;
  getAssigneeTasks(staffId: string): Promise<Task[]>;
  getOverdueTasks(): Promise<Task[]>;
  addComment(input: AddCommentInput): Promise<TaskComment>;
  getComments(taskId: string): Promise<TaskComment[]>;
  getStats(): Promise<TaskStats>;
  getStatuses(): TaskStatus[];
  getPriorities(): TaskPriority[];
  getCategories(): TaskCategory[];
}

// ============================================
// ERROR CLASS
// ============================================

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'TaskServiceError';
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function validateTitle(title: string): void {
  if (!title || title.trim().length < MIN_TITLE_LENGTH) {
    throw new TaskServiceError(
      `Title must be at least ${MIN_TITLE_LENGTH} characters`,
      'INVALID_TITLE'
    );
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new TaskServiceError(
      `Title cannot exceed ${MAX_TITLE_LENGTH} characters`,
      'INVALID_TITLE'
    );
  }
}

function validateDescription(description: string): void {
  if (!description || description.trim().length === 0) {
    throw new TaskServiceError('Description is required', 'INVALID_DESCRIPTION');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new TaskServiceError(
      `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      'INVALID_DESCRIPTION'
    );
  }
}

function validateLocation(location: string): void {
  if (!location || location.trim().length === 0) {
    throw new TaskServiceError('Location is required', 'INVALID_LOCATION');
  }
  if (location.length > MAX_LOCATION_LENGTH) {
    throw new TaskServiceError(
      `Location cannot exceed ${MAX_LOCATION_LENGTH} characters`,
      'INVALID_LOCATION'
    );
  }
}

function validateCategory(category: TaskCategory): void {
  if (!TASK_CATEGORIES.includes(category)) {
    throw new TaskServiceError(`Invalid category: ${category}`, 'INVALID_CATEGORY');
  }
}

function validatePriority(priority: TaskPriority): void {
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new TaskServiceError(`Invalid priority: ${priority}`, 'INVALID_PRIORITY');
  }
}

function validateDueDate(dueDate: string): void {
  const date = new Date(dueDate);
  if (isNaN(date.getTime())) {
    throw new TaskServiceError('Invalid due date format', 'INVALID_DUE_DATE');
  }
}

function validateEstimatedMinutes(minutes: number): void {
  if (minutes <= 0) {
    throw new TaskServiceError('Estimated minutes must be positive', 'INVALID_ESTIMATED_MINUTES');
  }
  if (minutes > 24 * 60) {
    throw new TaskServiceError('Estimated minutes cannot exceed 24 hours', 'INVALID_ESTIMATED_MINUTES');
  }
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createTaskService(container: Container): TaskService {
  const { taskRepository, logger } = container;

  async function createTask(input: CreateTaskInput): Promise<Task> {
    logger?.info?.('Creating task', { title: input.title });

    // Validate required fields
    validateTitle(input.title);
    validateDescription(input.description);
    validateCategory(input.category);
    validatePriority(input.priority);
    validateLocation(input.location);

    if (!isValidUUID(input.createdBy)) {
      throw new TaskServiceError('Invalid creator ID', 'INVALID_CREATOR_ID');
    }

    if (!input.createdByName || input.createdByName.trim().length === 0) {
      throw new TaskServiceError('Creator name is required', 'INVALID_CREATOR_NAME');
    }

    if (input.dueDate) {
      validateDueDate(input.dueDate);
    }

    if (input.estimatedMinutes !== undefined) {
      validateEstimatedMinutes(input.estimatedMinutes);
    }

    if (input.assignedTo && !isValidUUID(input.assignedTo)) {
      throw new TaskServiceError('Invalid assignee ID', 'INVALID_ASSIGNEE_ID');
    }

    const status: TaskStatus = input.assignedTo ? 'assigned' : 'open';

    const task = await taskRepository.create({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      status,
      assignedTo: input.assignedTo || null,
      assignedToName: input.assignedToName || null,
      createdBy: input.createdBy,
      createdByName: input.createdByName.trim(),
      location: input.location.trim(),
      dueDate: input.dueDate || null,
      estimatedMinutes: input.estimatedMinutes || null,
      actualMinutes: null,
      completedAt: null,
      notes: input.notes?.trim() || null,
      tags: input.tags || [],
    });

    return task;
  }

  async function getTask(id: string): Promise<Task | null> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    return taskRepository.getById(id);
  }

  async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new TaskServiceError(
        'Cannot update completed or cancelled tasks',
        'INVALID_STATUS'
      );
    }

    const updates: Partial<Task> = {};

    if (input.title !== undefined) {
      validateTitle(input.title);
      updates.title = input.title.trim();
    }

    if (input.description !== undefined) {
      validateDescription(input.description);
      updates.description = input.description.trim();
    }

    if (input.category !== undefined) {
      validateCategory(input.category);
      updates.category = input.category;
    }

    if (input.priority !== undefined) {
      validatePriority(input.priority);
      updates.priority = input.priority;
    }

    if (input.location !== undefined) {
      validateLocation(input.location);
      updates.location = input.location.trim();
    }

    if (input.dueDate !== undefined) {
      if (input.dueDate !== null) {
        validateDueDate(input.dueDate);
      }
      updates.dueDate = input.dueDate;
    }

    if (input.estimatedMinutes !== undefined) {
      if (input.estimatedMinutes !== null) {
        validateEstimatedMinutes(input.estimatedMinutes);
      }
      updates.estimatedMinutes = input.estimatedMinutes;
    }

    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes?.trim() || null;
    }

    return taskRepository.update(id, updates);
  }

  async function deleteTask(id: string): Promise<void> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'in_progress') {
      throw new TaskServiceError(
        'Cannot delete in-progress tasks',
        'INVALID_STATUS'
      );
    }

    await taskRepository.delete(id);
  }

  async function assignTask(id: string, input: AssignTaskInput): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    if (!isValidUUID(input.assignedTo)) {
      throw new TaskServiceError('Invalid assignee ID', 'INVALID_ASSIGNEE_ID');
    }

    if (!input.assignedToName || input.assignedToName.trim().length === 0) {
      throw new TaskServiceError('Assignee name is required', 'INVALID_ASSIGNEE_NAME');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new TaskServiceError(
        'Cannot assign completed or cancelled tasks',
        'INVALID_STATUS'
      );
    }

    return taskRepository.update(id, {
      assignedTo: input.assignedTo,
      assignedToName: input.assignedToName.trim(),
      status: task.status === 'open' ? 'assigned' : task.status,
    });
  }

  async function unassignTask(id: string): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'in_progress') {
      throw new TaskServiceError(
        'Cannot unassign in-progress tasks',
        'INVALID_STATUS'
      );
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new TaskServiceError(
        'Cannot unassign completed or cancelled tasks',
        'INVALID_STATUS'
      );
    }

    return taskRepository.update(id, {
      assignedTo: null,
      assignedToName: null,
      status: 'open',
    });
  }

  async function startTask(id: string): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'assigned' && task.status !== 'on_hold') {
      throw new TaskServiceError(
        'Only assigned or on-hold tasks can be started',
        'INVALID_STATUS'
      );
    }

    return taskRepository.update(id, {
      status: 'in_progress',
    });
  }

  async function completeTask(id: string, input?: CompleteTaskInput): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'in_progress') {
      throw new TaskServiceError(
        'Only in-progress tasks can be completed',
        'INVALID_STATUS'
      );
    }

    const updates: Partial<Task> = {
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    if (input?.actualMinutes !== undefined) {
      if (input.actualMinutes <= 0) {
        throw new TaskServiceError('Actual minutes must be positive', 'INVALID_ACTUAL_MINUTES');
      }
      updates.actualMinutes = input.actualMinutes;
    }

    if (input?.notes) {
      updates.notes = task.notes
        ? `${task.notes}\n---\nCompletion: ${input.notes.trim()}`
        : input.notes.trim();
    }

    return taskRepository.update(id, updates);
  }

  async function cancelTask(id: string, reason?: string): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'completed') {
      throw new TaskServiceError(
        'Cannot cancel completed tasks',
        'INVALID_STATUS'
      );
    }

    const updates: Partial<Task> = {
      status: 'cancelled',
    };

    if (reason) {
      updates.notes = task.notes
        ? `${task.notes}\n---\nCancellation: ${reason.trim()}`
        : `Cancellation: ${reason.trim()}`;
    }

    return taskRepository.update(id, updates);
  }

  async function putOnHold(id: string, reason?: string): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'assigned' && task.status !== 'in_progress') {
      throw new TaskServiceError(
        'Only assigned or in-progress tasks can be put on hold',
        'INVALID_STATUS'
      );
    }

    const updates: Partial<Task> = {
      status: 'on_hold',
    };

    if (reason) {
      updates.notes = task.notes
        ? `${task.notes}\n---\nOn hold: ${reason.trim()}`
        : `On hold: ${reason.trim()}`;
    }

    return taskRepository.update(id, updates);
  }

  async function reopenTask(id: string): Promise<Task> {
    if (!isValidUUID(id)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(id);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'cancelled' && task.status !== 'on_hold') {
      throw new TaskServiceError(
        'Only cancelled or on-hold tasks can be reopened',
        'INVALID_STATUS'
      );
    }

    const newStatus: TaskStatus = task.assignedTo ? 'assigned' : 'open';

    return taskRepository.update(id, {
      status: newStatus,
      completedAt: null,
    });
  }

  async function listTasks(filters?: TaskFilters): Promise<Task[]> {
    return taskRepository.list(filters);
  }

  async function getAssigneeTasks(staffId: string): Promise<Task[]> {
    if (!isValidUUID(staffId)) {
      throw new TaskServiceError('Invalid staff ID', 'INVALID_STAFF_ID');
    }

    return taskRepository.getByAssignee(staffId);
  }

  async function getOverdueTasks(): Promise<Task[]> {
    return taskRepository.getOverdue();
  }

  async function addComment(input: AddCommentInput): Promise<TaskComment> {
    if (!isValidUUID(input.taskId)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    if (!isValidUUID(input.authorId)) {
      throw new TaskServiceError('Invalid author ID', 'INVALID_AUTHOR_ID');
    }

    if (!input.authorName || input.authorName.trim().length === 0) {
      throw new TaskServiceError('Author name is required', 'INVALID_AUTHOR_NAME');
    }

    if (!input.content || input.content.trim().length === 0) {
      throw new TaskServiceError('Comment content is required', 'INVALID_CONTENT');
    }

    const task = await taskRepository.getById(input.taskId);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    return taskRepository.addComment({
      taskId: input.taskId,
      authorId: input.authorId,
      authorName: input.authorName.trim(),
      content: input.content.trim(),
    });
  }

  async function getComments(taskId: string): Promise<TaskComment[]> {
    if (!isValidUUID(taskId)) {
      throw new TaskServiceError('Invalid task ID', 'INVALID_TASK_ID');
    }

    const task = await taskRepository.getById(taskId);
    if (!task) {
      throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    return taskRepository.getComments(taskId);
  }

  async function getStats(): Promise<TaskStats> {
    const allTasks = await taskRepository.list();
    const overdueTasks = await taskRepository.getOverdue();

    const stats: TaskStats = {
      totalTasks: allTasks.length,
      openTasks: 0,
      assignedTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      cancelledTasks: 0,
      onHoldTasks: 0,
      overdueTasks: overdueTasks.length,
      avgCompletionMinutes: 0,
      byCategory: {
        maintenance: 0,
        cleaning: 0,
        repair: 0,
        inspection: 0,
        delivery: 0,
        setup: 0,
        other: 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
    };

    let totalCompletionMinutes = 0;
    let completedWithMinutes = 0;

    for (const task of allTasks) {
      switch (task.status) {
        case 'open':
          stats.openTasks++;
          break;
        case 'assigned':
          stats.assignedTasks++;
          break;
        case 'in_progress':
          stats.inProgressTasks++;
          break;
        case 'completed':
          stats.completedTasks++;
          if (task.actualMinutes) {
            totalCompletionMinutes += task.actualMinutes;
            completedWithMinutes++;
          }
          break;
        case 'cancelled':
          stats.cancelledTasks++;
          break;
        case 'on_hold':
          stats.onHoldTasks++;
          break;
      }

      stats.byCategory[task.category]++;
      stats.byPriority[task.priority]++;
    }

    stats.avgCompletionMinutes = completedWithMinutes > 0
      ? Math.round(totalCompletionMinutes / completedWithMinutes)
      : 0;

    return stats;
  }

  function getStatuses(): TaskStatus[] {
    return [...TASK_STATUSES];
  }

  function getPriorities(): TaskPriority[] {
    return [...TASK_PRIORITIES];
  }

  function getCategories(): TaskCategory[] {
    return [...TASK_CATEGORIES];
  }

  return {
    createTask,
    getTask,
    updateTask,
    deleteTask,
    assignTask,
    unassignTask,
    startTask,
    completeTask,
    cancelTask,
    putOnHold,
    reopenTask,
    listTasks,
    getAssigneeTasks,
    getOverdueTasks,
    addComment,
    getComments,
    getStats,
    getStatuses,
    getPriorities,
    getCategories,
  };
}
