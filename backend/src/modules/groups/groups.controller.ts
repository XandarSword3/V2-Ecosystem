/**
 * Group Bookings Controller
 * Phase 3.3: HTTP endpoints for group management
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { groupBookingService } from './groups.service';
import { logger } from '../../utils/logger';

// =============================================
// GROUP RESERVATIONS
// =============================================

export const createGroupReservation = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const userId = req.user?.id;

    const group = await groupBookingService.createGroupReservation(
      propertyId,
      req.body,
      userId
    );

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group reservation created successfully'
    });
});
export const getGroupReservations = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { status, startDate, endDate, assignedTo, search } = req.query;

    const groups = await groupBookingService.getGroupReservations(propertyId, {
      status: status ? (status as string).split(',') : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      assignedTo: assignedTo as string,
      search: search as string
    });

    res.json({
      success: true,
      data: groups,
      count: groups.length
    });
});
export const getGroupById = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;

    const group = await groupBookingService.getGroupById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    res.json({
      success: true,
      data: group
    });
});
export const updateGroupReservation = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user?.id;

    await groupBookingService.updateGroupReservation(groupId, req.body, userId);

    res.json({
      success: true,
      message: 'Group reservation updated successfully'
    });
});
export const cancelGroupReservation = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { reason, cancellationFee } = req.body;
    const userId = req.user?.id;

    await groupBookingService.cancelGroupReservation(
      groupId,
      reason || 'Cancelled by user',
      cancellationFee || 0,
      userId
    );

    res.json({
      success: true,
      message: 'Group reservation cancelled'
    });
});
// =============================================
// ROOM BLOCKS
// =============================================

export const addRoomBlock = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { blocks } = req.body;
    const userId = req.user?.id;

    await groupBookingService.addRoomBlock(groupId, blocks, userId);

    res.json({
      success: true,
      message: 'Room blocks added successfully'
    });
});
export const addRoomBlocksForDateRange = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { roomTypeId, startDate, endDate, roomsPerDay, rate } = req.body;
    const userId = req.user?.id;

    const nightsAdded = await groupBookingService.addRoomBlocksForDateRange(
      groupId,
      roomTypeId,
      new Date(startDate),
      new Date(endDate),
      roomsPerDay,
      rate,
      userId
    );

    res.json({
      success: true,
      data: { nightsAdded },
      message: `Room blocks added for ${nightsAdded} nights`
    });
});
export const releaseRoomBlock = asyncHandler(async (req: Request, res: Response) => {
    const { blockId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    await groupBookingService.releaseRoomBlock(blockId, reason || 'Released by user', userId);

    res.json({
      success: true,
      message: 'Room block released'
    });
});
// =============================================
// GROUP BOOKINGS
// =============================================

export const addGroupBooking = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user?.id;

    const booking = await groupBookingService.addGroupBooking(groupId, req.body, userId);

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Guest added to group'
    });
});
export const importRoomingList = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { guests } = req.body;
    const userId = req.user?.id;

    const result = await groupBookingService.importRoomingList(groupId, guests, userId);

    res.json({
      success: true,
      data: result,
      message: `Imported ${result.imported} guests${result.errors.length ? ` with ${result.errors.length} errors` : ''}`
    });
});
export const cancelGroupBooking = asyncHandler(async (req: Request, res: Response) => {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    await groupBookingService.cancelGroupBooking(bookingId, reason || 'Cancelled', userId);

    res.json({
      success: true,
      message: 'Group booking cancelled'
    });
});
// =============================================
// GROUP EVENTS
// =============================================

export const addGroupEvent = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user?.id;

    const event = await groupBookingService.addGroupEvent(groupId, req.body, userId);

    res.status(201).json({
      success: true,
      data: event,
      message: 'Event added to group'
    });
});
export const updateGroupEvent = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    await groupBookingService.updateGroupEvent(eventId, req.body);

    res.json({
      success: true,
      message: 'Event updated'
    });
});
// =============================================
// CONTRACTS
// =============================================

export const generateContract = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const userId = req.user?.id;

    const contract = await groupBookingService.generateContract(groupId, req.body, userId);

    res.status(201).json({
      success: true,
      data: contract,
      message: 'Contract generated successfully'
    });
});
export const signContract = asyncHandler(async (req: Request, res: Response) => {
    const { contractId } = req.params;
    const { signatory } = req.body;
    const userId = req.user?.id;

    await groupBookingService.markContractSigned(contractId, signatory, userId);

    res.json({
      success: true,
      message: 'Contract marked as signed'
    });
});
// =============================================
// INVOICES & PAYMENTS
// =============================================

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { invoiceType, lineItems, dueDate, notes } = req.body;
    const userId = req.user?.id;

    const invoice = await groupBookingService.createInvoice(
      groupId,
      invoiceType,
      lineItems,
      new Date(dueDate),
      notes,
      userId
    );

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully'
    });
});
export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { amount, paymentMethod, invoiceId, referenceNumber } = req.body;
    const userId = req.user?.id;

    const payment = await groupBookingService.recordPayment(
      groupId,
      amount,
      paymentMethod,
      invoiceId,
      referenceNumber,
      userId
    );

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment recorded successfully'
    });
});
// =============================================
// ACTIVITY LOG
// =============================================

export const getActivityLog = asyncHandler(async (req: Request, res: Response) => {
    const { groupId } = req.params;
    const { limit } = req.query;

    const activities = await groupBookingService.getActivityLog(
      groupId,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: activities
    });
});
// =============================================
// CUTOFF MANAGEMENT
// =============================================

export const processAutomaticCutoffs = asyncHandler(async (req: Request, res: Response) => {
    const released = await groupBookingService.processAutomaticCutoffs();

    res.json({
      success: true,
      data: { blocksReleased: released },
      message: `Released ${released} expired blocks`
    });
});
export const getUpcomingCutoffs = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { daysAhead } = req.query;

    const cutoffs = await groupBookingService.getUpcomingCutoffs(
      propertyId,
      daysAhead ? parseInt(daysAhead as string) : 14
    );

    res.json({
      success: true,
      data: cutoffs
    });
});