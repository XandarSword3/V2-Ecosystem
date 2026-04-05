import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
        return Component;
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import HousekeepingAdminPage from '../../src/app/admin/housekeeping/page';

function seedEndpoints() {
  apiGetMock.mockImplementation((url: string) => {
    if (url === '/housekeeping/tasks') {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            {
              id: 'task-1',
              task_type_id: 'type-1',
              task_type_name: 'Room Cleaning',
              priority: 'urgent',
              status: 'pending',
              notes: 'VIP arrival',
              assigned_to: undefined,
              assigned_to_name: undefined,
              chalet_name: 'Chalet A',
              scheduled_for: '2025-01-02T08:00:00.000Z',
              estimated_duration: 30,
              created_at: '2025-01-02T06:00:00.000Z',
            },
            {
              id: 'task-2',
              task_type_id: 'type-2',
              task_type_name: 'Linen Change',
              priority: 'normal',
              status: 'pending',
              assigned_to: 'staff-1',
              assigned_to_name: 'John Staff',
              created_at: '2025-01-02T06:10:00.000Z',
            },
            {
              id: 'task-3',
              task_type_id: 'type-3',
              task_type_name: 'Deep Clean',
              priority: 'high',
              status: 'in_progress',
              assigned_to: 'staff-1',
              assigned_to_name: 'John Staff',
              created_at: '2025-01-02T06:20:00.000Z',
            },
          ],
        },
      });
    }

    if (url === '/housekeeping/task-types') {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            { id: 'type-1', name: 'Room Cleaning', estimated_duration: 30, is_active: true },
            { id: 'type-2', name: 'Linen Change', estimated_duration: 20, is_active: true },
          ],
        },
      });
    }

    if (url === '/housekeeping/staff') {
      return Promise.resolve({
        data: {
          success: true,
          data: [
            { id: 'staff-1', name: 'John Staff', email: 'john@example.com', active_tasks: 2 },
            { id: 'staff-2', name: 'Sara Staff', email: 'sara@example.com', active_tasks: 1 },
          ],
        },
      });
    }

    if (url === '/housekeeping/stats') {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            summary: {
              pending: 2,
              in_progress: 1,
              completed_today: 4,
              total_completed: 150,
              on_hold: 0,
              urgent: 1,
            },
            staffPerformance: [
              { id: 'staff-1', name: 'John Staff', tasks_completed: 12, avg_time_minutes: 24 },
            ],
          },
        },
      });
    }

    return Promise.resolve({ data: { success: true, data: [] } });
  });

  apiPostMock.mockImplementation((url: string) => {
    if (url === '/housekeeping/tasks/task-1/assign') {
      return Promise.resolve({ data: { success: true } });
    }
    if (url === '/housekeeping/tasks/task-2/start') {
      return Promise.resolve({ data: { success: true } });
    }
    if (url === '/housekeeping/tasks/task-3/complete') {
      return Promise.resolve({ data: { success: true } });
    }
    if (url === '/housekeeping/tasks') {
      return Promise.resolve({ data: { success: true } });
    }
    return Promise.resolve({ data: { success: true } });
  });

  apiPutMock.mockResolvedValue({ data: { success: true } });
}

describe('Admin housekeeping route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    seedEndpoints();
  });

  it('renders task workflows, assignment modal, and status transitions', async () => {
    const user = userEvent.setup();

    render(<HousekeepingAdminPage />);

    expect(await screen.findByText('Housekeeping')).toBeInTheDocument();
    expect(screen.getByText('Room Cleaning')).toBeInTheDocument();
    expect(screen.getByText('Linen Change')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByText('Assign Task')).toBeInTheDocument();

    const assignModal = screen.getByText('Assign Task').closest('div');
    expect(assignModal).toBeTruthy();

    if (assignModal) {
      const johnOption = within(assignModal).getByRole('button', { name: /John Staff/i });
      await user.click(johnOption);
    }

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/housekeeping/tasks/task-1/assign', {
        staffId: 'staff-1',
      });
    });

    await user.click(screen.getByRole('button', { name: /Start/i }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/housekeeping/tasks/task-2/start', {});
    });

    await user.click(screen.getByRole('button', { name: /Complete/i }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/housekeeping/tasks/task-3/complete', {});
    });

    await user.click(screen.getByRole('tab', { name: 'Staff' }));
    expect(await screen.findByText('john@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Statistics' }));
    expect(await screen.findByText('Staff Performance (Last 7 Days)')).toBeInTheDocument();
  });

  it('validates create task form when required fields are missing', async () => {
    const user = userEvent.setup();

    render(<HousekeepingAdminPage />);
    await screen.findByText('Housekeeping');

    await user.click(screen.getByRole('button', { name: /New Task/i }));

    const createHeadings = await screen.findAllByText('Create Task');
    expect(createHeadings.length).toBeGreaterThan(0);

    const createButtons = screen.getAllByRole('button', { name: /^Create Task$/i });
    await user.click(createButtons[createButtons.length - 1]);

    expect(toastErrorMock).toHaveBeenCalledWith('Please select a task type');
  });
});
