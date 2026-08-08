/**
 * Notification Service
 * Manages in-app notifications, broadcasts, and templates
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  priority: string;
  targetType?: string;
  targetId?: string;
  actions?: any[];
  read: boolean;
  readAt?: string;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  channel: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: any[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationBroadcast {
  id: string;
  title: string;
  message: string;
  targetRoles?: string[];
  targetDepartments?: string[];
  channel: string;
  priority: string;
  scheduledFor?: string;
  sentAt?: string;
  sentCount: string;
  createdBy?: string;
  createdAt: string;
}

class NotificationService {
  /**
   * Get notifications for a user
   */
  async getForUser(
    userId: string,
    options: {
      unreadOnly?: boolean;
      type?: string;
      limit?: number;
      propertyId?: string;
    }
  ): Promise<Notification[]> {
    const supabase = getSupabase();
    
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error marking notification as read:', error);
      return null;
    }

    return data;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)
      .select('id');

    if (error) {
      logger.error('Error marking all notifications as read:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Broadcast a notification to multiple users
   */
  async broadcast(options: {
    title: string;
    message: string;
    type?: string;
    targetType?: string;
    priority?: string;
    targetUserIds?: string[];
    actions?: any[];
    scheduledFor?: string;
    createdBy?: string;
    propertyId?: string;
  }): Promise<NotificationBroadcast> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notification_broadcasts')
      .insert({
        title: options.title,
        message: options.message,
        channel: 'in_app',
        priority: options.priority || 'normal',
        scheduled_for: options.scheduledFor,
        created_by: options.createdBy,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating broadcast:', error);
      throw error;
    }

    // If target user IDs provided, create individual notifications
    if (options.targetUserIds && options.targetUserIds.length > 0) {
      const notifications = options.targetUserIds.map(userId => ({
        user_id: userId,
        type: options.type || 'info',
        title: options.title,
        message: options.message,
        channel: 'in_app',
        priority: options.priority || 'normal',
        target_type: options.targetType,
        actions: options.actions || [],
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        logger.error('Error creating broadcast notifications:', notifError);
      }
    }

    return data;
  }

  /**
   * Delete a notification
   */
  async delete(id: string): Promise<void> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultiple(ids: string[]): Promise<number> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids);

    if (error) {
      logger.error('Error deleting notifications:', error);
      return 0;
    }

    return ids.length;
  }

  /**
   * Get notification templates
   */
  async getTemplates(activeOnly: boolean = true, propertyId?: string): Promise<NotificationTemplate[]> {
    const supabase = getSupabase();
    
    let query = supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get a template by ID
   */
  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Error fetching template:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a notification template
   */
  async createTemplate(options: {
    name: string;
    title: string;
    message: string;
    type?: string;
    targetType?: string;
    priority?: string;
    actions?: any[];
    variables?: any[];
    isActive?: boolean;
    propertyId?: string;
  }): Promise<NotificationTemplate> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notification_templates')
      .insert({
        name: options.name,
        type: options.type || 'info',
        channel: 'in_app',
        title_template: options.title,
        body_template: options.message,
        variables: options.variables || [],
        is_active: options.isActive !== false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating template:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update a notification template
   */
  async updateTemplate(
    id: string,
    options: {
      name?: string;
      title?: string;
      message?: string;
      type?: string;
      targetType?: string;
      priority?: string;
      actions?: any[];
      variables?: any[];
      isActive?: boolean;
      propertyId?: string;
    }
  ): Promise<NotificationTemplate | null> {
    const supabase = getSupabase();
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (options.name !== undefined) updateData.name = options.name;
    if (options.type !== undefined) updateData.type = options.type;
    if (options.title !== undefined) updateData.title_template = options.title;
    if (options.message !== undefined) updateData.body_template = options.message;
    if (options.variables !== undefined) updateData.variables = options.variables;
    if (options.isActive !== undefined) updateData.is_active = options.isActive;

    const { data, error } = await supabase
      .from('notification_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating template:', error);
      return null;
    }

    return data;
  }

  /**
   * Delete a notification template
   */
  async deleteTemplate(id: string): Promise<void> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Send notification from a template
   */
  async sendFromTemplate(
    templateId: string,
    variables: Record<string, string>,
    options: {
      targetUserIds?: string[];
      scheduledFor?: string;
      createdBy?: string;
    }
  ): Promise<NotificationBroadcast> {
    const template = await this.getTemplateById(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Replace variables in template
    let title = template.titleTemplate;
    let message = template.bodyTemplate;

    for (const [key, value] of Object.entries(variables)) {
      title = title.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return this.broadcast({
      title,
      message,
      type: template.type,
      targetUserIds: options.targetUserIds,
      scheduledFor: options.scheduledFor,
      createdBy: options.createdBy,
    });
  }

  /**
   * Get notification broadcasts
   */
  async getBroadcasts(targetType?: string, propertyId?: string): Promise<NotificationBroadcast[]> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('notification_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Error fetching broadcasts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get valid priority values
   */
  getValidPriorities(): string[] {
    return ['low', 'normal', 'high', 'critical'];
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<number> {
    const supabase = getSupabase();
    
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .lte('scheduled_for', now)
      .is('sent_at', null);

    if (error) {
      logger.error('Error fetching scheduled notifications:', error);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    // Mark as sent
    const ids = data.map(n => n.id);
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ sent_at: now })
      .in('id', ids);

    if (updateError) {
      logger.error('Error updating scheduled notifications:', updateError);
      return 0;
    }

    return data.length;
  }

  /**
   * Create a single in-app notification for a specific user.
   * Lighter-weight than broadcast() — no notification_broadcasts row.
   */
  async create(options: {
    userId: string;
    type: string;
    title: string;
    message: string;
    priority?: string;
    targetType?: string;
    targetId?: string;
    actions?: any[];
  }): Promise<Notification | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: options.userId,
        type: options.type,
        title: options.title,
        message: options.message,
        channel: 'in_app',
        priority: options.priority || 'normal',
        target_type: options.targetType,
        target_id: options.targetId,
        actions: options.actions || [],
        read: false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating notification:', error);
      return null;
    }

    return data;
  }
}

export const notificationService = new NotificationService();
