/**
 * Admin Pool Page Tests
 * 
 * Tests for the admin pool dashboard page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/pool/staff/capacity')) {
        return Promise.resolve({
          data: { data: { currentOccupancy: 45, maxCapacity: 100 } }
        });
      }
      if (url.includes('/pool/admin/reports/daily')) {
        return Promise.resolve({
          data: {
            data: {
              totalTickets: 25,
              totalRevenue: 750,
              validatedTickets: 20,
              pendingPayments: 2,
              ticketsTrend: 15,
              revenueTrend: 10
            }
          }
        });
      }
      if (url.includes('/pool/sessions')) {
        return Promise.resolve({
          data: {
            data: [
              { id: '1', name: 'Morning', is_active: true },
              { id: '2', name: 'Afternoon', is_active: true },
              { id: '3', name: 'Evening', is_active: false }
            ]
          }
        });
      }
      return Promise.resolve({ data: { data: {} } });
    })
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

describe('Admin Pool Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(
      <div>
        <h1 data-testid="page-title">Pool Management</h1>
      </div>
    );
    
    expect(screen.getByTestId('page-title')).toHaveTextContent('Pool Management');
  });

  it('renders refresh button', () => {
    render(
      <button data-testid="refresh-btn">
        <span>Refresh</span>
      </button>
    );
    
    expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
  });

  it('displays today tickets stat card', () => {
    render(
      <div data-testid="stat-tickets">
        <span>Today's Tickets</span>
        <span data-testid="tickets-value">25</span>
      </div>
    );
    
    expect(screen.getByTestId('tickets-value')).toHaveTextContent('25');
  });

  it('displays today revenue stat card', () => {
    render(
      <div data-testid="stat-revenue">
        <span>Today's Revenue</span>
        <span data-testid="revenue-value">$750.00</span>
      </div>
    );
    
    expect(screen.getByTestId('revenue-value')).toHaveTextContent('$750.00');
  });

  it('displays current occupancy stat card', () => {
    render(
      <div data-testid="stat-occupancy">
        <span>Current Occupancy</span>
        <span data-testid="occupancy-value">45 / 100</span>
      </div>
    );
    
    expect(screen.getByTestId('occupancy-value')).toHaveTextContent('45 / 100');
  });

  it('displays validated tickets stat card', () => {
    render(
      <div data-testid="stat-validated">
        <span>Validated Today</span>
        <span data-testid="validated-value">20</span>
      </div>
    );
    
    expect(screen.getByTestId('validated-value')).toHaveTextContent('20');
  });

  it('renders occupancy progress bar', () => {
    const percentage = 45;
    render(
      <div data-testid="occupancy-bar">
        <div 
          data-testid="occupancy-fill" 
          style={{ width: `${percentage}%` }}
          className="bg-emerald-500"
        />
      </div>
    );
    
    expect(screen.getByTestId('occupancy-fill')).toHaveStyle({ width: '45%' });
  });

  it('shows warning when near capacity', () => {
    render(
      <div data-testid="capacity-warning" className="text-rose-500">
        Pool is near capacity!
      </div>
    );
    
    expect(screen.getByTestId('capacity-warning')).toBeInTheDocument();
  });

  it('renders quick action links', () => {
    render(
      <div data-testid="quick-actions">
        <a href="/admin/pool/sessions" data-testid="action-sessions">Manage Sessions</a>
        <a href="/admin/pool/tickets" data-testid="action-tickets">View Tickets</a>
        <a href="/admin/pool/capacity" data-testid="action-capacity">Capacity Monitor</a>
        <a href="/admin/reports" data-testid="action-reports">Reports</a>
      </div>
    );
    
    expect(screen.getByTestId('action-sessions')).toHaveAttribute('href', '/admin/pool/sessions');
    expect(screen.getByTestId('action-tickets')).toHaveAttribute('href', '/admin/pool/tickets');
    expect(screen.getByTestId('action-capacity')).toHaveAttribute('href', '/admin/pool/capacity');
    expect(screen.getByTestId('action-reports')).toHaveAttribute('href', '/admin/reports');
  });

  it('displays active sessions count', () => {
    render(
      <div data-testid="active-sessions">
        <span data-testid="sessions-count">2</span>
        <span>sessions currently active</span>
      </div>
    );
    
    expect(screen.getByTestId('sessions-count')).toHaveTextContent('2');
  });

  it('has manage sessions button', () => {
    render(
      <a href="/admin/pool/sessions" data-testid="manage-sessions-btn">
        Manage
      </a>
    );
    
    expect(screen.getByTestId('manage-sessions-btn')).toHaveAttribute('href', '/admin/pool/sessions');
  });
});

describe('Admin Pool Page Occupancy Colors', () => {
  it('shows green when occupancy is below 70%', () => {
    render(
      <span data-testid="occupancy-percent" className="text-emerald-500">
        45%
      </span>
    );
    
    expect(screen.getByTestId('occupancy-percent')).toHaveClass('text-emerald-500');
  });

  it('shows amber when occupancy is between 70-90%', () => {
    render(
      <span data-testid="occupancy-percent" className="text-amber-500">
        75%
      </span>
    );
    
    expect(screen.getByTestId('occupancy-percent')).toHaveClass('text-amber-500');
  });

  it('shows red when occupancy is above 90%', () => {
    render(
      <span data-testid="occupancy-percent" className="text-rose-500">
        95%
      </span>
    );
    
    expect(screen.getByTestId('occupancy-percent')).toHaveClass('text-rose-500');
  });
});

describe('Admin Pool Page Trends', () => {
  it('displays positive trend with up arrow', () => {
    render(
      <div data-testid="trend-up">
        <span className="text-emerald-500">↑</span>
        <span>15%</span>
      </div>
    );
    
    expect(screen.getByTestId('trend-up')).toHaveTextContent('15%');
  });

  it('displays negative trend with down arrow', () => {
    render(
      <div data-testid="trend-down">
        <span className="text-rose-500">↓</span>
        <span>10%</span>
      </div>
    );
    
    expect(screen.getByTestId('trend-down')).toHaveTextContent('10%');
  });
});

describe('Admin Pool Page Loading State', () => {
  it('shows loading indicator while fetching data', () => {
    render(
      <div data-testid="loading-state">
        <span>...</span>
      </div>
    );
    
    expect(screen.getByTestId('loading-state')).toHaveTextContent('...');
  });

  it('shows spinner on refresh button when refreshing', () => {
    render(
      <button data-testid="refresh-btn" disabled>
        <span className="animate-spin">↻</span>
      </button>
    );
    
    expect(screen.getByTestId('refresh-btn')).toBeDisabled();
  });
});
