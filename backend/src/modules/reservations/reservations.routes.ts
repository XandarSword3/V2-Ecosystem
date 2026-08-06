import type { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import {
  createReservation,
  getReservationsForDay,
  assignTableToReservation,
  checkInReservation,
  cancelReservation,
  markReservationNoShow,
  reassignStaffToLocation,
} from './reservations.service.js';

interface DynamicRequest extends Request {
  mountedModule?: {
    id: string;
    slug: string;
    property_id?: string | null;
    tenant_id?: string | null;
  };
}

async function resolveModuleContext(req: Request) {
  const dynamicReq = req as DynamicRequest;
  let mounted = dynamicReq.mountedModule;
  const supabase = getSupabase();

  if (!mounted && req.params.slug) {
    const { data: moduleRow } = await supabase
      .from('modules')
      .select('id, slug, property_id, tenant_id')
      .eq('slug', req.params.slug)
      .maybeSingle();

    if (moduleRow) {
      mounted = moduleRow;
    }
  }

  if (!mounted) {
    throw new Error('Mounted module context missing');
  }

  let tenantId = mounted.tenant_id ?? (req.user as any)?.tenantId ?? null;
  if (!tenantId && mounted.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', mounted.property_id)
      .maybeSingle();
    tenantId = prop?.tenant_id ?? null;
  }

  if (!tenantId || !mounted.property_id) {
    throw new Error('Module missing tenant or property association');
  }

  return {
    moduleId: mounted.id,
    slug: mounted.slug,
    propertyId: mounted.property_id,
    tenantId,
  };
}

export async function createReservationHandler(req: Request, res: Response) {
  try {
    const ctx = await resolveModuleContext(req);
    const {
      serviceLocationId,
      partySize,
      reservedFor,
      durationMinutes,
      guestName,
      guestPhone,
      notes,
    } = req.body;

    if (!partySize || !reservedFor || !guestName) {
      return res.status(400).json({
        success: false,
        error: 'partySize, reservedFor, and guestName are required',
      });
    }

    const reservation = await createReservation(getSupabase(), {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      moduleId: ctx.moduleId,
      serviceLocationId: serviceLocationId ?? null,
      partySize: Number(partySize),
      reservedFor: String(reservedFor),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 90,
      guestName: String(guestName),
      guestPhone: guestPhone ? String(guestPhone) : null,
      notes: notes ? String(notes) : null,
      createdBy: req.user?.userId ?? null,
    });

    res.status(201).json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error('[Reservations] Create failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create reservation' });
  }
}

export async function getReservationsDayHandler(req: Request, res: Response) {
  try {
    const ctx = await resolveModuleContext(req);
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const reservations = await getReservationsForDay(getSupabase(), ctx.moduleId, dateStr);
    res.json({ success: true, data: reservations });
  } catch (error: any) {
    logger.error('[Reservations] Fetch day view failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch reservations' });
  }
}

export async function assignTableHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { serviceLocationId } = req.body;

    const reservation = await assignTableToReservation(
      getSupabase(),
      id,
      serviceLocationId ?? null
    );

    res.json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error('[Reservations] Table assignment failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to assign table' });
  }
}

export async function checkInHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { serviceLocationId } = req.body;

    const reservation = await checkInReservation(getSupabase(), {
      reservationId: id,
      serviceLocationId: serviceLocationId ?? null,
    });

    res.json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error('[Reservations] Check-in failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to check in reservation' });
  }
}

export async function cancelHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const reservation = await cancelReservation(getSupabase(), id);
    res.json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error('[Reservations] Cancel failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to cancel reservation' });
  }
}

export async function noShowHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const reservation = await markReservationNoShow(getSupabase(), id);
    res.json({ success: true, data: reservation });
  } catch (error: any) {
    logger.error('[Reservations] No-show failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to mark no-show' });
  }
}

export async function reassignStaffHandler(req: Request, res: Response) {
  try {
    const { id } = req.params; // serviceLocationId
    const { staffId } = req.body;

    const updatedLocation = await reassignStaffToLocation(getSupabase(), id, staffId ?? null);
    res.json({ success: true, data: updatedLocation });
  } catch (error: any) {
    logger.error('[Reservations] Staff reassign failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reassign staff' });
  }
}
