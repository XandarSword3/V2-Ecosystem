/**
 * Self-Service Kiosk Controller
 * Phase 4.2: HTTP endpoints for kiosk operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { kioskService } from './kiosk.service';

// =============================================
// DEVICE MANAGEMENT
// =============================================

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const device = await kioskService.registerDevice(propertyId, req.body);

    res.status(201).json({
      success: true,
      data: device,
      message: 'Kiosk device registered'
    });
});
export const getDevice = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;

    const device = await kioskService.getDevice(deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
});
export const getPropertyDevices = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const includeInactive = req.query.includeInactive === 'true';

    const devices = await kioskService.getPropertyDevices(propertyId, includeInactive);

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
});
export const updateDeviceStatus = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const { status, error } = req.body;

    await kioskService.updateDeviceStatus(deviceId, status, error);

    res.json({
      success: true,
      message: 'Device status updated'
    });
});
export const updateDeviceConfig = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;

    await kioskService.updateDeviceConfig(deviceId, req.body);

    res.json({
      success: true,
      message: 'Device configuration updated'
    });
});
export const setMaintenanceMode = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const { enabled, notes } = req.body;

    await kioskService.setDeviceMaintenanceMode(deviceId, enabled, notes);

    res.json({
      success: true,
      message: enabled ? 'Device in maintenance mode' : 'Device maintenance completed'
    });
});
export const deactivateDevice = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;

    await kioskService.deactivateDevice(deviceId);

    res.json({
      success: true,
      message: 'Device deactivated'
    });
});
// =============================================
// SESSION MANAGEMENT
// =============================================

export const startSession = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;
    const { sessionType, bookingId, guestId, confirmationNumber } = req.body;

    const session = await kioskService.startSession(kioskId, sessionType, {
      bookingId,
      guestId,
      confirmationNumber
    });

    res.status(201).json({
      success: true,
      data: session,
      message: 'Session started'
    });
});
export const getSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = await kioskService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
});
export const updateSessionStep = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { step, data } = req.body;

    await kioskService.updateSessionStep(sessionId, step, data);

    res.json({
      success: true,
      message: 'Session step updated'
    });
});
export const abandonSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { reason } = req.body;

    await kioskService.abandonSession(sessionId, reason);

    res.json({
      success: true,
      message: 'Session abandoned'
    });
});
export const transferToDesk = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { reason } = req.body;
    const staffId = req.user?.id;

    await kioskService.transferToDesk(sessionId, reason, staffId);

    res.json({
      success: true,
      message: 'Session transferred to front desk'
    });
});
// =============================================
// CHECK-IN / CHECK-OUT
// =============================================

export const initiateCheckin = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;
    const { confirmationNumber } = req.body;

    const session = await kioskService.performKioskCheckin(kioskId, confirmationNumber);

    res.json({
      success: true,
      data: session,
      message: 'Check-in initiated'
    });
});
export const completeCheckin = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { roomNumber, issueKey } = req.body;

    const result = await kioskService.finalizeKioskCheckin(sessionId, roomNumber, issueKey);

    res.json({
      success: true,
      data: result,
      message: 'Check-in completed'
    });
});
export const initiateCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;
    const { roomNumber } = req.body;

    const session = await kioskService.performKioskCheckout(kioskId, roomNumber);

    res.json({
      success: true,
      data: session,
      message: 'Check-out initiated'
    });
});
export const completeCheckout = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { paymentData } = req.body;

    const result = await kioskService.finalizeKioskCheckout(sessionId, paymentData);

    res.json({
      success: true,
      data: result,
      message: 'Check-out completed'
    });
});
// =============================================
// TRANSACTIONS
// =============================================

export const scanId = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, kioskId } = req.params;

    const result = await kioskService.scanId(sessionId, kioskId, req.body);

    res.json({
      success: true,
      data: result,
      message: 'ID scanned'
    });
});
export const encodeKey = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, kioskId } = req.params;

    const result = await kioskService.encodeKey(sessionId, kioskId, req.body);

    res.json({
      success: true,
      data: result,
      message: 'Key encoded'
    });
});
export const processPayment = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, kioskId } = req.params;

    const result = await kioskService.processPayment(sessionId, kioskId, req.body);

    res.json({
      success: true,
      data: result,
      message: 'Payment processed'
    });
});
export const printReceipt = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, kioskId } = req.params;

    const result = await kioskService.printReceipt(sessionId, kioskId, req.body);

    res.json({
      success: true,
      data: result,
      message: 'Receipt printed'
    });
});
// =============================================
// KEY STOCK
// =============================================

export const getKeyStock = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;

    const stock = await kioskService.getKeyStock(kioskId);

    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Key stock not configured for this kiosk'
      });
    }

    res.json({
      success: true,
      data: stock
    });
});
export const refillKeyStock = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;
    const { quantity } = req.body;
    const refillerId = req.user?.id;
    if (!refillerId) throw new Error('Authentication required');

    await kioskService.refillKeyStock(kioskId, quantity, refillerId);

    res.json({
      success: true,
      message: 'Key stock refilled'
    });
});
// =============================================
// HARDWARE EVENTS
// =============================================

export const logHardwareEvent = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.params;
    const { eventType, severity, component, details } = req.body;

    const eventId = await kioskService.logHardwareEvent(
      kioskId,
      eventType,
      severity,
      component,
      details
    );

    res.status(201).json({
      success: true,
      data: { eventId },
      message: 'Event logged'
    });
});
export const resolveHardwareEvent = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const { notes } = req.body;
    const resolvedBy = req.user?.id;
    if (!resolvedBy) throw new Error('Authentication required');

    await kioskService.resolveHardwareEvent(eventId, resolvedBy, notes);

    res.json({
      success: true,
      message: 'Event resolved'
    });
});
export const getUnresolvedEvents = asyncHandler(async (req: Request, res: Response) => {
    const { kioskId } = req.query;

    const events = await kioskService.getUnresolvedEvents(kioskId as string);

    res.json({
      success: true,
      data: events,
      count: events.length
    });
});
// =============================================
// SCREEN FLOWS
// =============================================

export const getScreenFlow = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, flowType } = req.params;

    const flow = await kioskService.getScreenFlow(propertyId, flowType);

    if (!flow) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found'
      });
    }

    res.json({
      success: true,
      data: flow
    });
});
export const getScreenContent = asyncHandler(async (req: Request, res: Response) => {
    const { flowId, stepKey } = req.params;
    const { language } = req.query;

    const content = await kioskService.getScreenContent(flowId, stepKey, language as string);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: content
    });
});
// =============================================
// ANALYTICS
// =============================================

export const getKioskAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { startDate, endDate, kioskId } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const analytics = await kioskService.getKioskAnalytics(
      propertyId,
      start,
      end,
      kioskId as string
    );

    res.json({
      success: true,
      data: analytics
    });
});
// =============================================
// HEARTBEAT
// =============================================

export const heartbeat = asyncHandler(async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const { status, error, metrics } = req.body;

    await kioskService.updateDeviceStatus(deviceId, status || 'online', error);

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
});