/**
 * In-Memory Feedback Repository
 *
 * Test double for the Feedback repository.
 */

import type {
  Feedback,
  SurveyQuestion,
  SurveyResponse,
  FeedbackFilters,
  FeedbackRepository,
} from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private feedbacks: Map<string, Feedback> = new Map();
  private questions: Map<string, SurveyQuestion> = new Map();
  private responses: Map<string, SurveyResponse> = new Map();

  // Feedback Operations
  async create(data: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt'>): Promise<Feedback> {
    const feedback: Feedback = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.feedbacks.set(feedback.id, feedback);
    return feedback;
  }

  async update(id: string, data: Partial<Feedback>): Promise<Feedback> {
    const feedback = this.feedbacks.get(id);
    if (!feedback) {
      throw new Error(`Feedback not found: ${id}`);
    }
    const updated: Feedback = {
      ...feedback,
      ...data,
      id: feedback.id,
      createdAt: feedback.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.feedbacks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.feedbacks.delete(id);
  }

  async getById(id: string): Promise<Feedback | null> {
    return this.feedbacks.get(id) || null;
  }

  async list(filters?: FeedbackFilters): Promise<Feedback[]> {
    let result = Array.from(this.feedbacks.values());

    if (filters?.type) {
      result = result.filter(f => f.type === filters.type);
    }
    if (filters?.status) {
      result = result.filter(f => f.status === filters.status);
    }
    if (filters?.department) {
      result = result.filter(f => f.department === filters.department);
    }
    if (filters?.assignedTo) {
      result = result.filter(f => f.assignedTo === filters.assignedTo);
    }

    return result;
  }

  async getByGuest(guestId: string): Promise<Feedback[]> {
    return Array.from(this.feedbacks.values()).filter(f => f.guestId === guestId);
  }

  // Question Operations
  async createQuestion(data: Omit<SurveyQuestion, 'id'>): Promise<SurveyQuestion> {
    const question: SurveyQuestion = {
      ...data,
      id: randomUUID(),
    };
    this.questions.set(question.id, question);
    return question;
  }

  async updateQuestion(id: string, data: Partial<SurveyQuestion>): Promise<SurveyQuestion> {
    const question = this.questions.get(id);
    if (!question) {
      throw new Error(`Question not found: ${id}`);
    }
    const updated: SurveyQuestion = {
      ...question,
      ...data,
      id: question.id,
    };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: string): Promise<void> {
    this.questions.delete(id);
  }

  async getQuestionById(id: string): Promise<SurveyQuestion | null> {
    return this.questions.get(id) || null;
  }

  async getQuestionsForSurvey(surveyId: string): Promise<SurveyQuestion[]> {
    return Array.from(this.questions.values())
      .filter(q => q.surveyId === surveyId)
      .sort((a, b) => a.order - b.order);
  }

  // Response Operations
  async createResponse(data: Omit<SurveyResponse, 'id'>): Promise<SurveyResponse> {
    const response: SurveyResponse = {
      ...data,
      id: randomUUID(),
    };
    this.responses.set(response.id, response);
    return response;
  }

  async getResponsesForSurvey(surveyId: string): Promise<SurveyResponse[]> {
    return Array.from(this.responses.values()).filter(r => r.surveyId === surveyId);
  }

  async getResponsesForGuest(guestId: string): Promise<SurveyResponse[]> {
    return Array.from(this.responses.values()).filter(r => r.guestId === guestId);
  }

  // Test helpers
  addFeedback(feedback: Feedback): void {
    this.feedbacks.set(feedback.id, feedback);
  }

  addQuestion(question: SurveyQuestion): void {
    this.questions.set(question.id, question);
  }

  addResponse(response: SurveyResponse): void {
    this.responses.set(response.id, response);
  }

  clear(): void {
    this.feedbacks.clear();
    this.questions.clear();
    this.responses.clear();
  }

  getAllFeedbacks(): Feedback[] {
    return Array.from(this.feedbacks.values());
  }

  getAllQuestions(): SurveyQuestion[] {
    return Array.from(this.questions.values());
  }

  getAllResponses(): SurveyResponse[] {
    return Array.from(this.responses.values());
  }
}
