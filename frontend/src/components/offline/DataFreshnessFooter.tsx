'use client';

import { useEffect, useState } from 'react';
import { cacheManager } from '@/lib/offline/offline-storage';
import { Clock, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DataFreshnessFooterProps {
  storeName: string;
}

export function DataFreshnessFooter({ storeName }: DataFreshnessFooterProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const t = useTranslations('adminCommon.offline');

  useEffect(() => {
    const fetchMetadata = async () => {
      const metadata = await cacheManager.getMetadata(storeName);
      if (metadata) {
        setLastSync(new Date(metadata.lastSyncAt));
      }
    };

    fetchMetadata();
    
    // Refresh the "time ago" every 30 seconds
    const interval = setInterval(() => setNow(new Date()), 30000);
    
    // Also listen for cache updates (optional improvement: use an event emitter)
    const metadataInterval = setInterval(fetchMetadata, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(metadataInterval);
    };
  }, [storeName]);

  if (!lastSync) return null;

  const diffMins = Math.floor((now.getTime() - lastSync.getTime()) / 60000);
  
  let colorClass = 'text-slate-400';
  let Icon = Clock;
  
  if (diffMins >= 60) {
    colorClass = 'text-red-500 font-semibold';
    Icon = AlertTriangle;
  } else if (diffMins >= 30) {
    colorClass = 'text-yellow-500 font-semibold';
    Icon = AlertTriangle;
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs py-2 px-4 border-t dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm ${colorClass}`}>
      <Icon className="w-3 h-3" />
      <span>
        Last updated {diffMins === 0 ? 'just now' : `${diffMins}m ago`}
      </span>
      {diffMins >= 30 && (
        <span className="ml-auto flex items-center gap-1">
          {diffMins >= 60 ? 'Stale data' : 'Data may be old'}
        </span>
      )}
    </div>
  );
}
