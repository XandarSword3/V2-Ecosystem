'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  LifeBuoy,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Gift,
  CreditCard,
  FileText,
  AlertTriangle,
  HelpCircle,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

export interface CustomerInquiry {
  id: string;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  resolution?: string;
}

export interface RecoveryAction {
  id: string;
  type: 'refund' | 'replacement' | 'credit' | 'comp' | 'resolution';
  title: string;
  description: string;
  amount?: number;
  orderNumber?: string;
  status: string;
  date: string;
}

export interface RecoveryHubProps {
  propertySlug?: string;
  className?: string;
}

export function RecoveryHub({ propertySlug = '', className = '' }: RecoveryHubProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  // Ticket Form State
  const [subject, setSubject] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [message, setMessage] = useState('');

  const fetchInquiries = async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/support/my-tickets', { signal });
      if (res.data?.success) {
        setInquiries(res.data.data || []);
      }
    } catch {
      // Non-fatal fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      fetchInquiries(controller.signal);
      return () => controller.abort();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !subject.trim()) {
      toast.error('Please enter both subject and message.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: user?.fullName || 'Customer',
        email: user?.email || '',
        subject: orderNumber.trim() ? `[Order #${orderNumber.trim()}] ${subject.trim()}` : subject.trim(),
        message: message.trim(),
        priority,
      };

      const res = await api.post('/support/contact', payload);
      if (res.data?.success) {
        toast.success('Support inquiry submitted. Our team will review and respond promptly.');
        setShowNewTicket(false);
        setSubject('');
        setOrderNumber('');
        setMessage('');
        await fetchInquiries();
      } else {
        toast.error(res.data?.error || 'Failed to submit inquiry');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="recovery-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center p-8 border-dashed" data-testid="recovery-guest">
        <CardContent className="space-y-4">
          <LifeBuoy className="w-12 h-12 text-blue-600 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sign In for Customer Service & Recovery</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Log in to view resolutions, refunds, replacements, or submit assistance requests.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Sign In
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Derive resolved inquiries as recovery resolutions
  const resolvedInquiries = inquiries.filter((i) => ['resolved', 'closed'].includes(i.status) && i.resolution);

  return (
    <div className={`space-y-6 ${className}`} data-testid="recovery-hub">
      {/* Header Overview & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-blue-600" />
            Customer Service & Service Recovery
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track inquiries, view compensation or replacement resolutions, and reach our dedicated support team.
          </p>
        </div>

        <Button
          onClick={() => setShowNewTicket((prev) => !prev)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0"
          data-testid="open-ticket-btn"
        >
          {showNewTicket ? 'Cancel' : 'Open Support Inquiry'}
        </Button>
      </div>

      {/* New Ticket Form */}
      {showNewTicket && (
        <Card className="border-2 border-blue-500/40 shadow-sm" data-testid="new-ticket-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-blue-600" />
              Submit Service or Order Assistance Inquiry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Subject / Issue Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Missing line item, delay, or quality issue"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-testid="ticket-subject-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Order / Transaction Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-12345"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    data-testid="ticket-order-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Urgency / Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full sm:w-64 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  data-testid="ticket-priority-select"
                >
                  <option value="low">Low (General inquiry)</option>
                  <option value="normal">Normal (Standard assistance)</option>
                  <option value="high">High (Active order issue)</option>
                  <option value="urgent">Urgent (Immediate resolution required)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe what happened, any discrepancies, or how we can make things right..."
                  className="w-full p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  data-testid="ticket-message-textarea"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewTicket(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                  data-testid="submit-ticket-btn"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Send Inquiry
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Service Recovery Transparency Cards (Phase F10 Requirement) */}
      {resolvedInquiries.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10" data-testid="recovery-resolutions-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Granted Resolutions & Recoveries ({resolvedInquiries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolvedInquiries.map((res) => (
              <div
                key={res.id}
                className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-slate-800 shadow-sm space-y-1.5"
                data-testid={`resolution-item-${res.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Re: {res.subject}</span>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                    Resolved
                  </Badge>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {res.resolution}
                </p>
                {res.resolved_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Resolved on {formatDate(res.resolved_at)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active & Historical Inquiries List */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-blue-600" />
            Support Inquiries & History ({inquiries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs" data-testid="no-inquiries-msg">
              No support tickets found. If you ever have questions or experience any issues with an order, submit an inquiry above!
            </div>
          ) : (
            <div className="space-y-3" data-testid="inquiries-list">
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-2"
                  data-testid={`inquiry-card-${inquiry.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{inquiry.subject}</span>
                      <Badge
                        className={`text-[10px] uppercase font-bold ${
                          inquiry.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : inquiry.priority === 'high'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {inquiry.priority}
                      </Badge>
                    </div>

                    <Badge
                      className={`text-[10px] font-semibold capitalize ${
                        ['resolved', 'closed'].includes(inquiry.status)
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : inquiry.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                      }`}
                      data-testid={`inquiry-status-${inquiry.id}`}
                    >
                      {inquiry.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{inquiry.message}</p>

                  {inquiry.resolution && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                        Support Resolution:
                      </span>
                      <p className="text-foreground">{inquiry.resolution}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Submitted {formatDate(inquiry.created_at)}</span>
                    <span className="font-mono">Ticket #{inquiry.id.slice(-8).toUpperCase()}</span>
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

export default RecoveryHub;
