import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock dependencies inline to avoid hoisting issues
vi.mock('../../../src/modules/mobile-checkin/mobile-checkin.service', () => ({
  mobileCheckinService: {
    createRegistration: vi.fn(),
    getRegistrationByToken: vi.fn(),
    updateRegistration: vi.fn(),
    submitRegistration: vi.fn(),
    approveRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
    getPendingRegistrations: vi.fn(),
    uploadDocument: vi.fn(),
    verifyDocument: vi.fn(),
    getDocumentVerificationStatus: vi.fn(),
    generateDigitalKey: vi.fn(),
    getDigitalKey: vi.fn(),
    revokeDigitalKey: vi.fn(),
    openDoor: vi.fn(),
    checkIn: vi.fn(),
    getCheckinStatus: vi.fn(),
  },
}));

import { mobileCheckinService } from '../../../src/modules/mobile-checkin/mobile-checkin.service';
import {
  createRegistration,
  getRegistrationByToken,
  updateRegistration,
  submitRegistration,
  approveRegistration,
  rejectRegistration,
  getPendingRegistrations,
  uploadDocument,
} from '../../../src/modules/mobile-checkin/mobile-checkin.controller';

describe('Mobile Check-in Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pre-Arrival Registration', () => {
    describe('createRegistration', () => {
      it('should create a registration successfully', async () => {
        const mockRegistration = {
          id: 'reg-1',
          booking_id: 'booking-123',
          status: 'pending',
          access_token: 'token-abc',
        };
        vi.mocked(mobileCheckinService.createRegistration).mockResolvedValue(mockRegistration);

        const { req, res, next } = createMockReqRes({
          params: { bookingId: 'booking-123' },
        });

        await createRegistration(req, res, next);

        expect(mobileCheckinService.createRegistration).toHaveBeenCalledWith('booking-123');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockRegistration,
          message: 'Registration created',
        });
      });

      it('should call next on error', async () => {
        const error = new Error('Booking not found');
        vi.mocked(mobileCheckinService.createRegistration).mockRejectedValue(error);

        const { req, res, next } = createMockReqRes({
          params: { bookingId: 'invalid' },
        });

        await createRegistration(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('getRegistrationByToken', () => {
      it('should return registration by token', async () => {
        const mockRegistration = {
          id: 'reg-1',
          booking_id: 'booking-123',
          guest_details: { full_name: 'John Doe' },
        };
        vi.mocked(mobileCheckinService.getRegistrationByToken).mockResolvedValue(mockRegistration);

        const { req, res, next } = createMockReqRes({
          params: { token: 'token-abc' },
        });

        await getRegistrationByToken(req, res, next);

        expect(mobileCheckinService.getRegistrationByToken).toHaveBeenCalledWith('token-abc');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockRegistration,
        });
      });

      it('should call next on error for invalid token', async () => {
        const error = new Error('Invalid token');
        vi.mocked(mobileCheckinService.getRegistrationByToken).mockRejectedValue(error);

        const { req, res, next } = createMockReqRes({
          params: { token: 'invalid-token' },
        });

        await getRegistrationByToken(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('updateRegistration', () => {
      it('should update registration successfully', async () => {
        vi.mocked(mobileCheckinService.updateRegistration).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
          body: {
            guestDetails: {
              full_name: 'John Smith',
              phone: '+1234567890',
            },
          },
        });
        req.ip = '192.168.1.1';

        await updateRegistration(req, res, next);

        expect(mobileCheckinService.updateRegistration).toHaveBeenCalledWith(
          'reg-1',
          expect.objectContaining({
            guestDetails: expect.any(Object),
          }),
          '192.168.1.1'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Registration updated',
        });
      });
    });

    describe('submitRegistration', () => {
      it('should submit registration for review', async () => {
        vi.mocked(mobileCheckinService.submitRegistration).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
        });

        await submitRegistration(req, res, next);

        expect(mobileCheckinService.submitRegistration).toHaveBeenCalledWith('reg-1');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Registration submitted for review',
        });
      });
    });

    describe('approveRegistration', () => {
      it('should approve registration', async () => {
        vi.mocked(mobileCheckinService.approveRegistration).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
          body: { notes: 'Documents verified' },
          user: { id: 'staff-1' },
        });

        await approveRegistration(req, res, next);

        expect(mobileCheckinService.approveRegistration).toHaveBeenCalledWith(
          'reg-1',
          'staff-1',
          'Documents verified'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Registration approved',
        });
      });
    });

    describe('rejectRegistration', () => {
      it('should reject registration with reason', async () => {
        vi.mocked(mobileCheckinService.rejectRegistration).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
          body: { reason: 'Invalid ID document' },
          user: { id: 'staff-1' },
        });

        await rejectRegistration(req, res, next);

        expect(mobileCheckinService.rejectRegistration).toHaveBeenCalledWith(
          'reg-1',
          'staff-1',
          'Invalid ID document'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Registration rejected',
        });
      });
    });

    describe('getPendingRegistrations', () => {
      it('should return pending registrations for property', async () => {
        const mockRegistrations = [
          { id: 'reg-1', status: 'submitted' },
          { id: 'reg-2', status: 'submitted' },
        ];
        vi.mocked(mobileCheckinService.getPendingRegistrations).mockResolvedValue(mockRegistrations);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
        });

        await getPendingRegistrations(req, res, next);

        expect(mobileCheckinService.getPendingRegistrations).toHaveBeenCalledWith('prop-1');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockRegistrations,
          count: 2,
        });
      });

      it('should return empty list when no pending registrations', async () => {
        vi.mocked(mobileCheckinService.getPendingRegistrations).mockResolvedValue([]);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
        });

        await getPendingRegistrations(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: [],
          count: 0,
        });
      });
    });
  });

  describe('Documents', () => {
    describe('uploadDocument', () => {
      it('should upload document successfully', async () => {
        const mockDocument = {
          id: 'doc-1',
          registration_id: 'reg-1',
          document_type: 'passport',
          verification_status: 'pending',
        };
        vi.mocked(mobileCheckinService.uploadDocument).mockResolvedValue(mockDocument);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
          body: {
            documentType: 'passport',
            frontImageUrl: 'https://storage.example.com/front.jpg',
            backImageUrl: 'https://storage.example.com/back.jpg',
          },
        });

        await uploadDocument(req, res, next);

        expect(mobileCheckinService.uploadDocument).toHaveBeenCalledWith(
          'reg-1',
          expect.objectContaining({
            documentType: 'passport',
          })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockDocument,
          message: 'Document uploaded',
        });
      });

      it('should call next on upload error', async () => {
        const error = new Error('Invalid file format');
        vi.mocked(mobileCheckinService.uploadDocument).mockRejectedValue(error);

        const { req, res, next } = createMockReqRes({
          params: { registrationId: 'reg-1' },
          body: { documentType: 'invalid' },
        });

        await uploadDocument(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });
  });
});
