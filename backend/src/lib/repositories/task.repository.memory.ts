/**
 * In-Memory Task Repository
 * Test double for TaskRepository using in-memory data structures.
 */

import type {
  TaskRepository,
  Task,
  TaskComment,
  TaskFilters,
} from '../container/types.js';

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();
  private comments: TaskComment[] = [];

  /** Test helper: directly insert a task */
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  reset() {
    this.tasks.clear();
    this.comments = [];
  }

  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const id = crypto.randomUUID();
    const task: Task = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.tasks.set(id, task);
    return task;
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async getById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(filters?: TaskFilters): Promise<Task[]> {
    let result = [...this.tasks.values()];
    if (filters?.status) result = result.filter(t => t.status === filters.status);
    if (filters?.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters?.category) result = result.filter(t => t.category === filters.category);
    if (filters?.assignedTo) result = result.filter(t => t.assignedTo === filters.assignedTo);
    if (filters?.createdBy) result = result.filter(t => t.createdBy === filters.createdBy);
    if (filters?.location) result = result.filter(t => t.location === filters.location);
    if (filters?.tags?.length) result = result.filter(t => filters.tags!.some(tag => t.tags.includes(tag)));
    return result;
  }

  async getByAssignee(staffId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter(t => t.assignedTo === staffId);
  }

  async addComment(data: Omit<TaskComment, 'id' | 'createdAt'>): Promise<TaskComment> {
    const comment: TaskComment = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.comments.push(comment);
    return comment;
  }

  async getComments(taskId: string): Promise<TaskComment[]> {
    return this.comments.filter(c => c.taskId === taskId);
  }

  async getOverdue(): Promise<Task[]> {
    const now = new Date().toISOString();
    return [...this.tasks.values()].filter(
      t => t.dueDate && t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled'
    );
  }
}
