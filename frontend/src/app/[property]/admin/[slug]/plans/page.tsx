'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, CreditCard } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  feature_limits: Record<string, number>;
  stripe_product_id: string | null;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PlanFormState {
  code: string;
  name: string;
  description: string;
  price_monthly_dollars: string;
  price_annual_dollars: string;
  max_properties: string;
  max_properties_unlimited: boolean;
  max_modules: string;
  max_modules_unlimited: boolean;
  max_users: string;
  max_users_unlimited: boolean;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_FORM: PlanFormState = {
  code: '',
  name: '',
  description: '',
  price_monthly_dollars: '',
  price_annual_dollars: '',
  max_properties: '1',
  max_properties_unlimited: false,
  max_modules: '3',
  max_modules_unlimited: false,
  max_users: '5',
  max_users_unlimited: false,
  is_active: true,
  sort_order: '0',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const parsed = parseFloat(dollars);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

function planToForm(plan: Plan): PlanFormState {
  const lim = plan.feature_limits || {};
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    price_monthly_dollars: centsToDisplay(plan.price_monthly_cents),
    price_annual_dollars: centsToDisplay(plan.price_annual_cents),
    max_properties: lim.max_properties === -1 ? '1' : String(lim.max_properties ?? 1),
    max_properties_unlimited: lim.max_properties === -1,
    max_modules: lim.max_modules === -1 ? '1' : String(lim.max_modules ?? 3),
    max_modules_unlimited: lim.max_modules === -1,
    max_users: lim.max_users === -1 ? '1' : String(lim.max_users ?? 5),
    max_users_unlimited: lim.max_users === -1,
    is_active: plan.is_active,
    sort_order: String(plan.sort_order),
  };
}

function limitLabel(val: number): string {
  return val === -1 ? '∞' : String(val);
}

const LIMIT_ROWS = [
  { key: 'max_properties' as const, unlimitedKey: 'max_properties_unlimited' as const, label: 'Properties' },
  { key: 'max_modules'    as const, unlimitedKey: 'max_modules_unlimited'    as const, label: 'Modules'    },
  { key: 'max_users'      as const, unlimitedKey: 'max_users_unlimited'      as const, label: 'Users'      },
] as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Data ───────────────────────────────────────────────────

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/plans');
      setPlans(res.data.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ── Dialog ─────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm(planToForm(plan));
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    setFormError(null);
  };

  // ── Save ───────────────────────────────────────────────────

  const handleSave = async () => {
    setFormError(null);
    if (!form.code.trim()) return setFormError('Plan code is required');
    if (!form.name.trim()) return setFormError('Name is required');

    const feature_limits = {
      max_properties: form.max_properties_unlimited ? -1 : (parseInt(form.max_properties, 10) || 1),
      max_modules:    form.max_modules_unlimited    ? -1 : (parseInt(form.max_modules, 10)    || 1),
      max_users:      form.max_users_unlimited      ? -1 : (parseInt(form.max_users, 10)      || 1),
    };

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_monthly_cents: dollarsToCents(form.price_monthly_dollars),
      price_annual_cents:  dollarsToCents(form.price_annual_dollars),
      feature_limits,
      is_active: form.is_active,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };

    try {
      setSaving(true);
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/admin/plans', payload);
      }
      closeDialog();
      fetchPlans();
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────

  const openDelete = (plan: Plan) => {
    setDeleteTarget(plan);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(`/admin/plans/${deleteTarget.id}`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchPlans();
    } catch (err: any) {
      console.error('[Plans] Delete failed', err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prices in USD · Stripe products are created automatically on save
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Plan cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-card h-64 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="font-medium text-muted-foreground">No plans yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first subscription plan to get started.
          </p>
          <Button onClick={openCreate} className="mt-4 gap-2" variant="outline">
            <Plus className="h-4 w-4" /> New Plan
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const lim = plan.feature_limits || {};
            const stripeConnected = !!plan.stripe_product_id;
            return (
              <div
                key={plan.id}
                className="rounded-xl border bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Card body */}
                <div className="p-5 flex-1 space-y-4">

                  {/* Name + status + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg leading-tight">{plan.name}</h2>
                        <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-xs">
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.code}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(plan)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Monthly</p>
                      <p className="font-semibold">${centsToDisplay(plan.price_monthly_cents)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Annual</p>
                      <p className="font-semibold">${centsToDisplay(plan.price_annual_cents)}</p>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Limits</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Properties', val: lim.max_properties },
                        { label: 'Modules',    val: lim.max_modules    },
                        { label: 'Users',      val: lim.max_users      },
                      ].map(({ label, val }) => (
                        <div key={label} className="rounded-lg border px-2 py-2">
                          <p className="text-lg font-bold">{val !== undefined ? limitLabel(val) : '—'}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card footer — Stripe sync status */}
                <div className="border-t px-5 py-3 flex items-center gap-3 bg-muted/30">
                  {stripeConnected ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-muted-foreground">Synced to Stripe</span>
                      <span className="text-xs text-muted-foreground/50 font-mono ml-auto truncate">
                        {plan.stripe_product_id}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="text-xs text-muted-foreground">Not synced to Stripe</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit dialog ───────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? `Edit "${editingPlan.name}"` : 'New Plan'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Code + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Plan Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. starter"
                  value={form.code}
                  disabled={!!editingPlan}
                  onChange={(e) =>
                    setForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))
                  }
                />
                {editingPlan && (
                  <p className="text-xs text-muted-foreground">Codes are permanent identifiers and cannot be changed.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Starter"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <textarea
                id="description"
                rows={2}
                placeholder="Short tagline shown on the pricing page"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           ring-offset-background placeholder:text-muted-foreground resize-none
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                           focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Pricing */}
            <div>
              <Label className="mb-2 block">Pricing (USD)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Monthly</p>
                  <Input
                    type="number" step="0.01" min="0" placeholder="29.00"
                    value={form.price_monthly_dollars}
                    onChange={(e) => setForm(f => ({ ...f, price_monthly_dollars: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Annual</p>
                  <Input
                    type="number" step="0.01" min="0" placeholder="290.00"
                    value={form.price_annual_dollars}
                    onChange={(e) => setForm(f => ({ ...f, price_annual_dollars: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Stripe prices are created automatically when you save.
                {editingPlan?.stripe_product_id && ' Changing a price archives the old Stripe price and creates a new one.'}
              </p>
            </div>

            {/* Feature limits */}
            <div>
              <Label className="mb-2 block">Feature Limits</Label>
              <div className="rounded-lg border divide-y">
                {LIMIT_ROWS.map(({ key, unlimitedKey, label }) => (
                  <div key={key} className="flex items-center gap-4 px-4 py-3">
                    <span className="text-sm w-24 shrink-0">{label}</span>
                    <Input
                      type="number" min="1"
                      className="w-24"
                      value={form[key]}
                      disabled={form[unlimitedKey]}
                      onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                    <div className="flex items-center gap-2 ml-auto">
                      <Switch
                        checked={form[unlimitedKey]}
                        onCheckedChange={(checked) => setForm(f => ({ ...f, [unlimitedKey]: checked }))}
                      />
                      <span className="text-sm text-muted-foreground">Unlimited</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sort order + Active */}
            <div className="flex items-center gap-6">
              <div className="space-y-1.5 w-28">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order" type="number" min="0"
                  value={form.sort_order}
                  onChange={(e) => setForm(f => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            {/* Stripe sync status (edit only) */}
            {editingPlan && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3">
                {editingPlan.stripe_product_id ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Synced to Stripe</p>
                      <p className="text-xs text-muted-foreground font-mono">{editingPlan.stripe_product_id}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Not synced to Stripe</p>
                      <p className="text-xs text-muted-foreground">Saving will create a Stripe product if STRIPE_SECRET_KEY is configured.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ──────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) setDeleteDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete{' '}
            <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>?
            {' '}This cannot be undone.{' '}
            {deleteTarget?.stripe_product_id && 'The Stripe product will be archived. '}
            Don't delete a plan with active subscribers.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
