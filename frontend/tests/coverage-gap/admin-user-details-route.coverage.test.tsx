import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const routerBackMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user-1' }),
  useRouter: () => ({
    back: routerBackMock,
    refresh: routerRefreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
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

import UserDetailsPage from '../../src/app/admin/users/[id]/page';

describe('Admin user details route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    routerBackMock.mockReset();
    routerRefreshMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/users/user-1') {
        return Promise.resolve({
          data: {
            data: {
              id: 'user-1',
              full_name: 'Jane Manager',
              email: 'jane.manager@example.com',
              phone: '961-70-000-000',
              is_active: true,
              is_online: false,
              roles: ['staff'],
              role_permissions: ['orders.view'],
              user_permissions_overrides: [{ permission_slug: 'orders.edit', is_granted: true }],
            },
          },
        });
      }

      if (url === '/admin/permissions') {
        return Promise.resolve({
          data: {
            data: [
              {
                slug: 'orders.view',
                description: 'View all orders',
                module_slug: 'orders',
              },
              {
                slug: 'orders.edit',
                description: 'Edit order status',
                module_slug: 'orders',
              },
            ],
          },
        });
      }

      if (url === '/admin/roles') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'r-1', name: 'staff', display_name: 'Staff' },
              { id: 'r-2', name: 'admin', display_name: 'Admin' },
            ],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads user data, updates profile and roles, and saves permission overrides', async () => {
    const user = userEvent.setup();

    render(<UserDetailsPage />);

    expect(await screen.findByText('Jane Manager')).toBeInTheDocument();
    expect(screen.getByText('jane.manager@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Edit Profile/i }));

    const fullNameInput = await screen.findByDisplayValue('Jane Manager');
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'Jane Supervisor');

    const editProfileHeading = screen.getByRole('heading', { name: /Edit Profile/i });
    const editProfileModal = editProfileHeading.closest('div[class*="rounded"]') || editProfileHeading.parentElement;
    const profileSaveButton = editProfileModal instanceof HTMLElement
      ? within(editProfileModal).getByRole('button', { name: /Save/i })
      : screen.getByRole('button', { name: /Save/i });
    await user.click(profileSaveButton);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/users/user-1', {
        full_name: 'Jane Supervisor',
        email: 'jane.manager@example.com',
        phone: '961-70-000-000',
        is_active: true,
      });
    });

    await user.click(screen.getByRole('button', { name: /Manage Roles/i }));

    await screen.findByRole('heading', { name: /Manage Roles/i });

    const adminCheckbox = screen.getByRole('checkbox', { name: /Admin/i });
    await user.click(adminCheckbox);

    const roleHeading = screen.getByRole('heading', { name: /Manage Roles/i });
    const roleModal = roleHeading.closest('div[class*="rounded"]') || roleHeading.parentElement;
    const saveRoleButton = roleModal instanceof HTMLElement
      ? within(roleModal).getByRole('button', { name: /Save/i })
      : screen.getByRole('button', { name: /Save/i });
    await user.click(saveRoleButton);

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/users/user-1/roles', {
        roles: expect.arrayContaining(['staff', 'admin']),
      });
    });

    await user.click(screen.getAllByRole('button', { name: 'Grant' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/users/user-1/permissions', {
        permissions: expect.arrayContaining([
          expect.objectContaining({ permission_slug: 'orders.view', is_granted: true }),
        ]),
      });
    });

    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it('shows fallback when loading user details fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('load failed'));

    render(<UserDetailsPage />);

    expect(await screen.findByText('User not found')).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith('Failed to load user data');
  });
});
