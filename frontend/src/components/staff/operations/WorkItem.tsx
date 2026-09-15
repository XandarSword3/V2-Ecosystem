'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Timer, Check, ChevronRight, Play, CheckCircle2, Flame, Crown } from 'lucide-react';
import { CustomerContext } from './CustomerContext';
import { FulfillmentDetails } from './FulfillmentDetails';
import { ExceptionAction } from './ExceptionAction';
import type { WorkItemData, WorkItemPriority } from './types';
import type { ItemStatus } from '../types';

export interface WorkItemProps {
  item: WorkItemData;
  onAdvanceOrder?: (orderId: string, targetState: string) => void;
  onAdvanceItem?: (orderId: string, itemId: string) => void;
  onTogglePriority?: (orderId: string, priority: WorkItemPriority) => void;
  onCancelOrder?: (orderId: string, reason: string) => void;
  onExtendEta?: (orderId: string, minutes: number) => void;
  onPrintTicket?: (orderId: string) => void;
  actionLabel?: string | null;
  actionBgClass?: string;
  nextState?: string | null;
  disabled?: boolean;
  className?: string;
}

const ELAPSED_WARN_MIN = 10;
const ELAPSED_CRIT_MIN = 20;

function useElapsedMinutes(since: string): number {
  const [minutes, setMinutes] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000))
  );

  useEffect(() => {
    const tick = () =>
      setMinutes(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000)));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [since]);

  return minutes;
}

function ElapsedBadge({ since }: { since: string }) {
  const minutes = useElapsedMinutes(since);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const label = hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}h` : `${mm}m`;

  const isCrit = minutes >= ELAPSED_CRIT_MIN;
  const isWarn = minutes >= ELAPSED_WARN_MIN;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold font-mono ${
        isCrit
          ? 'bg-destructive text-destructive-foreground animate-pulse'
          : isWarn
          ? 'bg-amber-500 text-white'
          : 'bg-muted text-muted-foreground'
      }`}
      data-testid="elapsed-badge"
    >
      <Timer className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

const ITEM_NEXT_ACTION_LABEL: Record<string, string> = {
  pending: 'Start',
  preparing: 'Ready',
  ready: 'Serve',
};

const ITEM_STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  pending: {
    bg: 'bg-muted/40',
    border: 'border-border/60',
    text: 'text-muted-foreground',
  },
  preparing: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  ready: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-300 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  served: {
    bg: 'bg-muted/20',
    border: 'border-border/40',
    text: 'text-muted-foreground/60',
  },
};

/**
 * WorkItem — Canonical Work Item Card for Operations (Plan F8).
 *
 * Displays reference number, elapsed timers, customer context, item progress,
 * and canonical advance actions for any Engine A business vertical.
 */
export function WorkItem({
  item,
  onAdvanceOrder,
  onAdvanceItem,
  onTogglePriority,
  onCancelOrder,
  onExtendEta,
  onPrintTicket,
  actionLabel,
  actionBgClass = 'bg-primary-600 hover:bg-primary-700 text-white',
  nextState,
  disabled = false,
  className = '',
}: WorkItemProps) {
  const isRush = item.priority === 'rush';
  const isVip = item.priority === 'vip' || item.isVip;

  const priorityClasses = isRush
    ? 'border-2 border-orange-500 dark:border-orange-500 shadow-md shadow-orange-500/10'
    : isVip
    ? 'border-2 border-purple-500 dark:border-purple-500 shadow-md shadow-purple-500/10'
    : 'border border-border/80 shadow-sm';

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 bg-card ${priorityClasses} ${className}`}
      data-testid={`work-item-${item.id}`}
    >
      {/* Header */}
      <CardHeader className="p-3.5 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold font-mono tracking-tight">
              #{item.orderNumber}
            </span>
            {isRush && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300 text-[10px] font-bold uppercase tracking-wider animate-pulse"
                data-testid="rush-badge"
              >
                <Flame className="w-3 h-3 text-orange-600" />
                RUSH
              </span>
            )}
            {isVip && !isRush && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider"
                data-testid="vip-badge"
              >
                <Crown className="w-3 h-3 text-purple-600" />
                VIP
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <ElapsedBadge since={item.createdAt} />
            <ExceptionAction
              orderId={item.id}
              orderNumber={item.orderNumber}
              currentPriority={item.priority}
              onTogglePriority={(p) => onTogglePriority?.(item.id, p)}
              onCancelOrder={(r) => onCancelOrder?.(item.id, r)}
              onExtendEta={(m) => onExtendEta?.(item.id, m)}
              onPrintTicket={() => onPrintTicket?.(item.id)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Customer & Location Context */}
        <div className="pt-2">
          <CustomerContext
            customerName={item.customerName}
            customerPhone={item.customerPhone}
            loyaltyTier={item.loyaltyTier}
            isVip={item.isVip}
            tableNumber={item.tableNumber}
            tableName={item.tableName}
            roomNumber={item.roomNumber}
            staffName={item.staffName}
          />
        </div>
      </CardHeader>

      {/* Body: Items & Fulfillment Details */}
      <CardContent className="p-3.5 pt-3 space-y-3">
        {/* Fulfillment Metadata */}
        <FulfillmentDetails
          mode={item.fulfillmentMode}
          destinationType={item.destinationType}
          destinationRef={item.destinationRef}
          deliveryAddress={item.deliveryAddress}
          driverName={item.driverName}
          trackingNumber={item.trackingNumber}
          notes={item.notes}
        />

        {/* Line Items */}
        <div className="space-y-1.5 pt-1 border-t border-border/40" data-testid="work-item-lines">
          {item.items.map((line) => {
            const status = line.status || 'pending';
            const style = ITEM_STATUS_STYLES[status] || ITEM_STATUS_STYLES.pending;
            const nextLabel = ITEM_NEXT_ACTION_LABEL[status];
            const isServed = status === 'served';

            return (
              <div
                key={line.id}
                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${style.bg} ${style.border}`}
                data-testid={`work-line-${line.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold bg-background/80 px-1 rounded text-[10px] shrink-0">
                      {line.quantity}x
                    </span>
                    <span
                      className={`font-medium truncate ${
                        isServed ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {line.name}
                    </span>
                  </div>

                  {line.modifiers && line.modifiers.length > 0 && (
                    <div className="pl-6 flex flex-wrap gap-1 mt-0.5">
                      {line.modifiers.map((mod, mi) => (
                        <span
                          key={mi}
                          className="text-[10px] px-1 py-0.2 rounded bg-background/60 text-muted-foreground"
                        >
                          +{mod}
                        </span>
                      ))}
                    </div>
                  )}

                  {line.specialInstructions && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-6 mt-0.5 italic">
                      Note: {line.specialInstructions}
                    </p>
                  )}
                </div>

                {/* Line Item Advance Button */}
                {isServed ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : nextLabel && onAdvanceItem ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAdvanceItem(item.id, line.id)}
                    data-testid={`advance-line-${line.id}`}
                    className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-background border border-border hover:bg-muted/80 transition"
                  >
                    <span>{nextLabel}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Action Button: Advance Canonical State */}
        {actionLabel && nextState && onAdvanceOrder && (
          <div className="pt-2">
            <Button
              className={`w-full text-xs font-bold py-2 ${actionBgClass}`}
              disabled={disabled}
              onClick={() => onAdvanceOrder(item.id, nextState)}
              data-testid={`advance-order-${item.id}`}
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              {actionLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkItem;
