import { randomUUID } from 'crypto';
import type {
  Container, Feedback, SurveyQuestion, SurveyResponse,
  FeedbackType, FeedbackStatus, FeedbackSentiment, QuestionType,
} from '../container/types';
import type { InMemoryFeedbackRepository } from '../repositories/feedback.repository.memory';

const FEEDBACK_TYPES: FeedbackType[] = ['general', 'service', 'complaint', 'suggestion', 'compliment'];
const FEEDBACK_STATUSES: FeedbackStatus[] = ['pending', 'reviewed', 'responded', 'resolved', 'archived'];
const SENTIMENTS: FeedbackSentiment[] = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'];
const QUESTION_TYPES: QuestionType[] = ['text', 'rating', 'yesno', 'choice'];

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }
function isEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export class FeedbackServiceError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export function createFeedbackService(container: Container) {
  const repo = container.feedbackRepository as InMemoryFeedbackRepository;

  async function getOrThrow(id: string): Promise<Feedback> {
    if (!isUUID(id)) throw new FeedbackServiceError('INVALID_FEEDBACK_ID', 'Invalid feedback ID');
    const f = await repo.findFeedbackById(id);
    if (!f) throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 'Feedback not found');
    return f;
  }

  return {
    async submitFeedback(input: {
      guestName: string; guestEmail: string; type: string; subject: string;
      message: string; rating?: number; department?: string; guestId?: string;
    }): Promise<Feedback> {
      if (!input.guestName?.trim()) throw new FeedbackServiceError('INVALID_GUEST_NAME', 'Guest name is required');
      const email = input.guestEmail?.trim().toLowerCase();
      if (!isEmail(email)) throw new FeedbackServiceError('INVALID_EMAIL', 'Invalid email address');
      if (!FEEDBACK_TYPES.includes(input.type as FeedbackType)) throw new FeedbackServiceError('INVALID_TYPE', `Invalid feedback type: ${input.type}`);
      if (!input.subject?.trim()) throw new FeedbackServiceError('INVALID_SUBJECT', 'Subject is required');
      if (!input.message || input.message.trim().length < 10) throw new FeedbackServiceError('INVALID_MESSAGE', 'Message must be at least 10 characters');
      if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) throw new FeedbackServiceError('INVALID_RATING', 'Rating must be between 1 and 5');

      const feedback: Feedback = {
        id: randomUUID(),
        guestName: input.guestName.trim(),
        guestEmail: email,
        guestId: input.guestId ?? null,
        type: input.type as FeedbackType,
        subject: input.subject.trim(),
        message: input.message.trim(),
        rating: input.rating ?? null,
        status: 'pending',
        sentiment: null,
        department: input.department ?? null,
        assignedTo: null,
        response: null,
        respondedBy: null,
        respondedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return repo.saveFeedback(feedback);
    },

    async getFeedback(id: string): Promise<Feedback | null> {
      if (!isUUID(id)) throw new FeedbackServiceError('INVALID_FEEDBACK_ID', 'Invalid feedback ID');
      return repo.findFeedbackById(id);
    },

    async markAsReviewed(id: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (f.status !== 'pending') throw new FeedbackServiceError('INVALID_STATUS', 'Only pending feedback can be marked as reviewed');
      return repo.saveFeedback({ ...f, status: 'reviewed', updatedAt: new Date().toISOString() });
    },

    async respondToFeedback(id: string, input: { response: string; respondedBy: string }): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (f.status === 'archived') throw new FeedbackServiceError('INVALID_STATUS', 'Cannot respond to archived feedback');
      if (!input.response?.trim()) throw new FeedbackServiceError('INVALID_RESPONSE', 'Response text is required');
      if (!isUUID(input.respondedBy)) throw new FeedbackServiceError('INVALID_RESPONDER_ID', 'Invalid responder ID');
      return repo.saveFeedback({
        ...f, status: 'responded',
        response: input.response.trim(),
        respondedBy: input.respondedBy,
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    async resolveFeedback(id: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (f.status === 'pending') throw new FeedbackServiceError('INVALID_STATUS', 'Cannot resolve pending feedback directly; review it first');
      return repo.saveFeedback({ ...f, status: 'resolved', updatedAt: new Date().toISOString() });
    },

    async archiveFeedback(id: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (f.status === 'archived') throw new FeedbackServiceError('ALREADY_ARCHIVED', 'Feedback is already archived');
      return repo.saveFeedback({ ...f, status: 'archived', updatedAt: new Date().toISOString() });
    },

    async assignFeedback(id: string, assigneeId: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (!isUUID(assigneeId)) throw new FeedbackServiceError('INVALID_ASSIGNEE_ID', 'Invalid assignee ID');
      return repo.saveFeedback({ ...f, assignedTo: assigneeId, updatedAt: new Date().toISOString() });
    },

    async unassignFeedback(id: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      if (!f.assignedTo) throw new FeedbackServiceError('NOT_ASSIGNED', 'Feedback is not assigned');
      return repo.saveFeedback({ ...f, assignedTo: null, updatedAt: new Date().toISOString() });
    },

    async analyzeSentiment(id: string): Promise<Feedback> {
      const f = await getOrThrow(id);
      let sentiment: FeedbackSentiment;
      if (f.rating !== null) {
        if (f.rating >= 5) sentiment = 'very_positive';
        else if (f.rating >= 4) sentiment = 'positive';
        else if (f.rating >= 3) sentiment = 'neutral';
        else if (f.rating >= 2) sentiment = 'negative';
        else sentiment = 'very_negative';
      } else {
        const text = (f.subject + ' ' + f.message).toLowerCase();
        const veryPos = ['excellent', 'wonderful', 'amazing', 'fantastic', 'outstanding', 'perfect'];
        const veryNeg = ['terrible', 'horrible', 'awful', 'dreadful', 'atrocious', 'disgusting'];
        const pos = ['good', 'great', 'happy', 'pleased', 'nice', 'love'];
        const neg = ['bad', 'poor', 'disappointed', 'problem', 'issue', 'wrong'];
        const vpCount = veryNeg.filter(w => text.includes(w)).length;
        const vnCount = veryPos.filter(w => text.includes(w)).length;
        const pCount = pos.filter(w => text.includes(w)).length;
        const nCount = neg.filter(w => text.includes(w)).length;
        if (vpCount >= 2) sentiment = 'very_negative';
        else if (vnCount >= 2) sentiment = 'very_positive';
        else if (nCount > pCount) sentiment = 'negative';
        else if (pCount > nCount) sentiment = 'positive';
        else sentiment = 'neutral';
      }
      return repo.saveFeedback({ ...f, sentiment, updatedAt: new Date().toISOString() });
    },

    async createQuestion(input: {
      surveyId: string; question: string; type: string;
      options?: string[]; required?: boolean;
    }): Promise<SurveyQuestion> {
      if (!isUUID(input.surveyId)) throw new FeedbackServiceError('INVALID_SURVEY_ID', 'Invalid survey ID');
      if (!input.question?.trim()) throw new FeedbackServiceError('INVALID_QUESTION', 'Question text is required');
      if (!QUESTION_TYPES.includes(input.type as QuestionType)) throw new FeedbackServiceError('INVALID_TYPE', `Invalid question type: ${input.type}`);
      if (input.type === 'choice' && (!input.options || input.options.length === 0)) {
        throw new FeedbackServiceError('INVALID_OPTIONS', 'Choice questions require at least one option');
      }
      const question: SurveyQuestion = {
        id: randomUUID(),
        surveyId: input.surveyId,
        question: input.question.trim(),
        type: input.type as QuestionType,
        options: input.options ?? null,
        required: input.required ?? true,
        order: 0,
        createdAt: new Date().toISOString(),
      };
      return repo.saveQuestion(question);
    },

    async submitResponse(input: {
      surveyId: string; questionId: string; answer: string; ratingValue?: number;
    }): Promise<SurveyResponse> {
      const question = await repo.findQuestionById(input.questionId);
      if (!question) throw new FeedbackServiceError('QUESTION_NOT_FOUND', 'Question not found');
      if (question.required && !input.answer?.trim()) {
        throw new FeedbackServiceError('INVALID_ANSWER', 'Answer is required for this question');
      }
      if (question.type === 'rating' && input.ratingValue !== undefined) {
        if (input.ratingValue < 1 || input.ratingValue > 5) throw new FeedbackServiceError('INVALID_RATING', 'Rating value must be between 1 and 5');
      }
      if (question.type === 'yesno') {
        if (!['yes', 'no'].includes(input.answer?.toLowerCase())) {
          throw new FeedbackServiceError('INVALID_ANSWER', "Answer must be 'yes' or 'no'");
        }
      }
      if (question.type === 'choice' && question.options) {
        if (!question.options.includes(input.answer)) {
          throw new FeedbackServiceError('INVALID_ANSWER', 'Answer must be one of the available options');
        }
      }
      const response: SurveyResponse = {
        id: randomUUID(),
        surveyId: input.surveyId,
        questionId: input.questionId,
        answer: input.answer,
        ratingValue: input.ratingValue ?? null,
        createdAt: new Date().toISOString(),
      };
      return repo.saveResponse(response);
    },

    async listFeedback(filters?: { type?: FeedbackType; status?: FeedbackStatus }): Promise<Feedback[]> {
      let all = await repo.findAllFeedback();
      if (filters?.type) all = all.filter(f => f.type === filters.type);
      if (filters?.status) all = all.filter(f => f.status === filters.status);
      return all;
    },

    async getStats() {
      const all = await repo.findAllFeedback();
      const withRating = all.filter(f => f.rating !== null);
      const avgRating = withRating.length ? withRating.reduce((s, f) => s + f.rating!, 0) / withRating.length : 0;
      const responded = all.filter(f => f.status === 'responded' || f.respondedAt);
      const responseRate = all.length ? (responded.length / all.length) * 100 : 0;
      const byType = FEEDBACK_TYPES.reduce((acc, t) => ({ ...acc, [t]: all.filter(f => f.type === t).length }), {} as Record<FeedbackType, number>);
      return {
        totalFeedback: all.length,
        avgRating: Math.round(avgRating * 10) / 10,
        responseRate: Math.round(responseRate),
        byType,
      };
    },

    async getPendingFeedback(): Promise<Feedback[]> {
      const all = await repo.findAllFeedback();
      return all.filter(f => f.status === 'pending');
    },

    async getUrgentComplaints(): Promise<Feedback[]> {
      const all = await repo.findAllFeedback();
      return all.filter(f => f.type === 'complaint' && f.status === 'pending');
    },

    getFeedbackTypes(): FeedbackType[] { return [...FEEDBACK_TYPES]; },
    getFeedbackStatuses(): FeedbackStatus[] { return [...FEEDBACK_STATUSES]; },
    getSentiments(): FeedbackSentiment[] { return [...SENTIMENTS]; },
  };
}
