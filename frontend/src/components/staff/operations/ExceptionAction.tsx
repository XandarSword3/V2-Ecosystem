'use client';

import React, { useState } from 'react';
import {
  MoreVertical,
  Flame,
  XCircle,
  Clock,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import type { WorkItemPriority } from './types';

export interface ExceptionActionProps {
  orderId: string;
  orderNumber: string;
  currentPriority?: WorkItemPriority;
  onTogglePriority?: (newPriority: WorkItemPriority) => void;
  onCancelOrder?: (reason: string) => void;
  onExtendEta?: (additionalMinutes: number) => void;
  onPrintTicket?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * ExceptionAction — Operational Exception Handling (Plan F8).
 *
 * Provides quick actions to handle workflow anomalies:
 * rush prioritization, cancellation/void with audit reasons, ETA adjustments,
 * and physical ticket printing.
 */
export function ExceptionAction({
  orderId,
  orderNumber,
  currentPriority = 'normal',
  onTogglePriority,
  onCancelOrder,
  onExtendEta,
  onPrintTicket,
  disabled = false,
  className = '',
}: ExceptionActionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer Request');
  const [customReason, setCustomReason] = useState('');
  const [etaModalOpen, setEtaModalOpen] = useState(false);

  const isRush = currentPriority === 'rush';

  const handleConfirmCancel = () => {
    const finalReason = cancelReason === 'Other' ? customReason.trim() || 'Other' : cancelReason;
    if (onCancelOrder) {
      onCancelOrder(finalReason);
    }
    setCancelModalOpen(false);
    setMenuOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} data-testid="exception-actions">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-1 h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Exception Actions"
        data-testid="exception-actions-button"
      >
        <MoreVertical className="w-4 h-4" />
      </Button>

      {/* Action Menu Dropdown */}
      {menuOpen && (
        <div
          className="absolute right-0 top-8 z-30 w-48 rounded-xl bg-card border border-border shadow-xl py-1 text-xs space-y-0.5"
          data-testid="exception-actions-menu"
        >
          {/* Priority Toggle */}
          {onTogglePriority && (
            <button
              type="button"
              onClick={() => {
                onTogglePriority(isRush ? 'normal' : 'rush');
                setMenuOpen(false);
              }}
              data-testid="action-toggle-rush"
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/60 transition"
            >
              <Flame className={`w-4 h-4 ${isRush ? 'text-muted-foreground' : 'text-orange-500'}`} />
              <span>{isRush ? 'Remove Rush Priority' : 'Mark as RUSH Priority'}</span>
            </button>
          )}

          {/* Extend ETA */}
          {onExtendEta && (
            <button
              type="button"
              onClick={() => {
                setEtaModalOpen(true);
                setMenuOpen(false);
              }}
              data-testid="action-extend-eta"
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/60 transition"
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Extend Prep Time / ETA</span>
            </button>
          )}

          {/* Print Ticket */}
          {onPrintTicket && (
            <button
              type="button"
              onClick={() => {
                onPrintTicket();
                setMenuOpen(false);
              }}
              data-testid="action-print-ticket"
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/60 transition"
            >
              <Printer className="w-4 h-4 text-primary-500" />
              <span>Print Station Ticket</span>
            </button>
          )}

          <div className="border-t border-border/60 my-1" />

          {/* Cancel / Void */}
          {onCancelOrder && (
            <button
              type="button"
              onClick={() => {
                setCancelModalOpen(true);
                setMenuOpen(false);
              }}
              data-testid="action-cancel-order"
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-destructive hover:bg-destructive/10 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel / Void Item</span>
            </button>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Cancel Order #{orderNumber}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs">
                Select an audit reason for cancelling this order. Inventory holds and reservations will be compensated.
              </p>

              <div className="space-y-1.5">
                {[
                  'Customer Request',
                  'Item Out of Stock',
                  'Kitchen / Machine Breakdown',
                  'Payment Issue',
                  'Other',
                ].map((reason) => (
                  <label key={reason} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {cancelReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify cancellation reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background"
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                data-testid="confirm-cancel-button"
              >
                Confirm Cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Extend ETA Modal */}
      {etaModalOpen && (
        <Dialog open={etaModalOpen} onOpenChange={setEtaModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Extend Prep Time for #{orderNumber}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2 py-4">
              {[5, 10, 15, 20, 30, 45].map((mins) => (
                <Button
                  key={mins}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onExtendEta) onExtendEta(mins);
                    setEtaModalOpen(false);
                  }}
                  data-testid={`extend-eta-${mins}`}
                >
                  +{mins} min
                </Button>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEtaModalOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ExceptionAction;
