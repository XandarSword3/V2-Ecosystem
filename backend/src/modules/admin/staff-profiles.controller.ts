import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';
import { getScopedClient, tenantContextFor } from '../../security/scoped-client.js';
import { logActivity } from '../../utils/activityLogger.js';
import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const staffProfileSchema = z.object({
  employee_id: z.string().max(50).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'seasonal', 'contract']).nullable().optional(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  base_wage: z.number().min(0).nullable().optional(),
  wage_currency: z.string().length(3).nullable().optional(),
  emergency_contact_name: z.string().max(255).nullable().optional(),
  emergency_contact_phone: z.string().max(20).nullable().optional(),
  emergency_contact_relationship: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * The caller may only read/write a staff profile for a user in their property
 * context. Mirrors users.controller.ts checkPropertyAccess: super_admin spans
 * tenants, everyone else is default-deny without a matching
 * user_property_access row.
 */
async function resolveTargetUser(req: Request, userId: string): Promise<{ tenant_id: string | null } | null> {
  const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string | undefined);
  const isSuperAdmin = req.user?.scope === 'super_admin' || req.user?.roles?.includes('super_admin') || false;
  const supabase = getSupabase();

  const { data: user } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', userId)
    .maybeSingle();

  if (!user) return null;

  if (!isSuperAdmin) {
    if (!propertyId) return null;
    const { data: access } = await supabase
      .from('user_property_access')
      .select('user_id')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (!access) return null;
  }

  return { tenant_id: user.tenant_id ?? null };
}

export const getStaffProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID format' });
  }

  const target = await resolveTargetUser(req, id);
  if (!target) {
    return res.status(403).json({ success: false, error: 'Access denied to this user' });
  }

  const scoped = getScopedClient(tenantContextFor(req));
  const { data, error } = await scoped
    .from('staff_profiles')
    .select('*')
    .eq('user_id', id)
    .maybeSingle();

  if (error) throw error;
  res.json({ success: true, data: data || null });
});

export const upsertStaffProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid user ID format' });
  }

  const target = await resolveTargetUser(req, id);
  if (!target) {
    return res.status(403).json({ success: false, error: 'Access denied to this user' });
  }

  const validation = staffProfileSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
  }

  // staff_profiles.tenant_id is NOT NULL; for a tenant-less global super_admin
  // the scoped client deliberately does not stamp tenant_id, so resolve it
  // from the target user here.
  const tenantId = target.tenant_id || (req as any).tenantId || req.user?.tenantId || null;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'Target user has no tenant context' });
  }

  const scoped = getScopedClient(tenantContextFor(req));
  const { data, error } = await scoped
    .from('staff_profiles')
    .upsert(
      {
        ...validation.data,
        user_id: id,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) throw error;

  await logActivity({
    user_id: req.user!.userId,
    action: 'UPSERT_STAFF_PROFILE',
    resource: 'staff_profiles',
    resource_id: data.id,
    entity_id: id,
  });

  res.json({ success: true, data });
});
