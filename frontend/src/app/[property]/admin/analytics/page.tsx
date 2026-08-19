'use client';

import { useParams } from 'next/navigation';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BedDouble,
  ChefHat,
  AlertCircle,
  Activity,
  RefreshCw
} from 'lucide-react';

interface LiveMetric {
  metric: string;
  value: number;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
}

export default function AnalyticsDashboard() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';

  useTranslations('admin.analytics');
  const [metrics, setMetrics] = useState<LiveMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchSnapshot = async () => {
    try {
      const { data } = await api.get('/analytics/snapshot');
      
      // Convert KPIs to metrics format
      const newMetrics: LiveMetric[] = Object.entries(data.kpis || {}).map(([key, value]) => ({
        metric: key,
        value: value as number,
        trend: 'stable'
      }));

      setMetrics(newMetrics);
      setAlerts(data.alerts || []);
      setLastUpdated(new Date());
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSnapshot, 30000);
    return () => clearInterval(interval);
  }, []);

  const getMetricIcon = (metric: string) => {
    if (metric.includes('occupancy')) return <BedDouble className="h-5 w-5" />;
    if (metric.includes('revenue')) return <DollarSign className="h-5 w-5" />;
    if (metric.includes('order')) return <ChefHat className="h-5 w-5" />;
    if (metric.includes('pool')) return <Activity className="h-5 w-5" />;
    if (metric.includes('guest') || metric.includes('checkin')) return <Users className="h-5 w-5" />;
    return <Activity className="h-5 w-5" />;
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      'live_occupancy_rate': 'Live Occupancy',
      'today_revenue': "Today's Revenue",
      'active_orders': 'Active Orders',
      'active_capacity_sessions': 'Active Sessions',
      'todays_checkins': "Today's Check-ins",
      'todays_checkouts': "Today's Check-outs",
      'housekeeping_completion': 'Housekeeping %',
      'pending_maintenance': 'Pending Maintenance'
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatMetricValue = (metric: string, value: number) => {
    if (metric.includes('revenue')) return formatCurrency(value);
    if (metric.includes('rate') || metric.includes('completion')) return formatPercent(value);
    return formatNumber(value);
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time property performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={fetchSnapshot}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-2">
          {criticalAlerts.map(alert => (
            <div key={alert.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                <span className="text-red-800 font-medium">{alert.message}</span>
              </div>
            </div>
          ))}
          {warningAlerts.map(alert => (
            <div key={alert.id} className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-3" />
                <span className="text-yellow-800">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-[80px]" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          metrics.slice(0, 8).map((metric) => (
            <Card key={metric.metric}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {getMetricLabel(metric.metric)}
                </CardTitle>
                <div className="text-muted-foreground">
                  {getMetricIcon(metric.metric)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMetricValue(metric.metric, metric.value)}
                </div>
                {metric.changePercent !== undefined && (
                  <div className={`flex items-center text-xs mt-1 ${
                    metric.changePercent > 0 ? 'text-green-600' : 
                    metric.changePercent < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {metric.changePercent > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : metric.changePercent < 0 ? (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    ) : null}
                    {Math.abs(metric.changePercent).toFixed(1)}% vs yesterday
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/${propertySlug}/admin/alerts`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Alert Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set up KPI thresholds and notification rules
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/${propertySlug}/admin/query-builder`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Query Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create custom reports and analyze data
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-gray-50" onClick={() => window.location.href = `/${propertySlug}/admin/guest-segments`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View RFM analysis and cohort reports
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
