/**
 * Feedback/Survey Service
 *
 * Manages guest feedback, complaints, and satisfaction surveys.
 */

import type {
  Container,
  Feedback,
  SurveyQuestion,
  SurveyResponse,
  FeedbackFilters,
  FeedbackType,
  FeedbackStatus,
  SurveySentiment,
} from '../container/types.js';

// Error handling
export class FeedbackServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FeedbackServiceError';
  }
}

// Input types
export interface SubmitFeedbackInput {
  guestId?: string;
  guestName: string;
  guestEmail: string;
  type: FeedbackType;
  subject: string;
  message: string;
  rating?: number;
  department?: string;
  metadata?: Record<string, unknown>;
}

export interface RespondToFeedbackInput {
  response: string;
  respondedBy: string;
}

export interface CreateQuestionInput {
  surveyId: string;
  question: string;
  type: 'rating' | 'text' | 'choice' | 'yesno';
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface SubmitResponseInput {
  surveyId: string;
  questionId: string;
  guestId?: string;
  answer: string;
  ratingValue?: number;
}

export interface FeedbackStats {
  totalFeedback: number;
  avgRating: number;
  byType: Record<FeedbackType, number>;
  byStatus: Record<FeedbackStatus, number>;
  bySentiment: Record<SurveySentiment, number>;
  responseRate: number;
  avgResponseTimeHours: number;
}

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEEDBACK_TYPES: FeedbackType[] = ['general', 'service', 'food', 'room', 'facilities', 'staff', 'complaint'];
const FEEDBACK_STATUSES: FeedbackStatus[] = ['pending', 'reviewed', 'responded', 'resolved', 'archived'];
const SENTIMENTS: SurveySentiment[] = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'];
const QUESTION_TYPES = ['rating', 'text', 'choice', 'yesno'] as const;

export interface FeedbackService {
  // Feedback operations
  submitFeedback(input: SubmitFeedbackInput): Promise<Feedback>;
  getFeedback(id: string): Promise<Feedback | null>;
  updateFeedback(id: string, data: Partial<Feedback>): Promise<Feedback>;
  deleteFeedback(id: string): Promise<void>;
  listFeedback(filters?: FeedbackFilters): Promise<Feedback[]>;
  getGuestFeedback(guestId: string): Promise<Feedback[]>;
  
  // Status workflow
  markAsReviewed(id: string): Promise<Feedback>;
  respondToFeedback(id: string, input: RespondToFeedbackInput): Promise<Feedback>;
  resolveFeedback(id: string): Promise<Feedback>;
  archiveFeedback(id: string): Promise<Feedback>;
  
  // Assignment
  assignFeedback(id: string, assignedTo: string): Promise<Feedback>;
  unassignFeedback(id: string): Promise<Feedback>;
  
  // Sentiment analysis
  analyzeSentiment(id: string): Promise<Feedback>;
  
  // Survey questions
  createQuestion(input: CreateQuestionInput): Promise<SurveyQuestion>;
  updateQuestion(id: string, data: Partial<SurveyQuestion>): Promise<SurveyQuestion>;
  deleteQuestion(id: string): Promise<void>;
  getSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]>;
  
  // Survey responses
  submitResponse(input: SubmitResponseInput): Promise<SurveyResponse>;
  getSurveyResponses(surveyId: string): Promise<SurveyResponse[]>;
  
  // Analytics
  getStats(): Promise<FeedbackStats>;
  getPendingFeedback(): Promise<Feedback[]>;
  getUrgentComplaints(): Promise<Feedback[]>;
  
  // Utilities
  getFeedbackTypes(): FeedbackType[];
  getFeedbackStatuses(): FeedbackStatus[];
  getSentiments(): SurveySentiment[];
}

export function createFeedbackService(container: Container): FeedbackService {
  const { feedbackRepository, logger } = container;

  // ============================================
  // FEEDBACK OPERATIONS
  // ============================================
  async function submitFeedback(input: SubmitFeedbackInput): Promise<Feedback> {
    // Validate guest name
    if (!input.guestName || input.guestName.trim().length === 0) {
      throw new FeedbackServiceError('Guest name is required', 'INVALID_GUEST_NAME');
    }

    // Validate email
    if (!input.guestEmail || !input.guestEmail.includes('@')) {
      throw new FeedbackServiceError('Valid email is required', 'INVALID_EMAIL');
    }

    // Validate type
    if (!FEEDBACK_TYPES.includes(input.type)) {
      throw new FeedbackServiceError('Invalid feedback type', 'INVALID_TYPE');
    }

    // Validate subject
    if (!input.subject || input.subject.trim().length === 0) {
      throw new FeedbackServiceError('Subject is required', 'INVALID_SUBJECT');
    }

    // Validate message
    if (!input.message || input.message.trim().length < 10) {
      throw new FeedbackServiceError('Message must be at least 10 characters', 'INVALID_MESSAGE');
    }

    // Validate rating if provided
    if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
      throw new FeedbackServiceError('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    // Validate guest ID if provided
    if (input.guestId && !UUID_REGEX.test(input.guestId)) {
      throw new FeedbackServiceError('Invalid guest ID format', 'INVALID_GUEST_ID');
    }

    const feedback = await feedbackRepository.create({
      guestId: input.guestId || null,
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.toLowerCase().trim(),
      type: input.type,
      status: 'pending',
      subject: input.subject.trim(),
      message: input.message.trim(),
      rating: input.rating ?? null,
      sentiment: null,
      department: input.department || null,
      assignedTo: null,
      response: null,
      respondedAt: null,
      respondedBy: null,
      metadata: input.metadata || {},
    });

    logger?.info?.(`Feedback submitted: ${feedback.type} from ${feedback.guestEmail}`);
    return feedback;
  }

  async function getFeedback(id: string): Promise<Feedback | null> {
    if (!UUID_REGEX.test(id)) {
      throw new FeedbackServiceError('Invalid feedback ID format', 'INVALID_FEEDBACK_ID');
    }
    return feedbackRepository.getById(id);
  }

  async function updateFeedback(id: string, data: Partial<Feedback>): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);
    return feedbackRepository.update(id, data);
  }

  async function deleteFeedback(id: string): Promise<void> {
    await getFeedbackOrThrow(id);
    await feedbackRepository.delete(id);
  }

  async function listFeedback(filters?: FeedbackFilters): Promise<Feedback[]> {
    return feedbackRepository.list(filters);
  }

  async function getGuestFeedback(guestId: string): Promise<Feedback[]> {
    if (!UUID_REGEX.test(guestId)) {
      throw new FeedbackServiceError('Invalid guest ID format', 'INVALID_GUEST_ID');
    }
    return feedbackRepository.getByGuest(guestId);
  }

  // ============================================
  // STATUS WORKFLOW
  // ============================================
  async function markAsReviewed(id: string): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    if (feedback.status !== 'pending') {
      throw new FeedbackServiceError('Feedback is not pending', 'INVALID_STATUS');
    }

    return feedbackRepository.update(id, { status: 'reviewed' });
  }

  async function respondToFeedback(id: string, input: RespondToFeedbackInput): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    if (feedback.status === 'archived') {
      throw new FeedbackServiceError('Cannot respond to archived feedback', 'INVALID_STATUS');
    }

    if (!input.response || input.response.trim().length === 0) {
      throw new FeedbackServiceError('Response is required', 'INVALID_RESPONSE');
    }

    if (!UUID_REGEX.test(input.respondedBy)) {
      throw new FeedbackServiceError('Invalid responder ID format', 'INVALID_RESPONDER_ID');
    }

    return feedbackRepository.update(id, {
      status: 'responded',
      response: input.response.trim(),
      respondedAt: new Date().toISOString(),
      respondedBy: input.respondedBy,
    });
  }

  async function resolveFeedback(id: string): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    if (feedback.status === 'pending') {
      throw new FeedbackServiceError('Feedback must be reviewed or responded first', 'INVALID_STATUS');
    }

    if (feedback.status === 'resolved' || feedback.status === 'archived') {
      throw new FeedbackServiceError('Feedback is already resolved or archived', 'INVALID_STATUS');
    }

    return feedbackRepository.update(id, { status: 'resolved' });
  }

  async function archiveFeedback(id: string): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    if (feedback.status === 'archived') {
      throw new FeedbackServiceError('Feedback is already archived', 'ALREADY_ARCHIVED');
    }

    return feedbackRepository.update(id, { status: 'archived' });
  }

  // ============================================
  // ASSIGNMENT
  // ============================================
  async function assignFeedback(id: string, assignedTo: string): Promise<Feedback> {
    await getFeedbackOrThrow(id);

    if (!UUID_REGEX.test(assignedTo)) {
      throw new FeedbackServiceError('Invalid assignee ID format', 'INVALID_ASSIGNEE_ID');
    }

    return feedbackRepository.update(id, { assignedTo });
  }

  async function unassignFeedback(id: string): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    if (!feedback.assignedTo) {
      throw new FeedbackServiceError('Feedback is not assigned', 'NOT_ASSIGNED');
    }

    return feedbackRepository.update(id, { assignedTo: null });
  }

  // ============================================
  // SENTIMENT ANALYSIS
  // ============================================
  async function analyzeSentiment(id: string): Promise<Feedback> {
    const feedback = await getFeedbackOrThrow(id);

    // Simple sentiment analysis based on rating and keywords
    let sentiment: SurveySentiment;

    if (feedback.rating !== null) {
      if (feedback.rating >= 5) sentiment = 'very_positive';
      else if (feedback.rating >= 4) sentiment = 'positive';
      else if (feedback.rating >= 3) sentiment = 'neutral';
      else if (feedback.rating >= 2) sentiment = 'negative';
      else sentiment = 'very_negative';
    } else {
      // Basic keyword analysis
      const message = feedback.message.toLowerCase();
      const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'best'];
      const negativeWords = ['terrible', 'awful', 'horrible', 'worst', 'hate', 'disgusting', 'unacceptable'];

      const positiveCount = positiveWords.filter(w => message.includes(w)).length;
      const negativeCount = negativeWords.filter(w => message.includes(w)).length;

      if (positiveCount > negativeCount + 1) sentiment = 'very_positive';
      else if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount + 1) sentiment = 'very_negative';
      else if (negativeCount > positiveCount) sentiment = 'negative';
      else sentiment = 'neutral';
    }

    return feedbackRepository.update(id, { sentiment });
  }

  // ============================================
  // SURVEY QUESTIONS
  // ============================================
  async function createQuestion(input: CreateQuestionInput): Promise<SurveyQuestion> {
    if (!UUID_REGEX.test(input.surveyId)) {
      throw new FeedbackServiceError('Invalid survey ID format', 'INVALID_SURVEY_ID');
    }

    if (!input.question || input.question.trim().length === 0) {
      throw new FeedbackServiceError('Question text is required', 'INVALID_QUESTION');
    }

    if (!QUESTION_TYPES.includes(input.type)) {
      throw new FeedbackServiceError('Invalid question type', 'INVALID_QUESTION_TYPE');
    }

    if (input.type === 'choice' && (!input.options || input.options.length < 2)) {
      throw new FeedbackServiceError('Choice questions must have at least 2 options', 'INVALID_OPTIONS');
    }

    return feedbackRepository.createQuestion({
      surveyId: input.surveyId,
      question: input.question.trim(),
      type: input.type,
      options: input.options || null,
      required: input.required ?? true,
      order: input.order ?? 0,
    });
  }

  async function updateQuestion(id: string, data: Partial<SurveyQuestion>): Promise<SurveyQuestion> {
    if (!UUID_REGEX.test(id)) {
      throw new FeedbackServiceError('Invalid question ID format', 'INVALID_QUESTION_ID');
    }

    const question = await feedbackRepository.getQuestionById(id);
    if (!question) {
      throw new FeedbackServiceError('Question not found', 'QUESTION_NOT_FOUND', 404);
    }

    return feedbackRepository.updateQuestion(id, data);
  }

  async function deleteQuestion(id: string): Promise<void> {
    if (!UUID_REGEX.test(id)) {
      throw new FeedbackServiceError('Invalid question ID format', 'INVALID_QUESTION_ID');
    }

    const question = await feedbackRepository.getQuestionById(id);
    if (!question) {
      throw new FeedbackServiceError('Question not found', 'QUESTION_NOT_FOUND', 404);
    }

    await feedbackRepository.deleteQuestion(id);
  }

  async function getSurveyQuestions(surveyId: string): Promise<SurveyQuestion[]> {
    if (!UUID_REGEX.test(surveyId)) {
      throw new FeedbackServiceError('Invalid survey ID format', 'INVALID_SURVEY_ID');
    }
    return feedbackRepository.getQuestionsForSurvey(surveyId);
  }

  // ============================================
  // SURVEY RESPONSES
  // ============================================
  async function submitResponse(input: SubmitResponseInput): Promise<SurveyResponse> {
    if (!UUID_REGEX.test(input.surveyId)) {
      throw new FeedbackServiceError('Invalid survey ID format', 'INVALID_SURVEY_ID');
    }

    if (!UUID_REGEX.test(input.questionId)) {
      throw new FeedbackServiceError('Invalid question ID format', 'INVALID_QUESTION_ID');
    }

    const question = await feedbackRepository.getQuestionById(input.questionId);
    if (!question) {
      throw new FeedbackServiceError('Question not found', 'QUESTION_NOT_FOUND', 404);
    }

    // Validate answer based on question type
    if (question.required && (!input.answer || input.answer.trim().length === 0)) {
      throw new FeedbackServiceError('Answer is required', 'INVALID_ANSWER');
    }

    if (question.type === 'rating') {
      if (input.ratingValue === undefined || input.ratingValue < 1 || input.ratingValue > 5) {
        throw new FeedbackServiceError('Rating must be between 1 and 5', 'INVALID_RATING');
      }
    }

    if (question.type === 'yesno' && !['yes', 'no'].includes(input.answer.toLowerCase())) {
      throw new FeedbackServiceError('Answer must be yes or no', 'INVALID_ANSWER');
    }

    if (question.type === 'choice' && question.options && !question.options.includes(input.answer)) {
      throw new FeedbackServiceError('Answer must be one of the provided options', 'INVALID_ANSWER');
    }

    return feedbackRepository.createResponse({
      surveyId: input.surveyId,
      questionId: input.questionId,
      guestId: input.guestId || null,
      answer: input.answer.trim(),
      ratingValue: input.ratingValue ?? null,
      submittedAt: new Date().toISOString(),
    });
  }

  async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
    if (!UUID_REGEX.test(surveyId)) {
      throw new FeedbackServiceError('Invalid survey ID format', 'INVALID_SURVEY_ID');
    }
    return feedbackRepository.getResponsesForSurvey(surveyId);
  }

  // ============================================
  // ANALYTICS
  // ============================================
  async function getStats(): Promise<FeedbackStats> {
    const feedbacks = await feedbackRepository.list();

    const byType: Record<FeedbackType, number> = {
      general: 0,
      service: 0,
      food: 0,
      room: 0,
      facilities: 0,
      staff: 0,
      complaint: 0,
    };

    const byStatus: Record<FeedbackStatus, number> = {
      pending: 0,
      reviewed: 0,
      responded: 0,
      resolved: 0,
      archived: 0,
    };

    const bySentiment: Record<SurveySentiment, number> = {
      very_positive: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      very_negative: 0,
    };

    let totalRating = 0;
    let ratingCount = 0;
    let respondedCount = 0;
    let totalResponseTime = 0;

    for (const feedback of feedbacks) {
      byType[feedback.type]++;
      byStatus[feedback.status]++;

      if (feedback.sentiment) {
        bySentiment[feedback.sentiment]++;
      }

      if (feedback.rating !== null) {
        totalRating += feedback.rating;
        ratingCount++;
      }

      if (feedback.respondedAt) {
        respondedCount++;
        const created = new Date(feedback.createdAt).getTime();
        const responded = new Date(feedback.respondedAt).getTime();
        totalResponseTime += (responded - created) / (1000 * 60 * 60); // hours
      }
    }

    return {
      totalFeedback: feedbacks.length,
      avgRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
      byType,
      byStatus,
      bySentiment,
      responseRate: feedbacks.length > 0 ? Math.round((respondedCount / feedbacks.length) * 100) : 0,
      avgResponseTimeHours: respondedCount > 0 ? Math.round((totalResponseTime / respondedCount) * 10) / 10 : 0,
    };
  }

  async function getPendingFeedback(): Promise<Feedback[]> {
    return feedbackRepository.list({ status: 'pending' });
  }

  async function getUrgentComplaints(): Promise<Feedback[]> {
    const feedbacks = await feedbackRepository.list({ type: 'complaint', status: 'pending' });
    // Sort by creation date (oldest first)
    return feedbacks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // ============================================
  // UTILITIES
  // ============================================
  function getFeedbackTypes(): FeedbackType[] {
    return [...FEEDBACK_TYPES];
  }

  function getFeedbackStatuses(): FeedbackStatus[] {
    return [...FEEDBACK_STATUSES];
  }

  function getSentiments(): SurveySentiment[] {
    return [...SENTIMENTS];
  }

  // Helper
  async function getFeedbackOrThrow(id: string): Promise<Feedback> {
    if (!UUID_REGEX.test(id)) {
      throw new FeedbackServiceError('Invalid feedback ID format', 'INVALID_FEEDBACK_ID');
    }

    const feedback = await feedbackRepository.getById(id);
    if (!feedback) {
      throw new FeedbackServiceError('Feedback not found', 'FEEDBACK_NOT_FOUND', 404);
    }

    return feedback;
  }

  return {
    submitFeedback,
    getFeedback,
    updateFeedback,
    deleteFeedback,
    listFeedback,
    getGuestFeedback,
    markAsReviewed,
    respondToFeedback,
    resolveFeedback,
    archiveFeedback,
    assignFeedback,
    unassignFeedback,
    analyzeSentiment,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getSurveyQuestions,
    submitResponse,
    getSurveyResponses,
    getStats,
    getPendingFeedback,
    getUrgentComplaints,
    getFeedbackTypes,
    getFeedbackStatuses,
    getSentiments,
  };
}
