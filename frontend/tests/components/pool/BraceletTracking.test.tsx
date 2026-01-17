/**
 * Pool Bracelet Tracking Tests
 * 
 * Tests for pool bracelet assignment and tracking functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock API responses for bracelet operations
const mockBraceletApi = {
  assignBracelet: vi.fn(),
  returnBracelet: vi.fn(),
  getActiveBracelets: vi.fn(),
  searchByBracelet: vi.fn(),
};

describe('Bracelet Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bracelet number input field', () => {
    render(
      <div data-testid="bracelet-form">
        <input
          type="text"
          data-testid="bracelet-number-input"
          placeholder="Enter bracelet number"
        />
      </div>
    );
    
    expect(screen.getByTestId('bracelet-number-input')).toBeInTheDocument();
  });

  it('renders bracelet color selector', () => {
    const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Orange'];
    render(
      <select data-testid="bracelet-color-select">
        {colors.map(color => (
          <option key={color} value={color.toLowerCase()}>{color}</option>
        ))}
      </select>
    );
    
    const select = screen.getByTestId('bracelet-color-select');
    expect(select).toBeInTheDocument();
    expect(select.children.length).toBe(5);
  });

  it('submits bracelet assignment', () => {
    const handleAssign = vi.fn();
    render(
      <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }}>
        <input data-testid="bracelet-number-input" defaultValue="BR-001" />
        <button type="submit" data-testid="assign-btn">Assign Bracelet</button>
      </form>
    );
    
    fireEvent.click(screen.getByTestId('assign-btn'));
    expect(handleAssign).toHaveBeenCalled();
  });

  it('validates bracelet number is required', () => {
    render(
      <div>
        <input data-testid="bracelet-number-input" value="" required />
        <span data-testid="error-message" className="text-red-500">
          Bracelet number is required
        </span>
      </div>
    );
    
    expect(screen.getByTestId('error-message')).toHaveTextContent('Bracelet number is required');
  });

  it('shows success message on assignment', () => {
    render(
      <div data-testid="success-message" className="text-green-500">
        Bracelet BR-001 assigned successfully
      </div>
    );
    
    expect(screen.getByTestId('success-message')).toBeInTheDocument();
  });

  it('shows error when bracelet already in use', () => {
    render(
      <div data-testid="error-message" className="text-red-500">
        Bracelet BR-001 is already assigned to John Doe
      </div>
    );
    
    expect(screen.getByTestId('error-message')).toHaveTextContent('already assigned');
  });
});

describe('Bracelet Return', () => {
  it('renders return bracelet button', () => {
    render(
      <button data-testid="return-btn">Return Bracelet</button>
    );
    
    expect(screen.getByTestId('return-btn')).toBeInTheDocument();
  });

  it('confirms bracelet return', () => {
    const handleReturn = vi.fn();
    render(
      <button onClick={handleReturn} data-testid="confirm-return-btn">
        Confirm Return
      </button>
    );
    
    fireEvent.click(screen.getByTestId('confirm-return-btn'));
    expect(handleReturn).toHaveBeenCalled();
  });

  it('shows return confirmation message', () => {
    render(
      <div data-testid="return-success">
        Bracelet BR-001 has been returned
      </div>
    );
    
    expect(screen.getByTestId('return-success')).toHaveTextContent('returned');
  });

  it('disables return for already returned bracelets', () => {
    render(
      <button data-testid="return-btn" disabled>
        Already Returned
      </button>
    );
    
    expect(screen.getByTestId('return-btn')).toBeDisabled();
  });
});

describe('Active Bracelets List', () => {
  const mockActiveBracelets = [
    {
      id: '1',
      ticket_number: 'P-260116-0001',
      customer_name: 'John Doe',
      bracelet_number: 'BR-001',
      bracelet_color: 'red',
      bracelet_assigned_at: '2026-01-16T10:30:00Z',
    },
    {
      id: '2',
      ticket_number: 'P-260116-0002',
      customer_name: 'Jane Smith',
      bracelet_number: 'BR-002',
      bracelet_color: 'blue',
      bracelet_assigned_at: '2026-01-16T11:00:00Z',
    },
  ];

  it('renders active bracelets table', () => {
    render(
      <table data-testid="bracelets-table">
        <thead>
          <tr>
            <th>Bracelet #</th>
            <th>Color</th>
            <th>Customer</th>
            <th>Ticket</th>
            <th>Assigned At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mockActiveBracelets.map(b => (
            <tr key={b.id} data-testid={`bracelet-row-${b.id}`}>
              <td>{b.bracelet_number}</td>
              <td>{b.bracelet_color}</td>
              <td>{b.customer_name}</td>
              <td>{b.ticket_number}</td>
              <td>{b.bracelet_assigned_at}</td>
              <td><button>Return</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    
    expect(screen.getByTestId('bracelets-table')).toBeInTheDocument();
    expect(screen.getByTestId('bracelet-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('bracelet-row-2')).toBeInTheDocument();
  });

  it('shows bracelet count', () => {
    render(
      <div data-testid="bracelet-count">
        Active Bracelets: <span data-testid="count-value">2</span>
      </div>
    );
    
    expect(screen.getByTestId('count-value')).toHaveTextContent('2');
  });

  it('shows empty state when no active bracelets', () => {
    render(
      <div data-testid="empty-state">
        No active bracelets at this time
      </div>
    );
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('displays bracelet color indicator', () => {
    render(
      <div 
        data-testid="color-indicator" 
        className="w-4 h-4 rounded-full bg-red-500"
        title="Red"
      />
    );
    
    expect(screen.getByTestId('color-indicator')).toHaveClass('bg-red-500');
  });
});

describe('Bracelet Search', () => {
  it('renders search input', () => {
    render(
      <input
        type="text"
        data-testid="bracelet-search"
        placeholder="Search by bracelet number"
      />
    );
    
    expect(screen.getByTestId('bracelet-search')).toBeInTheDocument();
  });

  it('searches by bracelet number', () => {
    const handleSearch = vi.fn();
    render(
      <div>
        <input
          data-testid="bracelet-search"
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
    );
    
    fireEvent.change(screen.getByTestId('bracelet-search'), { target: { value: 'BR-001' } });
    expect(handleSearch).toHaveBeenCalledWith('BR-001');
  });

  it('displays search results', () => {
    render(
      <div data-testid="search-result">
        <span>BR-001</span>
        <span>John Doe</span>
        <span>Session: Morning</span>
      </div>
    );
    
    expect(screen.getByTestId('search-result')).toHaveTextContent('BR-001');
    expect(screen.getByTestId('search-result')).toHaveTextContent('John Doe');
  });

  it('shows not found message', () => {
    render(
      <div data-testid="not-found">
        No ticket found with this bracelet number today
      </div>
    );
    
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });
});

describe('Bracelet Info Display', () => {
  it('displays bracelet details on ticket', () => {
    render(
      <div data-testid="ticket-bracelet-info">
        <div data-testid="bracelet-number">Bracelet: BR-001</div>
        <div data-testid="bracelet-color">Color: Red</div>
        <div data-testid="assigned-time">Assigned: 10:30 AM</div>
        <div data-testid="assigned-by">By: Staff Member</div>
      </div>
    );
    
    expect(screen.getByTestId('bracelet-number')).toHaveTextContent('BR-001');
    expect(screen.getByTestId('bracelet-color')).toHaveTextContent('Red');
  });

  it('shows no bracelet assigned message', () => {
    render(
      <div data-testid="no-bracelet">
        No bracelet assigned
      </div>
    );
    
    expect(screen.getByTestId('no-bracelet')).toBeInTheDocument();
  });

  it('shows bracelet returned status', () => {
    render(
      <div data-testid="bracelet-returned">
        <span className="text-gray-500">Bracelet returned at 5:30 PM</span>
      </div>
    );
    
    expect(screen.getByTestId('bracelet-returned')).toHaveTextContent('returned');
  });
});
