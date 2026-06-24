import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin',
}));

import AdminDashboardRedirect from '../../src/app/admin/page';

describe('Admin dashboard route coverage', () => {
  it('redirects to /admin/modules', () => {
    // next/navigation redirect throws internally; catch it
    try {
      render(<AdminDashboardRedirect />);
    } catch {
      // redirect() throws NEXT_REDIRECT — expected
    }

    expect(redirectMock).toHaveBeenCalledWith('/admin/modules');
  });
});
