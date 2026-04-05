import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

const modulesSeed = [
  {
    id: 'mod-1',
    name: 'Pool Club',
    slug: 'pool-club',
    description: 'All pool services',
    template_type: 'session_access',
    is_active: true,
    show_in_main: true,
    settings: {
      header_color: '#0ea5e9',
      accent_color: '#6366f1',
      show_in_nav: true,
      icon: 'waves',
    },
  },
];

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/lib/api', () => ({
  modulesApi: {
    getAll: getAllMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import ModulesPage from '../../src/app/admin/modules/page';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ModulesPage />
    </QueryClientProvider>
  );
}

describe('Admin modules route coverage', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    pushMock.mockReset();

    getAllMock.mockResolvedValue({ data: { data: modulesSeed } });
    createMock.mockResolvedValue({ data: { success: true } });
    updateMock.mockResolvedValue({ data: { success: true } });
    deleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('prompt', vi.fn().mockReturnValue('Delete'));
  });

  it('loads modules and supports update, create, builder navigation, and delete actions', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Module Management')).toBeInTheDocument();
    expect(screen.getByText('Pool Club')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Builder/i }));
    expect(pushMock).toHaveBeenCalledWith('/admin/modules/builder/mod-1');

    await user.click(screen.getByTitle('Edit Module Settings'));
    expect(await screen.findByText('Edit Module')).toBeInTheDocument();

    const editNameInput = screen.getByDisplayValue('Pool Club');
    await user.clear(editNameInput);
    await user.type(editNameInput, 'Pool Club Premium');

    await user.click(screen.getByRole('button', { name: /Update Module/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'mod-1',
        expect.objectContaining({
          name: 'Pool Club Premium',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Module updated successfully');

    await user.click(screen.getByRole('button', { name: /Add Module/i }));
    expect(await screen.findByText('Create New Module')).toBeInTheDocument();

    const createNameInput = screen.getAllByRole('textbox')[0];
    await user.clear(createNameInput);
    await user.type(createNameInput, 'Chocolate Box');

    await user.click(screen.getByRole('button', { name: /Create Module/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Chocolate Box',
          slug: 'chocolate-box',
        })
      );
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Module created successfully');

    await user.click(screen.getByTitle('Delete Module'));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('mod-1', true);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Module deleted successfully');
  });

  it('shows an error toast when creating a module fails', async () => {
    const user = userEvent.setup();

    createMock.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Slug already exists',
        },
      },
    });

    renderPage();

    await screen.findByText('Module Management');

    await user.click(screen.getByRole('button', { name: /Add Module/i }));

    const createNameInput = (await screen.findAllByRole('textbox'))[0];
    await user.clear(createNameInput);
    await user.type(createNameInput, 'Pool Club');

    await user.click(screen.getByRole('button', { name: /Create Module/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Slug already exists');
    });
  });
});
