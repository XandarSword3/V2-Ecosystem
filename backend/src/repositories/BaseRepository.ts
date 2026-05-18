import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../database/supabase.js';

export interface FindManyOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

/** Constraint-compatible row type. */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type Row = { [key: string]: unknown };

/**
 * Abstract base repository encapsulating common Supabase CRUD operations.
 * All domain repositories extend this class.
 */
export abstract class BaseRepository<T extends Row> {
  protected baseFilters: Record<string, unknown> = {};

  constructor(protected tableName: string) {}

  /** Returns the lazily-initialized Supabase client. */
  protected getClient(): SupabaseClient {
    return getSupabase();
  }

  /** Helper to get a query with base filters applied. */
  protected getQuery() {
    let query = this.getClient().from(this.tableName).select('*');
    for (const [key, value] of Object.entries(this.baseFilters)) {
      query = query.eq(key, value);
    }
    return query;
  }

  /** Find a single record by its primary key (`id`). */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.getQuery()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`[${this.tableName}] findById failed: ${error.message}`);
    return (data as T) ?? null;
  }

  /**
   * Find many records with optional equality filters, pagination, and ordering.
   */
  async findMany(
    filters?: Record<string, unknown>,
    options?: FindManyOptions,
  ): Promise<T[]> {
    let query = this.getQuery();

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }

    if (options?.offset !== undefined) {
      const limit = options.limit ?? 50;
      query = query.range(options.offset, options.offset + limit - 1);
    } else if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[${this.tableName}] findMany failed: ${error.message}`);
    return (data as T[]) ?? [];
  }

  /** Insert a new record and return the created row. */
  async create(data: Partial<T>): Promise<T> {
    const { data: created, error } = await this.getClient()
      .from(this.tableName)
      .insert(data as Record<string, unknown>)
      .select('*')
      .single();

    if (error) throw new Error(`[${this.tableName}] create failed: ${error.message}`);
    return created as T;
  }

  /** Update a record by `id` and return the updated row. */
  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: updated, error } = await this.getClient()
      .from(this.tableName)
      .update(data as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`[${this.tableName}] update failed: ${error.message}`);
    return updated as T;
  }

  /** Delete a record by `id`. */
  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`[${this.tableName}] delete failed: ${error.message}`);
  }

  /** Return the count of records matching optional equality filters. */
  async count(filters?: Record<string, unknown>): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (this.getQuery() as any).select('*', { count: 'exact', head: true });

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    const { count, error } = await query;
    if (error) throw new Error(`[${this.tableName}] count failed: ${error.message}`);
    return count ?? 0;
  }

  /**
   * Soft-delete a record by setting `deleted_at` to now.
   * Falls back to a hard delete if the table lacks a `deleted_at` column.
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      // Table may not have deleted_at — fall back to hard delete
      await this.delete(id);
    }
  }
}
