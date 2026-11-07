import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Public SaaS Pricing & Checkout Flow (Engine E)', () => {
  const mockPlans = [
    {
      id: 'plan-starter',
      code: 'starter',
      name: 'Starter Tier',
      description: 'Single property starter plan',
      price_monthly_cents: 9900,
      price_annual_cents: 99000,
      feature_limits: { max_properties: 1, max_modules: 5, max_users: 10 },
      sort_order: 1,
    },
    {
      id: 'plan-growth',
      code: 'growth',
      name: 'Growth Tier',
      description: 'Multi-property growth plan',
      price_monthly_cents: 29900,
      price_annual_cents: 299000,
      feature_limits: { max_properties: 3, max_modules: 15, max_users: 35 },
      sort_order: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: mockPlans } });
  });

  it('renders plans from /platform/plans endpoint', async () => {
    render(<PricingPage />);

    expect(api.get).toHaveBeenCalledWith('/platform/plans');
    await waitFor(() => {
      expect(screen.getByText('Starter Tier')).toBeInTheDocument();
      expect(screen.getByText('Growth Tier')).toBeInTheDocument();
      expect(screen.getByText('$99')).toBeInTheDocument();
      expect(screen.getByText('$299')).toBeInTheDocument();
    });
  });

  it('toggles annual billing and displays 20% discount prices', async () => {
    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Starter Tier')).toBeInTheDocument();
    });

    const annualBtn = screen.getByText(/Annual billing/i);
    fireEvent.click(annualBtn);

    // Annual starter is 99000/12 = 8250 cents = $83/mo
    await waitFor(() => {
      expect(screen.getByText('$83')).toBeInTheDocument();
    });
  });

  it('opens trial signup modal and posts to /platform/checkout', async () => {
    delete (window as any).location;
    window.location = { href: '' } as any;

    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { url: 'https://checkout.stripe.com/pay/cs_test_saas_123' },
      },
    });

    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Starter Tier')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /Start 14-day trial/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Subscribe to V2 Starter Tier')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your Full Name/i), { target: { value: 'Alice Founder' } });
    fireEvent.change(screen.getByLabelText(/Business Email/i), { target: { value: 'alice@resortgroup.com' } });
    fireEvent.change(screen.getByLabelText(/Desired Subdomain/i), { target: { value: 'aliceresort' } });

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Stripe Checkout/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/platform/checkout', {
        tier: 'starter',
        email: 'alice@resortgroup.com',
        name: 'Alice Founder',
        subdomain: 'aliceresort',
      });
      expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_test_saas_123');
    });
  });
});
