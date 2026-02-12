'use client';

import { useOfflineSync } from '@/lib/offline';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function OfflineStatusIndicator({
  showDetails = true,
  className,
}: OfflineStatusIndicatorProps) {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncAt,
    error,
    sync,
    retry,
    initialized,
  } = useOfflineSync();

  if (!initialized) {
    return null;
  }

  const hasIssues = failedCount > 0 || !!error;
  const hasPending = pendingCount > 0;

  const StatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-yellow-500" />;
    }
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (hasIssues) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (hasPending) {
      return <Cloud className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };

  const statusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (hasIssues) return `${failedCount} failed`;
    if (hasPending) return `${pendingCount} pending`;
    return 'Synced';
  };

  const statusColor = () => {
    if (!isOnline) return 'bg-yellow-500/10 text-yellow-700 border-yellow-300';
    if (hasIssues) return 'bg-red-500/10 text-red-700 border-red-300';
    if (hasPending) return 'bg-yellow-500/10 text-yellow-700 border-yellow-300';
    return 'bg-green-500/10 text-green-700 border-green-300';
  };

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <StatusIcon />
        {(hasPending || hasIssues) && (
          <span className="text-xs font-medium">
            {pendingCount + failedCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2 border',
            statusColor(),
            className
          )}
        >
          <StatusIcon />
          <span className="text-xs font-medium">{statusText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Sync Status</h4>
            <Badge variant={isOnline ? 'default' : 'secondary'}>
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-medium">{pendingCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed:</span>
              <span className={cn('font-medium', failedCount > 0 && 'text-red-500')}>
                {failedCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last sync:</span>
              <span className="font-medium">
                {lastSyncAt
                  ? new Date(lastSyncAt).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded bg-red-50 text-red-700 text-xs">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            {failedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retry()}
                disabled={!isOnline || isSyncing}
              >
                Retry Failed
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync()}
              disabled={!isOnline || isSyncing}
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Offline Mode Banner - Shows when offline
 */
export function OfflineModeBanner() {
  const { isOnline, pendingCount, initialized } = useOfflineSync();

  if (!initialized || isOnline) {
    return null;
  }

  return (
    <div className="bg-yellow-500 text-yellow-950 px-4 py-2 text-center text-sm font-medium">
      <WifiOff className="h-4 w-4 inline-block mr-2" />
      You're currently offline. Changes will sync when you're back online.
      {pendingCount > 0 && (
        <span className="ml-2">
          ({pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'})
        </span>
      )}
    </div>
  );
}
