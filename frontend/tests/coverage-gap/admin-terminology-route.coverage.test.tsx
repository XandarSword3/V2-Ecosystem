import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => {
  const api = {
    get: apiGetMock,
    post: apiPostMock,
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

import TerminologyPage from '../../src/app/[property]/admin/terminology/page';

describe('Admin terminology route coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    apiGetMock.mockImplementation((url: string) => {
      if (url.includes('business_type=property')) {
        return Promise.resolve({
          data: {
            data: {
              unit_singular: 'AccommodationUnit',
              unit_plural: 'AccommodationUnits',
            },
          },
        });
      }

      if (url.includes('business_type=hotel')) {
        return Promise.resolve({
          data: {
            data: {
              unit_singular: 'Room',
              unit_plural: 'Rooms',
            },
          },
        });
      }

      return Promise.resolve({ data: { data: {} } });
    });

    apiPostMock.mockResolvedValue({ data: { success: true } });
  });

  it('loads terms, switches business type, edits values, and saves', async () => {
    const user = userEvent.setup();

    render(<TerminologyPage />);

    expect(await screen.findByText('Terminology Configuration')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/terminology?business_type=hotel');
    });

    const businessTypeSelect = screen.getByRole('combobox');
    await user.selectOptions(businessTypeSelect, 'hotel');

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/terminology?business_type=hotel');
    });

    const textInputs = screen.getAllByRole('textbox');
    await user.clear(textInputs[0]);
    await user.type(textInputs[0], 'Suite');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/terminology/bulk', {
        business_type: 'hotel',
        language: 'en',
        updates: expect.objectContaining({
          unit_singular: 'Suite',
        }),
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Terminology updated successfully');
  });

  it('shows toast error when fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('fetch failed'));

    render(<TerminologyPage />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to fetch terminology');
    });
  });
});
