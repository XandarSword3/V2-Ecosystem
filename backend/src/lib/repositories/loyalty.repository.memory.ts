/**
 * In-Memory Loyalty Repository
 * Test double for LoyaltyRepository using in-memory data structures.
 */

import type {
  LoyaltyRepository,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyFilters,
} from '../container/types.js';

export class InMemoryLoyaltyRepository implements LoyaltyRepository {
  private accounts = new Map<string, LoyaltyAccount>();
  private transactions: LoyaltyTransaction[] = [];

  /** Test helper: directly insert an account */
  addAccount(account: LoyaltyAccount): void {
    this.accounts.set(account.id, account);
  }

  /** Test helper: directly insert a transaction */
  addTestTransaction(tx: LoyaltyTransaction): void {
    this.transactions.push(tx);
  }

  reset() {
    this.accounts.clear();
    this.transactions = [];
  }

  async createAccount(userId: string): Promise<LoyaltyAccount> {
    const id = crypto.randomUUID();
    const account: LoyaltyAccount = {
      id,
      userId,
      totalPoints: 0,
      availablePoints: 0,
      lifetimePoints: 0,
      tier: 'bronze',
      tierExpiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.accounts.set(id, account);
    return account;
  }

  async getAccountByUserId(userId: string): Promise<LoyaltyAccount | null> {
    for (const a of this.accounts.values()) {
      if (a.userId === userId) return a;
    }
    return null;
  }

  async getAccountById(id: string): Promise<LoyaltyAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  async updateAccount(id: string, data: Partial<LoyaltyAccount>): Promise<LoyaltyAccount | null> {
    const existing = this.accounts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.accounts.set(id, updated);
    return updated;
  }

  async addTransaction(data: Omit<LoyaltyTransaction, 'id' | 'createdAt'>): Promise<LoyaltyTransaction> {
    const tx: LoyaltyTransaction = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.transactions.push(tx);
    return tx;
  }

  async getTransactions(accountId: string, limit?: number): Promise<LoyaltyTransaction[]> {
    let result = this.transactions.filter(t => t.accountId === accountId);
    if (limit) result = result.slice(-limit);
    return result;
  }

  async getExpiringPoints(accountId: string, beforeDate: string): Promise<LoyaltyTransaction[]> {
    return this.transactions.filter(
      t => t.accountId === accountId && t.expiresAt && t.expiresAt <= beforeDate
    );
  }

  async listAccounts(filters?: LoyaltyFilters): Promise<LoyaltyAccount[]> {
    let result = [...this.accounts.values()];
    if (filters?.userId) result = result.filter(a => a.userId === filters.userId);
    if (filters?.tier) result = result.filter(a => a.tier === filters.tier);
    if (filters?.minPoints !== undefined) result = result.filter(a => a.availablePoints >= filters.minPoints!);
    return result;
  }

  async adjustPointsAtomic(id: string, points: number): Promise<LoyaltyAccount> {
    const existing = this.accounts.get(id);
    if (!existing) throw new Error(`Account ${id} not found`);
    const updated = {
      ...existing,
      availablePoints: existing.availablePoints + points,
      totalPoints: existing.totalPoints + (points > 0 ? points : 0),
      lifetimePoints: existing.lifetimePoints + (points > 0 ? points : 0),
      updatedAt: new Date().toISOString(),
    };
    this.accounts.set(id, updated);
    return updated;
  }
}
