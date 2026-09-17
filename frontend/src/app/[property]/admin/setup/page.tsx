'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Building2,
  MapPin,
  Palette,
  Clock,
  Grid3X3,
  DollarSign,
  Package,
  Users,
  Mail,
  CreditCard,
  ArrowRight,
  Loader2,
  Shield,
  Terminal,
} from 'lucide-react';

const STEP_SLUGS = [
  'welcome',
  'property_details',
  'visual_design',
  'operating_hours',
  'modules',
  'payment_gateway',
  'transactional_emails',
  'staff_invitations',
  'taxes',
  'review',
] as const;

type StepSlug = typeof STEP_SLUGS[number];

interface StepState {
  status: 'pending' | 'completed' | 'skipped';
  data?: Record<string, unknown>;
}

interface OnboardingState {
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  current_step: string;
  steps: Record<string, StepState>;
}

const STEP_ICONS: Record<string, React.ElementType> = {
  welcome: Terminal,
  property_details: Building2,
  visual_design: Palette,
  operating_hours: Clock,
  modules: Grid3X3,
  payment_gateway: CreditCard,
  transactional_emails: Mail,
  staff_invitations: Users,
  taxes: DollarSign,
  review: Shield,
};

const STEP_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  property_details: 'Property Details',
  visual_design: 'Visual Design',
  operating_hours: 'Operating Hours',
  modules: 'Modules',
  payment_gateway: 'Payment Gateway',
  transactional_emails: 'Transactional Emails',
  staff_invitations: 'Staff Invitations',
  taxes: 'Tax & Fees',
  review: 'Review & Launch',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  welcome: 'Get oriented before you configure anything.',
  property_details: 'Name, address, phone, and email for the property.',
  visual_design: 'Theme color, accent, logo, and favicon.',
  operating_hours: 'Timezone and default reception hours.',
  modules: 'Pick the Engine A capability modules this property runs.',
  payment_gateway: 'Verify Stripe credentials before launch.',
  transactional_emails: 'Verify SMTP or SendGrid before launch.',
  staff_invitations: 'Invite the first staff members and assign roles.',
  taxes: 'Set the default tax rate and optional service charge.',
  review: 'Confirm everything looks right, then finalize.',
};

interface ModuleOption {
  value: string;
  label: string;
}

const DEFAULT_MODULES: ModuleOption[] = [
  { value: 'menu_service', label: 'Menu / Orders (instant transaction)' },
  { value: 'multi_day_booking', label: 'Reservations (time-exclusive)' },
  { value: 'session_access', label: 'Sessions / Capacity (shared access)' },
];

const FALLBACK_STEPS: Record<string, StepState> = Object.fromEntries(
  STEP_SLUGS.map((s) => [s, { status: 'pending' as const }]),
);

export default function AdminSetupPage() {
  const t = useTranslations('admin');
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const { user } = useAuth();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<StepSlug>('welcome');
  const [expandedStep, setExpandedStep] = useState<string | null>('welcome');
  const [verifyingStripe, setVerifyingStripe] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [brand, setBrand] = useState({ name: '', address: '', phone: '', email: '' });
  const [theme, setTheme] = useState({ themeColor: '#6366f1', accentColor: '#4f46e5', logoUrl: '', faviconUrl: '' });
  const [hours, setHours] = useState({ timezone: 'UTC', receptionHours: '24/7' });
  const [selectedModules, setSelectedModules] = useState<string[]>(['menu_service']);
  const [gateway, setGateway] = useState({ publicKey: '', secretKey: '' });
  const [smtp, setSmtp] = useState({ provider: 'smtp', host: '', port: '', secure: false, user: '', pass: '', fromEmail: '', apiKey: '', toEmail: '' });
  const [staffInvites, setStaffInvites] = useState<Array<{ name: string; email: string; role: string }>>([{ name: '', email: '', role: 'property_staff' }]);
  const [tax, setTax] = useState({ taxRate: '0', serviceCharge: '10' });

  const fetchState = useCallback(async () => {
    try {
      const res = await api.get(`/${propertySlug}/admin/onboarding`);
      if (res.data?.success && res.data?.data) {
        setState(res.data.data);
        if (res.data.data.completed) {
          toast.success('Onboarding already completed');
          window.location.href = `/${propertySlug}/admin`;
          return;
        }
        const cs = res.data.data.current_step;
        if (cs && STEP_SLUGS.includes(cs as StepSlug)) {
          setActiveStep(cs as StepSlug);
        }
      }
    } catch {
      toast.error('Failed to load onboarding state');
    } finally {
      setLoading(false);
    }
  }, [propertySlug]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const saveStep = useCallback(
    async (slug: string, data: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await api.put(`/${propertySlug}/admin/onboarding`, {
          current_step: slug,
          steps: { [slug]: { status: 'completed', data } },
        });
        if (res.data?.success) {
          setState((prev) => {
            if (!prev) return prev;
            const steps = { ...(prev.steps ?? {}), [slug]: { status: 'completed' as const, data } };
            return { ...prev, steps, current_step: slug, started_at: prev.started_at ?? new Date().toISOString() };
          });
          toast.success('Step saved');
        }
      } catch {
        toast.error('Failed to save step');
      } finally {
        setSaving(false);
      }
    },
    [propertySlug],
  );

  const next = useCallback(() => {
    const idx = STEP_SLUGS.indexOf(activeStep);
    if (idx < STEP_SLUGS.length - 1) {
      setActiveStep(STEP_SLUGS[idx + 1] as StepSlug);
      setExpandedStep(STEP_SLUGS[idx + 1]);
    }
  }, [activeStep]);

  const prev = useCallback(() => {
    const idx = STEP_SLUGS.indexOf(activeStep);
    if (idx > 0) {
      setActiveStep(STEP_SLUGS[idx - 1] as StepSlug);
      setExpandedStep(STEP_SLUGS[idx - 1]);
    }
  }, [activeStep]);

  const verifyStripe = useCallback(async () => {
    if (!gateway.secretKey) {
      toast.error('Stripe secret key is required');
      return;
    }
    setVerifyingStripe(true);
    try {
      const res = await api.post(`/${propertySlug}/admin/onboarding/verify-stripe`, { secretKey: gateway.secretKey });
      if (res.data?.success) {
        toast.success('Stripe credentials verified');
      } else {
        toast.error(res.data?.error ?? 'Stripe verification failed');
      }
    } catch {
      toast.error('Stripe verification failed');
    } finally {
      setVerifyingStripe(false);
    }
  }, [gateway.secretKey, propertySlug]);

  const testEmail = useCallback(async () => {
    if (!smtp.toEmail) {
      toast.error('Recipient email is required to test');
      return;
    }
    setTestingEmail(true);
    try {
      const body: Record<string, unknown> = { toEmail: smtp.toEmail };
      if (smtp.provider === 'sendgrid') {
        body.provider = 'sendgrid';
        body.apiKey = smtp.apiKey;
        body.fromEmail = smtp.fromEmail || 'noreply@example.com';
      } else {
        body.provider = 'smtp';
        body.host = smtp.host;
        body.port = Number(smtp.port);
        body.secure = smtp.secure;
        body.user = smtp.user;
        body.pass = smtp.pass;
        body.fromEmail = smtp.fromEmail || 'noreply@example.com';
      }
      const res = await api.post(`/${propertySlug}/admin/onboarding/test-email`, body);
      if (res.data?.success) {
        toast.success('Test email sent successfully');
      } else {
        toast.error(res.data?.error ?? 'Email test failed');
      }
    } catch {
      toast.error('Email test failed');
    } finally {
      setTestingEmail(false);
    }
  }, [smtp, propertySlug]);

  const finalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const body: Record<string, unknown> = {
        stripeSecretKey: gateway.secretKey || undefined,
        smtpApiKey: smtp.apiKey || undefined,
        smtpPass: smtp.pass || undefined,
        steps: {
          property_details: { status: 'completed', data: brand },
          visual_design: { status: 'completed', data: theme },
          operating_hours: { status: 'completed', data: hours },
          modules: { status: 'completed', data: { modules: selectedModules } },
          payment_gateway: { status: 'completed', data: gateway },
          transactional_emails: { status: 'completed', data: smtp },
          staff_invitations: { status: 'completed', data: { invitations: staffInvites.filter((s) => s.email) } },
          taxes: { status: 'completed', data: tax },
        },
      };
      const res = await api.post(`/${propertySlug}/admin/onboarding/finalize`, body);
      if (res.data?.success) {
        toast.success(`Onboarding finalized for ${res.data.data?.propertyName ?? 'the property'}`);
        window.location.href = `/${propertySlug}/admin`;
      } else {
        toast.error(res.data?.error ?? 'Finalization failed');
      }
    } catch {
      toast.error('Finalization failed');
    } finally {
      setFinalizing(false);
    }
  }, [gateway, smtp, staffInvites, tax, brand, theme, hours, selectedModules, propertySlug]);

  const stepStatus = (slug: string) => {
    if (!state) return 'pending';
    const s = state.steps?.[slug];
    return s?.status ?? 'pending';
  };

  const completedCount = STEP_SLUGS.filter((s) => stepStatus(s) === 'completed').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">Unable to load setup.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('setup.title') || 'Business Setup'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {user?.fullName ? `Signed in as ${user.fullName}` : 'Admin setup'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {completedCount} / {STEP_SLUGS.length} steps
            </span>
            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / STEP_SLUGS.length) * 100}%` }}
                className="h-full bg-blue-600"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Step list */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6">
        <div className="max-w-3xl mx-auto flex gap-1 overflow-x-auto pb-2">
          {STEP_SLUGS.map((slug) => {
            const Icon = STEP_ICONS[slug] || Terminal;
            const done = stepStatus(slug) === 'completed';
            const active = slug === activeStep;
            return (
              <button
                key={slug}
                onClick={() => setActiveStep(slug)}
                className={cn(
                  'flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg text-sm transition-all whitespace-nowrap',
                  active
                    ? 'bg-blue-600 text-white'
                    : done
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                {STEP_LABELS[slug]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step body */}
      <div className="px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {activeStep === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.welcome}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.welcome}</p>
                <div className="mt-6 grid gap-4">
                  <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <Building2 className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">One property, one setup</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Completing this wizard provisions the property, seeds settings, and installs the modules you select.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <Shield className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Server authority</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Stripe and SMTP credentials are verified server-side. The wizard never stores secrets in the browser.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <Terminal className="h-5 w-5 mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">One endpoint, one state machine</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Progress is saved to a single onboarding_state record and the wizard enforces the finish sequence for you.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={next}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Start setup <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'property_details' && (
              <motion.div
                key="property_details"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.property_details}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.property_details}</p>
                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Property name</span>
                    <input
                      value={brand.name}
                      onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="My Resort"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Address</span>
                    <input
                      value={brand.address}
                      onChange={(e) => setBrand((b) => ({ ...b, address: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="123 Main Street"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</span>
                    <input
                      value={brand.phone}
                      onChange={(e) => setBrand((b) => ({ ...b, phone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="+1 555 000 0000"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                    <input
                      type="email"
                      value={brand.email}
                      onChange={(e) => setBrand((b) => ({ ...b, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="hello@example.com"
                    />
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('property_details', brand)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'visual_design' && (
              <motion.div
                key="visual_design"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.visual_design}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.visual_design}</p>
                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme color</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={theme.themeColor}
                        onChange={(e) => setTheme((t) => ({ ...t, themeColor: e.target.value }))}
                        className="h-10 w-20 rounded border border-slate-300 dark:border-slate-600 bg-white"
                      />
                      <input
                        value={theme.themeColor}
                        onChange={(e) => setTheme((t) => ({ ...t, themeColor: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Accent color</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={theme.accentColor}
                        onChange={(e) => setTheme((t) => ({ ...t, accentColor: e.target.value }))}
                        className="h-10 w-20 rounded border border-slate-300 dark:border-slate-600 bg-white"
                      />
                      <input
                        value={theme.accentColor}
                        onChange={(e) => setTheme((t) => ({ ...t, accentColor: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo URL (optional)</span>
                    <input
                      value={theme.logoUrl}
                      onChange={(e) => setTheme((t) => ({ ...t, logoUrl: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Favicon URL (optional)</span>
                    <input
                      value={theme.faviconUrl}
                      onChange={(e) => setTheme((t) => ({ ...t, faviconUrl: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('visual_design', theme)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'operating_hours' && (
              <motion.div
                key="operating_hours"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.operating_hours}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.operating_hours}</p>
                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
                    <select
                      value={hours.timezone}
                      onChange={(e) => setHours((h) => ({ ...h, timezone: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="UTC">UTC</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Reception hours</span>
                    <input
                      value={hours.receptionHours}
                      onChange={(e) => setHours((h) => ({ ...h, receptionHours: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="24/7"
                    />
                  </label>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('operating_hours', hours)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'modules' && (
              <motion.div
                key="modules"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.modules}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.modules}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Each module becomes an Engine A capability package for this property.
                </p>
                <div className="mt-6 space-y-2">
                  {DEFAULT_MODULES.map((m) => {
                    const selected = selectedModules.includes(m.value);
                    return (
                      <label
                        key={m.value}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                          selected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const next = selected
                              ? selectedModules.filter((v) => v !== m.value)
                              : [...selectedModules, m.value];
                            setSelectedModules(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('modules', { modules: selectedModules })}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'payment_gateway' && (
              <motion.div
                key="payment_gateway"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.payment_gateway}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.payment_gateway}</p>
                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Stripe publishable key</span>
                    <input
                      value={gateway.publicKey}
                      onChange={(e) => setGateway((g) => ({ ...g, publicKey: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="pk_test_..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Stripe secret key</span>
                    <input
                      value={gateway.secretKey}
                      onChange={(e) => setGateway((g) => ({ ...g, secretKey: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="sk_test_..."
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={verifyStripe}
                    disabled={!gateway.secretKey || verifyingStripe}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {verifyingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Verify credentials
                  </button>
                  {gateway.secretKey && !verifyingStripe && (
                    <span className="text-sm text-slate-500">Stored server-side during finalization.</span>
                  )}
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('payment_gateway', gateway)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'transactional_emails' && (
              <motion.div
                key="transactional_emails"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.transactional_emails}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.transactional_emails}</p>
                <div className="mt-6">
                  <label className="flex items-center gap-2 mb-4">
                    <input
                      type="radio"
                      name="email_provider"
                      checked={smtp.provider === 'smtp'}
                      onChange={() => setSmtp((s) => ({ ...s, provider: 'smtp' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SMTP</span>
                  </label>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="email_provider"
                      checked={smtp.provider === 'sendgrid'}
                      onChange={() => setSmtp((s) => ({ ...s, provider: 'sendgrid' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SendGrid</span>
                  </label>
                </div>
                {smtp.provider === 'smtp' ? (
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SMTP host</span>
                      <input
                        value={smtp.host}
                        onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="smtp.example.com"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Port</span>
                      <input
                        type="number"
                        value={smtp.port}
                        onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="587"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Secure (TLS)</span>
                      <input
                        type="checkbox"
                        checked={smtp.secure}
                        onChange={(e) => setSmtp((s) => ({ ...s, secure: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</span>
                      <input
                        value={smtp.user}
                        onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="user@example.com"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
                      <input
                        type="password"
                        value={smtp.pass}
                        onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="••••••••"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">From email</span>
                      <input
                        value={smtp.fromEmail}
                        onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="noreply@example.com"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Test recipient email</span>
                      <input
                        value={smtp.toEmail}
                        onChange={(e) => setSmtp((s) => ({ ...s, toEmail: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="you@example.com"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SendGrid API key</span>
                      <input
                        type="password"
                        value={smtp.apiKey}
                        onChange={(e) => setSmtp((s) => ({ ...s, apiKey: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="SG...."
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">From email</span>
                      <input
                        value={smtp.fromEmail}
                        onChange={(e) => setSmtp((s) => ({ ...s, fromEmail: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="noreply@example.com"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Test recipient email</span>
                      <input
                        value={smtp.toEmail}
                        onChange={(e) => setSmtp((s) => ({ ...s, toEmail: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="you@example.com"
                      />
                    </label>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={testEmail}
                    disabled={!smtp.toEmail || testingEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send test email
                  </button>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('transactional_emails', smtp)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'staff_invitations' && (
              <motion.div
                key="staff_invitations"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.staff_invitations}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.staff_invitations}</p>
                <div className="mt-6 space-y-4">
                  {staffInvites.map((invite, idx) => (
                    <div key={idx} className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
                          <input
                            value={invite.name}
                            onChange={(e) => {
                              const next = [...staffInvites];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setStaffInvites(next);
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Jane Doe"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                          <input
                            type="email"
                            value={invite.email}
                            onChange={(e) => {
                              const next = [...staffInvites];
                              next[idx] = { ...next[idx], email: e.target.value };
                              setStaffInvites(next);
                            }}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="jane@example.com"
                          />
                        </label>
                      </div>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
                        <select
                          value={invite.role}
                          onChange={(e) => {
                            const next = [...staffInvites];
                            next[idx] = { ...next[idx], role: e.target.value };
                            setStaffInvites(next);
                          }}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="property_staff">Staff</option>
                          <option value="property_manager">Manager</option>
                          <option value="tenant_admin">Admin</option>
                        </select>
                      </label>
                    </div>
                  ))}
                  <button
                    onClick={() => setStaffInvites((prev) => [...prev, { name: '', email: '', role: 'property_staff' }])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Add another staff member
                  </button>
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('staff_invitations', { invitations: staffInvites.filter((s) => s.email) })}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'taxes' && (
              <motion.div
                key="taxes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.taxes}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.taxes}</p>
                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Default tax rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={tax.taxRate}
                      onChange={(e) => setTax((t) => ({ ...t, taxRate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Service charge (%) — optional</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={tax.serviceCharge}
                      onChange={(e) => setTax((t) => ({ ...t, serviceCharge: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0"
                    />
                  </label>
                </div>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Both rates are persisted to tax_configuration and editable later from Tax Configuration. No delivery fee is created here — add one from the Tax page if needed.
                </p>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={() => saveStep('taxes', tax)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {STEP_LABELS.review}
                </h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">{STEP_DESCRIPTIONS.review}</p>
                <div className="mt-6 space-y-4">
                  {STEP_SLUGS.filter((s) => s !== 'welcome' && s !== 'review').map((s) => {
                    const done = stepStatus(s) === 'completed';
                    return (
                      <div
                        key={s}
                        className={cn(
                          'flex items-center justify-between p-4 rounded-lg',
                          done ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-50 dark:bg-slate-700/50',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {done ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /> : <Package className="h-5 w-5 text-slate-400" />}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{STEP_LABELS[s]}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {done ? (t('setup.stepCompleted') ?? 'Completed') : (t('setup.stepPending') ?? 'Not completed')}
                            </p>
                          </div>
                        </div>
                        {done && <span className="text-xs text-green-600 dark:text-green-400">Done</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-between">
                  <button onClick={prev} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={finalize}
                    disabled={finalizing || completedCount < STEP_SLUGS.filter((s) => s !== 'welcome').length}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                    Finalize & launch
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Complete all steps before finalizing. Finalization provisions the property, seeds settings, and installs selected modules.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

import { ChevronLeft } from 'lucide-react';
