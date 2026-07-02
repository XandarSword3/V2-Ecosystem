import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const apiPutMock = vi.hoisted(() => vi.fn());
const apiDeleteMock = vi.hoisted(() => vi.fn());

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const translateMock = vi.hoisted(() => (key: string) => key);

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

vi.mock('@/lib/api', () => {
  const api = {
    get: apiGetMock,
    post: apiPostMock,
    put: apiPutMock,
    delete: apiDeleteMock,
  };

  return {
    __esModule: true,
    default: api,
    api,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => translateMock,
}));

import TranslationsPage from '../../src/app/[property]/admin/settings/translations/page';

const statsSeed = {
  overall: { total: 10, translated: 4, missing: 6 },
  byTable: {
    catalog_items: { total: 6, translated: 2, missing: 4 },
    modules: { total: 4, translated: 2, missing: 2 },
  },
  percentage: 40,
};

const missingSeed = {
  byTable: {
    catalog_items: {
      displayName: 'Menu Items',
      items: [
        {
          table: 'catalog_items',
          tableDisplayName: 'Menu Items',
          id: 'menu-1',
          itemLabel: 'Lemonade',
          field: 'name',
          originalValue: 'Lemonade',
          missingLanguages: ['fr'],
        },
      ],
    },
  },
};

const frontendSeed = {
  totalKeys: 3,
  allKeys: ['common.ok', 'common.cancel', 'common.retry'],
  languages: {
    en: {
      file: 'messages/en.json',
      keyCount: 3,
      missingKeys: [],
      missingCount: 0,
    },
    fr: {
      file: 'messages/fr.json',
      keyCount: 2,
      missingKeys: ['common.retry'],
      missingCount: 1,
    },
  },
};

const languagesSeed = [
  {
    code: 'en',
    name: 'English',
    native_name: 'English',
    direction: 'ltr',
    is_default: true,
    is_active: true,
    sort_order: 1,
  },
  {
    code: 'fr',
    name: 'French',
    native_name: 'Français',
    direction: 'ltr',
    is_default: false,
    is_active: true,
    sort_order: 2,
  },
];

describe('Admin translations route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();

    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/admin/translations/stats') {
        return Promise.resolve({ data: { success: true, data: statsSeed } });
      }
      if (url === '/admin/translations/missing') {
        return Promise.resolve({ data: { success: true, data: missingSeed } });
      }
      if (url === '/admin/translations/status') {
        return Promise.resolve({
          data: {
            success: true,
            provider: 'Google Translate',
            configured: true,
            apiKeySet: true,
            message: 'Ready',
          },
        });
      }
      if (url === '/admin/translations/languages') {
        return Promise.resolve({ data: { success: true, data: languagesSeed } });
      }
      if (url === '/admin/translations/frontend/compare') {
        return Promise.resolve({ data: { success: true, data: frontendSeed } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    });

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/admin/translations/batch-translate') {
        return Promise.resolve({ data: { success: true, translated: 1, errors: [] } });
      }
      return Promise.resolve({ data: { success: true } });
    });

    apiPutMock.mockResolvedValue({ data: { success: true } });
    apiDeleteMock.mockResolvedValue({ data: { success: true } });

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('loads tabs, batch-translates missing database fields, and adds a language', async () => {
    const user = userEvent.setup();

    render(<TranslationsPage />);

    expect(await screen.findByText('title')).toBeInTheDocument();
    expect(screen.getByText('Database Content Translations')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Auto-translate All/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/admin/translations/batch-translate', { table: 'catalog_items' });
    });

    await user.click(screen.getByRole('button', { name: /tabs\.languages/i }));
    await user.click(screen.getByRole('button', { name: /languagesTab\.addLanguage/i }));

    await user.type(screen.getByPlaceholderText('e.g., de'), 'es');
    await user.type(screen.getByPlaceholderText('e.g., German'), 'Spanish');
    await user.type(screen.getByPlaceholderText('e.g., Deutsch'), 'Español');

    await user.click(screen.getByRole('button', { name: /Save$/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/admin/translations/languages',
        expect.objectContaining({
          code: expect.any(String),
          name: expect.any(String),
          native_name: expect.any(String),
        })
      );
    });
  });

  it('shows validation error when adding language with missing required fields', async () => {
    const user = userEvent.setup();

    render(<TranslationsPage />);

    await screen.findByText('title');

    await user.click(screen.getByRole('button', { name: /tabs\.languages/i }));
    await user.click(screen.getByRole('button', { name: /languagesTab\.addLanguage/i }));
    await user.click(screen.getByRole('button', { name: /Save$/i }));

    expect(toastErrorMock).toHaveBeenCalledWith('errors.fillRequired');
  });
});
