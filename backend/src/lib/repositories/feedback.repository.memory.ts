import type { Feedback, SurveyQuestion, SurveyResponse } from '../container/types';

export class InMemoryFeedbackRepository {
  private feedbacks: Map<string, Feedback> = new Map();
  private questions: Map<string, SurveyQuestion> = new Map();
  private responses: Map<string, SurveyResponse> = new Map();

  async saveFeedback(f: Feedback): Promise<Feedback> { this.feedbacks.set(f.id, { ...f }); return f; }
  async findFeedbackById(id: string): Promise<Feedback | null> { return this.feedbacks.get(id) ?? null; }
  async findAllFeedback(): Promise<Feedback[]> { return Array.from(this.feedbacks.values()); }

  async saveQuestion(q: SurveyQuestion): Promise<SurveyQuestion> { this.questions.set(q.id, { ...q }); return q; }
  async findQuestionById(id: string): Promise<SurveyQuestion | null> { return this.questions.get(id) ?? null; }

  async saveResponse(r: SurveyResponse): Promise<SurveyResponse> { this.responses.set(r.id, { ...r }); return r; }
}
