'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useProperty } from '@/context/PropertyContext';
import {
  Plus,
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Edit,
  Check
} from 'lucide-react';

interface AlertDefinition {
  id: string;
  name: string;
  kpiCode: string;
  condition: { operator: string; value: number };
  severity: 'info' | 'warning' | 'critical';
  isActive: boolean;
  notificationChannels: { type: string; target: string }[];
}

interface ActiveAlert {
  id: string;
  alertDefinitionId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: string;
  metricValue: number;
  thresholdValue: number;
  status: 'active' | 'acknowledged' | 'resolved';
}

export default function AlertsPage() {
  const { activePropertyId } = useProperty();
  const [definitions, setDefinitions] = useState<AlertDefinition[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newAlert, setNewAlert] = useState({
    name: '',
    kpiCode: 'occupancy_rate',
    operator: '>',
    value: 90,
    severity: 'warning' as 'info' | 'warning' | 'critical',
    channels: [{ type: 'in_app', target: '' }]
  });

  // Build per-request header from the active property
  const propertyHeader = activePropertyId
    ? { 'x-property-id': activePropertyId }
    : undefined;

  const fetchData = useCallback(async () => {
    // Guard: if no property selected yet, leave the loading state visible
    // but don't attempt requests that would fail or return wrong data.
    if (!activePropertyId) {
      setIsLoading(false);
      return;
    }
    try {
      const [defsRes, alertsRes] = await Promise.all([
        api.get('/analytics/alerts/definitions', { headers: propertyHeader }),
        api.get('/analytics/alerts/active', { headers: propertyHeader })
      ]);
      // Defensive extraction — API may return { alerts: [...] } or bare array
      setDefinitions(defsRes.data?.alerts ?? defsRes.data ?? []);
      setActiveAlerts(alertsRes.data?.alerts ?? alertsRes.data ?? []);
    } catch {
      toast.error('Failed to load alerts');
      // Ensure arrays so .map() never crashes
      setDefinitions([]);
      setActiveAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [activePropertyId]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const createAlert = async () => {
    if (!activePropertyId) {
      toast.error('No property selected');
      return;
    }
    try {
      await api.post(
        '/analytics/alerts/definitions',
        {
          name: newAlert.name,
          kpiCode: newAlert.kpiCode,
          alertType: 'threshold',
          condition: { operator: newAlert.operator, value: newAlert.value },
          severity: newAlert.severity,
          notificationChannels: newAlert.channels,
          schedule: { frequency: 'realtime' },
          cooldownMinutes: 30,
          isActive: true
        },
        { headers: propertyHeader }
      );
      toast.success('Alert created');
      setShowCreateForm(false);
      fetchData();
    } catch {
      toast.error('Failed to create alert');
    }
  };

  const acknowledgeAlert = async (id: string) => {
    try {
      await api.post(`/analytics/alerts/${id}/acknowledge`, {}, { headers: propertyHeader });
      toast.success('Alert acknowledged');
      fetchData();
    } catch {
      toast.error('Failed to acknowledge');
    }
  };

  const deleteDefinition = async (id: string) => {
    try {
      await api.delete(`/analytics/alerts/definitions/${id}`, { headers: propertyHeader });
      toast.success('Alert deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
    return (
      <Badge className={colors[severity as keyof typeof colors] || colors.info}>
        {severity}
      </Badge>
    );
  };

  // Property gate
  if (!activePropertyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Select a property to view alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Management</h1>
          <p className="text-muted-foreground mt-1">
            Configure KPI thresholds and monitor active alerts
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alert
        </Button>
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Alert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Alert Name</label>
                <Input
                  value={newAlert.name}
                  onChange={e => setNewAlert({ ...newAlert, name: e.target.value })}
                  placeholder="e.g., High Occupancy Alert"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">KPI</label>
                <Select
                  value={newAlert.kpiCode}
                  onValueChange={v => setNewAlert({ ...newAlert, kpiCode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="occupancy_rate">Occupancy Rate</SelectItem>
                    <SelectItem value="today_revenue">Today&apos;s Revenue</SelectItem>
                    <SelectItem value="adr">ADR</SelectItem>
                    <SelectItem value="revpar">RevPAR</SelectItem>
                    <SelectItem value="cancellation_rate">Cancellation Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Operator</label>
                <Select
                  value={newAlert.operator}
                  onValueChange={v => setNewAlert({ ...newAlert, operator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Greater than</SelectItem>
                    <SelectItem value="<">Less than</SelectItem>
                    <SelectItem value=">=">Greater or equal</SelectItem>
                    <SelectItem value="<=">Less or equal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Threshold Value</label>
                <Input
                  type="number"
                  value={newAlert.value}
                  onChange={e => setNewAlert({ ...newAlert, value: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Severity</label>
                <Select
                  value={newAlert.severity}
                  onValueChange={v => setNewAlert({ ...newAlert, severity: v as 'info' | 'warning' | 'critical' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button onClick={createAlert} disabled={!newAlert.name}>
                Create Alert
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Active Alerts ({activeAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Loading…
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              No active alerts - everything looks good!
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alert.message}</span>
                        {getSeverityBadge(alert.severity)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Triggered {formatDistanceToNow(new Date(alert.triggeredAt))} ago
                        {' • '}Value: {alert.metricValue.toFixed(1)} (threshold: {alert.thresholdValue})
                      </div>
                    </div>
                  </div>
                  {alert.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Acknowledge
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Definitions */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules ({definitions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Loading…
            </div>
          ) : definitions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No alert rules defined yet
            </div>
          ) : (
            <div className="space-y-2">
              {definitions.map(def => (
                <div
                  key={def.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(def.severity)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{def.name}</span>
                        {getSeverityBadge(def.severity)}
                        {def.isActive ? (
                          <Badge variant="outline" className="text-green-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {def.kpiCode.replace(/_/g, ' ')} {def.condition.operator} {def.condition.value}
                        {' • '}Channels: {(def.notificationChannels || []).map(c => c.type).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" disabled title="Edit coming soon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDefinition(def.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
