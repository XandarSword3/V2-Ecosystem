import { Request, Response } from 'express';
import * as multiPropertyService from './multi-property.service.js';

// ==================== PROPERTY GROUPS ====================

export async function getPropertyGroups(req: Request, res: Response): Promise<void> {
  try {
    const groups = await multiPropertyService.getPropertyGroups();

    res.json({
      success: true,
      groups
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get property groups';
    res.status(500).json({ error: message });
  }
}

export async function getPropertyGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    const group = await multiPropertyService.getPropertyGroup(groupId);

    if (!group) {
      res.status(404).json({ error: 'Property group not found' });
      return;
    }

    const properties = await multiPropertyService.getPropertiesInGroup(groupId);

    res.json({
      success: true,
      group,
      properties
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get property group';
    res.status(500).json({ error: message });
  }
}

export async function createPropertyGroup(req: Request, res: Response): Promise<void> {
  try {
    const groupData = req.body;

    const group = await multiPropertyService.createPropertyGroup(groupData);

    res.status(201).json({
      success: true,
      group
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create property group';
    res.status(400).json({ error: message });
  }
}

export async function updatePropertyGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const updates = req.body;

    const group = await multiPropertyService.updatePropertyGroup(groupId, updates);

    res.json({
      success: true,
      group
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update property group';
    res.status(400).json({ error: message });
  }
}

export async function getGroupSummary(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    const summary = await multiPropertyService.getGroupSummary(groupId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get group summary';
    res.status(500).json({ error: message });
  }
}

// ==================== USER ACCESSIBLE PROPERTIES ====================

export async function getMyProperties(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const properties = await multiPropertyService.getUserAccessibleProperties(userId);
    const primaryProperty = await multiPropertyService.getUserPrimaryProperty(userId);

    res.json({
      success: true,
      properties,
      primary_property: primaryProperty
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get properties';
    res.status(500).json({ error: message });
  }
}

export async function switchProperty(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { property_id } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!property_id) {
      res.status(400).json({ error: 'property_id is required' });
      return;
    }

    await multiPropertyService.switchUserProperty(userId, property_id);

    res.json({
      success: true,
      message: 'Switched to property successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to switch property';
    res.status(403).json({ error: message });
  }
}

// ==================== ACCESS MANAGEMENT ====================

export async function grantPropertyAccess(req: Request, res: Response): Promise<void> {
  try {
    const grantedBy = req.user?.id;
    const { email, user_id, property_id, access_level, is_primary, expires_at } = req.body;

    if (!grantedBy) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    let targetUserId = user_id;

    // If email is provided instead of user_id, find the user
    if (email && !targetUserId) {
      const { data: user, error: userError } = await multiPropertyService.getUserByEmail(email);
      if (userError || !user) {
        res.status(404).json({ error: 'User with this email not found' });
        return;
      }
      targetUserId = user.id;
    }

    if (!targetUserId || !property_id || !access_level) {
      res.status(400).json({ error: 'user_id (or email), property_id, and access_level are required' });
      return;
    }

    const access = await multiPropertyService.grantPropertyAccess(
      targetUserId,
      property_id,
      access_level,
      grantedBy,
      { isPrimary: is_primary, expiresAt: expires_at }
    );

    res.status(201).json({
      success: true,
      access
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to grant access';
    res.status(400).json({ error: message });
  }
}

export async function revokePropertyAccess(req: Request, res: Response): Promise<void> {
  try {
    const { userId, propertyId } = req.params;

    if (!userId || !propertyId) {
      res.status(400).json({ error: 'userId and propertyId are required' });
      return;
    }

    await multiPropertyService.revokePropertyAccess(userId, propertyId);

    res.json({
      success: true,
      message: 'Access revoked'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke access';
    res.status(400).json({ error: message });
  }
}

export async function getPropertyStaff(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    const staff = await multiPropertyService.getPropertyStaff(propertyId);

    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Error in getPropertyStaff:', error);
    const message = error instanceof Error ? error.message : 'Failed to get property staff';
    res.status(500).json({ error: message });
  }
}

export async function updateProperty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const property = await multiPropertyService.updatePropertyDetails(id, updates);

    res.json({
      success: true,
      property
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update property';
    res.status(400).json({ error: message });
  }
}

export async function grantGroupAccess(req: Request, res: Response): Promise<void> {
  try {
    const grantedBy = req.user?.id;
    const { user_id, group_id, access_level, role_in_group } = req.body;

    if (!grantedBy) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!user_id || !group_id || !access_level) {
      res.status(400).json({ error: 'user_id, group_id, and access_level are required' });
      return;
    }

    const access = await multiPropertyService.grantGroupAccess(
      user_id,
      group_id,
      access_level,
      grantedBy,
      role_in_group
    );

    res.status(201).json({
      success: true,
      access
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to grant group access';
    res.status(400).json({ error: message });
  }
}

export async function revokeGroupAccess(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, group_id } = req.body;

    if (!user_id || !group_id) {
      res.status(400).json({ error: 'user_id and group_id are required' });
      return;
    }

    await multiPropertyService.revokeGroupAccess(user_id, group_id);

    res.json({
      success: true,
      message: 'Group access revoked'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke group access';
    res.status(400).json({ error: message });
  }
}

// ==================== PROPERTY GROUP MEMBERSHIP ====================

export async function addPropertyToGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { property_id } = req.body;

    if (!property_id) {
      res.status(400).json({ error: 'property_id is required' });
      return;
    }

    await multiPropertyService.addPropertyToGroup(property_id, groupId);

    res.json({
      success: true,
      message: 'Property added to group'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add property to group';
    res.status(400).json({ error: message });
  }
}

export async function removePropertyFromGroup(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    await multiPropertyService.removePropertyFromGroup(propertyId);

    res.json({
      success: true,
      message: 'Property removed from group'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove property from group';
    res.status(400).json({ error: message });
  }
}

// ==================== BENCHMARKING ====================

export async function getGroupBenchmarks(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { start_date, end_date, metrics } = req.query;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const benchmarks = await multiPropertyService.getGroupBenchmarks(
      groupId,
      start_date ? String(start_date) : thirtyDaysAgo.toISOString().split('T')[0],
      end_date ? String(end_date) : new Date().toISOString().split('T')[0],
      metrics ? String(metrics).split(',') : undefined
    );

    res.json({
      success: true,
      benchmarks
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get benchmarks';
    res.status(500).json({ error: message });
  }
}

export async function calculateBenchmarks(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      res.status(400).json({ error: 'start_date and end_date are required' });
      return;
    }

    await multiPropertyService.calculateAndStoreBenchmarks(groupId, start_date, end_date);

    res.json({
      success: true,
      message: 'Benchmarks calculated successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate benchmarks';
    res.status(500).json({ error: message });
  }
}

// ==================== CREATE PROPERTY ====================

export async function createProperty(req: Request, res: Response): Promise<void> {
  try {
    const { name, property_code, property_type, address, city, country, timezone, currency, phone, email, total_rooms, group_id } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Property name is required' });
      return;
    }

    const property = await multiPropertyService.createProperty({
      name,
      property_code,
      property_type,
      address,
      city,
      country,
      timezone,
      currency,
      phone,
      email,
      total_rooms,
      group_id,
    });

    // Grant the creating user admin access to the new property
    const userId = req.user?.id;
    if (userId) {
      await multiPropertyService.grantPropertyAccess(userId, property.id, 'admin', userId, { isPrimary: true });
    }

    res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create property';
    res.status(400).json({ error: message });
  }
}
