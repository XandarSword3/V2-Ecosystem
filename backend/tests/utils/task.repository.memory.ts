import type { Task, TaskComment, TaskRepository } from '../../src/services/task.service';

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();
  private comments: TaskComment[] = [];

  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }

  async findAll(filters?: Partial<Pick<Task, 'category' | 'priority' | 'status' | 'createdBy' | 'assignedTo'>>): Promise<Task[]> {
    let result = [...this.tasks.values()];
    if (filters?.category) result = result.filter(t => t.category === filters.category);
    if (filters?.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters?.status) result = result.filter(t => t.status === filters.status);
    if (filters?.createdBy) result = result.filter(t => t.createdBy === filters.createdBy);
    if (filters?.assignedTo) result = result.filter(t => t.assignedTo === filters.assignedTo);
    return result;
  }

  async save(t: Task): Promise<Task> { this.tasks.set(t.id, { ...t }); return t; }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }

  async saveComment(c: TaskComment): Promise<TaskComment> {
    this.comments.push({ ...c });
    return c;
  }

  async findComments(taskId: string): Promise<TaskComment[]> {
    return this.comments.filter(c => c.taskId === taskId);
  }

  addTask(t: Task): void { this.tasks.set(t.id, { ...t }); }
}
