import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

const socketHandlers = vi.hoisted(() => ({} as Record<string, ((payload: any) => void) | undefined>));
const socketMock = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({ socket: socketMock }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    put: apiPutMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@/components/ui/Tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/ContextMenu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onClick, disabled }: any) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

import { RestaurantFloorPlan } from '../../src/components/RestaurantFloorPlan';

function floorPlanPayload() {
  return {
    data: {
      data: {
        tables: [
          {
            id: 't1',
            number: 1,
            name: 'Main Table',
            capacity: 4,
            status: 'AVAILABLE',
            position: {
              x: 40,
              y: 50,
              rotation: 0,
              width: 80,
              height: 80,
              shape: 'circle',
            },
            section: 'Main',
            features: ['window'],
          },
          {
            id: 't2',
            number: 2,
            name: 'Patio Table',
            capacity: 2,
            status: 'RESERVED',
            position: {
              x: 180,
              y: 120,
              rotation: 0,
              width: 70,
              height: 70,
              shape: 'square',
            },
            section: 'Patio',
            features: ['outdoor'],
            currentReservation: {
              guestName: 'Nora',
              partySize: 2,
              time: '19:30',
            },
          },
        ],
        sections: ['Main', 'Patio'],
        dimensions: {
          width: 600,
          height: 400,
        },
      },
    },
  };
}

describe('RestaurantFloorPlan behavior', () => {
  beforeEach(() => {
    for (const key of Object.keys(socketHandlers)) {
      delete socketHandlers[key];
    }

    socketMock.on.mockReset();
    socketMock.off.mockReset();
    socketMock.on.mockImplementation((event: string, handler: (payload: any) => void) => {
      socketHandlers[event] = handler;
    });
    socketMock.off.mockImplementation((event: string) => {
      delete socketHandlers[event];
    });

    apiGetMock.mockReset();
    apiPutMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockResolvedValue(floorPlanPayload());
    apiPutMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads floor plan, filters by section, and selects a table in non-edit mode', async () => {
    const user = userEvent.setup();
    const onTableSelect = vi.fn();

    render(<RestaurantFloorPlan onTableSelect={onTableSelect} />);

    expect(await screen.findByText('Main Table')).toBeInTheDocument();
    expect(screen.getByText('Patio Table')).toBeInTheDocument();

    await user.click(screen.getByText('1'));
    expect(onTableSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', name: 'Main Table' }));

    await user.click(screen.getByRole('button', { name: 'Patio' }));

    expect(screen.queryByText('Main Table')).not.toBeInTheDocument();
    expect(screen.getByText('Patio Table')).toBeInTheDocument();
  });

  it('updates table status through context actions', async () => {
    const user = userEvent.setup();

    render(<RestaurantFloorPlan />);

    expect(await screen.findByText('Main Table')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Mark Occupied/i })[0]);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/restaurant/tables/t1/status', { status: 'OCCUPIED' });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Table status updated');
  });

  it('applies real-time socket updates and avoids table selection in editable mode', async () => {
    const user = userEvent.setup();
    const onTableSelect = vi.fn();

    const { unmount } = render(<RestaurantFloorPlan isEditable onTableSelect={onTableSelect} />);

    expect(await screen.findByText('Main Table')).toBeInTheDocument();

    await act(async () => {
      socketHandlers['table-status-changed']?.({ tableId: 't1', status: 'CLEANING' });
      socketHandlers['table-position-updated']?.({
        tableId: 't1',
        position: { x: 100, y: 120, rotation: 0, width: 80, height: 80, shape: 'circle' },
      });
    });

    expect(screen.getByText('Status: Cleaning')).toBeInTheDocument();

    await user.click(screen.getByText('1'));
    expect(onTableSelect).not.toHaveBeenCalled();

    unmount();

    expect(socketMock.off).toHaveBeenCalledWith('table-status-changed', expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith('table-position-updated', expect.any(Function));
  });
});
