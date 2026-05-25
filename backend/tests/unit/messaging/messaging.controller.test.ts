import { createMockReqRes } from '../utils';

// Mock dependencies inline to avoid hoisting issues
vi.mock('../../../src/modules/messaging/messaging.service', () => ({
  messagingService: {
    configureChannel: vi.fn(),
    getChannel: vi.fn(),
    verifyChannel: vi.fn(),
    updateGuestPreferences: vi.fn(),
    getGuestPreferences: vi.fn(),
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    getPropertyConversations: vi.fn(),
    assignConversation: vi.fn(),
    updateConversationPriority: vi.fn(),
    resolveConversation: vi.fn(),
    reopenConversation: vi.fn(),
    markConversationRead: vi.fn(),
    sendMessage: vi.fn(),
    getConversationMessages: vi.fn(),
    getMessagingAnalytics: vi.fn(),
  },
}));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

import { messagingService } from '../../../src/modules/messaging/messaging.service';
import {
  configureChannel,
  getChannel,
  verifyChannel,
  updateGuestPreferences,
  getGuestPreferences,
  createConversation,
  getConversation,
  getPropertyConversations,
  assignConversation,
  updateConversationPriority,
  resolveConversation,
  reopenConversation,
  markConversationRead,
  sendMessage,
  getConversationMessages,
  getMessagingAnalytics,
  submitInquiry,
} from '../../../src/modules/messaging/messaging.controller';
import { getSupabase } from '../../../src/database/connection.js';
import { createChainableMock } from '../utils';

describe('Messaging Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Channel Configuration', () => {
    describe('configureChannel', () => {
      it('should configure a channel successfully', async () => {
        vi.mocked(messagingService.configureChannel).mockResolvedValue('channel-123');

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
          body: {
            channelType: 'whatsapp',
            apiKey: 'key-123',
            phoneNumber: '+1234567890',
          },
        });

        await configureChannel(req, res, next);

        expect(messagingService.configureChannel).toHaveBeenCalledWith(
          'prop-1',
          'whatsapp',
          expect.objectContaining({
            apiKey: 'key-123',
            phoneNumber: '+1234567890',
          })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: { channelId: 'channel-123' },
          message: 'Channel configured',
        });
      });

      it('should call next on error', async () => {
        const error = new Error('Config failed');
        vi.mocked(messagingService.configureChannel).mockRejectedValue(error);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
          body: { channelType: 'sms' },
        });

        await configureChannel(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
      });
    });

    describe('getChannel', () => {
      it('should return channel data', async () => {
        const mockChannel = {
          id: 'channel-1',
          channel_type: 'whatsapp',
          is_active: true,
        };
        vi.mocked(messagingService.getChannel).mockResolvedValue(mockChannel);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1', channelType: 'whatsapp' },
        });

        await getChannel(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockChannel,
        });
      });

      it('should return 404 if channel not found', async () => {
        vi.mocked(messagingService.getChannel).mockResolvedValue(null);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1', channelType: 'telegram' },
        });

        await getChannel(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Channel not found',
        });
      });

      it('should remove sensitive api_key_encrypted from response', async () => {
        const mockChannel = {
          id: 'channel-1',
          channel_type: 'whatsapp',
          api_key_encrypted: 'secret-key',
        };
        vi.mocked(messagingService.getChannel).mockResolvedValue(mockChannel);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1', channelType: 'whatsapp' },
        });

        await getChannel(req, res, next);

        // Verify api_key_encrypted was deleted
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.not.objectContaining({ api_key_encrypted: expect.anything() }),
        });
      });
    });

    describe('verifyChannel', () => {
      it('should verify channel successfully', async () => {
        vi.mocked(messagingService.verifyChannel).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { channelId: 'channel-1' },
        });

        await verifyChannel(req, res, next);

        expect(messagingService.verifyChannel).toHaveBeenCalledWith('channel-1');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Channel verified',
        });
      });
    });
  });

  describe('Guest Preferences', () => {
    describe('updateGuestPreferences', () => {
      it('should update guest preferences', async () => {
        vi.mocked(messagingService.updateGuestPreferences).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { guestId: 'guest-1', propertyId: 'prop-1' },
          body: { preferredChannel: 'whatsapp', quietHoursStart: '22:00' },
        });

        await updateGuestPreferences(req, res, next);

        expect(messagingService.updateGuestPreferences).toHaveBeenCalledWith(
          'guest-1',
          'prop-1',
          { preferredChannel: 'whatsapp', quietHoursStart: '22:00' }
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Preferences updated',
        });
      });
    });

    describe('getGuestPreferences', () => {
      it('should return guest preferences', async () => {
        const mockPrefs = {
          preferred_channel: 'sms',
          quiet_hours_enabled: true,
        };
        vi.mocked(messagingService.getGuestPreferences).mockResolvedValue(mockPrefs);

        const { req, res, next } = createMockReqRes({
          params: { guestId: 'guest-1', propertyId: 'prop-1' },
        });

        await getGuestPreferences(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockPrefs,
        });
      });
    });
  });

  describe('Conversations', () => {
    describe('createConversation', () => {
      it('should create a conversation', async () => {
        const mockConversation = {
          id: 'conv-1',
          channel_type: 'whatsapp',
          status: 'open',
        };
        vi.mocked(messagingService.createConversation).mockResolvedValue(mockConversation);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
          body: {
            channelType: 'whatsapp',
            guestIdentifier: '+1234567890',
            guestId: 'guest-1',
            subject: 'Room service inquiry',
          },
        });

        await createConversation(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockConversation,
          message: 'Conversation created',
        });
      });
    });

    describe('getConversation', () => {
      it('should return conversation', async () => {
        const mockConversation = { id: 'conv-1', status: 'open' };
        vi.mocked(messagingService.getConversation).mockResolvedValue(mockConversation);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
        });

        await getConversation(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockConversation,
        });
      });

      it('should return 404 if not found', async () => {
        vi.mocked(messagingService.getConversation).mockResolvedValue(null);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'nonexistent' },
        });

        await getConversation(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Conversation not found',
        });
      });
    });

    describe('getPropertyConversations', () => {
      it('should return paginated conversations', async () => {
        const mockResult = {
          conversations: [{ id: 'conv-1' }, { id: 'conv-2' }],
          total: 50,
        };
        vi.mocked(messagingService.getPropertyConversations).mockResolvedValue(mockResult);

        const { req, res, next } = createMockReqRes({
          params: { propertyId: 'prop-1' },
          query: { page: '2', limit: '10', status: 'open' },
        });

        await getPropertyConversations(req, res, next);

        expect(messagingService.getPropertyConversations).toHaveBeenCalledWith(
          'prop-1',
          expect.objectContaining({ status: 'open' }),
          2,
          10
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult.conversations,
          total: 50,
          page: 2,
          limit: 10,
        });
      });
    });

    describe('assignConversation', () => {
      it('should assign conversation to staff', async () => {
        vi.mocked(messagingService.assignConversation).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
          body: { staffId: 'staff-1', department: 'concierge' },
        });

        await assignConversation(req, res, next);

        expect(messagingService.assignConversation).toHaveBeenCalledWith(
          'conv-1',
          'staff-1',
          'concierge'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Conversation assigned',
        });
      });
    });

    describe('updateConversationPriority', () => {
      it('should update priority', async () => {
        vi.mocked(messagingService.updateConversationPriority).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
          body: { priority: 'high' },
        });

        await updateConversationPriority(req, res, next);

        expect(messagingService.updateConversationPriority).toHaveBeenCalledWith('conv-1', 'high');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Priority updated',
        });
      });
    });

    describe('resolveConversation', () => {
      it('should resolve conversation', async () => {
        vi.mocked(messagingService.resolveConversation).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
          body: { resolution: 'Issue resolved, guest satisfied' },
        });

        await resolveConversation(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Conversation resolved',
        });
      });
    });

    describe('reopenConversation', () => {
      it('should reopen conversation', async () => {
        vi.mocked(messagingService.reopenConversation).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
        });

        await reopenConversation(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Conversation reopened',
        });
      });
    });

    describe('markConversationRead', () => {
      it('should mark conversation as read', async () => {
        vi.mocked(messagingService.markConversationRead).mockResolvedValue(undefined);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
        });

        await markConversationRead(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: 'Marked as read',
        });
      });
    });
  });

  describe('Messages', () => {
    describe('sendMessage', () => {
      it('should send message successfully', async () => {
        const mockMessage = {
          id: 'msg-1',
          content: 'Hello!',
          sender_type: 'staff',
        };
        vi.mocked(messagingService.sendMessage).mockResolvedValue(mockMessage);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
          body: { content: 'Hello!' },
          user: { id: 'user-1', email: 'staff@hotel.com' },
        });

        await sendMessage(req, res, next);

        expect(messagingService.sendMessage).toHaveBeenCalledWith(
          'conv-1',
          'Hello!',
          { type: 'staff', id: 'user-1', name: 'staff' },
          expect.any(Object)
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockMessage,
          message: 'Message sent',
        });
      });
    });

    describe('getConversationMessages', () => {
      it('should return paginated messages', async () => {
        const mockResult = {
          messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
          total: 100,
        };
        vi.mocked(messagingService.getConversationMessages).mockResolvedValue(mockResult);

        const { req, res, next } = createMockReqRes({
          params: { conversationId: 'conv-1' },
          query: { page: '1', limit: '50' },
        });

        await getConversationMessages(req, res, next);

        expect(messagingService.getConversationMessages).toHaveBeenCalledWith('conv-1', 1, 50);
      });
    });
  });

  describe('Analytics', () => {
    it('should return messaging analytics', async () => {
      const mockAnalytics = { sent: 100, delivered: 95 };
      vi.mocked(messagingService.getMessagingAnalytics).mockResolvedValue(mockAnalytics);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { startDate: '2024-01-01', endDate: '2024-01-31' }
      });

      await getMessagingAnalytics(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAnalytics });
    });
  });

  describe('Public Inquiries', () => {
    it('should submit inquiry successfully', async () => {
      const mockInquiry = { id: 'inq-1' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue(createChainableMock(mockInquiry))
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          subject: 'Question',
          message: 'Hello world'
        }
      });

      await submitInquiry(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockInquiry,
        message: 'Inquiry submitted successfully'
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'John' }
      });

      await submitInquiry(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
