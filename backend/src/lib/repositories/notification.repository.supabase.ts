import { getSupabase } from '../../database/connection.js';

export function createSupabaseNotificationRepository() {
  const supabase = getSupabase();

  return {
    async create(data: any): Promise<any> {
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.user_id,
          property_id: data.property_id,
          title: data.title,
          message: data.message,
          type: data.type,
          target_type: data.target_type,
          channel: data.channel,
          priority: data.priority ?? 'normal',
          is_read: data.is_read ?? false,
          read_at: data.read_at,
          data: data.data,
          actions: data.actions,
          scheduled_for: data.scheduled_for,
          sent_at: data.sent_at,
          expires_at: data.expires_at,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create notification: ${error.message}`);
      return notification;
    },

    async getById(id: string): Promise<any | null> {
      const { data, error } = await supabase.from('notifications').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw new Error(`Failed to get notification: ${error.message}`);
      return data || null;
    },

    async getByUserId(userId: string, filters?: any): Promise<any[]> {
      let query = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.isRead !== undefined) query = query.eq('is_read', filters.isRead);
      if (filters?.channel) query = query.eq('channel', filters.channel);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to get notifications: ${error.message}`);
      return data || [];
    },

    async getAll(filters?: any, pagination?: { limit: number; offset: number }): Promise<{ notifications: any[]; total: number }> {
      let query = supabase.from('notifications').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (filters?.userId) query = query.eq('user_id', filters.userId);
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.targetType) query = query.eq('target_type', filters.targetType);
      if (filters?.isRead !== undefined) query = query.eq('is_read', filters.isRead);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (pagination) query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to get notifications: ${error.message}`);
      return { notifications: data || [], total: count || 0 };
    },

    async markAsRead(id: string): Promise<any> {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
      return data;
    },

    async markAllAsRead(userId: string): Promise<number> {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id');
      if (error) throw new Error(`Failed to mark all as read: ${error.message}`);
      return data?.length || 0;
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete notification: ${error.message}`);
    },

    async deleteExpired(): Promise<number> {
      const { data, error } = await supabase.from('notifications').delete().lt('expires_at', new Date().toISOString()).select('id');
      if (error) throw new Error(`Failed to delete expired: ${error.message}`);
      return data?.length || 0;
    },

    async deleteMultiple(ids: string[]): Promise<number> {
      const { data, error } = await supabase.from('notifications').delete().in('id', ids).select('id');
      if (error) throw new Error(`Failed to delete notifications: ${error.message}`);
      return data?.length || 0;
    },

    async createBroadcast(data: any): Promise<any> {
      const { data: broadcast, error } = await supabase
        .from('notification_broadcasts')
        .insert({
          property_id: data.property_id,
          title: data.title,
          message: data.message,
          type: data.type,
          target_type: data.target_type,
          priority: data.priority ?? 'normal',
          target_user_ids: data.target_user_ids || [],
          actions: data.actions,
          scheduled_for: data.scheduled_for,
          sent_at: data.sent_at,
          delivery_count: data.delivery_count ?? 0,
          read_count: data.read_count ?? 0,
          created_by: data.created_by,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create broadcast: ${error.message}`);
      return broadcast;
    },

    async getBroadcasts(targetType?: string, propertyId?: string): Promise<any[]> {
      let query = supabase.from('notification_broadcasts').select('*').order('created_at', { ascending: false });
      if (targetType) query = query.or(`target_type.eq.${targetType},target_type.eq.all`);
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to get broadcasts: ${error.message}`);
      return data || [];
    },

    async getBroadcastById(id: string): Promise<any | null> {
      const { data, error } = await supabase.from('notification_broadcasts').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw new Error(`Failed to get broadcast: ${error.message}`);
      return data || null;
    },

    async updateBroadcast(id: string, data: any): Promise<any> {
      const { data: broadcast, error } = await supabase.from('notification_broadcasts').update(data).eq('id', id).select().single();
      if (error) throw new Error(`Failed to update broadcast: ${error.message}`);
      return broadcast;
    },

    async getScheduledNotifications(): Promise<any[]> {
      const { data, error } = await supabase.from('notifications').select('*').lte('scheduled_for', new Date().toISOString()).is('sent_at', null);
      if (error) throw new Error(`Failed to get scheduled notifications: ${error.message}`);
      return data || [];
    },

    async getScheduledBroadcasts(): Promise<any[]> {
      const { data, error } = await supabase.from('notification_broadcasts').select('*').lte('scheduled_for', new Date().toISOString()).is('sent_at', null);
      if (error) throw new Error(`Failed to get scheduled broadcasts: ${error.message}`);
      return data || [];
    },

    async createTemplate(data: any): Promise<any> {
      const { data: template, error } = await supabase
        .from('notification_templates')
        .insert({ property_id: data.property_id, name: data.name, title: data.title, message: data.message, type: data.type, target_type: data.target_type, priority: data.priority, actions: data.actions, variables: data.variables || [], is_active: data.is_active ?? true })
        .select()
        .single();
      if (error) throw new Error(`Failed to create template: ${error.message}`);
      return template;
    },

    async getTemplates(activeOnly = true, propertyId?: string): Promise<any[]> {
      let query = supabase.from('notification_templates').select('*').order('name', { ascending: true });
      if (activeOnly) query = query.eq('is_active', true);
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to get templates: ${error.message}`);
      return data || [];
    },

    async getTemplateById(id: string): Promise<any | null> {
      const { data, error } = await supabase.from('notification_templates').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw new Error(`Failed to get template: ${error.message}`);
      return data || null;
    },

    async updateTemplate(id: string, data: any): Promise<any> {
      const { data: template, error } = await supabase.from('notification_templates').update(data).eq('id', id).select().single();
      if (error) throw new Error(`Failed to update template: ${error.message}`);
      return template;
    },

    async deleteTemplate(id: string): Promise<void> {
      const { error } = await supabase.from('notification_templates').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete template: ${error.message}`);
    },
  };
}
