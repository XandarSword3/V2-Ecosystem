/**
 * In-Memory Analytics Repository
 * Test double for AnalyticsRepository using in-memory data structures.
 */

import type {
  AnalyticsRepository,
  Metric,
  MetricType,
  MetricPeriod,
  Dashboard,
  DashboardWidget,
} from '../container/types.js';

export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  private metrics = new Map<string, Metric>();
  private dashboards = new Map<string, Dashboard>();
  private widgets = new Map<string, DashboardWidget>();

  reset() {
    this.metrics.clear();
    this.dashboards.clear();
    this.widgets.clear();
  }

  // Metric operations
  async createMetric(data: Omit<Metric, 'id' | 'createdAt'>): Promise<Metric> {
    const id = crypto.randomUUID();
    const metric: Metric = { ...data, id, createdAt: new Date().toISOString() };
    this.metrics.set(id, metric);
    return metric;
  }

  async getMetric(id: string): Promise<Metric | null> {
    return this.metrics.get(id) ?? null;
  }

  async getMetricsByType(type: MetricType, period: MetricPeriod): Promise<Metric[]> {
    return [...this.metrics.values()].filter(m => m.type === type && m.period === period);
  }

  async getMetricsForPeriod(startDate: string, endDate: string): Promise<Metric[]> {
    return [...this.metrics.values()].filter(m => m.startDate >= startDate && m.endDate <= endDate);
  }

  async getLatestMetrics(types: MetricType[]): Promise<Metric[]> {
    const latest = new Map<MetricType, Metric>();
    for (const m of this.metrics.values()) {
      if (types.includes(m.type)) {
        const existing = latest.get(m.type);
        if (!existing || m.createdAt >= existing.createdAt) {
          latest.set(m.type, m);
        }
      }
    }
    return [...latest.values()];
  }

  // Dashboard operations
  async createDashboard(data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const id = crypto.randomUUID();
    const dashboard: Dashboard = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.dashboards.set(id, dashboard);
    return dashboard;
  }

  async updateDashboard(id: string, data: Partial<Dashboard>): Promise<Dashboard> {
    const existing = this.dashboards.get(id);
    if (!existing) throw new Error(`Dashboard ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.dashboards.set(id, updated);
    return updated;
  }

  async deleteDashboard(id: string): Promise<void> {
    this.dashboards.delete(id);
  }

  async getDashboard(id: string): Promise<Dashboard | null> {
    return this.dashboards.get(id) ?? null;
  }

  async getDashboardsByOwner(ownerId: string): Promise<Dashboard[]> {
    return [...this.dashboards.values()].filter(d => d.ownerId === ownerId);
  }

  async getDefaultDashboard(): Promise<Dashboard | null> {
    for (const d of this.dashboards.values()) {
      if (d.isDefault) return d;
    }
    return null;
  }

  // Widget operations
  async createWidget(data: Omit<DashboardWidget, 'id' | 'createdAt'>): Promise<DashboardWidget> {
    const id = crypto.randomUUID();
    const widget: DashboardWidget = { ...data, id, createdAt: new Date().toISOString() };
    this.widgets.set(id, widget);
    return widget;
  }

  async updateWidget(id: string, data: Partial<DashboardWidget>): Promise<DashboardWidget> {
    const existing = this.widgets.get(id);
    if (!existing) throw new Error(`Widget ${id} not found`);
    const updated = { ...existing, ...data };
    this.widgets.set(id, updated);
    return updated;
  }

  async deleteWidget(id: string): Promise<void> {
    this.widgets.delete(id);
  }

  async getWidget(id: string): Promise<DashboardWidget | null> {
    return this.widgets.get(id) ?? null;
  }

  async getWidgetsForDashboard(dashboardId: string): Promise<DashboardWidget[]> {
    return [...this.widgets.values()].filter(w => w.dashboardId === dashboardId);
  }
}
