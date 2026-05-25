import type { Task, TaskComment } from '../container/types';

export class InMemoryTaskRepository {
  private tasks: Map<string, Task> = new Map();
  private comments: Map<string, TaskComment[]> = new Map();

  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async findAll(filters?: { category?: string; priority?: string; status?: string; createdBy?: string; assignedTo?: string }): Promise<Task[]> {
    let res = Array.from(this.tasks.values());
    if (filters?.category) res = res.filter(t => t.category === filters.category);
    if (filters?.priority) res = res.filter(t => t.priority === filters.priority);
    if (filters?.status) res = res.filter(t => t.status === filters.status);
    if (filters?.createdBy) res = res.filter(t => t.createdBy === filters.createdBy);
    if (filters?.assignedTo) res = res.filter(t => t.assignedTo === filters.assignedTo);
    return res;
  }
  async save(task: Task): Promise<Task> { this.tasks.set(task.id, { ...task }); return task; }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }
  async saveComment(comment: TaskComment): Promise<TaskComment> {
    const list = this.comments.get(comment.taskId) ?? [];
    list.push({ ...comment });
    this.comments.set(comment.taskId, list);
    return comment;
  }
  async findComments(taskId: string): Promise<TaskComment[]> { return this.comments.get(taskId) ?? []; }

  // For test helper
  addTask(task: Task): void { this.tasks.set(task.id, { ...task }); }
}
