/**
 * In-Memory Gift Card Repository
 * 
 * Test double implementation for gift card operations.
 */

import { randomUUID } from 'crypto';
import type { 
  GiftCardRepository, 
  GiftCard, 
  GiftCardTransaction 
} from '../container/types';

export class InMemoryGiftCardRepository implements GiftCardRepository {
  private giftCards: Map<string, GiftCard> = new Map();
  private transactions: Map<string, GiftCardTransaction> = new Map();

  async getById(id: string): Promise<GiftCard | null> {
    return this.giftCards.get(id) || null;
  }

  async getByCode(code: string): Promise<GiftCard | null> {
    const cards = Array.from(this.giftCards.values());
    return cards.find(c => c.code === code.toUpperCase()) || null;
  }

  async create(data: Omit<GiftCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<GiftCard> {
    const giftCard: GiftCard = {
      ...data,
      code: data.code.toUpperCase(),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.giftCards.set(giftCard.id, giftCard);
    return giftCard;
  }

  async update(id: string, data: Partial<GiftCard>): Promise<GiftCard> {
    const existing = this.giftCards.get(id);
    if (!existing) throw new Error('Gift card not found');
    
    const updated: GiftCard = {
      ...existing,
      ...data,
      id: existing.id,
      code: existing.code,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.giftCards.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.giftCards.delete(id);
  }

  async getByPurchaser(purchaserId: string): Promise<GiftCard[]> {
    return Array.from(this.giftCards.values())
      .filter(c => c.purchasedBy === purchaserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getByRecipient(recipientEmail: string): Promise<GiftCard[]> {
    return Array.from(this.giftCards.values())
      .filter(c => c.recipientEmail?.toLowerCase() === recipientEmail.toLowerCase())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExpiring(beforeDate: string): Promise<GiftCard[]> {
    const before = new Date(beforeDate).getTime();
    return Array.from(this.giftCards.values())
      .filter(c => c.status === 'active' && new Date(c.expiresAt).getTime() <= before)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }

  async logTransaction(data: Omit<GiftCardTransaction, 'id' | 'createdAt'>): Promise<GiftCardTransaction> {
    const transaction: GiftCardTransaction = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async getTransactions(giftCardId: string): Promise<GiftCardTransaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.giftCardId === giftCardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Test utility method
  clear(): void {
    this.giftCards.clear();
    this.transactions.clear();
  }
}
