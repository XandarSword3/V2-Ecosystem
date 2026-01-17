/**
 * In-Memory Analytics Repository
 *
 * Test double for the Analytics repository.
 */

import type {
  Metric,
  MetricType,
  MetricPeriod,
  Dashboard,
  DashboardWidget,
  AnalyticsRepository,
} from '../container/types.js';
import { randomUUID } from 'crypto';

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private metrics: Map<string, Metric> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private widgets: Map<string, DashboardWidget> = new Map();

  // Metric Operations
  async createMetric(data: Omit<Metric, 'id' | 'createdAt'>): Promise<Metric> {
    const metric: Metric = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.metrics.set(metric.id, metric);
    return metric;
  }

  async getMetric(id: string): Promise<Metric | null> {
    return this.metrics.get(id) || null;
  }

  async getMetricsByType(type: MetricType, period: MetricPeriod): Promise<Metric[]> {
    return Array.from(this.metrics.values()).filter(
      m => m.type === type && m.period === period
    );
  }

  async getMetricsForPeriod(startDate: string, endDate: string): Promise<Metric[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return Array.from(this.metrics.values()).filter(m => {
      const metricStart = new Date(m.startDate);
      const metricEnd = new Date(m.endDate);
      return metricStart >= start && metricEnd <= end;
    });
  }

  async getLatestMetrics(types: MetricType[]): Promise<Metric[]> {
    const result: Metric[] = [];
    
    for (const type of types) {
      const metrics = Array.from(this.metrics.values())
        .filter(m => m.type === type)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
      
      if (metrics.length > 0) {
        result.push(metrics[0]);
      }
    }
    
    return result;
  }

  // Dashboard Operations
  async createDashboard(data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const dashboard: Dashboard = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  async updateDashboard(id: string, data: Partial<Dashboard>): Promise<Dashboard> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }
    const updated: Dashboard = {
      ...dashboard,
      ...data,
      id: dashboard.id,
      createdAt: dashboard.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.dashboards.set(id, updated);
    return updated;
  }

  async deleteDashboard(id: string): Promise<void> {
    this.dashboards.delete(id);
    // Also delete widgets
    for (const [wId, widget] of this.widgets.entries()) {
      if (widget.dashboardId === id) {
        this.widgets.delete(wId);
      }
    }
  }

  async getDashboard(id: string): Promise<Dashboard | null> {
    return this.dashboards.get(id) || null;
  }

  async getDashboardsByOwner(ownerId: string): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values()).filter(d => d.ownerId === ownerId);
  }

  async getDefaultDashboard(): Promise<Dashboard | null> {
    for (const dashboard of this.dashboards.values()) {
      if (dashboard.isDefault) {
        return dashboard;
      }
    }
    return null;
  }

  // Widget Operations
  async createWidget(data: Omit<DashboardWidget, 'id' | 'createdAt'>): Promise<DashboardWidget> {
    const widget: DashboardWidget = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.widgets.set(widget.id, widget);
    return widget;
  }

  async updateWidget(id: string, data: Partial<DashboardWidget>): Promise<DashboardWidget> {
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new Error(`Widget not found: ${id}`);
    }
    const updated: DashboardWidget = {
      ...widget,
      ...data,
      id: widget.id,
      createdAt: widget.createdAt,
    };
    this.widgets.set(id, updated);
    return updated;
  }

  async deleteWidget(id: string): Promise<void> {
    this.widgets.delete(id);
  }

  async getWidget(id: string): Promise<DashboardWidget | null> {
    return this.widgets.get(id) || null;
  }

  async getWidgetsForDashboard(dashboardId: string): Promise<DashboardWidget[]> {
    return Array.from(this.widgets.values()).filter(w => w.dashboardId === dashboardId);
  }

  // Test helper to clear all data
  clear(): void {
    this.metrics.clear();
    this.dashboards.clear();
    this.widgets.clear();
  }
}
