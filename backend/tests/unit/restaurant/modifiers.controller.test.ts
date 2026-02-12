import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';
import { modifiersController } from '../../../src/modules/restaurant/modifiers.controller';
import { getSupabase } from '../../../src/database/connection';

// Mock dependencies
vi.mock('../../../src/database/connection');

describe('Modifiers Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a modifier group with options', async () => {
      const mockGroup = { id: 'group-1', name: 'Size' };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'menu_modifier_groups') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
                })
              })
            };
          } else {
            return {
              insert: vi.fn().mockResolvedValue({ error: null })
            };
          }
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [
            { name: 'Small', price: 0 },
            { name: 'Large', price: 2.50 }
          ],
          moduleId: 'mod-1'
        }
      });

      await modifiersController.createGroup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGroup });
    });

    it('should create a modifier group without options', async () => {
      const mockGroup = { id: 'group-1', name: 'Extras' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGroup, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Extras',
          minSelections: 0,
          maxSelections: 5
        }
      });

      await modifiersController.createGroup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should call next on error', async () => {
      const error = new Error('DB Error');
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { name: 'Test' }
      });

      await modifiersController.createGroup(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateGroup', () => {
    it('should update a modifier group', async () => {
      const mockUpdated = { id: 'group-1', name: 'Updated Size' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' },
        body: {
          name: 'Updated Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true
        }
      });

      await modifiersController.updateGroup(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it('should call next on error', async () => {
      const error = new Error('Update failed');
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' },
        body: { name: 'Test' }
      });

      await modifiersController.updateGroup(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteGroup', () => {
    it('should soft delete a modifier group', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' }
      });

      await modifiersController.deleteGroup(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('getGroups', () => {
    it('should return all modifier groups with options', async () => {
      const mockGroups = [
        { 
          id: 'group-1', 
          name: 'Size', 
          options: [
            { id: 'opt-1', name: 'Small' },
            { id: 'opt-2', name: 'Large' }
          ]
        }
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockGroups, error: null })
              })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: { moduleId: 'mod-1' }
      });

      await modifiersController.getGroups(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGroups });
    });

    it('should return all groups without module filter', async () => {
      const mockGroups = [{ id: 'group-1', name: 'Test' }];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockGroups, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await modifiersController.getGroups(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGroups });
    });

    it('should call next on error', async () => {
      const error = new Error('Fetch failed');
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await modifiersController.getGroups(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
