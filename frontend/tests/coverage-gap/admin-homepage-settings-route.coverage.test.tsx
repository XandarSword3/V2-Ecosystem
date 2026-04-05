import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string | symbol) => {
        if (typeof tag !== 'string' || tag === 'then' || tag === 'catch' || tag === 'finally') {
          return undefined;
        }

        const MotionComponent = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);

        return MotionComponent;
      },
    }
  );

  return {
    motion: motionProxy,
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: apiGetMock,
    put: apiPutMock,
    post: apiPostMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

import HomepageSettingsPage from '../../src/app/admin/settings/homepage/page';

describe('Admin homepage settings route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPutMock.mockReset();
    apiPostMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiPostMock.mockResolvedValue({ data: { success: true } });

    apiGetMock.mockResolvedValue({
      data: {
        success: true,
        data: {
          heroSlides: [
            {
              id: 'hero-1',
              title: 'Loaded Hero',
              subtitle: 'Loaded subtitle',
              buttonText: 'Book',
              buttonLink: '/book',
              imageUrl: '',
              enabled: true,
            },
          ],
          sections: ['hero', 'features', 'cta'],
          ctaTitle: 'Loaded CTA Title',
          ctaSubtitle: 'Loaded CTA Subtitle',
          ctaButtonText: 'Book Now',
          ctaButtonLink: '/reserve',
        },
      },
    });
  });

  it('loads homepage settings and saves CTA updates', async () => {
    const user = userEvent.setup();

    render(<HomepageSettingsPage />);

    await user.click(await screen.findByRole('button', { name: /Call to Action/i }));

    const ctaTitleInput = (await screen.findAllByRole('textbox'))[0];
    await user.clear(ctaTitleInput);
    await user.type(ctaTitleInput, 'Book Your Ocean Escape');

    await user.click(screen.getByRole('button', { name: /saveChanges/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/admin/settings/homepage', expect.any(Object));
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('homepage.saved');
  });

  it('shows an error toast when saving homepage settings fails', async () => {
    const user = userEvent.setup();

    apiPutMock.mockRejectedValueOnce(new Error('save failed'));

    render(<HomepageSettingsPage />);

    await screen.findByRole('heading', { name: /homepage.title/i });

    const heroTitleInput = await screen.findByDisplayValue('Loaded Hero');
    await user.clear(heroTitleInput);
    await user.type(heroTitleInput, 'Updated Hero Headline');

    await user.click(screen.getByRole('button', { name: /saveChanges/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('errors.failedToSave');
    });
  });
});
