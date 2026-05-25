import { randomUUID } from 'crypto';
import type { Container, Task, TaskCategory, TaskPriority, TaskStatus, TaskComment } from '../container/types';
import type { InMemoryTaskRepository } from '../repositories/task.repository.memory';

export class TaskServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const CATEGORIES: TaskCategory[] = ['maintenance','cleaning','repair','inspection','delivery','setup','other'];
const PRIORITIES: TaskPriority[] = ['low','medium','high','urgent'];
const STATUSES: TaskStatus[] = ['open','assigned','in_progress','on_hold','completed','cancelled'];

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

export function createTaskService(container: Container) {
  const repo = container.taskRepository as InMemoryTaskRepository;

  async function getOrThrow(id: string): Promise<Task> {
    if (!isUUID(id)) throw new TaskServiceError('INVALID_TASK_ID', 'Invalid ID');
    const t = await repo.findById(id);
    if (!t) throw new TaskServiceError('TASK_NOT_FOUND', 'Task not found');
    return t;
  }

  return {
    async createTask(input: { title: string; description: string; category: TaskCategory; priority: TaskPriority; createdBy: string; createdByName: string; location: string; assignedTo?: string; assignedToName?: string; dueDate?: string; estimatedMinutes?: number; tags?: string[] }) {
      if (input.title.length < 3) throw new TaskServiceError('INVALID_TITLE', 'Title too short');
      if (!input.description.trim()) throw new TaskServiceError('INVALID_DESCRIPTION', 'Description required');
      if (!CATEGORIES.includes(input.category)) throw new TaskServiceError('INVALID_CATEGORY', 'Invalid category');
      if (!PRIORITIES.includes(input.priority)) throw new TaskServiceError('INVALID_PRIORITY', 'Invalid priority');
      if (!input.location.trim()) throw new TaskServiceError('INVALID_LOCATION', 'Location required');
      if (!isUUID(input.createdBy)) throw new TaskServiceError('INVALID_CREATOR_ID', 'Invalid creator ID');
      if (!input.createdByName.trim()) throw new TaskServiceError('INVALID_CREATOR_NAME', 'Creator name required');
      if (input.estimatedMinutes !== undefined && input.estimatedMinutes < 0) throw new TaskServiceError('INVALID_ESTIMATED_MINUTES', 'Must be non-negative');
      if (input.assignedTo && !isUUID(input.assignedTo)) throw new TaskServiceError('INVALID_ASSIGNEE_ID', 'Invalid assignee ID');
      const now = new Date().toISOString();
      const task: Task = {
        id: randomUUID(),
        title: input.title, description: input.description,
        category: input.category, priority: input.priority,
        status: input.assignedTo ? 'assigned' : 'open',
        assignedTo: input.assignedTo ?? null,
        assignedToName: input.assignedToName ?? null,
        createdBy: input.createdBy, createdByName: input.createdByName,
        location: input.location,
        dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        actualMinutes: null, completedAt: null, notes: null,
        tags: input.tags ?? [],
        createdAt: now, updatedAt: null,
      };
      return repo.save(task);
    },

    async getTask(id: string) {
      if (!isUUID(id)) throw new TaskServiceError('INVALID_TASK_ID', 'Invalid ID');
      return repo.findById(id);
    },

    async updateTask(id: string, updates: Partial<Task>) {
      if (!isUUID(id)) throw new TaskServiceError('INVALID_TASK_ID', 'Invalid ID');
      const t = await repo.findById(id);
      if (!t) throw new TaskServiceError('TASK_NOT_FOUND', 'Task not found');
      if (t.status === 'completed' || t.status === 'cancelled') throw new TaskServiceError('INVALID_STATUS', 'Cannot update in current status');
      if (updates.category && !CATEGORIES.includes(updates.category)) throw new TaskServiceError('INVALID_CATEGORY', 'Invalid category');
      if (updates.priority && !PRIORITIES.includes(updates.priority as TaskPriority)) throw new TaskServiceError('INVALID_PRIORITY', 'Invalid priority');
      return repo.save({ ...t, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteTask(id: string) {
      const t = await getOrThrow(id);
      if (t.status === 'in_progress') throw new TaskServiceError('INVALID_STATUS', 'Cannot delete in-progress task');
      await repo.delete(id);
    },

    async assignTask(id: string, input: { assignedTo: string; assignedToName: string }) {
      const t = await getOrThrow(id);
      if (!isUUID(input.assignedTo)) throw new TaskServiceError('INVALID_ASSIGNEE_ID', 'Invalid assignee ID');
      if (!input.assignedToName.trim()) throw new TaskServiceError('INVALID_ASSIGNEE_NAME', 'Assignee name required');
      if (t.status === 'completed' || t.status === 'cancelled') throw new TaskServiceError('INVALID_STATUS', 'Cannot assign in current status');
      return repo.save({ ...t, assignedTo: input.assignedTo, assignedToName: input.assignedToName, status: 'assigned', updatedAt: new Date().toISOString() });
    },

    async unassignTask(id: string) {
      const t = await getOrThrow(id);
      if (t.status === 'in_progress') throw new TaskServiceError('INVALID_STATUS', 'Cannot unassign in-progress task');
      return repo.save({ ...t, assignedTo: null, assignedToName: null, status: 'open', updatedAt: new Date().toISOString() });
    },

    async startTask(id: string) {
      const t = await getOrThrow(id);
      if (t.status !== 'assigned') throw new TaskServiceError('INVALID_STATUS', 'Must be assigned first');
      return repo.save({ ...t, status: 'in_progress', updatedAt: new Date().toISOString() });
    },

    async completeTask(id: string, input?: { actualMinutes?: number; notes?: string }) {
      const t = await getOrThrow(id);
      if (t.status !== 'in_progress') throw new TaskServiceError('INVALID_STATUS', 'Must be in progress');
      if (input?.actualMinutes !== undefined && input.actualMinutes < 0) throw new TaskServiceError('INVALID_ACTUAL_MINUTES', 'Must be non-negative');
      const now = new Date().toISOString();
      const notes = input?.notes ? `${t.notes ? t.notes + '\n' : ''}${input.notes}` : t.notes;
      return repo.save({ ...t, status: 'completed', completedAt: now, actualMinutes: input?.actualMinutes ?? null, notes, updatedAt: now });
    },

    async cancelTask(id: string, reason?: string) {
      const t = await getOrThrow(id);
      if (t.status === 'completed' || t.status === 'cancelled') throw new TaskServiceError('INVALID_STATUS', 'Cannot cancel in current status');
      const notes = reason ? `${t.notes ? t.notes + '\n' : ''}${reason}` : t.notes;
      return repo.save({ ...t, status: 'cancelled', notes, updatedAt: new Date().toISOString() });
    },

    async putOnHold(id: string, reason?: string) {
      const t = await getOrThrow(id);
      if (t.status !== 'assigned' && t.status !== 'in_progress') throw new TaskServiceError('INVALID_STATUS', 'Must be assigned or in progress');
      const notes = reason ? `${t.notes ? t.notes + '\n' : ''}${reason}` : t.notes;
      return repo.save({ ...t, status: 'on_hold', notes, updatedAt: new Date().toISOString() });
    },

    async reopenTask(id: string) {
      const t = await getOrThrow(id);
      if (t.status !== 'cancelled' && t.status !== 'on_hold') throw new TaskServiceError('INVALID_STATUS', 'Must be cancelled or on hold');
      const newStatus: TaskStatus = t.assignedTo && t.status === 'on_hold' ? 'assigned' : 'open';
      return repo.save({ ...t, status: newStatus, updatedAt: new Date().toISOString() });
    },

    async listTasks(filters?: { category?: string; priority?: string; status?: string; createdBy?: string }) {
      return repo.findAll(filters);
    },

    async getAssigneeTasks(staffId: string) {
      if (!isUUID(staffId)) throw new TaskServiceError('INVALID_STAFF_ID', 'Invalid staff ID');
      return repo.findAll({ assignedTo: staffId });
    },

    async getOverdueTasks() {
      const all = await repo.findAll();
      const now = new Date();
      return all.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'cancelled');
    },

    async addComment(input: { taskId: string; authorId: string; authorName: string; content: string }) {
      if (!isUUID(input.authorId)) throw new TaskServiceError('INVALID_AUTHOR_ID', 'Invalid author ID');
      if (!input.authorName.trim()) throw new TaskServiceError('INVALID_AUTHOR_NAME', 'Author name required');
      if (!input.content.trim()) throw new TaskServiceError('INVALID_CONTENT', 'Content required');
      const comment: TaskComment = {
        id: randomUUID(),
        taskId: input.taskId, authorId: input.authorId,
        authorName: input.authorName, content: input.content,
        createdAt: new Date().toISOString(),
      };
      return repo.saveComment(comment);
    },

    async getComments(taskId: string) {
      if (!isUUID(taskId)) throw new TaskServiceError('INVALID_TASK_ID', 'Invalid task ID');
      return repo.findComments(taskId);
    },

    async getStats() {
      const all = await repo.findAll();
      const byStatus = all.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const byCategory = all.reduce((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      return { totalTasks: all.length, openTasks: byStatus['open'] ?? 0, cancelledTasks: byStatus['cancelled'] ?? 0, byStatus, byCategory };
    },

    getStatuses() { return STATUSES; },
    getPriorities() { return PRIORITIES; },
    getCategories() { return CATEGORIES; },
  };
}
