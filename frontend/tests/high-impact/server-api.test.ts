import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getChaletById,
  getChalets,
  getMenuItems,
  getPoolSessions,
  getSiteSettings,
  getSnackItems,
} from '../../src/lib/server-api';

describe('server-api helpers', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('returns menu items for both array and wrapped payload responses', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'item-1',
              name: 'Burger',
              price: 12,
              category: { id: 'cat-1', name: 'Main' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            items: [
              {
                id: 'item-2',
                name: 'Fries',
                price: 6,
                category: { id: 'cat-2', name: 'Sides' },
              },
            ],
          },
        }),
      });

    const first = await getMenuItems();
    const second = await getMenuItems();

    expect(first).toHaveLength(1);
    expect(first[0].id).toBe('item-1');
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe('item-2');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/restaurant/menu'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        next: expect.objectContaining({
          revalidate: 300,
          tags: ['menu'],
        }),
      })
    );
  });

  it('maps list endpoints and object-wrapped endpoints for chalets, pool, and snacks', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [{ id: 'ch-1', name: 'Chalet A', capacity: 4 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { sessions: [{ id: 's1', name: 'Morning', start_time: '08:00', end_time: '11:00', capacity: 20 }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { items: [{ id: 'sn-1', name: 'Nachos', price: 9, category: 'Snacks' }] } }),
      });

    const chalets = await getChalets();
    const sessions = await getPoolSessions();
    const snacks = await getSnackItems();

    expect(chalets[0].id).toBe('ch-1');
    expect(sessions[0].id).toBe('s1');
    expect(snacks[0].id).toBe('sn-1');
  });

  it('returns safe fallbacks when fetch fails or returns non-ok responses', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn() })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: false, status: 404, json: vi.fn() });

    const chalets = await getChalets();
    const settings = await getSiteSettings();
    const chalet = await getChaletById('missing-id');

    expect(chalets).toEqual([]);
    expect(settings).toEqual({});
    expect(chalet).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
