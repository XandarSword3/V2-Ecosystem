import { getSupabase } from '../../database/connection.js';

// Lazy-initialized Supabase client - use proxy to defer getSupabase() call
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) { return getSupabase()[prop as keyof ReturnType<typeof getSupabase>]; }
});

// ==================== TYPES ====================

export interface PropertyGroup {
  id: string;
  name: string;
  code?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  contact_email?: string;
  contact_phone?: string;
  timezone: string;
  currency: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  name: string;
  group_id?: string;
  property_code?: string;
  property_type: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  is_active: boolean;
}

export interface UserPropertyAccess {
  id: string;
  user_id: string;
  property_id: string;
  access_level: 'read' | 'write' | 'manage' | 'admin';
  is_primary: boolean;
  granted_at: string;
  expires_at?: string;
}

export interface UserGroupAccess {
  id: string;
  user_id: string;
  group_id: string;
  access_level: string;
  role_in_group?: string;
  granted_at: string;
}

// ==================== PROPERTY GROUPS ====================

export async function getPropertyGroups(): Promise<PropertyGroup[]> {
  const { data, error } = await supabase
    .from('property_groups')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getPropertyGroup(groupId: string): Promise<PropertyGroup | null> {
  const { data, error } = await supabase
    .from('property_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) return null;
  return data;
}

export async function createPropertyGroup(group: Partial<PropertyGroup>): Promise<PropertyGroup> {
  const { data, error } = await supabase
    .from('property_groups')
    .insert(group)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePropertyGroup(
  groupId: string,
  updates: Partial<PropertyGroup>
): Promise<PropertyGroup> {
  const { data, error } = await supabase
    .from('property_groups')
    .update(updates)
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPropertiesInGroup(groupId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// ==================== USER ACCESS ====================

export async function getUserAccessibleProperties(userId: string): Promise<Property[]> {
  const client = supabase;

  // Get user role
  const { data: user } = await client
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  // Super admins can access all properties
  if (user?.role === 'super_admin') {
    const { data } = await client
      .from('properties')
      .select('*')
      .eq('is_active', true)
      .order('name');
    return data || [];
  }

  // Get directly assigned properties
  const { data: directAccess } = await client
    .from('user_property_access')
    .select('property_id, is_primary, access_level')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.now()');

  const directPropertyIds = (directAccess || []).map(a => a.property_id);

  // Get group-based access
  const { data: groupAccess } = await client
    .from('user_group_access')
    .select('group_id')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.now()');

  const groupIds = (groupAccess || []).map(a => a.group_id);

  // Get properties from groups
  let groupPropertyIds: string[] = [];
  if (groupIds.length > 0) {
    const { data: groupProperties } = await client
      .from('properties')
      .select('id')
      .in('group_id', groupIds)
      .eq('is_active', true);
    
    groupPropertyIds = (groupProperties || []).map(p => p.id);
  }

  // Combine and dedupe
  const allPropertyIds = [...new Set([...directPropertyIds, ...groupPropertyIds])];

  if (allPropertyIds.length === 0) {
    return [];
  }

  // Fetch full property details
  const { data: properties } = await client
    .from('properties')
    .select('*')
    .in('id', allPropertyIds)
    .eq('is_active', true)
    .order('name');

  // Add access info
  const propertiesWithAccess = (properties || []).map(p => {
    const access = directAccess?.find(a => a.property_id === p.id);
    return {
      ...p,
      access_level: access?.access_level || 'read',
      is_primary: access?.is_primary || false
    };
  });

  return propertiesWithAccess;
}

export async function getUserPrimaryProperty(userId: string): Promise<Property | null> {
  const client = supabase;

  const { data: access } = await client
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single();

  if (!access) {
    // Get first accessible property
    const properties = await getUserAccessibleProperties(userId);
    return properties[0] || null;
  }

  const { data: property } = await client
    .from('properties')
    .select('*')
    .eq('id', access.property_id)
    .single();

  return property;
}

export async function grantPropertyAccess(
  userId: string,
  propertyId: string,
  accessLevel: 'read' | 'write' | 'manage' | 'admin',
  grantedBy: string,
  options?: {
    isPrimary?: boolean;
    expiresAt?: string;
  }
): Promise<UserPropertyAccess> {
  const client = supabase;

  // If setting as primary, unset other primaries
  if (options?.isPrimary) {
    await client
      .from('user_property_access')
      .update({ is_primary: false })
      .eq('user_id', userId);
  }

  const { data, error } = await client
    .from('user_property_access')
    .upsert({
      user_id: userId,
      property_id: propertyId,
      access_level: accessLevel,
      granted_by: grantedBy,
      is_primary: options?.isPrimary || false,
      expires_at: options?.expiresAt
    }, {
      onConflict: 'user_id,property_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function revokePropertyAccess(
  userId: string,
  propertyId: string
): Promise<void> {
  const client = supabase;

  await client
    .from('user_property_access')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);
}

export async function grantGroupAccess(
  userId: string,
  groupId: string,
  accessLevel: string,
  grantedBy: string,
  roleInGroup?: string
): Promise<UserGroupAccess> {
  const client = supabase;

  const { data, error } = await client
    .from('user_group_access')
    .upsert({
      user_id: userId,
      group_id: groupId,
      access_level: accessLevel,
      role_in_group: roleInGroup,
      granted_by: grantedBy
    }, {
      onConflict: 'user_id,group_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function revokeGroupAccess(
  userId: string,
  groupId: string
): Promise<void> {
  const client = supabase;

  await client
    .from('user_group_access')
    .delete()
    .eq('user_id', userId)
    .eq('group_id', groupId);
}

export async function checkPropertyAccess(
  userId: string,
  propertyId: string,
  requiredLevel: 'read' | 'write' | 'manage' | 'admin' = 'read'
): Promise<boolean> {
  const client = supabase;

  // Call the database function
  const { data, error } = await client.rpc('user_has_property_access', {
    user_uuid: userId,
    property_uuid: propertyId,
    required_level: requiredLevel
  });

  if (error) return false;
  return data === true;
}

// ==================== PROPERTY MANAGEMENT ====================

export async function addPropertyToGroup(
  propertyId: string,
  groupId: string
): Promise<void> {
  const client = supabase;

  await client
    .from('properties')
    .update({ group_id: groupId })
    .eq('id', propertyId);
}

export async function removePropertyFromGroup(propertyId: string): Promise<void> {
  const client = supabase;

  await client
    .from('properties')
    .update({ group_id: null })
    .eq('id', propertyId);
}

export async function updatePropertyDetails(
  propertyId: string,
  updates: {
    property_code?: string;
    property_type?: string;
    star_rating?: number;
    chain_brand?: string;
    gds_codes?: Record<string, string>;
  }
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', propertyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==================== GROUP BENCHMARKING ====================

export async function getGroupBenchmarks(
  groupId: string,
  periodStart: string,
  periodEnd: string,
  metrics: string[] = ['revpar', 'adr', 'occupancy', 'revenue']
): Promise<any[]> {
  const client = supabase;

  const { data, error } = await client
    .from('property_benchmarks')
    .select(`
      *,
      properties(name, property_code)
    `)
    .eq('group_id', groupId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .in('metric', metrics)
    .order('metric')
    .order('group_rank');

  if (error) throw error;
  return data || [];
}

export async function calculateAndStoreBenchmarks(
  groupId: string,
  periodStart: string,
  periodEnd: string
): Promise<void> {
  const client = supabase;

  // Get all properties in group
  const properties = await getPropertiesInGroup(groupId);
  if (properties.length === 0) return;

  const metrics = ['revenue', 'occupancy', 'adr', 'revpar'];

  for (const metric of metrics) {
    // Calculate metric for each property (simplified - in production, pull from actual data)
    const propertyMetrics: { propertyId: string; value: number }[] = [];

    for (const property of properties) {
      // Get aggregated data for the property
      // This would typically come from reservations, revenue, etc.
      let value = 0;

      if (metric === 'revenue') {
        const { data: revenue } = await client
          .from('payments')
          .select('amount')
          .eq('property_id', property.id)
          .eq('status', 'completed')
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd);
        
        value = (revenue || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      } else if (metric === 'occupancy') {
        // Calculate occupancy percentage
        const { count: totalRooms } = await client
          .from('rooms')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id);

        const { count: bookedNights } = await client
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .gte('check_in', periodStart)
          .lte('check_out', periodEnd)
          .in('status', ['confirmed', 'checked_in', 'checked_out']);

        const days = Math.ceil(
          (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24)
        );
        const totalRoomNights = (totalRooms || 1) * days;
        value = totalRoomNights > 0 ? ((bookedNights || 0) / totalRoomNights) * 100 : 0;
      }

      propertyMetrics.push({ propertyId: property.id, value });
    }

    // Calculate group average
    const groupAverage = propertyMetrics.reduce((sum, p) => sum + p.value, 0) / propertyMetrics.length;

    // Sort and rank
    propertyMetrics.sort((a, b) => b.value - a.value);

    // Store benchmarks
    for (let i = 0; i < propertyMetrics.length; i++) {
      const pm = propertyMetrics[i];
      
      await client
        .from('property_benchmarks')
        .upsert({
          group_id: groupId,
          property_id: pm.propertyId,
          period_start: periodStart,
          period_end: periodEnd,
          metric,
          value: pm.value,
          group_average: groupAverage,
          group_rank: i + 1
        }, {
          onConflict: 'property_id,period_start,period_end,metric'
        });
    }
  }
}

// ==================== CONSOLIDATED REPORTING ====================

export async function getGroupSummary(groupId: string): Promise<{
  group: PropertyGroup;
  properties: Property[];
  totalRevenue: number;
  averageOccupancy: number;
  propertyCount: number;
}> {
  const group = await getPropertyGroup(groupId);
  if (!group) throw new Error('Group not found');

  const properties = await getPropertiesInGroup(groupId);

  // Calculate summary metrics (simplified)
  const client = supabase;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: revenue } = await client
    .from('payments')
    .select('amount')
    .in('property_id', properties.map(p => p.id))
    .eq('status', 'completed')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const totalRevenue = (revenue || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    group,
    properties,
    totalRevenue,
    averageOccupancy: 0, // Would calculate from actual data
    propertyCount: properties.length
  };
}

// ==================== PROPERTY SWITCHER ====================

export async function switchUserProperty(
  userId: string,
  propertyId: string
): Promise<boolean> {
  // Verify access
  const hasAccess = await checkPropertyAccess(userId, propertyId, 'read');
  if (!hasAccess) {
    throw new Error('Access denied to this property');
  }

  const client = supabase;

  // Set all user's properties to non-primary
  await client
    .from('user_property_access')
    .update({ is_primary: false })
    .eq('user_id', userId);

  // Set selected property as primary
  await client
    .from('user_property_access')
    .upsert({
      user_id: userId,
      property_id: propertyId,
      access_level: 'read',
      is_primary: true
    }, {
      onConflict: 'user_id,property_id'
    });

  return true;
}

