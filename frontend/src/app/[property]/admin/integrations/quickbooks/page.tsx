'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { 
  RefreshCw, 
  Link2, 
  Link2Off, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  History,
  Settings,
  FileText,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface ConnectionStatus {
  connected: boolean;
  connectionId?: string;
  companyId?: string;
  companyName?: string;
  syncEnabled?: boolean;
  lastSync?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  connectedAt?: string;
}

interface SyncHistoryItem {
  id: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  recordsSynced: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
}

interface AccountMapping {
  key: string;
  name: string;
  defaultType: string;
  mapped: {
    qb_account_id: string;
    qb_account_name: string;
  } | null;
}

interface QBAccount {
  id: string;
  name: string;
  accountType: string;
  classification: string;
}

export default function QuickBooksIntegrationPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [accounts, setAccounts] = useState<QBAccount[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

  useEffect(() => {
    fetchConnectionStatus();
    
    // Check URL params for connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      toast.success('QuickBooks Connected', {
        description: 'Your QuickBooks account has been successfully connected.',
      });
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      toast.error('Connection Failed', {
        description: 'Failed to connect to QuickBooks. Please try again.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (status?.connected && status.connectionId) {
      fetchSyncHistory();
      fetchMappings();
      fetchAccounts();
    }
  }, [status?.connected, status?.connectionId]);

  async function fetchConnectionStatus() {
    try {
      const res = await api.get('/integrations/quickbooks/status');
      setStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSyncHistory() {
    if (!status?.connectionId) return;
    try {
      const res = await api.get(`/integrations/quickbooks/${status.connectionId}/sync/history`);
      setHistory(res.data.history || []);
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
    }
  }

  async function fetchMappings() {
    if (!status?.connectionId) return;
    try {
      const res = await api.get(`/integrations/quickbooks/${status.connectionId}/mappings`);
      setMappings(res.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch mappings:', error);
    }
  }

  async function fetchAccounts() {
    if (!status?.connectionId) return;
    try {
      const res = await api.get(`/integrations/quickbooks/${status.connectionId}/accounts`);
      setAccounts(res.data.accounts || []);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }

  async function handleConnect() {
    try {
      const res = await api.post('/integrations/quickbooks/connect', { propertyId: 'default' });
      
      if (res.data.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      }
    } catch (error) {
      toast.error('Connection Error', {
        description: 'Failed to initiate QuickBooks connection.',
      });
    }
  }

  async function handleDisconnect() {
    if (!status?.connectionId) return;
    
    if (!confirm('Are you sure you want to disconnect QuickBooks? This will stop all syncing.')) {
      return;
    }

    try {
      await api.post(`/integrations/quickbooks/${status.connectionId}/disconnect`);
      
      toast.success('Disconnected', {
        description: 'QuickBooks has been disconnected.',
      });
      
      fetchConnectionStatus();
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to disconnect QuickBooks.',
      });
    }
  }

  async function handleSync() {
    if (!status?.connectionId) return;
    
    setSyncing(true);
    try {
      const res = await api.post(`/integrations/quickbooks/${status.connectionId}/sync`, { syncType: 'sales' });
      
      if (res.data.success) {
        toast.success('Sync Complete', {
          description: `Synced ${res.data.recordsSynced} records. ${res.data.recordsFailed} failed.`,
        });
        fetchSyncHistory();
        fetchConnectionStatus();
      } else {
        throw new Error(res.data.error);
      }
    } catch (error) {
      toast.error('Sync Failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveMapping(category: string, accountId: string) {
    if (!status?.connectionId) return;
    
    const account = accounts.find(a => a.id === accountId);
    
    try {
      await api.post(`/integrations/quickbooks/${status.connectionId}/mappings`, {
        v2Category: category,
        qbAccountId: accountId,
        qbAccountName: account?.name,
        qbAccountType: account?.accountType,
      });
      
      toast.success('Mapping Saved', {
        description: 'Account mapping has been updated.',
      });
      
      fetchMappings();
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to save mapping.',
      });
    }
  }

  async function handleToggleSync(enabled: boolean) {
    if (!status?.connectionId) return;
    
    try {
      await api.patch(`/integrations/quickbooks/${status.connectionId}/settings`, { syncEnabled: enabled });
      
      setStatus(prev => prev ? { ...prev, syncEnabled: enabled } : null);
      
      toast.success(enabled ? 'Sync Enabled' : 'Sync Disabled', {
        description: enabled 
          ? 'Automatic syncing has been enabled.' 
          : 'Automatic syncing has been disabled.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to update settings.',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">QuickBooks Integration</h1>
          <p className="text-muted-foreground mt-1">
            Sync your sales, customers, and invoices with QuickBooks Online
          </p>
        </div>
        {status?.connected && (
          <Badge variant={status.syncEnabled ? 'default' : 'secondary'} className="text-sm">
            {status.syncEnabled ? 'Sync Active' : 'Sync Paused'}
          </Badge>
        )}
      </div>

      {/* Connection Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status?.connected ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Link2Off className="h-5 w-5 text-muted-foreground" />
            )}
            Connection Status
          </CardTitle>
          <CardDescription>
            {status?.connected 
              ? `Connected to ${status.companyName || 'QuickBooks'}` 
              : 'Connect your QuickBooks Online account to sync data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{status.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company ID</p>
                  <p className="font-medium font-mono text-sm">{status.companyId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-medium">
                    {status.lastSync 
                      ? new Date(status.lastSync).toLocaleString() 
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Status</p>
                  <Badge variant={
                    status.lastSyncStatus === 'completed' ? 'default' :
                    status.lastSyncStatus === 'completed_with_errors' ? 'secondary' :
                    status.lastSyncStatus === 'failed' ? 'destructive' : 'outline'
                  }>
                    {status.lastSyncStatus || 'N/A'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-sync"
                    checked={status.syncEnabled}
                    onCheckedChange={handleToggleSync}
                  />
                  <Label htmlFor="auto-sync">Automatic Daily Sync</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Connect your QuickBooks Online account to automatically sync sales, customers, and invoices.
              </p>
              <Button onClick={handleConnect}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed sections - only show when connected */}
      {status?.connected && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <Settings className="h-4 w-4 mr-2" />
              Account Mappings
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Sync History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>What Gets Synced</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Daily sales as Sales Receipts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Customer profiles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Revenue by category</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Tax collected</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Refunds and adjustments</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Automatic Sync</span>
                      <Badge variant={status.syncEnabled ? 'default' : 'secondary'}>
                        {status.syncEnabled ? 'Daily at 2:00 AM' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Manual Sync</span>
                      <Badge variant="outline">Available</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Real-time Sync</span>
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mappings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Mappings</CardTitle>
                <CardDescription>
                  Map V2 revenue categories to your QuickBooks accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mappings.map((mapping) => (
                    <div 
                      key={mapping.key} 
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{mapping.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Default type: {mapping.defaultType}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {mapping.mapped ? (
                          <div className="text-right">
                            <p className="text-sm font-medium">{mapping.mapped.qb_account_name}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {mapping.mapped.qb_account_id}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not mapped</span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <select
                          className="border rounded-md px-3 py-2 text-sm min-w-[200px]"
                          value={mapping.mapped?.qb_account_id || ''}
                          onChange={(e) => handleSaveMapping(mapping.key, e.target.value)}
                        >
                          <option value="">Select account...</option>
                          {accounts
                            .filter(a => a.classification === mapping.defaultType || mapping.defaultType === 'Other Current Liability')
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({account.accountType})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>
                  View past sync operations and their results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sync history yet. Run a sync to see results here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          {item.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : item.status === 'completed_with_errors' ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          ) : item.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <RefreshCw className="h-5 w-5 animate-spin" />
                          )}
                          <div>
                            <p className="font-medium capitalize">{item.syncType} Sync</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(item.startedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-green-600">{item.recordsSynced} synced</span>
                            {item.recordsFailed > 0 && (
                              <span className="text-red-600 ml-2">{item.recordsFailed} failed</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.recordsProcessed} processed
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Error Alert */}
      {status?.lastSyncError && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Last Sync Error</AlertTitle>
          <AlertDescription>{status.lastSyncError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
