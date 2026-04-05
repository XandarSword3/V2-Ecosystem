/**
 * In-Memory Feedback Repository
 * Test double for FeedbackRepository using in-memory data structures.
 */

import type {
  FeedbackRepository,
  Feedback,
  SurveyQuestion,
  SurveyResponse,
  FeedbackFilters,
} from '../container/types.js';

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private feedbacks = new Map<string, Feedback>();
  private questions = new Map<string, SurveyQuestion>();
  private responses: SurveyResponse[] = [];

  reset() {
    this.feedbacks.clear();
    this.questions.clear();
    this.responses = [];
  }

  // Feedback operations
  async create(data: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>): Promise<Feedback> {
    const id = crypto.randomUUID();
    const feedback: Feedback = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.feedbacks.set(id, feedback);
    return feedback;
  }

  async update(id: string, data: Partial<Feedback>): Promise<Feedback> {
    const existing = this.feedbacks.get(id);
    if (!existing) throw new Error(`Feedback ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.feedbacks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.feedbacks.delete(id);
  }

  async getById(id: string): Promise<Feedback | null> {
    return this.feedbacks.get(id) ?? null;
  }

  async list(filters?: FeedbackFilters): Promise<Feedback[]> {
    let result = [...this.feedbacks.values()];
    if (filters?.type) result = result.filter(f => f.type === filters.type);
    if (filters?.status) result = result.filter(f => f.status === filters.status);
    if (filters?.department) result = result.filter(f => f.department === filters.department);
    if (filters?.assignedTo) result = result.filter(f => f.assignedTo === filters.assignedTo);
    return result;
  }

  async getByGuest(guestId: string): Promise<Feedback[]> {
    return [...this.feedbacks.values()].filter(f => f.guestId === guestId);
  }

  // Survey question operations
  async createQuestion(data: Omit<SurveyQuestion, 'id'>): Promise<SurveyQuestion> {
    const id = crypto.randomUUID();
    const question: SurveyQuestion = { ...data, id };
    this.questions.set(id, question);
    return question;
  }

  async updateQuestion(id: string, data: Partial<SurveyQuestion>): Promise<SurveyQuestion> {
    const existing = this.questions.get(id);
    if (!existing) throw new Error(`Question ${id} not found`);
    const updated = { ...existing, ...data };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: string): Promise<void> {
    this.questions.delete(id);
  }

  async getQuestionById(id: string): Promise<SurveyQuestion | null> {
    return this.questions.get(id) ?? null;
  }

  async getQuestionsForSurvey(surveyId: string): Promise<SurveyQuestion[]> {
    return [...this.questions.values()]
      .filter(q => q.surveyId === surveyId)
      .sort((a, b) => a.order - b.order);
  }

  // Survey response operations
  async createResponse(data: Omit<SurveyResponse, 'id'>): Promise<SurveyResponse> {
    const response: SurveyResponse = { ...data, id: crypto.randomUUID() };
    this.responses.push(response);
    return response;
  }

  async getResponsesForSurvey(surveyId: string): Promise<SurveyResponse[]> {
    return this.responses.filter(r => r.surveyId === surveyId);
  }

  async getResponsesForGuest(guestId: string): Promise<SurveyResponse[]> {
    return this.responses.filter(r => r.guestId === guestId);
  }
}
