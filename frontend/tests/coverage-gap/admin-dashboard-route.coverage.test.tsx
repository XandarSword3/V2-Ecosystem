import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin',
  useParams: () => ({}),
}));

import AdminDashboardRedirect from '../../src/app/[property]/admin/page';

describe('Admin dashboard route coverage', () => {
  it('redirects to /{property}/admin/modules', async () => {
    // next/navigation redirect throws internally; catch it
    try {
      await AdminDashboardRedirect({ params: Promise.resolve({ property: 'test-property' }) });
    } catch {
      // redirect() throws NEXT_REDIRECT — expected
    }

    expect(redirectMock).toHaveBeenCalledWith('/test-property/admin/modules');
  });
});
