import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================================
// MOCK UTILITIES
// ==================================

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown; count?: number }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
    return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// ==================================
// MOCK DATA
// ==================================

const mockChannel = {
  id: 'channel-1',
  property_id: 'prop-1',
  channel_type: 'sms',
  provider: 'twilio',
  api_key_encrypted: 'ZW5jcnlwdGVkLWtleQ==',
  from_number: '+15551234567',
  webhook_url: 'https://example.com/webhook',
  enabled: true,
  chatbot_enabled: false,
  verified: true,
  verified_at: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

const mockGuestPreferences = {
  id: 'pref-1',
  guest_id: 'guest-1',
  property_id: 'prop-1',
  sms_opt_in: true,
  whatsapp_opt_in: true,
  email_opt_in: true,
  push_opt_in: false,
  preferred_channel: 'sms',
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

const mockConversation = {
  id: 'conv-1',
  property_id: 'prop-1',
  guest_id: 'guest-1',
  booking_id: 'booking-1',
  channel_type: 'sms',
  external_contact: '+15559876543',
  subject: 'Booking inquiry',
  status: 'active',
  priority: 'normal',
  assigned_to: null,
  department: null,
  message_count: 5,
  unread_count: 2,
  last_message_at: '2025-01-15T10:30:00Z',
  resolved_at: null,
  resolution_notes: null,
  created_at: '2025-01-15T09:00:00Z',
  updated_at: '2025-01-15T10:30:00Z'
};

const mockMessage = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  direction: 'inbound',
  sender_type: 'guest',
  sender_id: 'guest-1',
  sender_name: 'John Doe',
  message_type: 'text',
  content: 'Hello, I have a question about my booking.',
  template_id: null,
  external_id: 'ext-msg-1',
  media_url: null,
  media_type: null,
  status: 'received',
  delivered_at: null,
  read_at: null,
  created_at: '2025-01-15T10:00:00Z'
};

const mockTemplate = {
  id: 'template-1',
  property_id: 'prop-1',
  name: 'Welcome Message',
  channel_type: 'sms',
  content: 'Welcome {{guest_name}}! Your check-in is on {{check_in_date}}.',
  variables: ['guest_name', 'check_in_date'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

const mockCannedResponse = {
  id: 'canned-1',
  property_id: 'prop-1',
  category: 'greetings',
  shortcut: '/hello',
  content: 'Hello {{guest_name}}, how can I help you today?',
  use_count: 10,
  created_by: 'staff-1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

const mockChatbotContext = {
  conversation_id: 'conv-1',
  state: 'idle',
  current_intent: null,
  slot_values: null,
  fallback_count: 0,
  handoff_requested: false,
  handoff_reason: null,
  last_intent_at: null,
  created_at: '2025-01-15T09:00:00Z',
  updated_at: '2025-01-15T09:00:00Z'
};

const mockChatbotIntent = {
  id: 'intent-1',
  property_id: 'prop-1',
  name: 'check_in_time',
  patterns: ['check in', 'check-in time', 'when can i check in'],
  response_template: 'Check-in time is from {{check_in_time}}. Is there anything else I can help with?',
  requires_handoff: false,
  handoff_reason: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z'
};

const mockAnalytics = {
  id: 'analytics-1',
  property_id: 'prop-1',
  date: '2025-01-15',
  channel_type: 'sms',
  conversations_started: 10,
  messages_inbound: 50,
  messages_outbound: 45,
  avg_response_time_seconds: 300,
  created_at: '2025-01-15T23:59:59Z'
};

const mockGuest = {
  id: 'guest-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '+15559876543'
};

const mockBooking = {
  id: 'booking-1',
  guest_id: 'guest-1',
  property_id: 'prop-1',
  check_in_date: '2025-01-20',
  check_out_date: '2025-01-25',
  status: 'confirmed',
  rooms: {
    room_number: '101',
    room_types: { name: 'Deluxe Suite' }
  }
};

// ==================================
// MOCKS
// ==================================

let mockFromReturns: Record<string, ReturnType<typeof createQueryMock>> = {};

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (mockFromReturns[table]) {
        return mockFromReturns[table];
      }
      return createQueryMock(() => []);
    })
  }))
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid')
}));

import { MessagingService, messagingService } from '../../../../src/modules/messaging/messaging.service';

describe('MessagingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromReturns = {};
  });

  // ==================================
  // INSTANCE TESTS
  // ==================================

  describe('messagingService instance', () => {
    it('should be defined', () => {
      expect(messagingService).toBeDefined();
    });

    it('should be instance of MessagingService', () => {
      expect(messagingService).toBeInstanceOf(MessagingService);
    });
  });

  // ==================================
  // CHANNEL CONFIGURATION
  // ==================================

  describe('configureChannel', () => {
    it('should create a new channel when none exists', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.configureChannel('prop-1', 'sms', {
        provider: 'twilio',
        fromNumber: '+15551234567',
        enabled: true
      });

      expect(result).toBe('generated-uuid');
    });

    it('should update existing channel when it exists', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => [mockChannel]);
      const service = new MessagingService();

      const result = await service.configureChannel('prop-1', 'sms', {
        provider: 'messagebird',
        enabled: false
      });

      expect(result).toBe('channel-1');
    });

    it('should encrypt API key when provided', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.configureChannel('prop-1', 'sms', {
        apiKeyEncrypted: 'my-secret-key'
      });

      expect(result).toBe('generated-uuid');
    });

    it('should handle WhatsApp channel configuration', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.configureChannel('prop-1', 'whatsapp', {
        provider: 'twilio',
        fromNumber: '+15551234567',
        webhookUrl: 'https://example.com/webhook'
      });

      expect(result).toBe('generated-uuid');
    });

    it('should enable chatbot when specified', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.configureChannel('prop-1', 'sms', {
        chatbotEnabled: true
      });

      expect(result).toBe('generated-uuid');
    });
  });

  describe('getChannel', () => {
    it('should return channel when found', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => [mockChannel]);
      const service = new MessagingService();

      const result = await service.getChannel('prop-1', 'sms');

      expect(result).toEqual(mockChannel);
    });

    it('should return null when channel not found', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getChannel('prop-1', 'whatsapp');

      expect(result).toBeNull();
    });
  });

  describe('verifyChannel', () => {
    it('should verify channel successfully', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => [mockChannel]);
      const service = new MessagingService();

      await expect(service.verifyChannel('channel-1')).resolves.toBeUndefined();
    });

    it('should throw error when channel not found', async () => {
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      await expect(service.verifyChannel('nonexistent')).rejects.toThrow('Channel not found');
    });
  });

  // ==================================
  // GUEST PREFERENCES
  // ==================================

  describe('updateGuestPreferences', () => {
    it('should update existing preferences', async () => {
      mockFromReturns['guest_messaging_preferences'] = createQueryMock(() => [mockGuestPreferences]);
      const service = new MessagingService();

      const result = await service.updateGuestPreferences('guest-1', 'prop-1', {
        smsOptIn: false,
        preferredChannel: 'email'
      });

      expect(result).toBeDefined();
    });

    it('should create new preferences when none exist', async () => {
      mockFromReturns['guest_messaging_preferences'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.updateGuestPreferences('guest-1', 'prop-1', {
        smsOptIn: true,
        whatsappOptIn: true,
        preferredChannel: 'sms'
      });

      expect(result).toBeDefined();
    });

    it('should handle quiet hours configuration', async () => {
      mockFromReturns['guest_messaging_preferences'] = createQueryMock(() => [mockGuestPreferences]);
      const service = new MessagingService();

      const result = await service.updateGuestPreferences('guest-1', 'prop-1', {
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00'
      });

      expect(result).toBeDefined();
    });
  });

  describe('getGuestPreferences', () => {
    it('should return preferences when found', async () => {
      mockFromReturns['guest_messaging_preferences'] = createQueryMock(() => [mockGuestPreferences]);
      const service = new MessagingService();

      const result = await service.getGuestPreferences('guest-1', 'prop-1');

      expect(result).toEqual(mockGuestPreferences);
    });

    it('should return null when preferences not found', async () => {
      mockFromReturns['guest_messaging_preferences'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getGuestPreferences('guest-2', 'prop-1');

      expect(result).toBeNull();
    });
  });

  // ==================================
  // CONVERSATIONS
  // ==================================

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.createConversation('prop-1', 'sms', '+15559876543');

      expect(result).toBeDefined();
      expect(result.propertyId).toBe('prop-1');
      expect(result.channelType).toBe('sms');
    });

    it('should create conversation with guest and booking', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.createConversation('prop-1', 'sms', '+15559876543', {
        guestId: 'guest-1',
        bookingId: 'booking-1',
        subject: 'Booking inquiry'
      });

      expect(result).toBeDefined();
      expect(result.guestId).toBe('guest-1');
      expect(result.bookingId).toBe('booking-1');
    });
  });

  describe('getConversation', () => {
    it('should return conversation when found', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getConversation('conv-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('conv-1');
      expect(result?.status).toBe('active');
    });

    it('should return null when conversation not found', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getConversation('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findConversation', () => {
    it('should find conversation by guestId', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.findConversation('prop-1', 'sms', 'guest-1');

      expect(result).toBeDefined();
      expect(result?.guestId).toBe('guest-1');
    });

    it('should find conversation by external contact', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.findConversation('prop-1', 'sms', undefined, '+15559876543');

      expect(result).toBeDefined();
    });

    it('should return null when no matching conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.findConversation('prop-1', 'email', 'guest-999');

      expect(result).toBeNull();
    });
  });

  describe('getPropertyConversations', () => {
    it('should return paginated conversations', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1');

      expect(result.conversations).toBeDefined();
      expect(Array.isArray(result.conversations)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should filter by status', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1', { status: 'active' });

      expect(result.conversations).toBeDefined();
    });

    it('should filter by channel type', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1', { channelType: 'sms' });

      expect(result.conversations).toBeDefined();
    });

    it('should filter by assigned staff', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1', { assignedTo: 'staff-1' });

      expect(result.conversations).toEqual([]);
    });

    it('should filter unread only', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1', { unreadOnly: true });

      expect(result.conversations).toBeDefined();
    });

    it('should handle pagination', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1', {}, 2, 10);

      expect(result.conversations).toEqual([]);
    });
  });

  describe('assignConversation', () => {
    it('should assign conversation to staff', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      await expect(service.assignConversation('conv-1', 'staff-1')).resolves.toBeUndefined();
    });

    it('should assign with department', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      await expect(service.assignConversation('conv-1', 'staff-1', 'Front Desk')).resolves.toBeUndefined();
    });
  });

  describe('updateConversationPriority', () => {
    it('should update conversation priority', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      await expect(service.updateConversationPriority('conv-1', 'high')).resolves.toBeUndefined();
    });
  });

  describe('resolveConversation', () => {
    it('should resolve conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      await expect(service.resolveConversation('conv-1')).resolves.toBeUndefined();
    });

    it('should resolve with resolution notes', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      await expect(service.resolveConversation('conv-1', 'Issue resolved by providing room upgrade')).resolves.toBeUndefined();
    });
  });

  describe('reopenConversation', () => {
    it('should reopen resolved conversation', async () => {
      const resolvedConv = { ...mockConversation, status: 'resolved' };
      mockFromReturns['conversations'] = createQueryMock(() => [resolvedConv]);
      const service = new MessagingService();

      await expect(service.reopenConversation('conv-1')).resolves.toBeUndefined();
    });
  });

  describe('markConversationRead', () => {
    it('should mark conversation as read', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      await expect(service.markConversationRead('conv-1')).resolves.toBeUndefined();
    });
  });

  // ==================================
  // MESSAGES
  // ==================================

  describe('sendMessage', () => {
    it('should send a text message', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, enabled: false }]);
      const service = new MessagingService();

      const result = await service.sendMessage('conv-1', 'Hello!', { type: 'staff', id: 'staff-1', name: 'Agent' });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should throw error for non-existent conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      await expect(
        service.sendMessage('nonexistent', 'Hello!', { type: 'staff' })
      ).rejects.toThrow('Conversation not found');
    });

    it('should send message with template', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, enabled: false }]);
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.sendMessage('conv-1', '', {
        type: 'staff',
        id: 'staff-1'
      }, {
        templateId: 'template-1',
        templateParams: { guest_name: 'John', check_in_date: '2025-01-20' }
      });

      expect(result).toBeDefined();
    });

    it('should send message with media', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, enabled: false }]);
      const service = new MessagingService();

      const result = await service.sendMessage('conv-1', 'Check this out!', {
        type: 'staff'
      }, {
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image/jpeg'
      });

      expect(result).toBeDefined();
    });
  });

  describe('receiveMessage', () => {
    it('should receive and create message in existing conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['guests'] = createQueryMock(() => [mockGuest]);
      mockFromReturns['bookings'] = createQueryMock(() => [mockBooking]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, chatbot_enabled: false }]);
      const service = new MessagingService();

      const result = await service.receiveMessage('prop-1', 'sms', '+15559876543', 'I have a question');

      expect(result).toBeDefined();
      expect(result.direction).toBe('inbound');
    });

    it('should create new conversation for unknown contact', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['guests'] = createQueryMock(() => []);
      mockFromReturns['bookings'] = createQueryMock(() => []);
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();
      
      // Mock the createConversation to return a conversation
      vi.spyOn(service, 'createConversation').mockResolvedValue({
        id: 'new-conv',
        propertyId: 'prop-1',
        channelType: 'sms',
        status: 'active',
        priority: 'normal',
        messageCount: 0,
        unreadCount: 0
      });

      const result = await service.receiveMessage('prop-1', 'sms', '+15551112222', 'Hello');

      expect(result).toBeDefined();
    });

    it('should receive message with media attachment', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['guests'] = createQueryMock(() => [mockGuest]);
      mockFromReturns['bookings'] = createQueryMock(() => [mockBooking]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, chatbot_enabled: false }]);
      const service = new MessagingService();

      const result = await service.receiveMessage('prop-1', 'sms', '+15559876543', 'Check this', {
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image/jpeg'
      });

      expect(result).toBeDefined();
    });
  });

  describe('getConversationMessages', () => {
    it('should return paginated messages', async () => {
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      const result = await service.getConversationMessages('conv-1');

      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should handle pagination parameters', async () => {
      mockFromReturns['messages'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getConversationMessages('conv-1', 2, 25);

      expect(result.messages).toEqual([]);
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message to delivered', async () => {
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      await expect(service.updateMessageStatus('msg-1', 'delivered')).resolves.toBeUndefined();
    });

    it('should update message to read', async () => {
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      await expect(service.updateMessageStatus('msg-1', 'read')).resolves.toBeUndefined();
    });

    it('should update message to failed', async () => {
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      await expect(service.updateMessageStatus('msg-1', 'failed')).resolves.toBeUndefined();
    });
  });

  // ==================================
  // TEMPLATES
  // ==================================

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.createTemplate('prop-1', {
        name: 'Welcome Message',
        channelType: 'sms',
        content: 'Welcome {{guest_name}}!',
        variables: ['guest_name']
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Welcome Message');
    });

    it('should create template without variables', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [{
        ...mockTemplate,
        variables: []
      }]);
      const service = new MessagingService();

      const result = await service.createTemplate('prop-1', {
        name: 'Simple Template',
        channelType: 'sms',
        content: 'Hello!'
      });

      expect(result).toBeDefined();
    });
  });

  describe('getTemplate', () => {
    it('should return template when found', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.getTemplate('template-1');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Welcome Message');
    });

    it('should return null when template not found', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getTemplate('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPropertyTemplates', () => {
    it('should return all templates for property', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.getPropertyTemplates('prop-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter templates by channel type', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.getPropertyTemplates('prop-1', 'sms');

      expect(result).toBeDefined();
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.renderTemplate('template-1', {
        guest_name: 'John Doe',
        check_in_date: 'January 20, 2025'
      });

      expect(result).toBe('Welcome John Doe! Your check-in is on January 20, 2025.');
    });

    it('should throw error for non-existent template', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => []);
      const service = new MessagingService();

      await expect(
        service.renderTemplate('nonexistent', { guest_name: 'John' })
      ).rejects.toThrow('Template not found');
    });
  });

  // ==================================
  // CANNED RESPONSES
  // ==================================

  describe('createCannedResponse', () => {
    it('should create a canned response', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.createCannedResponse('prop-1', {
        category: 'greetings',
        shortcut: '/hello',
        content: 'Hello {{guest_name}}!'
      });

      expect(result).toBe('generated-uuid');
    });

    it('should create canned response with creator', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.createCannedResponse('prop-1', {
        category: 'greetings',
        shortcut: '/hello',
        content: 'Hello!'
      }, 'staff-1');

      expect(result).toBe('generated-uuid');
    });
  });

  describe('getCannedResponses', () => {
    it('should return all canned responses for property', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.getCannedResponses('prop-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by category', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.getCannedResponses('prop-1', 'greetings');

      expect(result).toBeDefined();
    });
  });

  describe('useCannedResponse', () => {
    it('should return canned response content', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.useCannedResponse('canned-1');

      expect(result).toBe('Hello {{guest_name}}, how can I help you today?');
    });

    it('should replace variables in canned response', async () => {
      mockFromReturns['canned_responses'] = createQueryMock(() => [mockCannedResponse]);
      const service = new MessagingService();

      const result = await service.useCannedResponse('canned-1', { guest_name: 'John' });

      expect(result).toBe('Hello John, how can I help you today?');
    });
  });

  // ==================================
  // CHATBOT
  // ==================================

  describe('processChatbotResponse', () => {
    it('should process chatbot response with matching intent', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['chatbot_context'] = createQueryMock(() => [mockChatbotContext]);
      mockFromReturns['chatbot_intents'] = createQueryMock(() => [mockChatbotIntent]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, enabled: false }]);
      mockFromReturns['guests'] = createQueryMock(() => [mockGuest]);
      mockFromReturns['bookings'] = createQueryMock(() => [mockBooking]);
      const service = new MessagingService();

      await expect(service.processChatbotResponse('conv-1', 'when can i check in')).resolves.toBeUndefined();
    });

    it('should handle unrecognized messages', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['chatbot_context'] = createQueryMock(() => [mockChatbotContext]);
      mockFromReturns['chatbot_intents'] = createQueryMock(() => []);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [{ ...mockChannel, enabled: false }]);
      const service = new MessagingService();

      await expect(service.processChatbotResponse('conv-1', 'random gibberish')).resolves.toBeUndefined();
    });

    it('should return early for non-existent conversation', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      await expect(service.processChatbotResponse('nonexistent', 'hello')).resolves.toBeUndefined();
    });
  });

  // ==================================
  // WEBHOOKS
  // ==================================

  describe('processWebhook', () => {
    it('should store webhook event', async () => {
      mockFromReturns['messaging_webhooks'] = createQueryMock(() => []);
      mockFromReturns['messaging_channels'] = createQueryMock(() => []);
      const service = new MessagingService();

      await expect(service.processWebhook('channel-1', 'message.status', {
        messageId: 'ext-1',
        status: 'delivered'
      })).resolves.toBeUndefined();
    });

    it('should handle message.received webhook', async () => {
      mockFromReturns['messaging_webhooks'] = createQueryMock(() => []);
      mockFromReturns['messaging_channels'] = createQueryMock(() => [mockChannel]);
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      mockFromReturns['guests'] = createQueryMock(() => []);
      mockFromReturns['bookings'] = createQueryMock(() => []);
      const service = new MessagingService();
      
      vi.spyOn(service, 'receiveMessage').mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        direction: 'inbound',
        senderType: 'guest',
        messageType: 'text',
        content: 'Hello',
        status: 'received',
        createdAt: new Date()
      });

      await expect(service.processWebhook('channel-1', 'message.received', {
        from: '+15559876543',
        body: 'Hello from webhook'
      })).resolves.toBeUndefined();
    });

    it('should handle message.status webhook', async () => {
      mockFromReturns['messaging_webhooks'] = createQueryMock(() => []);
      mockFromReturns['messages'] = createQueryMock(() => [{ id: 'msg-1' }]);
      const service = new MessagingService();

      await expect(service.processWebhook('channel-1', 'message.status', {
        messageId: 'ext-msg-1',
        status: 'delivered'
      })).resolves.toBeUndefined();
    });
  });

  // ==================================
  // ANALYTICS
  // ==================================

  describe('getMessagingAnalytics', () => {
    it('should return analytics data', async () => {
      mockFromReturns['messaging_analytics'] = createQueryMock(() => [mockAnalytics]);
      const service = new MessagingService();

      const result = await service.getMessagingAnalytics(
        'prop-1',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result).toBeDefined();
      expect(result.byChannel).toBeDefined();
      expect(result.daily).toBeDefined();
    });

    it('should aggregate by channel', async () => {
      const smsAnalytics = { ...mockAnalytics, channel_type: 'sms' };
      const whatsappAnalytics = { ...mockAnalytics, id: 'analytics-2', channel_type: 'whatsapp' };
      mockFromReturns['messaging_analytics'] = createQueryMock(() => [smsAnalytics, whatsappAnalytics]);
      const service = new MessagingService();

      const result = await service.getMessagingAnalytics(
        'prop-1',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result.byChannel.length).toBe(2);
    });

    it('should return empty analytics when no data', async () => {
      mockFromReturns['messaging_analytics'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getMessagingAnalytics(
        'prop-1',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result.byChannel).toEqual([]);
      expect(result.daily).toEqual([]);
    });
  });

  // ==================================
  // EDGE CASES
  // ==================================

  describe('edge cases', () => {
    it('should handle empty conversations list', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getPropertyConversations('prop-1');

      expect(result.conversations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle empty messages list', async () => {
      mockFromReturns['messages'] = createQueryMock(() => []);
      const service = new MessagingService();

      const result = await service.getConversationMessages('conv-1');

      expect(result.messages).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle template with multiple same variables', async () => {
      const multiVarTemplate = {
        ...mockTemplate,
        content: 'Hi {{name}}! Welcome {{name}}, enjoy your stay!'
      };
      mockFromReturns['message_templates'] = createQueryMock(() => [multiVarTemplate]);
      const service = new MessagingService();

      const result = await service.renderTemplate('template-1', { name: 'John' });

      expect(result).toBe('Hi John! Welcome John, enjoy your stay!');
    });
  });

  // ==================================
  // DATA MAPPING VERIFICATION
  // ==================================

  describe('data mapping', () => {
    it('should correctly map conversation data', async () => {
      mockFromReturns['conversations'] = createQueryMock(() => [mockConversation]);
      const service = new MessagingService();

      const result = await service.getConversation('conv-1');

      expect(result).toEqual({
        id: 'conv-1',
        propertyId: 'prop-1',
        guestId: 'guest-1',
        bookingId: 'booking-1',
        channelType: 'sms',
        status: 'active',
        priority: 'normal',
        assignedTo: null,
        messageCount: 5,
        unreadCount: 2,
        lastMessageAt: '2025-01-15T10:30:00Z'
      });
    });

    it('should correctly map message data', async () => {
      mockFromReturns['messages'] = createQueryMock(() => [mockMessage]);
      const service = new MessagingService();

      const result = await service.getConversationMessages('conv-1');

      expect(result.messages[0]).toEqual({
        id: 'msg-1',
        conversationId: 'conv-1',
        direction: 'inbound',
        senderType: 'guest',
        senderId: 'guest-1',
        senderName: 'John Doe',
        messageType: 'text',
        content: 'Hello, I have a question about my booking.',
        status: 'received',
        createdAt: '2025-01-15T10:00:00Z'
      });
    });

    it('should correctly map template data', async () => {
      mockFromReturns['message_templates'] = createQueryMock(() => [mockTemplate]);
      const service = new MessagingService();

      const result = await service.getTemplate('template-1');

      expect(result).toEqual({
        id: 'template-1',
        name: 'Welcome Message',
        channelType: 'sms',
        content: 'Welcome {{guest_name}}! Your check-in is on {{check_in_date}}.',
        variables: ['guest_name', 'check_in_date']
      });
    });
  });
});
