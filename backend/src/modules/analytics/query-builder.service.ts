/**
 * Advanced Query Builder Service
 * Phase 2 Upgrade: Self-service analytics with drag-and-drop interface support
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export type FilterOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'like' | 'nlike' | 'is_null' | 'is_not_null'
  | 'between' | 'date_in' | 'date_before' | 'date_after';

export type LogicalOperator = 'AND' | 'OR';

export type AggregateFunction = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
  valueTo?: unknown; // For between operator
}

export interface FilterGroup {
  operator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
}

export interface GroupByConfig {
  field: string;
  alias?: string;
  sort?: 'asc' | 'desc';
}

export interface AggregateConfig {
  function: AggregateFunction;
  field: string;
  alias: string;
  format?: 'number' | 'currency' | 'percent' | 'duration';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryConfig {
  table: string;
  fields?: string[];
  filters?: FilterGroup;
  groupBy?: GroupByConfig[];
  aggregates?: AggregateConfig[];
  sort?: SortConfig[];
  limit?: number;
  offset?: number;
  dateRange?: {
    field: string;
    from: Date;
    to: Date;
  };
}

export interface DrillDownConfig {
  baseQuery: QueryConfig;
  drillPaths: DrillPath[];
}

export interface DrillPath {
  name: string;
  field: string;
  filterValue: unknown;
  childQuery?: QueryConfig;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  metadata: {
    totalCount: number;
    executionTimeMs: number;
    appliedFilters: FilterGroup;
    groupByApplied: boolean;
    aggregatesApplied: boolean;
  };
  drillDown?: {
    available: boolean;
    paths: DrillPath[];
  };
}

export interface SavedQuery {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  category?: string;
  queryConfig: QueryConfig;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
}

export class QueryBuilderService {
  private supabase = getSupabase();

  // =============================================
  // QUERY EXECUTION
  // =============================================

  async executeQuery(propertyId: string, config: QueryConfig): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Build base query
      let query = this.buildBaseQuery(propertyId, config);

      // Apply filters
      if (config.filters) {
        query = this.applyFilterGroup(query, config.filters);
      }

      // Apply date range
      if (config.dateRange) {
        query = query
          .gte(config.dateRange.field, config.dateRange.from.toISOString())
          .lte(config.dateRange.field, config.dateRange.to.toISOString());
      }

      // Apply grouping and aggregates
      const selectString = this.buildSelectString(config);
      if (selectString) {
        query = this.supabase.from(config.table).select(selectString, { count: 'exact' });
        query = query.eq('property_id', propertyId);

        // Re-apply filters after changing select
        if (config.filters) {
          query = this.applyFilterGroup(query, config.filters);
        }
        if (config.dateRange) {
          query = query
            .gte(config.dateRange.field, config.dateRange.from.toISOString())
            .lte(config.dateRange.field, config.dateRange.to.toISOString());
        }
      }

      // Apply sorting
      if (config.sort && config.sort.length > 0) {
        for (const sort of config.sort) {
          query = query.order(sort.field, { ascending: sort.direction === 'asc' });
        }
      }

      // Apply pagination
      if (config.limit) {
        query = query.limit(config.limit);
      }
      if (config.offset) {
        const limit = config.limit || 100;
        query = query.range(config.offset, config.offset + limit - 1);
      }

      // Execute query
      const { data, error, count } = await query;

      if (error) throw error;

      const executionTime = Date.now() - startTime;

      return {
        data: (data || []) as any,
        metadata: {
          totalCount: count || 0,
          executionTimeMs: executionTime,
          appliedFilters: config.filters || { operator: 'AND' as const, conditions: [] },
          groupByApplied: !!config.groupBy && config.groupBy.length > 0,
          aggregatesApplied: !!config.aggregates && config.aggregates.length > 0
        },
        drillDown: this.generateDrillDownOptions(config, (data || []) as any)
      };
    } catch (error) {
      logger.error('Query execution failed:', error);
      throw error;
    }
  }

  private buildBaseQuery(propertyId: string, config: QueryConfig) {
    return this.supabase
      .from(config.table)
      .select(config.fields?.join(',') || '*', { count: 'exact' })
      .eq('property_id', propertyId);
  }

  private buildSelectString(config: QueryConfig): string | null {
    if (!config.groupBy && !config.aggregates) return null;

    const parts: string[] = [];

    // Add group by fields
    if (config.groupBy) {
      for (const gb of config.groupBy) {
        parts.push(gb.field);
      }
    }

    // Add regular fields (only if not grouping)
    if (!config.groupBy && config.fields) {
      parts.push(...config.fields);
    }

    // Add aggregates
    if (config.aggregates) {
      for (const agg of config.aggregates) {
        const alias = agg.alias || `${agg.function}_${agg.field}`;
        parts.push(`${agg.function}:${agg.field}.${alias}`);
      }
    }

    return parts.join(',');
  }

  private applyFilterGroup(query: any, group: FilterGroup): any {
    // Supabase doesn't support complex AND/OR nesting directly
    // For complex filters, we need to build a raw query or use RPC
    // This is a simplified implementation

    const filterString = this.buildFilterString(group);
    if (filterString) {
      // Use the filter string in a raw query or RPC
      // For now, apply simple filters at top level
      for (const condition of this.flattenConditions(group)) {
        query = this.applySimpleFilter(query, condition);
      }
    }

    return query;
  }

  private flattenConditions(group: FilterGroup): FilterCondition[] {
    const conditions: FilterCondition[] = [];

    for (const item of group.conditions) {
      if ('conditions' in item) {
        // It's a nested group
        conditions.push(...this.flattenConditions(item as FilterGroup));
      } else {
        conditions.push(item as FilterCondition);
      }
    }

    return conditions;
  }

  private applySimpleFilter(query: any, condition: FilterCondition): any {
    switch (condition.operator) {
      case 'eq':
        return query.eq(condition.field, condition.value);
      case 'neq':
        return query.neq(condition.field, condition.value);
      case 'gt':
        return query.gt(condition.field, condition.value);
      case 'gte':
        return query.gte(condition.field, condition.value);
      case 'lt':
        return query.lt(condition.field, condition.value);
      case 'lte':
        return query.lte(condition.field, condition.value);
      case 'in':
        return query.in(condition.field, condition.value as unknown[]);
      case 'nin':
        return query.not('in', condition.field, condition.value as unknown[]);
      case 'like':
        return query.ilike(condition.field, `%${condition.value}%`);
      case 'nlike':
        return query.not('ilike', condition.field, `%${condition.value}%`);
      case 'is_null':
        return query.is(condition.field, null);
      case 'is_not_null':
        return query.not('is', condition.field, null);
      case 'between':
        return query
          .gte(condition.field, condition.value)
          .lte(condition.field, condition.valueTo);
      case 'date_before':
        return query.lt(condition.field, condition.value);
      case 'date_after':
        return query.gt(condition.field, condition.value);
      default:
        return query;
    }
  }

  private buildFilterString(group: FilterGroup): string {
    // Build SQL-like filter string for complex cases
    // This would be used with a custom RPC function
    const parts: string[] = [];

    for (const item of group.conditions) {
      if ('conditions' in item) {
        const nested = this.buildFilterString(item as FilterGroup);
        if (nested) parts.push(`(${nested})`);
      } else {
        const cond = this.buildConditionString(item as FilterCondition);
        if (cond) parts.push(cond);
      }
    }

    return parts.join(` ${group.operator} `);
  }

  private buildConditionString(condition: FilterCondition): string | null {
    const { field, operator, value, valueTo } = condition;

    switch (operator) {
      case 'eq': return `${field} = ${this.quoteValue(value)}`;
      case 'neq': return `${field} != ${this.quoteValue(value)}`;
      case 'gt': return `${field} > ${this.quoteValue(value)}`;
      case 'gte': return `${field} >= ${this.quoteValue(value)}`;
      case 'lt': return `${field} < ${this.quoteValue(value)}`;
      case 'lte': return `${field} <= ${this.quoteValue(value)}`;
      case 'in': return `${field} IN (${(value as unknown[]).map(v => this.quoteValue(v)).join(',')})`;
      case 'like': return `${field} ILIKE '%${value}%'`;
      case 'is_null': return `${field} IS NULL`;
      case 'is_not_null': return `${field} IS NOT NULL`;
      case 'between': return `${field} BETWEEN ${this.quoteValue(value)} AND ${this.quoteValue(valueTo)}`;
      default: return null;
    }
  }

  private quoteValue(value: unknown): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'number') return value.toString();
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return String(value);
  }

  // =============================================
  // DRILL-DOWN
  // =============================================

  private generateDrillDownOptions(config: QueryConfig, data: Record<string, unknown>[]): {
    available: boolean;
    paths: DrillPath[];
  } {
    if (!config.groupBy || config.groupBy.length === 0) {
      return { available: false, paths: [] };
    }

    // Generate drill-down paths based on grouped data
    const paths: DrillPath[] = [];
    const groupField = config.groupBy[0].field;

    for (const row of data.slice(0, 10)) { // Limit to top 10 for drill options
      const value = row[groupField];
      if (value !== null && value !== undefined) {
        paths.push({
          name: `Drill into ${groupField} = ${value}`,
          field: groupField,
          filterValue: value,
          childQuery: {
            table: config.table,
            filters: {
              operator: 'AND',
              conditions: [{
                field: groupField,
                operator: 'eq',
                value
              }]
            }
          }
        });
      }
    }

    return {
      available: paths.length > 0,
      paths
    };
  }

  async drillDown(
    propertyId: string,
    parentConfig: QueryConfig,
    drillPath: DrillPath
  ): Promise<QueryResult> {
    const childConfig: QueryConfig = drillPath.childQuery || {
      table: parentConfig.table,
      fields: parentConfig.fields,
      filters: {
        operator: 'AND',
        conditions: [{
          field: drillPath.field,
          operator: 'eq',
          value: drillPath.filterValue
        }]
      }
    };

    // Merge with parent filters if exists
    if (parentConfig.filters) {
      childConfig.filters = {
        operator: 'AND',
        conditions: [
          parentConfig.filters,
          childConfig.filters!
        ]
      };
    }

    return this.executeQuery(propertyId, childConfig);
  }

  // =============================================
  // SAVED QUERIES
  // =============================================

  async saveQuery(
    propertyId: string,
    userId: string,
    data: Omit<SavedQuery, 'id' | 'createdAt' | 'createdBy' | 'executionCount'>
  ): Promise<SavedQuery> {
    const id = uuidv4();

    const { data: saved, error } = await this.supabase
      .from('saved_queries')
      .insert({
        id,
        property_id: propertyId,
        name: data.name,
        description: data.description,
        category: data.category,
        query_config: data.queryConfig,
        is_public: data.isPublic,
        created_by: userId,
        created_at: new Date().toISOString(),
        execution_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapSavedQueryFromDb(saved);
  }

  async getSavedQueries(
    propertyId: string,
    options?: { userId?: string; category?: string; publicOnly?: boolean }
  ): Promise<SavedQuery[]> {
    let query = this.supabase
      .from('saved_queries')
      .select('*')
      .eq('property_id', propertyId);

    if (options?.publicOnly) {
      query = query.eq('is_public', true);
    } else if (options?.userId) {
      query = query.or(`created_by.eq.${options.userId},is_public.eq.true`);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapSavedQueryFromDb);
  }

  async executeSavedQuery(propertyId: string, queryId: string): Promise<QueryResult> {
    const { data: saved, error } = await this.supabase
      .from('saved_queries')
      .select('*')
      .eq('id', queryId)
      .single();

    if (error) throw error;

    // Increment execution count
    await this.supabase
      .from('saved_queries')
      .update({
        execution_count: (saved.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString()
      })
      .eq('id', queryId);

    return this.executeQuery(propertyId, saved.query_config as QueryConfig);
  }

  // =============================================
  // QUERY SUGGESTIONS
  // =============================================

  async getQuerySuggestions(propertyId: string, table: string): Promise<{
    fields: { name: string; type: string; sampleValues: unknown[] }[];
    commonFilters: { field: string; operator: string; description: string }[];
    suggestedGroupings: { field: string; description: string }[];
  }> {
    // Get field information from the table
    const { data: sample, error } = await this.supabase
      .from(table)
      .select('*')
      .eq('property_id', propertyId)
      .limit(1);

    if (error || !sample || sample.length === 0) {
      return { fields: [], commonFilters: [], suggestedGroupings: [] };
    }

    const row = sample[0];
    const fields = Object.keys(row).map(key => ({
      name: key,
      type: typeof row[key],
      sampleValues: [row[key]]
    }));

    // Suggest common filters based on table type
    const commonFilters = this.getCommonFiltersForTable(table);
    const suggestedGroupings = this.getSuggestedGroupingsForTable(table);

    return { fields, commonFilters, suggestedGroupings };
  }

  private getCommonFiltersForTable(table: string): { field: string; operator: string; description: string }[] {
    const commonByTable: Record<string, { field: string; operator: string; description: string }[]> = {
      bookings: [
        { field: 'status', operator: 'eq', description: 'Filter by booking status' },
        { field: 'check_in', operator: 'date_after', description: 'Check-in after date' },
        { field: 'check_out', operator: 'date_before', description: 'Check-out before date' },
        { field: 'source', operator: 'eq', description: 'Booking source/channel' }
      ],
      orders: [
        { field: 'status', operator: 'eq', description: 'Order status' },
        { field: 'created_at', operator: 'date_after', description: 'Orders after date' },
        { field: 'total_amount', operator: 'gte', description: 'Minimum order value' }
      ],
      rooms: [
        { field: 'room_type_id', operator: 'eq', description: 'Room type' },
        { field: 'is_active', operator: 'eq', description: 'Active rooms only' },
        { field: 'floor', operator: 'eq', description: 'Floor number' }
      ]
    };

    return commonByTable[table] || [];
  }

  private getSuggestedGroupingsForTable(table: string): { field: string; description: string }[] {
    const groupingsByTable: Record<string, { field: string; description: string }[]> = {
      bookings: [
        { field: 'status', description: 'Group by booking status' },
        { field: 'source', description: 'Group by booking source' },
        { field: 'room_type_id', description: 'Group by room type' },
        { field: 'DATE(created_at)', description: 'Group by booking date' }
      ],
      orders: [
        { field: 'status', description: 'Group by order status' },
        { field: 'DATE(created_at)', description: 'Group by order date' },
        { field: 'staff_id', description: 'Group by staff member' }
      ],
      rooms: [
        { field: 'room_type_id', description: 'Group by room type' },
        { field: 'floor', description: 'Group by floor' },
        { field: 'status', description: 'Group by room status' }
      ]
    };

    return groupingsByTable[table] || [];
  }

  private mapSavedQueryFromDb(db: any): SavedQuery {
    return {
      id: db.id,
      propertyId: db.property_id,
      name: db.name,
      description: db.description,
      category: db.category,
      queryConfig: db.query_config,
      isPublic: db.is_public,
      createdBy: db.created_by,
      createdAt: new Date(db.created_at),
      lastExecutedAt: db.last_executed_at ? new Date(db.last_executed_at) : undefined,
      executionCount: db.execution_count || 0
    };
  }
}

export const queryBuilderService = new QueryBuilderService();
