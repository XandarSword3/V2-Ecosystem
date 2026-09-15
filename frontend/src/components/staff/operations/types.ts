/**
 * Canonical types for the Staff Operations Surface (Plan F8).
 *
 * Defines domain representations for Work Items, Queues, Contexts,
 * and Operational Exceptions across all fulfillment modes.
 */

import type { FulfillmentMode, FulfillmentState } from '@/lib/engine-a/types';
import type { ItemStatus } from '../types';

export type WorkItemPriority = 'normal' | 'rush' | 'vip';

export interface WorkItemLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  status?: ItemStatus;
  modifiers?: string[];
  specialInstructions?: string;
}

export interface WorkItemData {
  id: string;
  orderNumber: string;
  status: string; // Transaction layer: pending, confirmed, completed, cancelled
  fulfillmentStatus?: FulfillmentState | string | null; // Canonical fulfillment layer
  fulfillmentMode: FulfillmentMode;
  priority?: WorkItemPriority;
  createdAt: string;
  totalAmount?: number;
  currency?: string;

  // Customer Context
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  loyaltyTier?: string;
  isVip?: boolean;

  // Location / Destination Context
  tableNumber?: string | number;
  tableName?: string;
  roomNumber?: string;
  destinationType?: string | null;
  destinationRef?: string | null;
  deliveryAddress?: string | null;
  driverName?: string | null;
  trackingNumber?: string | null;

  // Content
  items: WorkItemLineItem[];
  notes?: string;
  estimatedReadyTime?: string;
  staffName?: string;
}

export interface WorkQueueColumn {
  state: FulfillmentState | string;
  label: string;
  actionLabel: string | null;
  bgClass: string;
  borderClass: string;
  textClass: string;
  actionBgClass?: string;
  terminal: boolean;
  items: WorkItemData[];
}

export type ExceptionActionType =
  | 'rush_priority'
  | 'normal_priority'
  | 'cancel_void'
  | 'extend_eta'
  | 'reassign_staff'
  | 'print_ticket';
