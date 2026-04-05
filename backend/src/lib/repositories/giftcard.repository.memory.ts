/**
 * In-Memory GiftCard Repository
 * Test double for GiftCardRepository using in-memory data structures.
 */

import type {
  GiftCardRepository,
  GiftCard,
  GiftCardTransaction,
} from '../container/types.js';

export class InMemoryGiftCardRepository implements GiftCardRepository {
  private giftCards = new Map<string, GiftCard>();
  private transactions: GiftCardTransaction[] = [];

  reset() {
    this.giftCards.clear();
    this.transactions = [];
  }

  async getById(id: string): Promise<GiftCard | null> {
    return this.giftCards.get(id) ?? null;
  }

  async getByCode(code: string): Promise<GiftCard | null> {
    for (const gc of this.giftCards.values()) {
      if (gc.code === code) return gc;
    }
    return null;
  }

  async create(data: Omit<GiftCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<GiftCard> {
    const id = crypto.randomUUID();
    const giftCard: GiftCard = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.giftCards.set(id, giftCard);
    return giftCard;
  }

  async update(id: string, data: Partial<GiftCard>): Promise<GiftCard> {
    const existing = this.giftCards.get(id);
    if (!existing) throw new Error(`GiftCard ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.giftCards.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.giftCards.delete(id);
  }

  async getByPurchaser(purchaserId: string): Promise<GiftCard[]> {
    return [...this.giftCards.values()].filter(gc => gc.purchasedBy === purchaserId);
  }

  async getByRecipient(recipientEmail: string): Promise<GiftCard[]> {
    return [...this.giftCards.values()].filter(gc => gc.recipientEmail === recipientEmail);
  }

  async getExpiring(beforeDate: string): Promise<GiftCard[]> {
    return [...this.giftCards.values()].filter(
      gc => gc.status === 'active' && gc.expiresAt <= beforeDate
    );
  }

  async logTransaction(data: Omit<GiftCardTransaction, 'id' | 'createdAt'>): Promise<GiftCardTransaction> {
    const tx: GiftCardTransaction = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.transactions.push(tx);
    return tx;
  }

  async getTransactions(giftCardId: string): Promise<GiftCardTransaction[]> {
    return this.transactions.filter(t => t.giftCardId === giftCardId);
  }
}
