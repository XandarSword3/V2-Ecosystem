/**
 * Performance Monitoring Service
 * Tracks application performance metrics, response times, and resource usage
 */
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';

interface MetricData {
  timestamp: Date;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
}

interface PerformanceThreshold {
  metric: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
}

interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
}

export class PerformanceMonitoringService extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map();
  private thresholds: PerformanceThreshold[] = [];
  private alertConfig: AlertConfig = { enabled: false };
  private readonly maxMetricsPerKey = 1000;
  private readonly retentionMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    this.initializeDefaultThresholds();
    this.startCleanupInterval();
  }

  private initializeDefaultThresholds(): void {
    this.thresholds = [
      { metric: 'response_time', warningThreshold: 500, criticalThreshold: 2000, unit: 'ms' },
      { metric: 'memory_usage', warningThreshold: 70, criticalThreshold: 90, unit: 'percent' },
      { metric: 'cpu_usage', warningThreshold: 70, criticalThreshold: 90, unit: 'percent' },
      { metric: 'database_query_time', warningThreshold: 200, criticalThreshold: 1000, unit: 'ms' },
      { metric: 'error_rate', warningThreshold: 1, criticalThreshold: 5, unit: 'percent' },
      { metric: 'active_connections', warningThreshold: 80, criticalThreshold: 95, unit: 'percent' },
    ];
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.retentionMs;
    
    for (const [key, dataPoints] of this.metrics.entries()) {
      const filtered = dataPoints.filter(d => d.timestamp.getTime() > cutoffTime);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags: Record<string, string> = {}
  ): void {
    const metric: MetricData = {
      timestamp: new Date(),
      name,
      value,
      unit,
      tags,
    };

    const key = this.getMetricKey(name, tags);
    const existing = this.metrics.get(key) || [];
    existing.push(metric);

    // Trim if too many
    if (existing.length > this.maxMetricsPerKey) {
      existing.shift();
    }

    this.metrics.set(key, existing);

    // Check thresholds
    this.checkThresholds(name, value);

    // Emit event for real-time monitoring
    this.emit('metric', metric);
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}|${tagStr}`;
  }

  private checkThresholds(metricName: string, value: number): void {
    const threshold = this.thresholds.find(t => t.metric === metricName);
    if (!threshold) return;

    if (value >= threshold.criticalThreshold) {
      this.triggerAlert('critical', metricName, value, threshold);
    } else if (value >= threshold.warningThreshold) {
      this.triggerAlert('warning', metricName, value, threshold);
    }
  }

  private async triggerAlert(
    severity: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: PerformanceThreshold
  ): Promise<void> {
    if (!this.alertConfig.enabled) return;

    const alert = {
      severity,
      metric,
      value,
      threshold: severity === 'critical' ? threshold.criticalThreshold : threshold.warningThreshold,
      unit: threshold.unit,
      timestamp: new Date().toISOString(),
    };

    this.emit('alert', alert);

    // Send webhook
    if (this.alertConfig.webhookUrl) {
      try {
        await fetch(this.alertConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        console.error('Failed to send alert webhook:', error);
      }
    }
  }

  /**
   * Track HTTP request timing
   */
  trackRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.recordMetric('response_time', durationMs, 'ms', {
      method,
      path: this.normalizePath(path),
      status: String(statusCode),
    });

    if (statusCode >= 500) {
      this.recordMetric('server_errors', 1, 'count', { path: this.normalizePath(path) });
    } else if (statusCode >= 400) {
      this.recordMetric('client_errors', 1, 'count', { path: this.normalizePath(path) });
    }
  }

  private normalizePath(path: string): string {
    // Replace UUIDs and IDs with placeholders
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Track database query timing
   */
  trackDatabaseQuery(query: string, durationMs: number, success: boolean): void {
    const operation = this.extractQueryOperation(query);
    
    this.recordMetric('database_query_time', durationMs, 'ms', {
      operation,
      success: String(success),
    });

    if (!success) {
      this.recordMetric('database_errors', 1, 'count', { operation });
    }
  }

  private extractQueryOperation(query: string): string {
    const normalized = query.trim().toLowerCase();
    if (normalized.startsWith('select')) return 'SELECT';
    if (normalized.startsWith('insert')) return 'INSERT';
    if (normalized.startsWith('update')) return 'UPDATE';
    if (normalized.startsWith('delete')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * Track external API call timing
   */
  trackExternalApi(service: string, endpoint: string, durationMs: number, success: boolean): void {
    this.recordMetric('external_api_time', durationMs, 'ms', {
      service,
      endpoint,
      success: String(success),
    });
  }

  /**
   * Get system health metrics
   */
  getSystemMetrics(): Record<string, number> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      uptime: process.uptime(),
    };
  }

  /**
   * Record system metrics snapshot
   */
  recordSystemMetrics(): void {
    const metrics = this.getSystemMetrics();
    
    this.recordMetric('memory_usage', metrics.heapUsagePercent, 'percent');
    this.recordMetric('heap_used', metrics.heapUsed, 'bytes');
    this.recordMetric('uptime', metrics.uptime, 'seconds');
  }

  /**
   * Get metric statistics
   */
  getMetricStats(
    name: string,
    tags: Record<string, string> = {},
    windowMs: number = 60000
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getMetricKey(name, tags);
    const data = this.metrics.get(key);
    
    if (!data || data.length === 0) return null;

    const cutoff = Date.now() - windowMs;
    const values = data
      .filter(d => d.timestamp.getTime() > cutoff)
      .map(d => d.value)
      .sort((a, b) => a - b);

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary(): {
    responseTime: ReturnType<typeof this.getMetricStats>;
    errorRate: number;
    throughput: number;
    systemHealth: Record<string, number>;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Calculate error rate
    let totalRequests = 0;
    let errorRequests = 0;

    for (const [key, data] of this.metrics.entries()) {
      if (key.startsWith('response_time|')) {
        const recentData = data.filter(d => d.timestamp.getTime() > oneMinuteAgo);
        totalRequests += recentData.length;
        
        if (key.includes('status:5') || key.includes('status:4')) {
          errorRequests += recentData.length;
        }
      }
    }

    return {
      responseTime: this.getMetricStats('response_time', {}, 60000),
      errorRate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
      throughput: totalRequests,
      systemHealth: this.getSystemMetrics(),
    };
  }

  /**
   * Configure alerts
   */
  configureAlerts(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Update threshold
   */
  updateThreshold(metric: string, warning: number, critical: number): void {
    const existing = this.thresholds.find(t => t.metric === metric);
    if (existing) {
      existing.warningThreshold = warning;
      existing.criticalThreshold = critical;
    }
  }

  /**
   * Export metrics for external systems (Prometheus format)
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [key, data] of this.metrics.entries()) {
      if (data.length === 0) continue;
      
      const [name, tagStr] = key.split('|');
      const latest = data[data.length - 1];
      const tags = tagStr
        ? `{${tagStr.split(',').map(t => {
            const [k, v] = t.split(':');
            return `${k}="${v}"`;
          }).join(',')}}`
        : '';

      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${tags} ${latest.value}`);
    }

    return lines.join('\n');
  }
}

// Express middleware for automatic request tracking
export function performanceMiddleware(monitor: PerformanceMonitoringService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      monitor.trackRequest(req.method, req.path, res.statusCode, duration);
    });

    next();
  };
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitoringService();

// Start system metrics collection
setInterval(() => {
  performanceMonitor.recordSystemMetrics();
}, 30000); // Every 30 seconds
