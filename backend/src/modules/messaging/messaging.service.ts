/**
 * Messaging Service - Guest Messaging via SMS, WhatsApp, In-App
 * Refactored to use Supabase instead of Prisma
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../../database/connection.js';

// =============================================
// TYPES
// =============================================

interface ChannelConfig {
  provider?: string;
  apiKeyEncrypted?: string;
  fromNumber?: string;
  webhookUrl?: string;
  enabled?: boolean;
  chatbotEnabled?: boolean;
}

interface MessagePreferences {
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
  pushOptIn?: boolean;
  preferredChannel?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

interface Conversation {
  id: string;
  propertyId: string;
  guestId?: string;
  bookingId?: string;
  channelType: string;
  status: string;
  priority: string;
  assignedTo?: string;
  messageCount: number;
  unreadCount: number;
  lastMessageAt?: Date;
}

interface Message {
  id: string;
  conversationId: string;
  direction: string;
  senderType: string;
  senderId?: string;
  senderName?: string;
  messageType: string;
  content: string;
  status: string;
  createdAt: Date;
}

interface MessageTemplate {
  id: string;
  name: string;
  channelType: string;
  content: string;
  variables: string[];
}

// =============================================
// SERVICE CLASS
// =============================================

export class MessagingService {
  private get supabase() {
    return getSupabase();
  }

  // =============================================
  // CHANNEL CONFIGURATION
  // =============================================

  async configureChannel(
    propertyId: string,
    channelType: string,
    config: ChannelConfig
  ): Promise<string> {
    // Check if channel exists
    const { data: existing } = await this.supabase
      .from('messaging_channels')
      .select('*')
      .eq('property_id', propertyId)
      .eq('channel_type', channelType)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await this.supabase
        .from('messaging_channels')
        .update({
          provider: config.provider ?? existing.provider,
          api_key_encrypted: config.apiKeyEncrypted
            ? this.encryptApiKey(config.apiKeyEncrypted)
            : existing.api_key_encrypted,
          from_number: config.fromNumber ?? existing.from_number,
          webhook_url: config.webhookUrl ?? existing.webhook_url,
          enabled: config.enabled ?? existing.enabled,
          chatbot_enabled: config.chatbotEnabled ?? existing.chatbot_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
      return existing.id;
    } else {
      // Create new
      const id = uuidv4();
      const { error } = await this.supabase
        .from('messaging_channels')
        .insert({
          id,
          property_id: propertyId,
          channel_type: channelType,
          provider: config.provider || 'internal',
          api_key_encrypted: config.apiKeyEncrypted
            ? this.encryptApiKey(config.apiKeyEncrypted)
            : null,
          from_number: config.fromNumber,
          webhook_url: config.webhookUrl,
          enabled: config.enabled ?? true,
          chatbot_enabled: config.chatbotEnabled ?? false
        });

      if (error) throw error;
      return id;
    }
  }

  async getChannel(propertyId: string, channelType: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('messaging_channels')
      .select('*')
      .eq('property_id', propertyId)
      .eq('channel_type', channelType)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async verifyChannel(channelId: string): Promise<void> {
    const { data: channel } = await this.supabase
      .from('messaging_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (!channel) throw new Error('Channel not found');

    // Mark as verified
    await this.supabase
      .from('messaging_channels')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId);
  }

  // =============================================
  // GUEST PREFERENCES
  // =============================================

  async updateGuestPreferences(
    guestId: string,
    propertyId: string,
    prefs: MessagePreferences
  ): Promise<any> {
    // Check existing
    const { data: existing } = await this.supabase
      .from('guest_messaging_preferences')
      .select('*')
      .eq('guest_id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.supabase
        .from('guest_messaging_preferences')
        .update({
          sms_opt_in: prefs.smsOptIn ?? existing.sms_opt_in,
          whatsapp_opt_in: prefs.whatsappOptIn ?? existing.whatsapp_opt_in,
          email_opt_in: prefs.emailOptIn ?? existing.email_opt_in,
          push_opt_in: prefs.pushOptIn ?? existing.push_opt_in,
          preferred_channel: prefs.preferredChannel ?? existing.preferred_channel,
          quiet_hours_start: prefs.quietHoursStart ?? existing.quiet_hours_start,
          quiet_hours_end: prefs.quietHoursEnd ?? existing.quiet_hours_end,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.supabase
        .from('guest_messaging_preferences')
        .insert({
          id: uuidv4(),
          guest_id: guestId,
          property_id: propertyId,
          sms_opt_in: prefs.smsOptIn ?? true,
          whatsapp_opt_in: prefs.whatsappOptIn ?? true,
          email_opt_in: prefs.emailOptIn ?? true,
          push_opt_in: prefs.pushOptIn ?? true,
          preferred_channel: prefs.preferredChannel ?? 'sms'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async getGuestPreferences(guestId: string, propertyId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('guest_messaging_preferences')
      .select('*')
      .eq('guest_id', guestId)
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // =============================================
  // CONVERSATIONS
  // =============================================

  async createConversation(
    propertyId: string,
    channelType: string,
    guestIdentifier: string,
    options?: { guestId?: string; bookingId?: string; subject?: string }
  ): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        id: uuidv4(),
        property_id: propertyId,
        channel_type: channelType,
        guest_id: options?.guestId,
        booking_id: options?.bookingId,
        external_contact: guestIdentifier,
        subject: options?.subject,
        status: 'active',
        priority: 'normal',
        message_count: 0,
        unread_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapConversation(data);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapConversation(data) : null;
  }

  async findConversation(
    propertyId: string,
    channelType: string,
    guestId?: string,
    externalContact?: string
  ): Promise<Conversation | null> {
    let query = this.supabase
      .from('conversations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('channel_type', channelType)
      .eq('status', 'active');

    if (guestId) {
      query = query.eq('guest_id', guestId);
    }
    if (externalContact) {
      query = query.eq('external_contact', externalContact);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (error) throw error;
    return data ? this.mapConversation(data) : null;
  }

  async getPropertyConversations(
    propertyId: string,
    filters?: {
      status?: string;
      channelType?: string;
      assignedTo?: string;
      priority?: string;
      unreadOnly?: boolean;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<{ conversations: Conversation[]; total: number }> {
    let query = this.supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('property_id', propertyId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.channelType) {
      query = query.eq('channel_type', filters.channelType);
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.unreadOnly) {
      query = query.gt('unread_count', 0);
    }

    const offset = (page - 1) * limit;
    const { data, error, count } = await query
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      conversations: (data || []).map((row: any) => this.mapConversation(row)),
      total: count || 0
    };
  }

  async assignConversation(conversationId: string, staffId: string, department?: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        assigned_to: staffId,
        department,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async updateConversationPriority(conversationId: string, priority: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async resolveConversation(conversationId: string, resolution?: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolution,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async reopenConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        status: 'active',
        resolved_at: null,
        resolution_notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async markConversationRead(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) throw error;

    // Also mark messages as read
    await this.supabase
      .from('messages')
      .update({
        status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .is('read_at', null);
  }

  // =============================================
  // MESSAGES
  // =============================================

  async sendMessage(
    conversationId: string,
    content: string,
    sender: { type: string; id?: string; name?: string },
    options?: {
      messageType?: string;
      templateId?: string;
      templateParams?: Record<string, string>;
      mediaUrl?: string;
      mediaType?: string;
    }
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // If template, render it
    let finalContent = content;
    if (options?.templateId && options?.templateParams) {
      finalContent = await this.renderTemplate(options.templateId, options.templateParams);
    }

    // Get channel config
    const channel = await this.getChannel(conversation.propertyId, conversation.channelType);

    // Create message
    const messageId = uuidv4();
    const { data: message, error } = await this.supabase
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: sender.type,
        sender_id: sender.id,
        sender_name: sender.name,
        message_type: options?.messageType || 'text',
        content: finalContent,
        template_id: options?.templateId,
        media_url: options?.mediaUrl,
        media_type: options?.mediaType,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // FIX: Iteration 18 - Recount from source of truth to prevent race condition counter drift
    // Previously: conversation.messageCount + 1 — concurrent messages would read same count
    const { count: msgCount } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    await this.supabase
      .from('conversations')
      .update({
        message_count: msgCount || 0,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    // Send via provider
    if (channel && channel.enabled) {
      try {
        const result = await this.sendViaProvider(channel, conversation, finalContent, options);
        await this.supabase
          .from('messages')
          .update({
            external_id: result.messageId,
            status: result.status
          })
          .eq('id', messageId);
      } catch (err) {
        await this.supabase
          .from('messages')
          .update({ status: 'failed' })
          .eq('id', messageId);
      }
    } else {
      // Internal - mark as sent
      await this.supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', messageId);
    }

    const { data: updatedMessage } = await this.supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    return this.mapMessage(updatedMessage);
  }

  async receiveMessage(
    propertyId: string,
    channelType: string,
    senderContact: string,
    content: string,
    options?: {
      externalId?: string;
      senderName?: string;
      messageType?: string;
      mediaUrl?: string;
      mediaType?: string;
    }
  ): Promise<Message> {
    // Try to identify guest
    const guestInfo = await this.identifyGuestByContact(propertyId, channelType, senderContact);

    // Find or create conversation
    let conversation = await this.findConversation(
      propertyId,
      channelType,
      guestInfo?.id,
      !guestInfo ? senderContact : undefined
    );

    if (!conversation) {
      conversation = await this.createConversation(
        propertyId,
        channelType,
        senderContact,
        {
          guestId: guestInfo?.id,
          bookingId: guestInfo?.currentBookingId
        }
      );
    }

    // Create message
    const messageId = uuidv4();
    const { data: message, error } = await this.supabase
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversation.id,
        direction: 'inbound',
        sender_type: guestInfo ? 'guest' : 'external',
        sender_id: guestInfo?.id,
        sender_name: options?.senderName,
        message_type: options?.messageType || 'text',
        content,
        external_id: options?.externalId,
        media_url: options?.mediaUrl,
        media_type: options?.mediaType,
        status: 'received'
      })
      .select()
      .single();

    if (error) throw error;

    // FIX: Iteration 18 - Recount from source of truth for atomicity (same as sendMessage)
    const { count: recvMsgCount } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id);

    const { count: unreadCount } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('direction', 'inbound')
      .is('read_at', null);

    await this.supabase
      .from('conversations')
      .update({
        message_count: recvMsgCount || 0,
        unread_count: unreadCount || 0,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id);

    // Check for chatbot
    const channel = await this.getChannel(propertyId, channelType);
    if (channel?.chatbot_enabled) {
      await this.processChatbotResponse(conversation.id, content);
    }

    return this.mapMessage(message);
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      messages: (data || []).map((row: any) => this.mapMessage(row)),
      total: count || 0
    };
  }

  async updateMessageStatus(messageId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('messages')
      .update({
        status,
        delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
        read_at: status === 'read' ? new Date().toISOString() : undefined
      })
      .eq('id', messageId);

    if (error) throw error;
  }

  // =============================================
  // TEMPLATES
  // =============================================

  async createTemplate(
    propertyId: string,
    data: { name: string; channelType: string; content: string; variables?: string[] }
  ): Promise<MessageTemplate> {
    const { data: template, error } = await this.supabase
      .from('message_templates')
      .insert({
        id: uuidv4(),
        property_id: propertyId,
        name: data.name,
        channel_type: data.channelType,
        content: data.content,
        variables: data.variables || []
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTemplate(template);
  }

  async getTemplate(templateId: string): Promise<MessageTemplate | null> {
    const { data, error } = await this.supabase
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapTemplate(data) : null;
  }

  async getPropertyTemplates(propertyId: string, channelType?: string): Promise<MessageTemplate[]> {
    let query = this.supabase
      .from('message_templates')
      .select('*')
      .eq('property_id', propertyId);

    if (channelType) {
      query = query.eq('channel_type', channelType);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return (data || []).map((row: any) => this.mapTemplate(row));
  }

  async renderTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      // FIX: Iteration 18 - Escape regex metacharacters in user-supplied key to prevent SyntaxError/DoS
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      content = content.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value);
    }
    return content;
  }

  // =============================================
  // CANNED RESPONSES
  // =============================================

  async createCannedResponse(
    propertyId: string,
    data: { category: string; shortcut: string; content: string },
    createdBy?: string
  ): Promise<string> {
    const id = uuidv4();
    const { error } = await this.supabase
      .from('canned_responses')
      .insert({
        id,
        property_id: propertyId,
        category: data.category,
        shortcut: data.shortcut,
        content: data.content,
        created_by: createdBy
      });

    if (error) throw error;
    return id;
  }

  async getCannedResponses(propertyId: string, category?: string): Promise<any[]> {
    let query = this.supabase
      .from('canned_responses')
      .select('*')
      .eq('property_id', propertyId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('shortcut');

    if (error) throw error;
    return data || [];
  }

  async useCannedResponse(
    responseId: string,
    variables?: Record<string, string>
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('canned_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (error) throw error;

    // Update usage count
    await this.supabase
      .from('canned_responses')
      .update({ 
        use_count: (data.use_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', responseId);

    let content = data.content;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
    return content;
  }

  // =============================================
  // CHATBOT
  // =============================================

  async processChatbotResponse(conversationId: string, userMessage: string): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return;

    // Get or create chatbot context
    let context = await this.getChatbotContext(conversationId);
    if (!context) {
      context = await this.createChatbotContext(conversationId);
    }

    // Match intent
    const intent = await this.matchIntent(conversation.propertyId, userMessage);

    if (intent) {
      // Update context with matched intent
      await this.updateChatbotContext(conversationId, {
        currentIntent: intent.name,
        lastIntentAt: new Date().toISOString(),
        state: 'responding'
      });

      // Generate response
      const contextVars = await this.getContextVariables(conversation);
      let response = intent.response_template;
      for (const [key, value] of Object.entries(contextVars)) {
        response = response.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      // Send bot response
      await this.sendMessage(conversationId, response, {
        type: 'bot',
        name: 'Assistant'
      });

      // Check if handoff needed
      if (intent.requires_handoff) {
        await this.requestHandoff(conversationId, intent.handoff_reason || 'User request requires staff assistance');
      }
    } else {
      // No intent matched - check fallback threshold
      const fallbackCount = (context.fallback_count || 0) + 1;
      await this.supabase
        .from('chatbot_context')
        .update({ 
          fallback_count: fallbackCount,
          updated_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId);

      if (fallbackCount >= 3) {
        // Too many unrecognized messages - request handoff
        await this.requestHandoff(conversationId, 'Multiple unrecognized messages');
        await this.sendMessage(conversationId, 
          "I'm having trouble understanding. Let me connect you with a staff member who can help better.", 
          { type: 'bot', name: 'Assistant' }
        );
      } else {
        await this.sendMessage(conversationId,
          "I'm not sure I understand. Could you please rephrase that, or type 'help' for assistance?",
          { type: 'bot', name: 'Assistant' }
        );
      }
    }
  }

  private async matchIntent(propertyId: string, message: string): Promise<any> {
    const { data: intents } = await this.supabase
      .from('chatbot_intents')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    if (!intents || intents.length === 0) return null;

    const lowerMessage = message.toLowerCase();
    
    for (const intent of intents) {
      const patterns = intent.patterns || [];
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern.toLowerCase())) {
          return intent;
        }
      }
    }

    return null;
  }

  private async getChatbotContext(conversationId: string): Promise<any> {
    const { data } = await this.supabase
      .from('chatbot_context')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    return data;
  }

  private async createChatbotContext(conversationId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('chatbot_context')
      .insert({
        conversation_id: conversationId,
        state: 'idle'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async updateChatbotContext(
    conversationId: string,
    updates: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('chatbot_context')
      .update({
        current_intent: updates.currentIntent,
        slot_values: updates.slotValues,
        state: updates.state,
        last_intent_at: updates.lastIntentAt,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId);

    if (error) throw error;
  }

  private async requestHandoff(conversationId: string, reason: string): Promise<void> {
    await this.supabase
      .from('chatbot_context')
      .update({
        handoff_requested: true,
        handoff_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId);

    await this.updateConversationPriority(conversationId, 'high');
  }

  private async getContextVariables(conversation: Conversation): Promise<Record<string, string>> {
    const variables: Record<string, string> = {
      property_name: '',
      guest_name: '',
      guest_first_name: '',
      room_number: '',
      room_type: '',
      check_in_date: '',
      check_out_date: ''
    };

    if (conversation.guestId) {
      const { data: guest } = await this.supabase
        .from('guests')
        .select('*')
        .eq('id', conversation.guestId)
        .maybeSingle();

      if (guest) {
        variables.guest_name = `${guest.first_name} ${guest.last_name}`;
        variables.guest_first_name = guest.first_name;
      }
    }

    if (conversation.bookingId) {
      const { data: booking } = await this.supabase
        .from('transactions')
        .select('*, accommodation_units(name)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', conversation.bookingId)
        .maybeSingle();

      if (booking) {
        variables.room_number = (booking.accommodation_units as any)?.name || '';
        variables.room_type = 'Chalet';
        const meta = booking.metadata as any;
        const checkIn = meta?.check_in_date || booking.created_at;
        const checkOut = meta?.check_out_date || booking.created_at;
        variables.check_in_date = checkIn ? new Date(checkIn).toLocaleDateString() : '';
        variables.check_out_date = checkOut ? new Date(checkOut).toLocaleDateString() : '';
      }
    }

    return variables;
  }

  // =============================================
  // PROVIDER INTEGRATION
  // =============================================

  private async sendViaProvider(
    channel: any,
    conversation: Conversation,
    content: string,
    options?: any
  ): Promise<{ messageId: string; status: string }> {
    const provider = channel.provider;

    switch (provider) {
      case 'twilio':
        return this.sendViaTwilio(channel, conversation, content, options);
      case 'messagebird':
        return this.sendViaMessageBird(channel, conversation, content, options);
      default:
        // Internal/mock provider
        return {
          messageId: uuidv4(),
          status: 'sent'
        };
    }
  }

  private async sendViaTwilio(
    channel: any,
    conversation: Conversation,
    content: string,
    options?: any
  ): Promise<{ messageId: string; status: string }> {
    // Twilio integration placeholder
    const apiKey = this.decryptApiKey(channel.api_key_encrypted);
    console.log(`[Twilio] Sending to ${conversation.guestId}: ${content}`);
    
    return {
      messageId: `SM${uuidv4().replace(/-/g, '').substring(0, 32)}`,
      status: 'sent'
    };
  }

  private async sendViaMessageBird(
    channel: any,
    conversation: Conversation,
    content: string,
    options?: any
  ): Promise<{ messageId: string; status: string }> {
    // MessageBird integration placeholder
    console.log(`[MessageBird] Sending to ${conversation.guestId}: ${content}`);
    
    return {
      messageId: uuidv4(),
      status: 'sent'
    };
  }

  // =============================================
  // WEBHOOKS
  // =============================================

  async processWebhook(
    channelId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    // Store webhook event
    await this.supabase
      .from('messaging_webhooks')
      .insert({
        channel_id: channelId,
        event_type: eventType,
        payload
      });

    // Process based on event type
    switch (eventType) {
      case 'message.received':
        await this.handleIncomingWebhook(channelId, payload);
        break;
      case 'message.status':
        await this.handleStatusWebhook(payload);
        break;
    }
  }

  private async handleIncomingWebhook(channelId: string, payload: any): Promise<void> {
    const { data: channel } = await this.supabase
      .from('messaging_channels')
      .select('*')
      .eq('id', channelId)
      .maybeSingle();

    if (!channel) return;

    await this.receiveMessage(
      channel.property_id,
      channel.channel_type,
      payload.from,
      payload.body || payload.text,
      {
        externalId: payload.messageId || payload.id,
        senderName: payload.senderName,
        messageType: payload.type || 'text',
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType
      }
    );
  }

  private async handleStatusWebhook(payload: any): Promise<void> {
    if (payload.messageId) {
      const { data: messages } = await this.supabase
        .from('messages')
        .select('id')
        .eq('external_id', payload.messageId);

      if (messages && messages.length > 0) {
        await this.updateMessageStatus(messages[0].id, payload.status);
      }
    }
  }

  // =============================================
  // ANALYTICS
  // =============================================

  async getMessagingAnalytics(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data: analytics } = await this.supabase
      .from('messaging_analytics')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    // Aggregate by channel
    const byChannel: Record<string, any> = {};
    const daily: { date: string; conversations: number; messages: number }[] = [];
    const dailyMap: Record<string, { conversations: number; messages: number }> = {};

    for (const row of (analytics || [])) {
      // By channel aggregation
      if (!byChannel[row.channel_type]) {
        byChannel[row.channel_type] = {
          channel_type: row.channel_type,
          conversations: 0,
          inbound: 0,
          outbound: 0,
          avg_response_time: 0,
          count: 0
        };
      }
      byChannel[row.channel_type].conversations += row.conversations_started || 0;
      byChannel[row.channel_type].inbound += row.messages_inbound || 0;
      byChannel[row.channel_type].outbound += row.messages_outbound || 0;
      byChannel[row.channel_type].avg_response_time += row.avg_response_time_seconds || 0;
      byChannel[row.channel_type].count++;

      // Daily aggregation
      const dateStr = row.date;
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { conversations: 0, messages: 0 };
      }
      dailyMap[dateStr].conversations += row.conversations_started || 0;
      dailyMap[dateStr].messages += (row.messages_inbound || 0) + (row.messages_outbound || 0);
    }

    // Calculate averages and format output
    const channelStats = Object.values(byChannel).map((ch: any) => ({
      channel_type: ch.channel_type,
      conversations: ch.conversations,
      inbound: ch.inbound,
      outbound: ch.outbound,
      avg_response_time: ch.count > 0 ? ch.avg_response_time / ch.count : 0
    }));

    for (const [date, stats] of Object.entries(dailyMap)) {
      daily.push({ date, ...stats });
    }
    daily.sort((a, b) => a.date.localeCompare(b.date));

    return {
      byChannel: channelStats,
      daily
    };
  }

  // =============================================
  // HELPERS
  // =============================================

  private async identifyGuestByContact(
    propertyId: string,
    channelType: string,
    contact: string
  ): Promise<{ id: string; currentBookingId?: string } | null> {
    const field = channelType === 'email' ? 'email' : 'phone';
    
    const { data: guests } = await this.supabase
      .from('guests')
      .select('id')
      .eq(field, contact)
      .limit(1);

    if (!guests || guests.length === 0) return null;

    const guestId = guests[0].id;

    // Try to find active booking
    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('id')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('guest_id', guestId)
      .eq('property_id', propertyId)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_in_date', { ascending: false })
      .limit(1);

    return {
      id: guestId,
      currentBookingId: bookings?.[0]?.id
    };
  }

  private encryptApiKey(apiKey: string): string {
    // In production, use proper encryption (e.g., node:crypto with AES)
    return Buffer.from(apiKey).toString('base64');
  }

  private decryptApiKey(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }

  private mapConversation(row: any): Conversation {
    return {
      id: row.id,
      propertyId: row.property_id,
      guestId: row.guest_id,
      bookingId: row.booking_id,
      channelType: row.channel_type,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      messageCount: row.message_count,
      unreadCount: row.unread_count,
      lastMessageAt: row.last_message_at
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      direction: row.direction,
      senderType: row.sender_type,
      senderId: row.sender_id,
      senderName: row.sender_name,
      messageType: row.message_type,
      content: row.content,
      status: row.status,
      createdAt: row.created_at
    };
  }

  private mapTemplate(row: any): MessageTemplate {
    return {
      id: row.id,
      name: row.name,
      channelType: row.channel_type,
      content: row.content,
      variables: row.variables || []
    };
  }
}

export const messagingService = new MessagingService();
