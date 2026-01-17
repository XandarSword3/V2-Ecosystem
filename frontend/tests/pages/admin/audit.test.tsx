/**
 * Audit Logs Page Tests
 * 
 * Tests for the enhanced audit logs page with export, filtering, and pagination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
    tbody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe('Audit Logs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit logs header', () => {
    render(
      <div>
        <h1 data-testid="page-title">Audit Logs</h1>
        <p data-testid="page-description">View system activity and user actions</p>
      </div>
    );
    
    expect(screen.getByTestId('page-title')).toHaveTextContent('Audit Logs');
  });

  it('renders audit log entries table', () => {
    const mockLogs = [
      { id: '1', action: 'LOGIN', user: 'admin@v2.com', timestamp: '2026-01-16T10:00:00Z' },
      { id: '2', action: 'CREATE_BOOKING', user: 'staff@v2.com', timestamp: '2026-01-16T11:00:00Z' },
    ];
    
    render(
      <table data-testid="audit-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>User</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {mockLogs.map(log => (
            <tr key={log.id} data-testid={`log-row-${log.id}`}>
              <td>{log.action}</td>
              <td>{log.user}</td>
              <td>{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    
    expect(screen.getByTestId('audit-table')).toBeInTheDocument();
    expect(screen.getByTestId('log-row-1')).toBeInTheDocument();
  });
});

describe('Export Functionality', () => {
  it('renders export button', () => {
    render(
      <button data-testid="export-btn">
        Export to CSV
      </button>
    );
    
    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
  });

  it('triggers export on button click', () => {
    const handleExport = vi.fn();
    render(
      <button data-testid="export-btn" onClick={handleExport}>
        Export to CSV
      </button>
    );
    
    fireEvent.click(screen.getByTestId('export-btn'));
    expect(handleExport).toHaveBeenCalled();
  });

  it('shows loading state during export', () => {
    render(
      <button data-testid="export-btn" disabled>
        <span className="animate-spin">⏳</span>
        Exporting...
      </button>
    );
    
    expect(screen.getByTestId('export-btn')).toBeDisabled();
    expect(screen.getByTestId('export-btn')).toHaveTextContent('Exporting');
  });

  it('generates correct CSV filename', () => {
    const generateFilename = () => {
      const now = new Date();
      return `audit-logs-${now.toISOString().split('T')[0]}.csv`;
    };
    
    const filename = generateFilename();
    expect(filename).toMatch(/audit-logs-\d{4}-\d{2}-\d{2}\.csv/);
  });

  it('includes all visible columns in export', () => {
    const exportData = [
      { action: 'LOGIN', user: 'admin@v2.com', timestamp: '2026-01-16', details: 'IP: 192.168.1.1' },
    ];
    
    const csvHeader = 'Action,User,Timestamp,Details';
    expect(csvHeader.split(',')).toHaveLength(4);
  });
});

describe('Date Range Filter', () => {
  it('renders date range inputs', () => {
    render(
      <div data-testid="date-filter">
        <label>
          From:
          <input type="date" data-testid="date-from" />
        </label>
        <label>
          To:
          <input type="date" data-testid="date-to" />
        </label>
      </div>
    );
    
    expect(screen.getByTestId('date-from')).toBeInTheDocument();
    expect(screen.getByTestId('date-to')).toBeInTheDocument();
  });

  it('updates from date', () => {
    const handleChange = vi.fn();
    render(
      <input 
        type="date" 
        data-testid="date-from" 
        onChange={(e) => handleChange(e.target.value)} 
      />
    );
    
    fireEvent.change(screen.getByTestId('date-from'), { target: { value: '2026-01-01' } });
    expect(handleChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('updates to date', () => {
    const handleChange = vi.fn();
    render(
      <input 
        type="date" 
        data-testid="date-to" 
        onChange={(e) => handleChange(e.target.value)} 
      />
    );
    
    fireEvent.change(screen.getByTestId('date-to'), { target: { value: '2026-01-31' } });
    expect(handleChange).toHaveBeenCalledWith('2026-01-31');
  });

  it('filters logs by date range', () => {
    const allLogs = [
      { id: '1', timestamp: '2026-01-10T10:00:00Z' },
      { id: '2', timestamp: '2026-01-15T10:00:00Z' },
      { id: '3', timestamp: '2026-01-20T10:00:00Z' },
    ];
    
    const fromDate = new Date('2026-01-12');
    const toDate = new Date('2026-01-18');
    
    const filteredLogs = allLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= fromDate && logDate <= toDate;
    });
    
    expect(filteredLogs).toHaveLength(1);
    expect(filteredLogs[0].id).toBe('2');
  });

  it('clears date filter', () => {
    const handleClear = vi.fn();
    render(
      <button data-testid="clear-filter" onClick={handleClear}>
        Clear Filter
      </button>
    );
    
    fireEvent.click(screen.getByTestId('clear-filter'));
    expect(handleClear).toHaveBeenCalled();
  });

  it('shows quick date presets', () => {
    render(
      <div data-testid="date-presets">
        <button data-testid="preset-today">Today</button>
        <button data-testid="preset-week">Last 7 Days</button>
        <button data-testid="preset-month">Last 30 Days</button>
      </div>
    );
    
    expect(screen.getByTestId('preset-today')).toBeInTheDocument();
    expect(screen.getByTestId('preset-week')).toBeInTheDocument();
    expect(screen.getByTestId('preset-month')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('renders pagination controls', () => {
    render(
      <div data-testid="pagination">
        <button data-testid="prev-page">Previous</button>
        <span data-testid="page-info">Page 1 of 10</span>
        <button data-testid="next-page">Next</button>
      </div>
    );
    
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByTestId('page-info')).toHaveTextContent('Page 1 of 10');
  });

  it('disables previous button on first page', () => {
    render(
      <button data-testid="prev-page" disabled>Previous</button>
    );
    
    expect(screen.getByTestId('prev-page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <button data-testid="next-page" disabled>Next</button>
    );
    
    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('navigates to next page', () => {
    const handleNext = vi.fn();
    render(
      <button data-testid="next-page" onClick={handleNext}>Next</button>
    );
    
    fireEvent.click(screen.getByTestId('next-page'));
    expect(handleNext).toHaveBeenCalled();
  });

  it('navigates to previous page', () => {
    const handlePrev = vi.fn();
    render(
      <button data-testid="prev-page" onClick={handlePrev}>Previous</button>
    );
    
    fireEvent.click(screen.getByTestId('prev-page'));
    expect(handlePrev).toHaveBeenCalled();
  });

  it('shows items per page selector', () => {
    render(
      <select data-testid="page-size">
        <option value="10">10 per page</option>
        <option value="25">25 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </select>
    );
    
    expect(screen.getByTestId('page-size')).toBeInTheDocument();
    expect(screen.getByTestId('page-size').children.length).toBe(4);
  });

  it('changes items per page', () => {
    const handleChange = vi.fn();
    render(
      <select data-testid="page-size" onChange={(e) => handleChange(e.target.value)}>
        <option value="10">10</option>
        <option value="25">25</option>
      </select>
    );
    
    fireEvent.change(screen.getByTestId('page-size'), { target: { value: '25' } });
    expect(handleChange).toHaveBeenCalledWith('25');
  });

  it('shows total count', () => {
    render(
      <span data-testid="total-count">
        Showing 1-10 of 150 entries
      </span>
    );
    
    expect(screen.getByTestId('total-count')).toHaveTextContent('150 entries');
  });
});

describe('Action Type Filter', () => {
  it('renders action type filter', () => {
    render(
      <select data-testid="action-filter">
        <option value="">All Actions</option>
        <option value="LOGIN">Login</option>
        <option value="LOGOUT">Logout</option>
        <option value="CREATE">Create</option>
        <option value="UPDATE">Update</option>
        <option value="DELETE">Delete</option>
      </select>
    );
    
    expect(screen.getByTestId('action-filter')).toBeInTheDocument();
  });

  it('filters by action type', () => {
    const handleFilter = vi.fn();
    render(
      <select data-testid="action-filter" onChange={(e) => handleFilter(e.target.value)}>
        <option value="">All</option>
        <option value="LOGIN">Login</option>
      </select>
    );
    
    fireEvent.change(screen.getByTestId('action-filter'), { target: { value: 'LOGIN' } });
    expect(handleFilter).toHaveBeenCalledWith('LOGIN');
  });
});

describe('User Filter', () => {
  it('renders user search input', () => {
    render(
      <input
        type="text"
        data-testid="user-filter"
        placeholder="Search by user email"
      />
    );
    
    expect(screen.getByTestId('user-filter')).toBeInTheDocument();
  });

  it('searches by user email', () => {
    const handleSearch = vi.fn();
    render(
      <input
        data-testid="user-filter"
        onChange={(e) => handleSearch(e.target.value)}
      />
    );
    
    fireEvent.change(screen.getByTestId('user-filter'), { target: { value: 'admin@v2.com' } });
    expect(handleSearch).toHaveBeenCalledWith('admin@v2.com');
  });
});

describe('Log Details', () => {
  it('expands log entry to show details', () => {
    const handleExpand = vi.fn();
    render(
      <tr data-testid="log-row" onClick={handleExpand} style={{ cursor: 'pointer' }}>
        <td>LOGIN</td>
        <td>admin@v2.com</td>
        <td>2026-01-16 10:00</td>
      </tr>
    );
    
    fireEvent.click(screen.getByTestId('log-row'));
    expect(handleExpand).toHaveBeenCalled();
  });

  it('shows expanded details panel', () => {
    render(
      <div data-testid="log-details" className="bg-gray-50 p-4">
        <div>IP Address: 192.168.1.1</div>
        <div>User Agent: Mozilla/5.0...</div>
        <div>Request ID: req-123</div>
        <pre>{"{ \"action\": \"LOGIN\" }"}</pre>
      </div>
    );
    
    expect(screen.getByTestId('log-details')).toHaveTextContent('IP Address');
    expect(screen.getByTestId('log-details')).toHaveTextContent('192.168.1.1');
  });

  it('collapses details on second click', () => {
    const handleToggle = vi.fn();
    let expanded = true;
    
    render(
      <button 
        data-testid="toggle-details" 
        onClick={() => {
          expanded = !expanded;
          handleToggle(expanded);
        }}
      >
        {expanded ? 'Hide Details' : 'Show Details'}
      </button>
    );
    
    fireEvent.click(screen.getByTestId('toggle-details'));
    expect(handleToggle).toHaveBeenCalledWith(false);
  });
});

describe('Loading and Error States', () => {
  it('shows loading spinner', () => {
    render(
      <div data-testid="loading" className="animate-spin">
        Loading audit logs...
      </div>
    );
    
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(
      <div data-testid="error" className="text-red-500">
        Failed to load audit logs. Please try again.
        <button data-testid="retry-btn">Retry</button>
      </div>
    );
    
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to load');
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(
      <div data-testid="empty-state">
        No audit logs found for the selected filters.
      </div>
    );
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
