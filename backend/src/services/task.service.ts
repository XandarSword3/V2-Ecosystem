import { v4 as uuidv4 } from 'uuid';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'maintenance' | 'cleaning' | 'repair' | 'inspection' | 'delivery' | 'setup' | 'other';
export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

export interface Task {
  id: string; title: string; description: string;
  category: TaskCategory; priority: TaskPriority; status: TaskStatus;
  assignedTo: string | null; assignedToName: string | null;
  createdBy: string; createdByName: string;
  location: string; dueDate: string | null;
  estimatedMinutes: number | null; actualMinutes: number | null;
  completedAt: string | null; notes: string | null; tags: string[];
  createdAt: string; updatedAt: string | null;
}

export interface TaskComment {
  id: string; taskId: string; authorId: string; authorName: string;
  content: string; createdAt: string;
}

export class TaskServiceError extends Error {
  constructor(msg: string, public readonly code: string, public readonly statusCode = 400) {
    super(msg); this.name = 'TaskServiceError';
  }
}

export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(filters?: Partial<Pick<Task, 'category' | 'priority' | 'status' | 'createdBy' | 'assignedTo'>>): Promise<Task[]>;
  save(t: Task): Promise<Task>;
  delete(id: string): Promise<void>;
  saveComment(c: TaskComment): Promise<TaskComment>;
  findComments(taskId: string): Promise<TaskComment[]>;
  addTask(t: Task): void; // for test seeding
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES: TaskCategory[] = ['maintenance', 'cleaning', 'repair', 'inspection', 'delivery', 'setup', 'other'];

export function createTaskService(container: { taskRepository: TaskRepository; logger?: any }) {
  const { taskRepository: repo } = container;

  function validate(id: string, code: string) {
    if (!UUID_RE.test(id)) throw new TaskServiceError(`Invalid UUID`, code);
  }

  async function getOrThrow(id: string): Promise<Task> {
    validate(id, 'INVALID_TASK_ID');
    const t = await repo.findById(id);
    if (!t) throw new TaskServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    return t;
  }

  return {
    async createTask(input: {
      title: string; description: string; category: string; priority: string;
      createdBy: string; createdByName: string; location: string;
      assignedTo?: string; assignedToName?: string;
      dueDate?: string; estimatedMinutes?: number; tags?: string[];
    }): Promise<Task> {
      if (!input.title || input.title.trim().length < 3) throw new TaskServiceError('Title too short', 'INVALID_TITLE');
      if (!input.description?.trim()) throw new TaskServiceError('Description required', 'INVALID_DESCRIPTION');
      if (!CATEGORIES.includes(input.category as TaskCategory)) throw new TaskServiceError('Invalid category', 'INVALID_CATEGORY');
      if (!PRIORITIES.includes(input.priority as TaskPriority)) throw new TaskServiceError('Invalid priority', 'INVALID_PRIORITY');
      if (!input.location?.trim()) throw new TaskServiceError('Location required', 'INVALID_LOCATION');
      if (!UUID_RE.test(input.createdBy)) throw new TaskServiceError('Invalid creator', 'INVALID_CREATOR_ID');
      if (!input.createdByName?.trim()) throw new TaskServiceError('Creator name required', 'INVALID_CREATOR_NAME');
      if (input.estimatedMinutes !== undefined && input.estimatedMinutes < 0) throw new TaskServiceError('Minutes must be non-negative', 'INVALID_ESTIMATED_MINUTES');
      if (input.assignedTo && !UUID_RE.test(input.assignedTo)) throw new TaskServiceError('Invalid assignee', 'INVALID_ASSIGNEE_ID');

      const hasAssignee = !!input.assignedTo;
      const now = new Date().toISOString();
      return repo.save({
        id: uuidv4(), title: input.title.trim(), description: input.description.trim(),
        category: input.category as TaskCategory, priority: input.priority as TaskPriority,
        status: hasAssignee ? 'assigned' : 'open',
        assignedTo: input.assignedTo ?? null, assignedToName: input.assignedToName ?? null,
        createdBy: input.createdBy, createdByName: input.createdByName,
        location: input.location.trim(), dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null, actualMinutes: null,
        completedAt: null, notes: null, tags: input.tags ?? [],
        createdAt: now, updatedAt: null,
      });
    },

    async getTask(id: string): Promise<Task | null> {
      validate(id, 'INVALID_TASK_ID');
      return repo.findById(id);
    },

    async updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'category' | 'priority' | 'location' | 'dueDate' | 'estimatedMinutes' | 'tags' | 'notes'>>): Promise<Task> {
      const t = await getOrThrow(id);
      if (['completed', 'cancelled'].includes(t.status)) throw new TaskServiceError('Cannot update in current status', 'INVALID_STATUS');
      return repo.save({ ...t, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteTask(id: string): Promise<void> {
      const t = await getOrThrow(id);
      if (t.status === 'in_progress') throw new TaskServiceError('Cannot delete in-progress task', 'INVALID_STATUS');
      await repo.delete(t.id);
    },

    async assignTask(id: string, input: { assignedTo: string; assignedToName: string }): Promise<Task> {
      if (!UUID_RE.test(input.assignedTo)) throw new TaskServiceError('Invalid assignee', 'INVALID_ASSIGNEE_ID');
      if (!input.assignedToName?.trim()) throw new TaskServiceError('Assignee name required', 'INVALID_ASSIGNEE_NAME');
      const t = await getOrThrow(id);
      if (['completed', 'cancelled'].includes(t.status)) throw new TaskServiceError('Cannot assign in current status', 'INVALID_STATUS');
      return repo.save({ ...t, assignedTo: input.assignedTo, assignedToName: input.assignedToName, status: 'assigned', updatedAt: new Date().toISOString() });
    },

    async unassignTask(id: string): Promise<Task> {
      const t = await getOrThrow(id);
      if (t.status !== 'assigned') throw new TaskServiceError('Can only unassign assigned tasks', 'INVALID_STATUS');
      return repo.save({ ...t, assignedTo: null, assignedToName: null, status: 'open', updatedAt: new Date().toISOString() });
    },

    async startTask(id: string): Promise<Task> {
      const t = await getOrThrow(id);
      if (t.status !== 'assigned') throw new TaskServiceError('Must be assigned first', 'INVALID_STATUS');
      return repo.save({ ...t, status: 'in_progress', updatedAt: new Date().toISOString() });
    },

    async completeTask(id: string, input?: { actualMinutes?: number; notes?: string }): Promise<Task> {
      const t = await getOrThrow(id);
      if (t.status !== 'in_progress') throw new TaskServiceError('Must be in progress', 'INVALID_STATUS');
      if (input?.actualMinutes !== undefined && input.actualMinutes < 0) throw new TaskServiceError('Minutes must be non-negative', 'INVALID_ACTUAL_MINUTES');
      const notes = input?.notes ? (t.notes ? `${t.notes}\n${input.notes}` : input.notes) : t.notes;
      return repo.save({ ...t, status: 'completed', actualMinutes: input?.actualMinutes ?? null, notes, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },

    async cancelTask(id: string, reason?: string): Promise<Task> {
      const t = await getOrThrow(id);
      if (['completed', 'cancelled'].includes(t.status)) throw new TaskServiceError('Cannot cancel in current status', 'INVALID_STATUS');
      const notes = reason ? (t.notes ? `${t.notes}\n${reason}` : reason) : t.notes;
      return repo.save({ ...t, status: 'cancelled', notes, updatedAt: new Date().toISOString() });
    },

    async putOnHold(id: string, reason?: string): Promise<Task> {
      const t = await getOrThrow(id);
      if (!['assigned', 'in_progress'].includes(t.status)) throw new TaskServiceError('Can only hold assigned/in_progress tasks', 'INVALID_STATUS');
      const notes = reason ? (t.notes ? `${t.notes}\n${reason}` : reason) : t.notes;
      return repo.save({ ...t, status: 'on_hold', notes, updatedAt: new Date().toISOString() });
    },

    async reopenTask(id: string): Promise<Task> {
      const t = await getOrThrow(id);
      if (!['cancelled', 'on_hold'].includes(t.status)) throw new TaskServiceError('Can only reopen cancelled or on_hold tasks', 'INVALID_STATUS');
      const newStatus: TaskStatus = (t.status === 'on_hold' && t.assignedTo) ? 'assigned' : 'open';
      return repo.save({ ...t, status: newStatus, updatedAt: new Date().toISOString() });
    },

    async listTasks(filters?: Partial<Pick<Task, 'category' | 'priority' | 'status' | 'createdBy'>>): Promise<Task[]> {
      return repo.findAll(filters);
    },

    async getAssigneeTasks(staffId: string): Promise<Task[]> {
      if (!UUID_RE.test(staffId)) throw new TaskServiceError('Invalid staff ID', 'INVALID_STAFF_ID');
      return repo.findAll({ assignedTo: staffId });
    },

    async getOverdueTasks(): Promise<Task[]> {
      const all = await repo.findAll();
      const now = Date.now();
      return all.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now && !['completed', 'cancelled'].includes(t.status));
    },

    async addComment(input: { taskId: string; authorId: string; authorName: string; content: string }): Promise<TaskComment> {
      validate(input.taskId, 'INVALID_TASK_ID');
      if (!UUID_RE.test(input.authorId)) throw new TaskServiceError('Invalid author', 'INVALID_AUTHOR_ID');
      if (!input.authorName?.trim()) throw new TaskServiceError('Author name required', 'INVALID_AUTHOR_NAME');
      if (!input.content?.trim()) throw new TaskServiceError('Content required', 'INVALID_CONTENT');
      return repo.saveComment({ id: uuidv4(), taskId: input.taskId, authorId: input.authorId, authorName: input.authorName, content: input.content.trim(), createdAt: new Date().toISOString() });
    },

    async getComments(taskId: string): Promise<TaskComment[]> {
      validate(taskId, 'INVALID_TASK_ID');
      return repo.findComments(taskId);
    },

    async getStats() {
      const all = await repo.findAll();
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      for (const t of all) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
      }
      return { totalTasks: all.length, openTasks: byStatus['open'] ?? 0, cancelledTasks: byStatus['cancelled'] ?? 0, byStatus, byCategory };
    },

    getStatuses(): TaskStatus[] { return ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold']; },
    getPriorities(): TaskPriority[] { return [...PRIORITIES]; },
    getCategories(): TaskCategory[] { return [...CATEGORIES]; },
  };
}
