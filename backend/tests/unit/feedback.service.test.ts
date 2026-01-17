/**
 * Feedback Service Tests
 *
 * Unit tests for the Feedback/Survey Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createFeedbackService, FeedbackServiceError } from '../../src/lib/services/feedback.service';
import { InMemoryFeedbackRepository } from '../../src/lib/repositories/feedback.repository.memory';
import type { Container } from '../../src/lib/container/types';

// Test UUIDs
const GUEST_1 = '11111111-1111-1111-1111-111111111111';
const STAFF_1 = '22222222-2222-2222-2222-222222222222';
const SURVEY_1 = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(feedbackRepository: InMemoryFeedbackRepository): Container {
  return {
    feedbackRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

describe('FeedbackService', () => {
  let repository: InMemoryFeedbackRepository;
  let container: Container;
  let service: ReturnType<typeof createFeedbackService>;

  beforeEach(() => {
    repository = new InMemoryFeedbackRepository();
    container = createMockContainer(repository);
    service = createFeedbackService(container);
  });

  // ============================================
  // SUBMIT FEEDBACK TESTS
  // ============================================
  describe('submitFeedback', () => {
    it('should submit feedback with required fields', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Great Stay',
        message: 'We had a wonderful time at your resort!',
      });

      expect(feedback).toBeDefined();
      expect(feedback.guestName).toBe('John Doe');
      expect(feedback.type).toBe('general');
      expect(feedback.status).toBe('pending');
    });

    it('should submit feedback with rating', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'service',
        subject: 'Excellent Service',
        message: 'The staff was incredibly helpful!',
        rating: 5,
      });

      expect(feedback.rating).toBe(5);
    });

    it('should submit complaint', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        type: 'complaint',
        subject: 'Room Issue',
        message: 'The air conditioning was not working properly.',
        department: 'maintenance',
      });

      expect(feedback.type).toBe('complaint');
      expect(feedback.department).toBe('maintenance');
    });

    it('should lowercase and trim email', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: '  JOHN@EXAMPLE.COM  ',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      expect(feedback.guestEmail).toBe('john@example.com');
    });

    it('should reject empty guest name', async () => {
      await expect(
        service.submitFeedback({
          guestName: '',
          guestEmail: 'john@example.com',
          type: 'general',
          subject: 'Test',
          message: 'This is a test message.',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_GUEST_NAME',
      });
    });

    it('should reject invalid email', async () => {
      await expect(
        service.submitFeedback({
          guestName: 'John Doe',
          guestEmail: 'invalid-email',
          type: 'general',
          subject: 'Test',
          message: 'This is a test message.',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_EMAIL',
      });
    });

    it('should reject invalid type', async () => {
      await expect(
        service.submitFeedback({
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          type: 'invalid' as any,
          subject: 'Test',
          message: 'This is a test message.',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TYPE',
      });
    });

    it('should reject empty subject', async () => {
      await expect(
        service.submitFeedback({
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          type: 'general',
          subject: '',
          message: 'This is a test message.',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SUBJECT',
      });
    });

    it('should reject short message', async () => {
      await expect(
        service.submitFeedback({
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          type: 'general',
          subject: 'Test',
          message: 'Short',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_MESSAGE',
      });
    });

    it('should reject invalid rating', async () => {
      await expect(
        service.submitFeedback({
          guestName: 'John Doe',
          guestEmail: 'john@example.com',
          type: 'general',
          subject: 'Test',
          message: 'This is a test message.',
          rating: 6,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RATING',
      });
    });
  });

  // ============================================
  // GET FEEDBACK TESTS
  // ============================================
  describe('getFeedback', () => {
    it('should retrieve feedback by ID', async () => {
      const created = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      const found = await service.getFeedback(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent feedback', async () => {
      const found = await service.getFeedback(GUEST_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getFeedback(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_FEEDBACK_ID',
      });
    });
  });

  // ============================================
  // STATUS WORKFLOW TESTS
  // ============================================
  describe('markAsReviewed', () => {
    it('should mark pending feedback as reviewed', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      const reviewed = await service.markAsReviewed(feedback.id);
      expect(reviewed.status).toBe('reviewed');
    });

    it('should reject non-pending feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });
      await service.markAsReviewed(feedback.id);

      await expect(service.markAsReviewed(feedback.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  describe('respondToFeedback', () => {
    let feedbackId: string;

    beforeEach(async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });
      feedbackId = feedback.id;
    });

    it('should respond to feedback', async () => {
      const responded = await service.respondToFeedback(feedbackId, {
        response: 'Thank you for your feedback!',
        respondedBy: STAFF_1,
      });

      expect(responded.status).toBe('responded');
      expect(responded.response).toBe('Thank you for your feedback!');
      expect(responded.respondedBy).toBe(STAFF_1);
      expect(responded.respondedAt).toBeDefined();
    });

    it('should reject empty response', async () => {
      await expect(
        service.respondToFeedback(feedbackId, {
          response: '',
          respondedBy: STAFF_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should reject invalid responder ID', async () => {
      await expect(
        service.respondToFeedback(feedbackId, {
          response: 'Thank you!',
          respondedBy: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RESPONDER_ID',
      });
    });

    it('should reject archived feedback', async () => {
      await service.archiveFeedback(feedbackId);

      await expect(
        service.respondToFeedback(feedbackId, {
          response: 'Thank you!',
          respondedBy: STAFF_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  describe('resolveFeedback', () => {
    it('should resolve reviewed feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was a problem with my room.',
      });
      await service.markAsReviewed(feedback.id);

      const resolved = await service.resolveFeedback(feedback.id);
      expect(resolved.status).toBe('resolved');
    });

    it('should reject pending feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was a problem with my room.',
      });

      await expect(service.resolveFeedback(feedback.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  describe('archiveFeedback', () => {
    it('should archive feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      const archived = await service.archiveFeedback(feedback.id);
      expect(archived.status).toBe('archived');
    });

    it('should reject already archived', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });
      await service.archiveFeedback(feedback.id);

      await expect(service.archiveFeedback(feedback.id)).rejects.toMatchObject({
        code: 'ALREADY_ARCHIVED',
      });
    });
  });

  // ============================================
  // ASSIGNMENT TESTS
  // ============================================
  describe('assignFeedback', () => {
    it('should assign feedback to staff', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was a problem with my room.',
      });

      const assigned = await service.assignFeedback(feedback.id, STAFF_1);
      expect(assigned.assignedTo).toBe(STAFF_1);
    });

    it('should reject invalid assignee ID', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      await expect(
        service.assignFeedback(feedback.id, INVALID_UUID)
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });
  });

  describe('unassignFeedback', () => {
    it('should unassign feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was a problem with my room.',
      });
      await service.assignFeedback(feedback.id, STAFF_1);

      const unassigned = await service.unassignFeedback(feedback.id);
      expect(unassigned.assignedTo).toBeNull();
    });

    it('should reject unassigned feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      await expect(service.unassignFeedback(feedback.id)).rejects.toMatchObject({
        code: 'NOT_ASSIGNED',
      });
    });
  });

  // ============================================
  // SENTIMENT ANALYSIS TESTS
  // ============================================
  describe('analyzeSentiment', () => {
    it('should analyze sentiment based on rating', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Great Stay',
        message: 'We had a wonderful time.',
        rating: 5,
      });

      const analyzed = await service.analyzeSentiment(feedback.id);
      expect(analyzed.sentiment).toBe('very_positive');
    });

    it('should analyze sentiment based on keywords', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'complaint',
        subject: 'Terrible Experience',
        message: 'The service was terrible and horrible. Absolutely awful experience.',
      });

      const analyzed = await service.analyzeSentiment(feedback.id);
      expect(analyzed.sentiment).toBe('very_negative');
    });

    it('should detect neutral sentiment', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Okay Stay',
        message: 'The stay was okay. Nothing special.',
      });

      const analyzed = await service.analyzeSentiment(feedback.id);
      expect(analyzed.sentiment).toBe('neutral');
    });
  });

  // ============================================
  // SURVEY QUESTION TESTS
  // ============================================
  describe('createQuestion', () => {
    it('should create rating question', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'How would you rate your stay?',
        type: 'rating',
      });

      expect(question).toBeDefined();
      expect(question.type).toBe('rating');
      expect(question.required).toBe(true);
    });

    it('should create choice question with options', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'Would you recommend us?',
        type: 'choice',
        options: ['Definitely', 'Maybe', 'No'],
      });

      expect(question.type).toBe('choice');
      expect(question.options).toHaveLength(3);
    });

    it('should reject invalid survey ID', async () => {
      await expect(
        service.createQuestion({
          surveyId: INVALID_UUID,
          question: 'Test?',
          type: 'text',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SURVEY_ID',
      });
    });

    it('should reject empty question', async () => {
      await expect(
        service.createQuestion({
          surveyId: SURVEY_1,
          question: '',
          type: 'text',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_QUESTION',
      });
    });

    it('should reject choice without options', async () => {
      await expect(
        service.createQuestion({
          surveyId: SURVEY_1,
          question: 'Choose one',
          type: 'choice',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_OPTIONS',
      });
    });
  });

  // ============================================
  // SURVEY RESPONSE TESTS
  // ============================================
  describe('submitResponse', () => {
    let questionId: string;

    beforeEach(async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'How was your stay?',
        type: 'rating',
        required: true,
      });
      questionId = question.id;
    });

    it('should submit rating response', async () => {
      const response = await service.submitResponse({
        surveyId: SURVEY_1,
        questionId,
        answer: 'Excellent',
        ratingValue: 5,
      });

      expect(response).toBeDefined();
      expect(response.ratingValue).toBe(5);
    });

    it('should reject invalid rating value', async () => {
      await expect(
        service.submitResponse({
          surveyId: SURVEY_1,
          questionId,
          answer: 'Test',
          ratingValue: 0,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RATING',
      });
    });

    it('should reject empty answer for required question', async () => {
      await expect(
        service.submitResponse({
          surveyId: SURVEY_1,
          questionId,
          answer: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ANSWER',
      });
    });
  });

  describe('yesno question response', () => {
    it('should accept yes/no answers', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'Would you stay again?',
        type: 'yesno',
      });

      const response = await service.submitResponse({
        surveyId: SURVEY_1,
        questionId: question.id,
        answer: 'yes',
      });

      expect(response.answer).toBe('yes');
    });

    it('should reject non yes/no answers', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'Would you stay again?',
        type: 'yesno',
      });

      await expect(
        service.submitResponse({
          surveyId: SURVEY_1,
          questionId: question.id,
          answer: 'maybe',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ANSWER',
      });
    });
  });

  describe('choice question response', () => {
    it('should accept valid option', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'How likely to recommend?',
        type: 'choice',
        options: ['Very likely', 'Likely', 'Unlikely'],
      });

      const response = await service.submitResponse({
        surveyId: SURVEY_1,
        questionId: question.id,
        answer: 'Very likely',
      });

      expect(response.answer).toBe('Very likely');
    });

    it('should reject invalid option', async () => {
      const question = await service.createQuestion({
        surveyId: SURVEY_1,
        question: 'How likely to recommend?',
        type: 'choice',
        options: ['Very likely', 'Likely', 'Unlikely'],
      });

      await expect(
        service.submitResponse({
          surveyId: SURVEY_1,
          questionId: question.id,
          answer: 'Invalid option',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ANSWER',
      });
    });
  });

  // ============================================
  // LIST AND FILTER TESTS
  // ============================================
  describe('listFeedback', () => {
    beforeEach(async () => {
      await service.submitFeedback({
        guestName: 'John',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Good',
        message: 'This was a good experience.',
      });

      await service.submitFeedback({
        guestName: 'Jane',
        guestEmail: 'jane@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was an issue with service.',
      });
    });

    it('should return all feedback', async () => {
      const feedbacks = await service.listFeedback();
      expect(feedbacks.length).toBe(2);
    });

    it('should filter by type', async () => {
      const feedbacks = await service.listFeedback({ type: 'complaint' });
      expect(feedbacks.length).toBe(1);
    });

    it('should filter by status', async () => {
      const feedbacks = await service.listFeedback({ status: 'pending' });
      expect(feedbacks.length).toBe(2);
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats', async () => {
      const stats = await service.getStats();

      expect(stats.totalFeedback).toBe(0);
      expect(stats.avgRating).toBe(0);
      expect(stats.responseRate).toBe(0);
    });

    it('should calculate stats correctly', async () => {
      const feedback1 = await service.submitFeedback({
        guestName: 'John',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Great',
        message: 'Wonderful experience!',
        rating: 5,
      });

      await service.submitFeedback({
        guestName: 'Jane',
        guestEmail: 'jane@example.com',
        type: 'complaint',
        subject: 'Issue',
        message: 'There was a problem.',
        rating: 2,
      });

      await service.respondToFeedback(feedback1.id, {
        response: 'Thank you!',
        respondedBy: STAFF_1,
      });

      const stats = await service.getStats();

      expect(stats.totalFeedback).toBe(2);
      expect(stats.avgRating).toBe(3.5);
      expect(stats.responseRate).toBe(50);
      expect(stats.byType.general).toBe(1);
      expect(stats.byType.complaint).toBe(1);
    });
  });

  describe('getPendingFeedback', () => {
    it('should return only pending feedback', async () => {
      const feedback = await service.submitFeedback({
        guestName: 'John',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Test',
        message: 'This is a test message.',
      });

      await service.submitFeedback({
        guestName: 'Jane',
        guestEmail: 'jane@example.com',
        type: 'general',
        subject: 'Test 2',
        message: 'Another test message.',
      });

      await service.markAsReviewed(feedback.id);

      const pending = await service.getPendingFeedback();
      expect(pending.length).toBe(1);
    });
  });

  describe('getUrgentComplaints', () => {
    it('should return pending complaints', async () => {
      await service.submitFeedback({
        guestName: 'John',
        guestEmail: 'john@example.com',
        type: 'general',
        subject: 'Good',
        message: 'This was a good experience.',
      });

      await service.submitFeedback({
        guestName: 'Jane',
        guestEmail: 'jane@example.com',
        type: 'complaint',
        subject: 'Urgent Issue',
        message: 'This needs immediate attention.',
      });

      const urgent = await service.getUrgentComplaints();
      expect(urgent.length).toBe(1);
      expect(urgent[0].type).toBe('complaint');
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getFeedbackTypes', () => {
    it('should return all feedback types', () => {
      const types = service.getFeedbackTypes();

      expect(types).toContain('general');
      expect(types).toContain('service');
      expect(types).toContain('complaint');
    });
  });

  describe('getFeedbackStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getFeedbackStatuses();

      expect(statuses).toContain('pending');
      expect(statuses).toContain('resolved');
      expect(statuses).toContain('archived');
    });
  });

  describe('getSentiments', () => {
    it('should return all sentiments', () => {
      const sentiments = service.getSentiments();

      expect(sentiments).toContain('very_positive');
      expect(sentiments).toContain('neutral');
      expect(sentiments).toContain('very_negative');
    });
  });
});
