/**
 * In-Memory Loyalty Repository
 *
 * Test double implementation for loyalty/rewards operations.
 * Stores data in memory for fast, isolated testing.
 */

import type {
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyFilters,
  LoyaltyRepository,
} from '../container/types';

export class InMemoryLoyaltyRepository implements LoyaltyRepository {
  private accounts: Map<string, LoyaltyAccount> = new Map();
  private transactions: Map<string, LoyaltyTransaction> = new Map();
  private transactionIdCounter = 1;

  // ============================================
  // ACCOUNT OPERATIONS
  // ============================================

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
    return { ...account };
  }

  async getAccountByUserId(userId: string): Promise<LoyaltyAccount | null> {
    for (const account of this.accounts.values()) {
      if (account.userId === userId) {
        return { ...account };
      }
    }
    return null;
  }

  async getAccountById(id: string): Promise<LoyaltyAccount | null> {
    const account = this.accounts.get(id);
    return account ? { ...account } : null;
  }

  async updateAccount(id: string, data: Partial<LoyaltyAccount>): Promise<LoyaltyAccount | null> {
    const existing = this.accounts.get(id);
    if (!existing) return null;

    const updated: LoyaltyAccount = {
      ...existing,
      ...data,
      id, // Ensure ID is not changed
      updatedAt: new Date().toISOString(),
    };
    this.accounts.set(id, updated);
    return { ...updated };
  }

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  async addTransaction(
    transaction: Omit<LoyaltyTransaction, 'id' | 'createdAt'>
  ): Promise<LoyaltyTransaction> {
    const id = `txn-${this.transactionIdCounter++}`;
    const newTransaction: LoyaltyTransaction = {
      ...transaction,
      id,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(id, newTransaction);
    return { ...newTransaction };
  }

  async getTransactions(accountId: string, limit?: number): Promise<LoyaltyTransaction[]> {
    const results: LoyaltyTransaction[] = [];
    for (const txn of this.transactions.values()) {
      if (txn.accountId === accountId) {
        results.push({ ...txn });
      }
    }
    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return limit ? results.slice(0, limit) : results;
  }

  async getExpiringPoints(accountId: string, beforeDate: string): Promise<LoyaltyTransaction[]> {
    const results: LoyaltyTransaction[] = [];
    for (const txn of this.transactions.values()) {
      if (
        txn.accountId === accountId &&
        txn.type === 'earn' &&
        txn.expiresAt &&
        txn.expiresAt <= beforeDate
      ) {
        results.push({ ...txn });
      }
    }
    return results;
  }

  async listAccounts(filters?: LoyaltyFilters): Promise<LoyaltyAccount[]> {
    let results = Array.from(this.accounts.values());

    if (filters?.userId) {
      results = results.filter((a) => a.userId === filters.userId);
    }

    if (filters?.tier) {
      results = results.filter((a) => a.tier === filters.tier);
    }

    if (filters?.minPoints !== undefined) {
      results = results.filter((a) => a.totalPoints >= filters.minPoints!);
    }

    return results.map((a) => ({ ...a }));
  }

  // ============================================
  // TEST HELPERS
  // ============================================

  addAccount(account: LoyaltyAccount): void {
    this.accounts.set(account.id, { ...account });
  }

  addTestTransaction(transaction: LoyaltyTransaction): void {
    this.transactions.set(transaction.id, { ...transaction });
  }

  clear(): void {
    this.accounts.clear();
    this.transactions.clear();
    this.transactionIdCounter = 1;
  }

  getAll(): LoyaltyAccount[] {
    return Array.from(this.accounts.values()).map((a) => ({ ...a }));
  }

  getAllTransactions(): LoyaltyTransaction[] {
    return Array.from(this.transactions.values()).map((t) => ({ ...t }));
  }
}
