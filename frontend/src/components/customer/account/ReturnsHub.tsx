'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  RotateCcw,
  Package,
  ShieldCheck,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export interface ReturnRequest {
  id: string;
  orderNumber: string;
  itemTitle: string;
  reason: string;
  resolutionType: 'refund' | 'replacement' | 'store_credit';
  status: 'pending_review' | 'approved' | 'dispatched' | 'refunded' | 'rejected';
  createdAt: string;
  resolutionNotes?: string;
}

export interface ReturnsHubProps {
  propertySlug?: string;
  className?: string;
}

export function ReturnsHub({ propertySlug = '', className = '' }: ReturnsHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Return Form State
  const [orderNumber, setOrderNumber] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [reason, setReason] = useState('damaged');
  const [resolutionType, setResolutionType] = useState<'refund' | 'replacement' | 'store_credit'>('replacement');
  const [notes, setNotes] = useState('');

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !notes.trim()) {
      toast.error('Please enter the order number and reason details.');
      return;
    }

    setSubmitting(true);
    // Submit as structured return inquiry
    api
      .post('/support/contact', {
        name: 'Customer Return Request',
        email: 'return@customer.com',
        subject: `[RETURN REQUEST] Order #${orderNumber.trim()} - ${itemTitle || 'Full Order'}`,
        message: `Return/Exchange Requested:\n- Order: #${orderNumber.trim()}\n- Item: ${itemTitle || 'All Items'}\n- Reason: ${reason}\n- Preferred Resolution: ${resolutionType}\n- Customer Notes: ${notes.trim()}`,
        priority: 'high',
      })
      .then(() => {
        toast.success('Return/Replacement request submitted. Our team will review within 24 hours.');
        const newReq: ReturnRequest = {
          id: `RET-${Date.now().toString().slice(-6)}`,
          orderNumber: orderNumber.trim(),
          itemTitle: itemTitle.trim() || 'Purchased Item',
          reason,
          resolutionType,
          status: 'pending_review',
          createdAt: new Date().toISOString(),
          resolutionNotes: 'Under evaluation by guest services.',
        };
        setReturnRequests((prev) => [newReq, ...prev]);
        setShowForm(false);
        setOrderNumber('');
        setItemTitle('');
        setNotes('');
      })
      .catch((err) => {
        toast.error('Failed to submit return request. Please try again.');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="returns-hub">
      {/* Header & Policy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            Returns, Exchanges & Replacements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Engine A provides seamless resolution for damaged goods, fulfillment mistakes, or quality exchanges.
          </p>
        </div>

        <Button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shrink-0"
          data-testid="start-return-btn"
        >
          {showForm ? 'Cancel' : 'Request Return / Exchange'}
        </Button>
      </div>

      {/* Return Policy Banner */}
      <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground">Customer Satisfaction & Return Policy</p>
            <p>
              For physical merchandise, return requests are accepted within 14 days of fulfillment.
              For prepared food or beverage orders, immediate replacements or transaction refunds are dispatched promptly if quality expectations are not met.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Return Request Form */}
      {showForm && (
        <Card className="border-2 border-indigo-500/40 shadow-sm" data-testid="return-form-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Package className="w-4 h-4 text-indigo-600" />
              New Return or Replacement Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Order Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-1002"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    data-testid="return-order-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Item Name or Description
                  </label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="e.g. Vintage T-Shirt (Size M) or Espresso"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    data-testid="return-item-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Reason for Request
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    data-testid="return-reason-select"
                  >
                    <option value="damaged">Damaged or defective product</option>
                    <option value="incorrect_item">Incorrect item received</option>
                    <option value="quality_dissatisfaction">Quality / preparation dissatisfaction</option>
                    <option value="missing_item">Missing from package</option>
                    <option value="other">Other reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Preferred Remedy
                  </label>
                  <select
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    data-testid="return-resolution-select"
                  >
                    <option value="replacement">Replacement Item (Free Dispatch)</option>
                    <option value="refund">Monetary Refund (Original Payment)</option>
                    <option value="store_credit">Account Store Credit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Additional Details & Explanation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Provide any details to help us expedite your return or exchange..."
                  className="w-full p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  data-testid="return-notes-textarea"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                  data-testid="submit-return-btn"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit Return Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Requests History */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            Return & Replacement Requests ({returnRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {returnRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs" data-testid="no-returns-msg">
              No return or replacement requests initiated yet.
            </div>
          ) : (
            <div className="space-y-3" data-testid="returns-list">
              {returnRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-2"
                  data-testid={`return-card-${req.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-foreground">
                        Order #{req.orderNumber} &bull; {req.itemTitle}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        Requested: {req.resolutionType.replace('_', ' ')} &bull; Reason: {req.reason.replace('_', ' ')}
                      </p>
                    </div>

                    <Badge
                      className={`text-[10px] font-semibold capitalize ${
                        req.status === 'refunded' || req.status === 'dispatched'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : req.status === 'approved'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                      data-testid={`return-status-${req.id}`}
                    >
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {req.resolutionNotes && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-semibold text-foreground block mb-0.5">Status Update:</span>
                      <p className="text-muted-foreground">{req.resolutionNotes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Submitted {formatDate(req.createdAt)}</span>
                    <span className="font-mono">{req.id}</span>
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

export default ReturnsHub;
