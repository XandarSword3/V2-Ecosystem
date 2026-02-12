// ============================================
// Messaging Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type MessagingChannelType = 'sms' | 'whatsapp' | 'email' | 'in_app' | 'web_chat';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'guest' | 'staff' | 'system' | 'bot';
export type MessageContentType = 'text' | 'image' | 'file' | 'location' | 'template';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ConversationStatus = 'active' | 'resolved' | 'archived';

export interface MessagingChannel extends BaseEntity {
  propertyId: UUID;
  channelType: MessagingChannelType;
  provider: string; // twilio, messagebird, vonage, internal
  accountId?: string;
  apiKeyEncrypted?: string;
  phoneNumber?: string;
  webhookUrl?: string;
  config: Record<string, unknown>;
  dailyLimit?: number;
  monthlyLimit?: number;
  isActive: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
}

export interface Conversation extends BaseEntity {
  propertyId: UUID;
  guestId?: UUID;
  bookingId?: UUID;
  channelType: MessagingChannelType;
  externalId?: string;
  guestIdentifier?: string;
  status: ConversationStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: UUID;
  department?: string;
  startedAt: Date;
  lastMessageAt: Date;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  messageCount: number;
  unreadCount: number;
  responseTimeSeconds?: number;
  subject?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface Message {
  id: UUID;
  conversationId: UUID;
  propertyId: UUID;
  direction: MessageDirection;
  senderType: MessageSenderType;
  senderId?: UUID;
  senderName?: string;
  messageType: MessageContentType;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaSize?: number;
  templateId?: string;
  templateParams?: Record<string, unknown>;
  status: MessageDeliveryStatus;
  externalId?: string;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  isAutomated: boolean;
  aiConfidence?: number;
  requiresHumanReview: boolean;
  createdAt: Date;
}

export interface MessageTemplate extends BaseEntity {
  propertyId: UUID;
  name: string;
  channelType: MessagingChannelType;
  category: string;
  content: string;
  variables: string[];
  isActive: boolean;
}

export interface MessageLog {
  id: UUID;
  propertyId: UUID;
  channelType: MessagingChannelType;
  direction: MessageDirection;
  recipientIdentifier: string;
  templateId?: UUID;
  status: MessageDeliveryStatus;
  errorMessage?: string;
  sentAt: Date;
  deliveredAt?: Date;
  cost?: number;
}

export interface GuestMessagingPreferences {
  id: UUID;
  guestId: UUID;
  propertyId: UUID;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  preferredPhone?: string;
  preferredEmail?: string;
  whatsappPhone?: string;
  preferredChannel: MessagingChannelType;
  preferredLanguage: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  smsConsentDate?: Date;
  whatsappConsentDate?: Date;
  marketingConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}
