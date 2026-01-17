/**
 * In-Memory Task Repository
 *
 * Test implementation of the task repository for unit testing.
 */

import type { Task, TaskComment, TaskFilters, TaskRepository } from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  private comments: Map<string, TaskComment> = new Map();

  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const task: Task = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.tasks.set(task.id, task);
    return { ...task };
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error('Task not found');
    }
    const updated: Task = {
      ...task,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
    // Delete associated comments
    for (const [commentId, comment] of this.comments) {
      if (comment.taskId === id) {
        this.comments.delete(commentId);
      }
    }
  }

  async getById(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async list(filters?: TaskFilters): Promise<Task[]> {
    let result = Array.from(this.tasks.values());

    if (filters) {
      if (filters.status) {
        result = result.filter((t) => t.status === filters.status);
      }
      if (filters.priority) {
        result = result.filter((t) => t.priority === filters.priority);
      }
      if (filters.category) {
        result = result.filter((t) => t.category === filters.category);
      }
      if (filters.assignedTo) {
        result = result.filter((t) => t.assignedTo === filters.assignedTo);
      }
      if (filters.createdBy) {
        result = result.filter((t) => t.createdBy === filters.createdBy);
      }
      if (filters.location) {
        result = result.filter((t) => t.location.toLowerCase().includes(filters.location!.toLowerCase()));
      }
      if (filters.dueBefore) {
        result = result.filter((t) => t.dueDate && new Date(t.dueDate) <= new Date(filters.dueBefore!));
      }
      if (filters.dueAfter) {
        result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= new Date(filters.dueAfter!));
      }
      if (filters.tags && filters.tags.length > 0) {
        result = result.filter((t) => filters.tags!.some((tag) => t.tags.includes(tag)));
      }
    }

    return result.map((t) => ({ ...t }));
  }

  async getByAssignee(staffId: string): Promise<Task[]> {
    return this.list({ assignedTo: staffId });
  }

  async addComment(data: Omit<TaskComment, 'id' | 'createdAt'>): Promise<TaskComment> {
    const comment: TaskComment = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.comments.set(comment.id, comment);
    return { ...comment };
  }

  async getComments(taskId: string): Promise<TaskComment[]> {
    const result: TaskComment[] = [];
    for (const comment of this.comments.values()) {
      if (comment.taskId === taskId) {
        result.push({ ...comment });
      }
    }
    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getOverdue(): Promise<Task[]> {
    const now = new Date().toISOString();
    return Array.from(this.tasks.values())
      .filter(
        (t) =>
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          t.dueDate &&
          new Date(t.dueDate) < new Date(now)
      )
      .map((t) => ({ ...t }));
  }

  // Test helpers
  addTask(task: Task): void {
    this.tasks.set(task.id, { ...task });
  }

  addCommentDirect(comment: TaskComment): void {
    this.comments.set(comment.id, { ...comment });
  }

  clear(): void {
    this.tasks.clear();
    this.comments.clear();
  }

  getAll(): Task[] {
    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  getAllComments(): TaskComment[] {
    return Array.from(this.comments.values()).map((c) => ({ ...c }));
  }
}

export function createInMemoryTaskRepository(): InMemoryTaskRepository {
  return new InMemoryTaskRepository();
}
