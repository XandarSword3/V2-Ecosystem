'use client';

import React from 'react';
import { WorkItem } from './WorkItem';
import type { WorkQueueColumn, WorkItemPriority } from './types';
import { CheckCircle2, Inbox } from 'lucide-react';

export interface WorkQueueProps {
  column: WorkQueueColumn;
  nextState?: string | null;
  onAdvanceOrder?: (orderId: string, targetState: string) => void;
  onAdvanceItem?: (orderId: string, itemId: string) => void;
  onTogglePriority?: (orderId: string, priority: WorkItemPriority) => void;
  onCancelOrder?: (orderId: string, reason: string) => void;
  onExtendEta?: (orderId: string, minutes: number) => void;
  onPrintTicket?: (orderId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * WorkQueue — Operational Workflow Queue Column (Plan F8).
 *
 * Renders a canonical workflow state column containing work items awaiting action.
 */
export function WorkQueue({
  column,
  nextState,
  onAdvanceOrder,
  onAdvanceItem,
  onTogglePriority,
  onCancelOrder,
  onExtendEta,
  onPrintTicket,
  disabled = false,
  className = '',
}: WorkQueueProps) {
  const itemCount = column.items.length;

  return (
    <div
      className={`flex flex-col h-full rounded-2xl bg-muted/30 border border-border/60 overflow-hidden ${className}`}
      data-testid={`work-queue-${column.state}`}
    >
      {/* Column Header */}
      <div
        className={`p-3.5 border-b border-border/60 flex items-center justify-between ${column.bgClass}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${column.borderClass} bg-current shrink-0`} />
          <h3 className={`font-bold text-sm truncate ${column.textClass}`}>{column.label}</h3>
        </div>

        <span
          className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-background/80 text-foreground border border-border/40 shadow-sm"
          data-testid={`queue-count-${column.state}`}
        >
          {itemCount}
        </span>
      </div>

      {/* Queue Body */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[240px]">
        {itemCount === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground space-y-2"
            data-testid="queue-empty-state"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/60">
              <Inbox className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium">Queue is clear</p>
          </div>
        ) : (
          column.items.map((item) => (
            <WorkItem
              key={item.id}
              item={item}
              actionLabel={column.actionLabel}
              actionBgClass={column.actionBgClass}
              nextState={nextState}
              onAdvanceOrder={onAdvanceOrder}
              onAdvanceItem={onAdvanceItem}
              onTogglePriority={onTogglePriority}
              onCancelOrder={onCancelOrder}
              onExtendEta={onExtendEta}
              onPrintTicket={onPrintTicket}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default WorkQueue;
