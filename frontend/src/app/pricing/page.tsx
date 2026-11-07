'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Check, Sparkles, Building2, Layers, Users, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  feature_limits: {
    max_properties?: number;
    max_modules?: number;
    max_users?: number;
    [key: string]: unknown;
  };
  sort_order: number;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout modal
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    subdomain: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        setLoading(true);
        const res = await api.get('/platform/plans');
        if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setPlans(res.data.data);
        } else {
          // Fallback to standard platform plans if DB not yet seeded
          setPlans([
            {
              id: 'starter',
              code: 'starter',
              name: 'Starter',
              description: 'For boutique resorts and single-property operators.',
              price_monthly_cents: 9900,
              price_annual_cents: 99000,
              feature_limits: { max_properties: 1, max_modules: 5, max_users: 10 },
              sort_order: 1,
            },
            {
              id: 'growth',
              code: 'growth',
              name: 'Growth',
              description: 'For growing hospitality groups with multi-module operations.',
              price_monthly_cents: 29900,
              price_annual_cents: 299000,
              feature_limits: { max_properties: 3, max_modules: 15, max_users: 35 },
              sort_order: 2,
            },
            {
              id: 'enterprise',
              code: 'enterprise',
              name: 'Enterprise',
              description: 'Full white-label ecosystem with unlimited scale and custom modules.',
              price_monthly_cents: 99900,
              price_annual_cents: 999000,
              feature_limits: { max_properties: -1, max_modules: -1, max_users: -1 },
              sort_order: 3,
            },
          ]);
        }
      } catch (err: any) {
        setError('Failed to load plans from server');
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const handleStartCheckout = (plan: Plan) => {
    setSelectedPlan(plan);
    setCheckoutModalOpen(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.subdomain) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/platform/checkout', {
        tier: selectedPlan.code,
        email: checkoutForm.email,
        name: checkoutForm.name,
        subdomain: checkoutForm.subdomain.toLowerCase().trim(),
      });

      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
      } else {
        toast.success('Subscription initiated! Redirecting to setup...');
        setCheckoutModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="outline" className="px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200">
            <Sparkles className="w-4 h-4 mr-1 inline" /> V2 Ecosystem SaaS
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Simple, transparent plans for modern hospitality
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Choose the subscription that fits your resort or property portfolio. Every plan includes full access to our 5-engine transactional platform and a 14-day free trial.
          </p>

          {/* Billing Cycle Switch */}
          <div className="flex items-center justify-center pt-4">
            <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl inline-flex">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Monthly billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Annual billing
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isPopular = plan.code === 'growth';
            const priceCents = billingCycle === 'annual' ? plan.price_annual_cents / 12 : plan.price_monthly_cents;
            const priceFormatted = `$${Math.round(priceCents / 100)}`;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-2xl transition-all duration-300 ${
                  isPopular
                    ? 'border-2 border-indigo-600 shadow-xl dark:shadow-indigo-950/20'
                    : 'border border-slate-200 dark:border-slate-800 hover:shadow-lg'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="pt-8">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400 min-h-[40px] mt-2">
                    {plan.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      {priceFormatted}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">/ month</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Billed annually (${(plan.price_annual_cents / 100).toFixed(0)}/yr)
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <span>
                        {plan.feature_limits?.max_properties === -1
                          ? 'Unlimited properties'
                          : `${plan.feature_limits?.max_properties ?? 1} Properties included`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      <span>
                        {plan.feature_limits?.max_modules === -1
                          ? 'Unlimited modules'
                          : `${plan.feature_limits?.max_modules ?? 3} Active modules`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>
                        {plan.feature_limits?.max_users === -1
                          ? 'Unlimited team members'
                          : `${plan.feature_limits?.max_users ?? 5} Staff accounts`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>All 5 transactional engines</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      <span>14-day free trial included</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pb-8">
                  <Button
                    onClick={() => handleStartCheckout(plan)}
                    className={`w-full py-6 text-base font-semibold gap-2 ${
                      isPopular
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                    }`}
                  >
                    Start 14-day trial
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Subscribe to V2 {selectedPlan?.name}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCheckoutSubmit} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkout-name">Your Full Name</Label>
              <Input
                id="checkout-name"
                required
                placeholder="Jane Doe"
                value={checkoutForm.name}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkout-email">Business Email</Label>
              <Input
                id="checkout-email"
                type="email"
                required
                placeholder="jane@resort.com"
                value={checkoutForm.email}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="checkout-subdomain">Desired Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="checkout-subdomain"
                  required
                  placeholder="myresort"
                  value={checkoutForm.subdomain}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                />
                <span className="text-sm text-slate-500 font-mono">.v2platform.com</span>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCheckoutModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {submitting ? 'Creating Session...' : 'Proceed to Stripe Checkout'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
