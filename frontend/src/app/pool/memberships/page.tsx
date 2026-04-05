'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Crown,
  Loader2,
  Percent,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';

type MembershipType = 'INDIVIDUAL' | 'FAMILY' | 'CORPORATE' | 'VIP';
type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

interface MembershipPlan {
  type: MembershipType;
  billingCycle: BillingCycle;
  price: number;
  maxMembers: number;
  dailyAccessLimit: number | string;
  guestPasses: number | string;
  discountPercentage: number;
}

interface MembershipDetails {
  id: string;
  type: MembershipType;
  status: string;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string;
  remainingGuestPasses: number;
  discountPercentage: number;
  autoRenew: boolean;
  members?: Array<{ email: string; status: string }>;
}

function formatPlanName(type: MembershipType, cycle: BillingCycle) {
  return `${type.charAt(0)}${type.slice(1).toLowerCase()} - ${cycle.charAt(0)}${cycle.slice(1).toLowerCase()}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function PoolMembershipsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const plansQuery = useQuery({
    queryKey: ['pool-membership-plans'],
    queryFn: async (): Promise<MembershipPlan[]> => {
      const res = await poolApi.getMembershipPlans();
      return res.data?.data || [];
    },
  });

  const membershipQuery = useQuery({
    queryKey: ['pool-my-membership'],
    enabled: !!user,
    queryFn: async (): Promise<MembershipDetails | null> => {
      const res = await poolApi.getMyMembership();
      return res.data?.data || null;
    },
  });

  const createMembershipMutation = useMutation({
    mutationFn: async (payload: { type: MembershipType; billingCycle: BillingCycle }) => {
      const res = await poolApi.createMembership(payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Membership created successfully.');
      queryClient.invalidateQueries({ queryKey: ['pool-my-membership'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create membership.');
    },
  });

  const cancelMembershipMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await poolApi.cancelMembership(membershipId, { immediate: false });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Membership cancellation requested.');
      queryClient.invalidateQueries({ queryKey: ['pool-my-membership'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to cancel membership.');
    },
  });

  const plans = plansQuery.data || [];
  const myMembership = membershipQuery.data || null;
  const hasActiveMembership = myMembership?.status === 'ACTIVE' || myMembership?.status === 'PENDING_PAYMENT';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/40 via-white to-secondary-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/85 dark:bg-slate-800/85 backdrop-blur p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Pool Memberships</h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Subscribe for discounted tickets, guest passes, and priority pool access.
              </p>
            </div>
            <Link
              href="/pool"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-700/70 transition-colors"
            >
              Back To Pool Tickets
            </Link>
          </div>
        </section>

        {!user && (
          <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-900/20 p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-300 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">Sign in required</p>
                <p className="text-amber-800 dark:text-amber-300 mt-1">
                  You can browse plans below. Sign in to subscribe or manage your membership.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Go To Login
                </Link>
              </div>
            </div>
          </section>
        )}

        {user && (
          <section className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/85 dark:bg-slate-800/85 backdrop-blur p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">My Membership</h2>

            {membershipQuery.isLoading ? (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mt-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading membership details...
              </div>
            ) : myMembership ? (
              <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/20 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                      {formatPlanName(myMembership.type, myMembership.billingCycle)}
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1">
                      Status: {myMembership.status}
                    </p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-white/80 dark:bg-slate-800/80 p-3 border border-emerald-200/70 dark:border-emerald-700/70">
                    <p className="text-slate-500 dark:text-slate-400">Start Date</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {new Date(myMembership.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-slate-800/80 p-3 border border-emerald-200/70 dark:border-emerald-700/70">
                    <p className="text-slate-500 dark:text-slate-400">End Date</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {new Date(myMembership.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-slate-800/80 p-3 border border-emerald-200/70 dark:border-emerald-700/70">
                    <p className="text-slate-500 dark:text-slate-400">Remaining Guest Passes</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {myMembership.remainingGuestPasses}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => cancelMembershipMutation.mutate(myMembership.id)}
                    disabled={cancelMembershipMutation.isPending}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelMembershipMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel At Period End'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-300 mt-3">No active membership found.</p>
            )}
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Available Plans</h2>
          </div>

          {plansQuery.isLoading ? (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-5 text-slate-600 dark:text-slate-300">
              No plans are currently available.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isCurrentPlan =
                  myMembership &&
                  myMembership.type === plan.type &&
                  myMembership.billingCycle === plan.billingCycle &&
                  myMembership.status !== 'CANCELLED' &&
                  myMembership.status !== 'EXPIRED';

                return (
                  <article
                    key={`${plan.type}-${plan.billingCycle}`}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatPlanName(plan.type, plan.billingCycle)}
                      </h3>
                      {isCurrentPlan && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">
                      {formatCurrency(Number(plan.price))}
                    </p>

                    <div className="space-y-2 mt-5 text-sm text-slate-700 dark:text-slate-300">
                      <p className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        Members: {plan.maxMembers}
                      </p>
                      <p className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-slate-500" />
                        Guest Passes: {plan.guestPasses}
                      </p>
                      <p className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-slate-500" />
                        Pool Discount: {plan.discountPercentage}%
                      </p>
                      <p className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                        Daily Access Limit: {plan.dailyAccessLimit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        createMembershipMutation.mutate({
                          type: plan.type,
                          billingCycle: plan.billingCycle,
                        })
                      }
                      disabled={!user || hasActiveMembership || createMembershipMutation.isPending}
                      className="mt-6 w-full inline-flex items-center justify-center rounded-lg px-4 py-2 bg-primary text-white hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {createMembershipMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Subscribing...
                        </>
                      ) : !user ? (
                        'Sign In To Subscribe'
                      ) : hasActiveMembership ? (
                        'Membership Already Active'
                      ) : (
                        'Choose Plan'
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
