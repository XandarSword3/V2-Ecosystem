/**
 * Mobile Check-in Controller
 * Phase 4.1: HTTP endpoints for mobile check-in
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { mobileCheckinService } from './mobile-checkin.service';

// =============================================
// PRE-ARRIVAL REGISTRATION
// =============================================

export const createRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;

    const registration = await mobileCheckinService.createRegistration(bookingId);

    res.status(201).json({
      success: true,
      data: registration,
      message: 'Registration created'
    });
});
export const getRegistrationByToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const registration = await mobileCheckinService.getRegistrationByToken(token);

    res.json({
      success: true,
      data: registration
    });
});
export const updateRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;
    const ipAddress = req.ip;

    await mobileCheckinService.updateRegistration(registrationId, req.body, ipAddress);

    res.json({
      success: true,
      message: 'Registration updated'
    });
});
export const submitRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;

    await mobileCheckinService.submitRegistration(registrationId);

    res.json({
      success: true,
      message: 'Registration submitted for review'
    });
});
export const approveRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await mobileCheckinService.approveRegistration(registrationId, userId, notes);

    res.json({
      success: true,
      message: 'Registration approved'
    });
});
export const rejectRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await mobileCheckinService.rejectRegistration(registrationId, userId, reason);

    res.json({
      success: true,
      message: 'Registration rejected'
    });
});
export const getPendingRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const registrations = await mobileCheckinService.getPendingRegistrations(propertyId);

    res.json({
      success: true,
      data: registrations,
      count: registrations.length
    });
});
// =============================================
// DOCUMENTS
// =============================================

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;

    const document = await mobileCheckinService.uploadDocument(registrationId, req.body);

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded'
    });
});
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { ocrData } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await mobileCheckinService.verifyDocument(documentId, userId, ocrData);

    res.json({
      success: true,
      message: 'Document verified'
    });
});
export const getGuestDocuments = asyncHandler(async (req: Request, res: Response) => {
    const { guestId } = req.params;

    const documents = await mobileCheckinService.getGuestDocuments(guestId);

    res.json({
      success: true,
      data: documents
    });
});
// =============================================
// SIGNATURES
// =============================================

export const captureSignature = asyncHandler(async (req: Request, res: Response) => {
    const { registrationId } = req.params;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const signature = await mobileCheckinService.captureSignature(registrationId, {
      ...req.body,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      data: signature,
      message: 'Signature captured'
    });
});
// =============================================
// TERMS
// =============================================

export const acceptTerms = asyncHandler(async (req: Request, res: Response) => {
    const { guestId, termsId } = req.params;
    const { bookingId, signatureId } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    await mobileCheckinService.acceptTerms(
      guestId,
      termsId,
      bookingId,
      ipAddress,
      userAgent,
      signatureId
    );

    res.json({
      success: true,
      message: 'Terms accepted'
    });
});
export const getCurrentTerms = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, termsType } = req.params;
    const { language } = req.query;

    const terms = await mobileCheckinService.getCurrentTerms(
      propertyId,
      termsType,
      language as string || 'en'
    );

    if (!terms) {
      return res.status(404).json({
        success: false,
        error: 'Terms not found'
      });
    }

    res.json({
      success: true,
      data: terms
    });
});
// =============================================
// MOBILE KEYS
// =============================================

export const requestMobileKey = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;

    const key = await mobileCheckinService.requestMobileKey(bookingId, req.body);

    res.status(201).json({
      success: true,
      data: key,
      message: 'Mobile key issued'
    });
});
export const getMobileKey = asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;

    const key = await mobileCheckinService.getMobileKeyById(keyId);

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'Mobile key not found'
      });
    }

    res.json({
      success: true,
      data: key
    });
});
export const getMobileKeyByBooking = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { deviceId } = req.query;

    const keys = await mobileCheckinService.getMobileKeyByBooking(
      bookingId,
      deviceId as string | undefined
    );

    res.json({
      success: true,
      data: keys
    });
});
export const revokeMobileKey = asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await mobileCheckinService.revokeMobileKey(keyId, userId, reason);

    res.json({
      success: true,
      message: 'Mobile key revoked'
    });
});
export const validateKeyAccess = asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    const { accessPoint, accessPointType, deviceInfo } = req.body;

    const granted = await mobileCheckinService.validateKeyAccess(keyId, accessPoint);

    // Log the access attempt
    await mobileCheckinService.logKeyAccess(
      keyId,
      accessPoint,
      accessPointType,
      granted,
      granted ? undefined : 'Access denied',
      deviceInfo
    );

    res.json({
      success: true,
      data: { granted }
    });
});
// =============================================
// CHECK-IN SESSIONS
// =============================================

export const startCheckinSession = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { channel } = req.body;
    const deviceInfo = {
      deviceType: req.body.deviceType,
      deviceId: req.body.deviceId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const session = await mobileCheckinService.startCheckinSession(bookingId, channel, deviceInfo);

    res.status(201).json({
      success: true,
      data: session,
      message: 'Check-in session started'
    });
});
export const updateCheckinSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { step, data } = req.body;

    await mobileCheckinService.updateCheckinSession(sessionId, step, data);

    res.json({
      success: true,
      message: 'Session updated'
    });
});
export const completeCheckin = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { roomId, keyType, mobileKeyId, physicalKeyNumber } = req.body;

    await mobileCheckinService.completeCheckin(
      sessionId,
      roomId,
      keyType,
      mobileKeyId,
      physicalKeyNumber
    );

    res.json({
      success: true,
      message: 'Check-in completed'
    });
});
// =============================================
// PUSH NOTIFICATIONS
// =============================================

export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
    const { guestId, propertyId } = req.params;
    const { deviceToken, platform, ...deviceInfo } = req.body;

    await mobileCheckinService.registerPushToken(
      guestId,
      propertyId,
      deviceToken,
      platform,
      deviceInfo
    );

    res.json({
      success: true,
      message: 'Push token registered'
    });
});
export const sendCheckinReminder = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;

    await mobileCheckinService.sendCheckinReminder(bookingId);

    res.json({
      success: true,
      message: 'Reminder sent'
    });
});
export const sendRoomReadyNotification = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { roomNumber } = req.body;

    await mobileCheckinService.sendRoomReadyNotification(bookingId, roomNumber);

    res.json({
      success: true,
      message: 'Notification sent'
    });
});