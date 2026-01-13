import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ locale: 'en' }),
  usePathname: () => '/test',
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('RoleAssignmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', async () => {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'admin', display_name: 'Administrator' },
          { id: '2', name: 'staff', display_name: 'Staff Member' },
        ],
      },
    });

    const { RoleAssignmentModal } = await import('@/components/admin/RoleAssignmentModal');
    
    render(
      <RoleAssignmentModal
        isOpen={true}
        onClose={vi.fn()}
        userId="test-user-id"
        userName="John Doe"
        currentRoles={['staff']}
        onRolesUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('Manage Roles')).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('should not render when isOpen is false', async () => {
    const { RoleAssignmentModal } = await import('@/components/admin/RoleAssignmentModal');
    
    const { container } = render(
      <RoleAssignmentModal
        isOpen={false}
        onClose={vi.fn()}
        userId="test-user-id"
        userName="John Doe"
        currentRoles={[]}
        onRolesUpdated={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should display available roles', async () => {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'admin', display_name: 'Administrator', description: 'Full access' },
          { id: '2', name: 'staff', display_name: 'Staff Member', description: 'Limited access' },
        ],
      },
    });

    const { RoleAssignmentModal } = await import('@/components/admin/RoleAssignmentModal');
    
    render(
      <RoleAssignmentModal
        isOpen={true}
        onClose={vi.fn()}
        userId="test-user-id"
        userName="John Doe"
        currentRoles={[]}
        onRolesUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Staff Member')).toBeInTheDocument();
    });
  });

  it('should call onClose when Cancel is clicked', async () => {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });

    const { RoleAssignmentModal } = await import('@/components/admin/RoleAssignmentModal');
    const onClose = vi.fn();
    
    render(
      <RoleAssignmentModal
        isOpen={true}
        onClose={onClose}
        userId="test-user-id"
        userName="John Doe"
        currentRoles={[]}
        onRolesUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should update roles when Save is clicked', async () => {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: [
          { id: '1', name: 'admin', display_name: 'Administrator' },
          { id: '2', name: 'staff', display_name: 'Staff Member' },
        ],
      },
    });
    (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });

    const { RoleAssignmentModal } = await import('@/components/admin/RoleAssignmentModal');
    const onRolesUpdated = vi.fn();
    const onClose = vi.fn();
    
    render(
      <RoleAssignmentModal
        isOpen={true}
        onClose={onClose}
        userId="test-user-id"
        userName="John Doe"
        currentRoles={['staff']}
        onRolesUpdated={onRolesUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    // Click on Administrator to add it
    fireEvent.click(screen.getByText('Administrator'));

    // Click Save
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/users/test-user-id/roles', {
        roleIds: expect.arrayContaining(['1', '2']),
      });
    });
  });
});
