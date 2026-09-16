/**
 * Cross-module admin Customers endpoint (F11 Customers capability).
 *
 * Lists customer-type users of the property with per-customer transaction
 * aggregates computed over the canonical `transactions` table — across ALL
 * engine types, not just instant_transaction. One unified customer view.
 *
 * Security model mirrors the cross-engine transactions/catalog controllers:
 *   - authorizeManager (staff/manager/admin/super_admin) at the router
 *   - property scope via validatePropertyAccess (req.propertyId)
 *   - tenant defense-in-depth: property must belong to the caller's tenant
 *     (JWT-derived tenant id only, never a header); super_admins homed to no
 *     tenant are not restricted.
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';

interface CustomerAggregate {
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
}

export async function getCrossModuleCustomers(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const supabase = getSupabase();
    const callerTenantId = getCallerTenantId(req);

    // Tenant defense-in-depth (same rule as transactions/catalog controllers):
    // verify the property belongs to the caller's tenant when they are homed
    // to one. Property scope is the primary boundary (validatePropertyAccess).
    if (callerTenantId !== null) {
      const { data: prop, error: propError } = await supabase
        .from('properties')
        .select('id, tenant_id')
        .eq('id', propertyId)
        .maybeSingle();
      if (propError) throw propError;
      if (!prop || prop.tenant_id !== callerTenantId) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 500);

    // 1. Customer-role users with access to this property.
    const { data: accessRows, error: accessError } = await supabase
      .from('user_property_access')
      .select('user_id, users!inner(id, full_name, email, created_at, user_roles!user_id(roles(name)))')
      .eq('property_id', propertyId)
      .limit(1000);

    if (accessError) throw accessError;

    // Filter to the customer role in code: role filtering inside embedded
    // user_roles is unreliable across PostgREST versions.
    const customers = (accessRows || []).filter((row: any) => {
      const roleLinks = row.users?.user_roles;
      const names = Array.isArray(roleLinks)
        ? roleLinks.map((ur: any) => (Array.isArray(ur?.roles) ? ur.roles[0]?.name : ur?.roles?.name))
        : [];
      return names.includes('customer');
    });

    if (customers.length === 0) {
      return res.json({ success: true, data: { customers: [], total: 0 } });
    }

    const customerIds = customers.map((c: any) => c.users.id);

    // 2. Canonical aggregates over ALL engine types. Reads the shared
    // columns only — no per-engine knowledge in this projection.
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('customer_id, amount, created_at')
      .eq('property_id', propertyId)
      .in('customer_id', customerIds);

    if (txError) throw txError;

    const aggregates = new Map<string, CustomerAggregate>();
    for (const tx of txData || []) {
      if (!tx.customer_id) continue;
      const agg = aggregates.get(tx.customer_id) || {
        orderCount: 0,
        lifetimeValue: 0,
        lastOrderAt: null as string | null,
      };
      agg.orderCount += 1;
      agg.lifetimeValue += Number(tx.amount) || 0;
      if (!agg.lastOrderAt || tx.created_at > agg.lastOrderAt) {
        agg.lastOrderAt = tx.created_at;
      }
      aggregates.set(tx.customer_id, agg);
    }

    // 3. Project the unified customer shape and filter/sort.
    let projected = customers.map((row: any) => {
      const u = row.users;
      const agg = aggregates.get(u.id) || { orderCount: 0, lifetimeValue: 0, lastOrderAt: null };
      return {
        id: u.id,
        name: u.full_name || 'Guest',
        email: u.email,
        createdAt: u.created_at,
        orderCount: agg.orderCount,
        lifetimeValue: agg.lifetimeValue,
        lastOrderAt: agg.lastOrderAt,
      };
    });

    if (search) {
      const needle = search.toLowerCase();
      projected = projected.filter(
        (c) => c.name.toLowerCase().includes(needle) || (c.email || '').toLowerCase().includes(needle)
      );
    }

    projected.sort((a, b) => b.lifetimeValue - a.lifetimeValue);

    res.json({
      success: true,
      data: {
        customers: projected.slice(0, limit),
        total: projected.length,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching cross-module customers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
}
