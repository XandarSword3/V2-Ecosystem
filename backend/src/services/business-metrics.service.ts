/**
 * V2 Ecosystem - Business Metrics Service
 * Tracks and exposes business-level KPIs and metrics
 */

import { supabase } from "../lib/supabase.js";
import { getRedis } from "../config/session-store.js";

export interface BookingMetrics {
  total_bookings: number;
  confirmed_bookings: number;
  pending_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  average_booking_value: number;
  occupancy_rate: number;
  bookings_by_room_type: Record<string, number>;
  bookings_by_source: Record<string, number>;
}

export interface RevenueMetrics {
  total_revenue: number;
  revenue_by_engine: Record<string, number>;
  revenue_by_day: Array<{ date: string; amount: number }>;
  average_transaction_value: number;
  refunds_total: number;
}

export interface UserMetrics {
  total_users: number;
  active_users_24h: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_today: number;
  new_users_week: number;
  users_by_role: Record<string, number>;
  retention_rate: number;
}

export interface OperationalMetrics {
  transactions_today: number;
  transactions_pending: number;
  transactions_completed: number;
  transactions_by_engine: Record<string, number>;
  staff_online: number;
  active_sessions: number;
}

export interface PerformanceMetrics {
  api_response_time_p50: number;
  api_response_time_p95: number;
  api_response_time_p99: number;
  error_rate: number;
  uptime_percentage: number;
  database_connections: number;
  cache_hit_rate: number;
}

class BusinessMetricsService {
  private cachePrefix = 'metrics:';
  private cacheTTL = 900; // 15 minutes (increased from 5 to reduce Redis reads)

  /**
   * Get all dashboard metrics
   * @param bypassCache - Skip Redis cache and fetch fresh data from database
   */
  async getDashboardMetrics(bypassCache = false): Promise<{
    bookings: BookingMetrics;
    revenue: RevenueMetrics;
    users: UserMetrics;
    operational: OperationalMetrics;
    timestamp: string;
  }> {
    const [bookings, revenue, users, operational] = await Promise.all([
      this.getBookingMetrics('month', bypassCache),
      this.getRevenueMetrics('month', bypassCache),
      this.getUserMetrics(bypassCache),
      this.getOperationalMetrics(bypassCache),
    ]);

    return {
      bookings,
      revenue,
      users,
      operational,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get booking metrics
   * @param bypassCache - Skip Redis cache and fetch fresh data from database
   */
  async getBookingMetrics(period: 'day' | 'week' | 'month' = 'month', bypassCache = false): Promise<BookingMetrics> {
    if (!bypassCache) {
      const cached = await this.getCached<BookingMetrics>(`bookings:${period}`);
      if (cached) return cached;
    }

    const periodStart = this.getPeriodStart(period);

    // Get booking counts
    const { data: bookings } = await supabase
      .from('transactions')
      .select('status, amount, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .gte('created_at', periodStart);

    const metrics: BookingMetrics = {
      total_bookings: bookings?.length || 0,
      confirmed_bookings: bookings?.filter((b: any) => b.status === 'confirmed').length || 0,
      pending_bookings: bookings?.filter((b: any) => b.status === 'pending').length || 0,
      cancelled_bookings: bookings?.filter((b: any) => b.status === 'cancelled').length || 0,
      total_revenue: bookings?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0,
      average_booking_value: 0,
      occupancy_rate: 0,
      bookings_by_room_type: {},
      bookings_by_source: {},
    };

    // Calculate averages
    const confirmedBookings = bookings?.filter((b: any) => b.status === 'confirmed') || [];
    if (confirmedBookings.length > 0) {
      metrics.average_booking_value =
        metrics.total_revenue / confirmedBookings.length;
    }

    // Group by room type
    for (const booking of bookings || []) {
      const meta = booking.metadata || {};
      if (meta.room_type) {
        metrics.bookings_by_room_type[meta.room_type] =
          (metrics.bookings_by_room_type[meta.room_type] || 0) + 1;
      }
      if (meta.source) {
        metrics.bookings_by_source[meta.source] =
          (metrics.bookings_by_source[meta.source] || 0) + 1;
      }
    }

    // Calculate occupancy rate (would need room availability data)
    // This is a simplified calculation
    const totalRooms = 50; // Assumed total rooms
    const daysInPeriod = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const bookedRoomNights = metrics.confirmed_bookings; // Simplified
    metrics.occupancy_rate = (bookedRoomNights / (totalRooms * daysInPeriod)) * 100;

    await this.setCache(`bookings:${period}`, metrics);
    return metrics;
  }

  /**
   * Get revenue metrics
   * @param bypassCache - Skip Redis cache and fetch fresh data from database
   */
  async getRevenueMetrics(period: 'day' | 'week' | 'month' = 'month', bypassCache = false): Promise<RevenueMetrics> {
    if (!bypassCache) {
      const cached = await this.getCached<RevenueMetrics>(`revenue:${period}`);
      if (cached) return cached;
    }

    const periodStart = this.getPeriodStart(period);

    // Get transactions from unified table
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, engine_type, created_at, status')
      .gte('created_at', periodStart);

    const metrics: RevenueMetrics = {
      total_revenue: 0,
      revenue_by_engine: {},
      revenue_by_day: [],
      average_transaction_value: 0,
      refunds_total: 0,
    };

    const revenueByDate = new Map<string, number>();

    for (const tx of transactions || []) {
      if (tx.amount > 0 && !['cancelled', 'refunded'].includes(tx.status)) {
        metrics.total_revenue += tx.amount;

        // Categorize by engine_type
        const engine = tx.engine_type || 'other';
        metrics.revenue_by_engine[engine] =
          (metrics.revenue_by_engine[engine] || 0) + tx.amount;

        // Group by date
        const date = tx.created_at.split('T')[0];
        revenueByDate.set(date, (revenueByDate.get(date) || 0) + tx.amount);
      } else if (['cancelled', 'refunded'].includes(tx.status)) {
        metrics.refunds_total += Math.abs(tx.amount);
      }
    }

    // Convert date map to array
    metrics.revenue_by_day = Array.from(revenueByDate.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate average
    const positiveTransactions = transactions?.filter((t: any) => t.amount > 0 && !['cancelled', 'refunded'].includes(t.status)) || [];
    if (positiveTransactions.length > 0) {
      metrics.average_transaction_value =
        metrics.total_revenue / positiveTransactions.length;
    }

    await this.setCache(`revenue:${period}`, metrics);
    return metrics;
  }

  /**
   * Get user metrics
   * @param bypassCache - Skip Redis cache and fetch fresh data from database
   */
  async getUserMetrics(bypassCache = false): Promise<UserMetrics> {
    if (!bypassCache) {
      const cached = await this.getCached<UserMetrics>('users');
      if (cached) return cached;
    }

    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get user counts
    const [totalResult, active24h, active7d, active30d, newToday, newWeek, roleData] =
      await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('last_active', day1),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('last_active', day7),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('last_active', day30),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', day1),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', day7),
        supabase.from('users').select('role'),
      ]);

    const metrics: UserMetrics = {
      total_users: totalResult.count || 0,
      active_users_24h: active24h.count || 0,
      active_users_7d: active7d.count || 0,
      active_users_30d: active30d.count || 0,
      new_users_today: newToday.count || 0,
      new_users_week: newWeek.count || 0,
      users_by_role: {},
      retention_rate: 0,
    };

    // Group by role
    for (const user of roleData.data || []) {
      const role = user.role || 'guest';
      metrics.users_by_role[role] = (metrics.users_by_role[role] || 0) + 1;
    }

    // Calculate retention (simplified: active in 7d / active in 30d)
    if (metrics.active_users_30d > 0) {
      metrics.retention_rate =
        (metrics.active_users_7d / metrics.active_users_30d) * 100;
    }

    await this.setCache('users', metrics);
    return metrics;
  }

  /**
   * Get operational metrics
   * @param bypassCache - Skip Redis cache and fetch fresh data from database
   */
  async getOperationalMetrics(bypassCache = false): Promise<OperationalMetrics> {
    if (!bypassCache) {
      const cached = await this.getCached<OperationalMetrics>('operational');
      if (cached) return cached;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [txData, staffOnline, activeSessions] = await Promise.all([
      supabase
        .from('transactions')
        .select('status, engine_type')
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .in('role', ['staff', 'admin', 'kitchen'])
        .eq('is_online', true),
      this.getActiveSessionCount(),
    ]);

    const txs = txData.data || [];
    const transactionsByEngine: Record<string, number> = {};
    for (const tx of txs) {
      const engine = tx.engine_type || 'other';
      transactionsByEngine[engine] = (transactionsByEngine[engine] || 0) + 1;
    }

    const metrics: OperationalMetrics = {
      transactions_today: txs.length,
      transactions_pending: txs.filter((t: any) => t.status === 'pending').length,
      transactions_completed: txs.filter((t: any) => t.status === 'completed').length,
      transactions_by_engine: transactionsByEngine,
      staff_online: staffOnline.count || 0,
      active_sessions: activeSessions,
    };

    await this.setCache('operational', metrics);
    return metrics;
  }

  /**
   * Get performance metrics (for dashboard)
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cached = await this.getCached<PerformanceMetrics>('performance');
    if (cached) return cached;

    // These would typically come from APM/monitoring tools
    // For now, return placeholder structure
    const metrics: PerformanceMetrics = {
      api_response_time_p50: 0,
      api_response_time_p95: 0,
      api_response_time_p99: 0,
      error_rate: 0,
      uptime_percentage: 99.9,
      database_connections: 0,
      cache_hit_rate: 0,
    };

    // Get database connection count
    const { data: connData } = await supabase.rpc('get_connection_count');
    if (connData) {
      metrics.database_connections = connData;
    }

    // Get cache stats from Redis
    try {
      const redis = await getRedis();
      if (redis) {
        const info = await redis.info('stats');
        const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
        const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
        if (hits + misses > 0) {
          metrics.cache_hit_rate = (hits / (hits + misses)) * 100;
        }
      }
    } catch (error) {
      // Redis not available
    }

    await this.setCache('performance', metrics);
    return metrics;
  }

  /**
   * Record a metric event
   */
  async recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<void> {
    await supabase.from('metrics_events').insert({
      name,
      value,
      labels,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get metrics history for charting
   */
  async getMetricsHistory(
    metricName: string,
    period: 'hour' | 'day' | 'week' | 'month'
  ): Promise<Array<{ timestamp: string; value: number }>> {
    const periodStart = this.getPeriodStart(period);

    const { data } = await supabase
      .from('metrics_events')
      .select('timestamp, value')
      .eq('name', metricName)
      .gte('timestamp', periodStart)
      .order('timestamp');

    return data || [];
  }

  /**
   * Export metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const [bookings, revenue, users, operational] = await Promise.all([
      this.getBookingMetrics(),
      this.getRevenueMetrics(),
      this.getUserMetrics(),
      this.getOperationalMetrics(),
    ]);

    const lines: string[] = [
      '# HELP v2ecosystem_bookings_total Total number of bookings',
      '# TYPE v2ecosystem_bookings_total gauge',
      `v2ecosystem_bookings_total ${bookings.total_bookings}`,
      '',
      '# HELP v2ecosystem_revenue_total Total revenue in cents',
      '# TYPE v2ecosystem_revenue_total gauge',
      `v2ecosystem_revenue_total ${Math.round(revenue.total_revenue * 100)}`,
      '',
      '# HELP v2ecosystem_users_total Total number of users',
      '# TYPE v2ecosystem_users_total gauge',
      `v2ecosystem_users_total ${users.total_users}`,
      '',
      '# HELP v2ecosystem_users_active_24h Active users in last 24 hours',
      '# TYPE v2ecosystem_users_active_24h gauge',
      `v2ecosystem_users_active_24h ${users.active_users_24h}`,
      '',
      '# HELP v2ecosystem_transactions_today Transactions placed today',
      '# TYPE v2ecosystem_transactions_today gauge',
      `v2ecosystem_transactions_today ${operational.transactions_today}`,
      '',
      '# HELP v2ecosystem_transactions_pending Pending transactions',
      '# TYPE v2ecosystem_transactions_pending gauge',
      `v2ecosystem_transactions_pending ${operational.transactions_pending}`,
      '',
      '# HELP v2ecosystem_staff_online Staff members currently online',
      '# TYPE v2ecosystem_staff_online gauge',
      `v2ecosystem_staff_online ${operational.staff_online}`,
    ];

    return lines.join('\n');
  }

  // Helper methods

  private getPeriodStart(period: 'hour' | 'day' | 'week' | 'month'): string {
    const now = new Date();
    switch (period) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const redis = await getRedis();
      if (!redis) return null;

      const cached = await redis.get(this.cachePrefix + key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, data: any): Promise<void> {
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.setex(
          this.cachePrefix + key,
          this.cacheTTL,
          JSON.stringify(data)
        );
      }
    } catch {
      // Cache write failed, ignore
    }
  }

  private async getActiveSessionCount(): Promise<number> {
    try {
      const redis = await getRedis();
      if (!redis) return 0;

      const keys = await redis.keys('sess:*');
      return keys.length;
    } catch {
      return 0;
    }
  }
}

export const businessMetricsService = new BusinessMetricsService();
