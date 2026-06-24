/**
 * Real-Time Analytics Service
 * Phase 2 Upgrade: Sub-second metric updates via WebSocket
 */

import { Server } from 'socket.io';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';

interface MetricSubscription {
  propertyId: string;
  metrics: string[];
  filters?: Record<string, unknown>;
}

interface LiveMetric {
  metric: string;
  value: number;
  timestamp: Date;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface PropertySnapshot {
  propertyId: string;
  timestamp: Date;
  kpis: Record<string, number>;
  alerts: string[];
  activeSessions: number;
}

export class RealtimeAnalyticsService {
  private io: Server | null = null;
  private supabase = getSupabase();
  private metricCache: Map<string, { value: number; timestamp: Date }> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  initialize(io: Server) {
    this.io = io;
    this.setupEventListeners();
    this.startBackgroundUpdates();
    logger.info('Real-time analytics service initialized');
  }

  private setupEventListeners() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.debug(`Client connected for analytics: ${socket.id}`);

      socket.on('subscribe_metrics', (subscription: MetricSubscription) => {
        this.handleSubscription(socket, subscription);
      });

      socket.on('unsubscribe_metrics', (propertyId: string) => {
        socket.leave(`property:${propertyId}`);
        logger.debug(`Client ${socket.id} unsubscribed from ${propertyId}`);
      });

      socket.on('request_snapshot', async (propertyId: string, callback: (snapshot: PropertySnapshot) => void) => {
        const snapshot = await this.getPropertySnapshot(propertyId);
        callback(snapshot);
      });

      socket.on('disconnect', () => {
        logger.debug(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private async handleSubscription(socket: any, subscription: MetricSubscription) {
    const { propertyId, metrics, filters } = subscription;
    
    socket.join(`property:${propertyId}`);
    logger.debug(`Client ${socket.id} subscribed to ${metrics.join(', ')} for ${propertyId}`);

    // Send initial data immediately
    const initialData = await this.fetchMetrics(propertyId, metrics, filters);
    socket.emit('metrics_update', {
      propertyId,
      metrics: initialData,
      timestamp: new Date()
    });
  }

  private startBackgroundUpdates() {
    // High-frequency updates (5 seconds) for critical metrics
    setInterval(() => this.broadcastCriticalMetrics(), 5000);
    
    // Medium-frequency updates (30 seconds) for operational metrics
    setInterval(() => this.broadcastOperationalMetrics(), 30000);
    
    // Low-frequency updates (5 minutes) for trend analysis
    setInterval(() => this.broadcastTrendMetrics(), 300000);
  }

  private async broadcastCriticalMetrics() {
    if (!this.io) return;

    const rooms = this.io.sockets.adapter.rooms;
    
    for (const [roomName] of rooms) {
      if (!roomName.startsWith('property:')) continue;
      
      const propertyId = roomName.replace('property:', '');
      
      try {
        const metrics = await this.fetchCriticalMetrics(propertyId);
        
        this.io.to(roomName).emit('metrics_update', {
          propertyId,
          priority: 'critical',
          metrics,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error broadcasting critical metrics for ${propertyId}:`, error);
      }
    }
  }

  private async broadcastOperationalMetrics() {
    if (!this.io) return;

    const rooms = this.io.sockets.adapter.rooms;
    
    for (const [roomName] of rooms) {
      if (!roomName.startsWith('property:')) continue;
      
      const propertyId = roomName.replace('property:', '');
      
      try {
        const metrics = await this.fetchOperationalMetrics(propertyId);
        
        this.io.to(roomName).emit('metrics_update', {
          propertyId,
          priority: 'operational',
          metrics,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error broadcasting operational metrics for ${propertyId}:`, error);
      }
    }
  }

  private async broadcastTrendMetrics() {
    if (!this.io) return;

    const rooms = this.io.sockets.adapter.rooms;
    
    for (const [roomName] of rooms) {
      if (!roomName.startsWith('property:')) continue;
      
      const propertyId = roomName.replace('property:', '');
      
      try {
        const metrics = await this.fetchTrendMetrics(propertyId);
        
        this.io.to(roomName).emit('metrics_update', {
          propertyId,
          priority: 'trend',
          metrics,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error broadcasting trend metrics for ${propertyId}:`, error);
      }
    }
  }

  private async fetchCriticalMetrics(propertyId: string): Promise<LiveMetric[]> {
    const today = dayjs().format('YYYY-MM-DD');
    const metrics: LiveMetric[] = [];

    // Live occupancy - current checked-in guests
    const { count: checkedInCount } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .eq('status', 'checked_in')
      .lte('metadata->>check_in_date', today)
      .gt('metadata->>check_out_date', today);

    const { data: rooms } = await this.supabase
      .from('rooms')
      .select('id')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    const totalRooms = rooms?.length || 1;
    const occupancyRate = (checkedInCount || 0) / totalRooms * 100;

    metrics.push({
      metric: 'live_occupancy_rate',
      value: Math.round(occupancyRate * 100) / 100,
      timestamp: new Date(),
      trend: this.calculateTrend('live_occupancy_rate', occupancyRate)
    });

    // Today's revenue (accumulating)
    const { data: todaysRevenue } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .gte('created_at', dayjs().startOf('day').toISOString())
      .lte('created_at', dayjs().endOf('day').toISOString())
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    const revenue = (todaysRevenue || []).reduce((sum, b) => sum + (b.amount || 0), 0);
    
    metrics.push({
      metric: 'today_revenue',
      value: revenue,
      timestamp: new Date(),
      trend: this.calculateTrend('today_revenue', revenue)
    });

    // Active instant-transaction orders
    const { count: activeOrders } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('engine_type', 'instant_transaction')
      .eq('property_id', propertyId)
      .in('status', ['pending', 'preparing', 'ready']);

    metrics.push({
      metric: 'active_orders',
      value: activeOrders || 0,
      timestamp: new Date()
    });

    // Shared-capacity occupancy (if applicable)
    const { count: activeSessions } = await this.supabase
      .from('capacity_windows')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'active');

    if (activeSessions !== null) {
      metrics.push({
        metric: 'active_capacity_sessions',
        value: activeSessions,
        timestamp: new Date()
      });
    }

    return metrics;
  }

  private async fetchOperationalMetrics(propertyId: string): Promise<LiveMetric[]> {
    const metrics: LiveMetric[] = [];
    const today = dayjs().format('YYYY-MM-DD');

    // Housekeeping progress
    const { data: hkTasks } = await this.supabase
      .from('housekeeping_tasks')
      .select('status')
      .eq('property_id', propertyId)
      .gte('scheduled_date', dayjs().startOf('day').toISOString())
      .lte('scheduled_date', dayjs().endOf('day').toISOString());

    const totalTasks = hkTasks?.length || 0;
    const completedTasks = hkTasks?.filter(t => t.status === 'completed').length || 0;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    metrics.push({
      metric: 'housekeeping_completion',
      value: Math.round(completionRate * 100) / 100,
      timestamp: new Date()
    });

    // Check-ins and check-outs today
    const { count: checkIns } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .filter('metadata->>check_in_date', 'eq', today);

    const { count: checkOuts } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .filter('metadata->>check_out_date', 'eq', today);

    metrics.push(
      { metric: 'todays_checkins', value: checkIns || 0, timestamp: new Date() },
      { metric: 'todays_checkouts', value: checkOuts || 0, timestamp: new Date() }
    );

    // Pending maintenance requests
    const { count: pendingMaintenance } = await this.supabase
      .from('maintenance_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .in('status', ['pending', 'in_progress']);

    metrics.push({
      metric: 'pending_maintenance',
      value: pendingMaintenance || 0,
      timestamp: new Date()
    });

    return metrics;
  }

  private async fetchTrendMetrics(propertyId: string): Promise<LiveMetric[]> {
    const metrics: LiveMetric[] = [];
    
    // Compare to yesterday
    const today = dayjs();
    const yesterday = today.subtract(1, 'day');

    // Revenue comparison
    const { data: todayRevenue } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .gte('created_at', today.startOf('day').toISOString())
      .lte('created_at', today.endOf('day').toISOString())
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    const { data: yesterdayRevenue } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .gte('created_at', yesterday.startOf('day').toISOString())
      .lte('created_at', yesterday.endOf('day').toISOString())
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    const todayTotal = (todayRevenue || []).reduce((sum, b) => sum + (b.amount || 0), 0);
    const yesterdayTotal = (yesterdayRevenue || []).reduce((sum, b) => sum + (b.amount || 0), 0);
    const change = yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;

    metrics.push({
      metric: 'revenue_vs_yesterday',
      value: todayTotal,
      timestamp: new Date(),
      change: todayTotal - yesterdayTotal,
      changePercent: Math.round(change * 100) / 100,
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
    });

    // ADR trend
    const { data: todayBookings } = await this.supabase
      .from('transactions')
      .select('amount, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .filter('metadata->>check_in_date', 'gte', today.startOf('day').format('YYYY-MM-DD'))
      .filter('metadata->>check_in_date', 'lte', today.endOf('day').format('YYYY-MM-DD'))
      .in('status', ['confirmed', 'checked_in']);

    const totalNights = (todayBookings || []).reduce((sum: number, b: any) => sum + (b.metadata?.nights || 1), 0);
    const totalRate = (todayBookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    const adr = totalNights > 0 ? totalRate / totalNights : 0;

    metrics.push({
      metric: 'today_adr',
      value: Math.round(adr * 100) / 100,
      timestamp: new Date()
    });

    return metrics;
  }

  private async fetchMetrics(
    propertyId: string,
    metricNames: string[],
    _filters?: Record<string, unknown>
  ): Promise<LiveMetric[]> {
    // Combine all metric fetches based on requested metrics
    const allMetrics: LiveMetric[] = [];

    if (metricNames.some(m => ['live_occupancy_rate', 'today_revenue', 'active_orders'].includes(m))) {
      const critical = await this.fetchCriticalMetrics(propertyId);
      allMetrics.push(...critical.filter(m => metricNames.includes(m.metric)));
    }

    if (metricNames.some(m => ['housekeeping_completion', 'todays_checkins', 'pending_maintenance'].includes(m))) {
      const operational = await this.fetchOperationalMetrics(propertyId);
      allMetrics.push(...operational.filter(m => metricNames.includes(m.metric)));
    }

    if (metricNames.some(m => m.includes('trend') || m.includes('vs_'))) {
      const trends = await this.fetchTrendMetrics(propertyId);
      allMetrics.push(...trends.filter(m => metricNames.includes(m.metric)));
    }

    return allMetrics;
  }

  private calculateTrend(metricName: string, currentValue: number): 'up' | 'down' | 'stable' {
    const cacheKey = `${metricName}`;
    const cached = this.metricCache.get(cacheKey);

    if (!cached) {
      this.metricCache.set(cacheKey, { value: currentValue, timestamp: new Date() });
      return 'stable';
    }

    const change = currentValue - cached.value;
    const changePercent = cached.value !== 0 ? (change / cached.value) * 100 : 0;

    // Update cache
    this.metricCache.set(cacheKey, { value: currentValue, timestamp: new Date() });

    if (changePercent > 2) return 'up';
    if (changePercent < -2) return 'down';
    return 'stable';
  }

  async getPropertySnapshot(propertyId: string): Promise<PropertySnapshot> {
    const [critical, operational, trends] = await Promise.all([
      this.fetchCriticalMetrics(propertyId),
      this.fetchOperationalMetrics(propertyId),
      this.fetchTrendMetrics(propertyId)
    ]);

    const allMetrics = [...critical, ...operational, ...trends];
    const kpis: Record<string, number> = {};
    
    for (const m of allMetrics) {
      kpis[m.metric] = m.value;
    }

    // Get active alerts
    const { data: activeAlerts } = await this.supabase
      .from('alert_history')
      .select('alert_definition_id')
      .eq('property_id', propertyId)
      .is('resolved_at', null)
      .limit(10);

    return {
      propertyId,
      timestamp: new Date(),
      kpis,
      alerts: activeAlerts?.map(a => a.alert_definition_id) || [],
      activeSessions: this.io?.sockets.adapter.rooms.get(`property:${propertyId}`)?.size || 0
    };
  }

  // Called by external services when data changes
  async notifyMetricChange(propertyId: string, metric: string, value: number) {
    if (!this.io) return;

    this.io.to(`property:${propertyId}`).emit('metric_change', {
      propertyId,
      metric,
      value,
      timestamp: new Date()
    });
  }
}

export const realtimeAnalytics = new RealtimeAnalyticsService();
