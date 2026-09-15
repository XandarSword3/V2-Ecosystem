'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatNumber, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Award,
  Sparkles,
  TrendingUp,
  History,
  AlertCircle,
  CheckCircle2,
  Gift,
  HelpCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

export interface LoyaltyTier {
  id: string;
  name: string;
  pointsMultiplier: number;
  benefits: string[];
  color: string;
  minPoints: number;
}

export interface LoyaltyAccount {
  id: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  lifetimeValue: number;
  tier: LoyaltyTier;
  nextTier?: {
    name: string;
    pointsRequired: number;
    pointsNeeded: number;
    color: string;
  };
}

export interface LoyaltyTransaction {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'reversal' | 'expired' | string;
  points: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface LoyaltyHubProps {
  propertySlug?: string;
  className?: string;
}

export function LoyaltyHub({ propertySlug = '', className = '' }: LoyaltyHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchLoyaltyData = async (signal?: AbortSignal) => {
    try {
      setLoadError(null);
      const [accountRes, txRes, tiersRes] = await Promise.all([
        api.get('/loyalty/me', { signal }),
        api.get('/loyalty/me/transactions', { signal }),
        api.get('/loyalty/tiers', { signal }),
      ]);

      if (accountRes.data?.success) setAccount(accountRes.data.data);
      if (txRes.data?.success) setTransactions(txRes.data.data || []);
      if (tiersRes.data?.success) setTiers(tiersRes.data.data || []);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || signal?.aborted) return;
      setLoadError('Unable to load loyalty account information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      fetchLoyaltyData(controller.signal);
      return () => controller.abort();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await api.post('/loyalty/enroll');
      if (res.data?.success) {
        toast.success('Successfully enrolled in the Loyalty Program!');
        await fetchLoyaltyData();
      } else {
        toast.error(res.data?.error || 'Enrollment failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="loyalty-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center p-8 border-dashed" data-testid="loyalty-guest">
        <CardContent className="space-y-4">
          <Award className="w-12 h-12 text-purple-600 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sign In to View Loyalty Rewards</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create an account or sign in to track points, unlock exclusive tier perks, and redeem discounts on future orders.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            Sign In / Register
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="text-center p-8" data-testid="loyalty-unregistered">
        <CardContent className="space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 mx-auto">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Join Our Loyalty & Rewards Program</h2>
          <p className="text-sm text-muted-foreground">
            Earn points automatically on every eligible purchase, level up your membership tier, and redeem rewards at checkout.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Sparkles className="w-4 h-4 text-purple-600 mb-1" />
              <p className="text-xs font-semibold text-foreground">Earn Points</p>
              <p className="text-[11px] text-muted-foreground">Points for every transaction</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <TrendingUp className="w-4 h-4 text-purple-600 mb-1" />
              <p className="text-xs font-semibold text-foreground">Tier Multipliers</p>
              <p className="text-[11px] text-muted-foreground">Earn up to 2x bonus points</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Gift className="w-4 h-4 text-purple-600 mb-1" />
              <p className="text-xs font-semibold text-foreground">Redeem Instantly</p>
              <p className="text-[11px] text-muted-foreground">Apply discounts at checkout</p>
            </div>
          </div>
          <Button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full sm:w-auto px-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            data-testid="loyalty-enroll-btn"
          >
            {enrolling ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enrolling...
              </>
            ) : (
              'Enroll Now'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tier = account.tier || {
    id: 'bronze',
    name: 'Standard',
    pointsMultiplier: 1.0,
    benefits: ['Earn 1 point per $1 spent'],
    color: '#8b5cf6',
    minPoints: 0,
  };

  const progressToNext = account.nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          ((account.totalPointsEarned - tier.minPoints) /
            (account.nextTier.pointsRequired - tier.minPoints)) *
            100
        )
      )
    : 100;

  // Check if any transaction is a reversal to show reversal explanation card
  const hasReversals = transactions.some((t) => t.type === 'reversal' || t.points < 0);

  return (
    <div className={`space-y-6 ${className}`} data-testid="loyalty-hub">
      {/* Top Banner: Points Balance & Current Tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white shadow-md border-0 overflow-hidden relative">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
            <Award className="w-48 h-48" />
          </div>
          <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider font-semibold text-purple-200">
                  Available Loyalty Balance
                </span>
                <Badge
                  className="text-xs font-bold px-3 py-1 text-white border-0"
                  style={{ backgroundColor: tier.color || '#8b5cf6' }}
                  data-testid="loyalty-tier-badge"
                >
                  {tier.name} Tier
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight" data-testid="loyalty-current-points">
                  {formatNumber(account.currentPoints)}
                </span>
                <span className="text-lg font-medium text-purple-200">Points</span>
              </div>
              <p className="text-xs text-purple-200/80 mt-1">
                Worth approx. ${(account.currentPoints / 100).toFixed(2)} in checkout discounts
              </p>
            </div>

            {/* Tier Progress */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-purple-200 font-medium">
                  {account.nextTier ? `Progress to ${account.nextTier.name}` : 'Highest Tier Achieved!'}
                </span>
                {account.nextTier && (
                  <span className="text-purple-100 font-semibold" data-testid="loyalty-points-needed">
                    {formatNumber(account.nextTier.pointsNeeded)} points needed
                  </span>
                )}
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Column */}
        <Card className="flex flex-col justify-center p-6 space-y-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs text-muted-foreground uppercase font-semibold">Tier Multiplier</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-2xl font-bold text-foreground" data-testid="loyalty-multiplier">
                {tier.pointsMultiplier}x
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Points earned per currency unit spent</p>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Lifetime Earned</span>
            <p className="text-lg font-bold text-foreground mt-0.5" data-testid="loyalty-lifetime-points">
              {formatNumber(account.totalPointsEarned)} pts
            </p>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Total Redeemed</span>
            <p className="text-lg font-bold text-foreground mt-0.5">
              {formatNumber(account.totalPointsRedeemed)} pts
            </p>
          </div>
        </Card>
      </div>

      {/* Program Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* How to Earn */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              How Earning Works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Every dollar spent earns <strong className="text-foreground">1 base point</strong>, scaled by your active tier multiplier (<strong className="text-foreground">{tier.pointsMultiplier}x</strong>).
            </p>
            <p>
              Points are credited automatically once your order is confirmed and fulfilled.
            </p>
          </CardContent>
        </Card>

        {/* How to Redeem */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" />
              How Redemption Works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Points can be applied at checkout as an instant monetary discount at the standard rate of <strong className="text-foreground">100 points = $1.00</strong>.
            </p>
            <p>
              You can combine points with coupon promotions or gift cards in accordance with our stored value priority.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reversal Explanation Callout (Phase F10 Rule) */}
      {hasReversals && (
        <div
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3"
          data-testid="loyalty-reversal-alert"
        >
          <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold text-sm">Understanding Loyalty Point Reversals</p>
            <p>
              When an order is cancelled or refunded, the points originally awarded for that purchase are reversed in the financial and loyalty ledgers to maintain strict transactional accounting integrity.
            </p>
          </div>
        </div>
      )}

      {/* Transaction Ledger History */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <History className="w-4 h-4 text-purple-600" />
            Loyalty Transaction Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs" data-testid="loyalty-no-txs">
              No loyalty point transactions recorded yet. Place an order to earn your first reward!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="loyalty-tx-list">
              {transactions.map((tx) => {
                const isPositive = tx.points > 0;
                const isReversal = tx.type === 'reversal' || (tx.points < 0 && tx.description?.toLowerCase().includes('revers'));
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isReversal
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : isPositive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {isReversal ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {tx.description || (isPositive ? 'Points Earned' : 'Points Redeemed')}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDate(tx.createdAt)}</span>
                          {tx.referenceType && (
                            <span className="capitalize px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                              {tx.referenceType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-sm font-bold ${
                          isReversal
                            ? 'text-amber-600 dark:text-amber-400'
                            : isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                        data-testid="loyalty-tx-points"
                      >
                        {isPositive ? `+${formatNumber(tx.points)}` : formatNumber(tx.points)} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LoyaltyHub;
