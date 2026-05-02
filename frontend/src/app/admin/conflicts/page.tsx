'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { conflictsStore, syncQueue } from '@/lib/offline/offline-storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  RefreshCw,
  Search,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTime } from '@/lib/utils';
import { resolveConflict as resolveConflictAction } from '@/lib/offline/offline-sync';

interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: any;
  serverData: any;
  resolved: boolean;
  createdAt: Date;
}

export default function ConflictDashboard() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadConflicts = async () => {
    try {
      const allConflicts = await conflictsStore.getAll();
      setConflicts((allConflicts as any[]).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      toast.error('Failed to load conflicts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const resolveConflict = async (id: string, resolution: 'accept_local' | 'accept_server') => {
    try {
      await resolveConflictAction(id, resolution);
      setConflicts(prev => prev.filter(c => c.id !== id));
      toast.success(resolution === 'accept_local' ? 'Conflict re-queued (Overriding server)' : 'Conflict resolved (Server data kept)');
    } catch (error) {
      toast.error('Failed to resolve conflict');
    }
  };

  const clearAllConflicts = async () => {
    try {
      const all = await conflictsStore.getAll();
      for (const c of all) {
        await conflictsStore.delete(c.id);
      }
      setConflicts([]);
      toast.success('All conflicts cleared');
    } catch (error) {
      toast.error('Failed to clear conflicts');
    }
  };


  const filteredConflicts = conflicts.filter(c => 
    c.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.entityId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            Sync Conflicts
          </h1>
          <p className="text-slate-500 mt-1">
            Review and resolve data mismatches from offline operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadConflicts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="ghost" onClick={clearAllConflicts} className="text-red-500 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by entity type or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </CardContent>
      </Card>

      {filteredConflicts.length === 0 ? (
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4 opacity-50" />
            <p className="text-lg font-medium">No active conflicts</p>
            <p className="text-sm">All offline actions synchronized successfully.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredConflicts.map((conflict) => (
            <Card key={conflict.id} className="overflow-hidden border-l-4 border-l-yellow-500">
              <CardHeader className="bg-slate-50/50 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {conflict.entityType.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm font-mono text-slate-500">ID: {conflict.entityId}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(conflict.createdAt).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Database className="h-3 w-3" />
                      Local (Rejected)
                    </h4>
                    <pre className="p-3 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/20 text-xs overflow-auto max-h-40">
                      {JSON.stringify(conflict.localData, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Database className="h-3 w-3" />
                      Server (Accepted)
                    </h4>
                    <pre className="p-3 bg-green-50 dark:bg-green-900/10 rounded border border-green-100 dark:border-green-900/20 text-xs overflow-auto max-h-40">
                      {JSON.stringify(conflict.serverData, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => resolveConflict(conflict.id, 'accept_server')}
                  >
                    Accept Server Version
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => resolveConflict(conflict.id, 'accept_local')}
                  >
                    Force My Version
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
