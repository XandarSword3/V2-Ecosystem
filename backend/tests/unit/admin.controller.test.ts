/**
 * Admin Controller Unit Tests
 * Tests logic in admin.controller.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabase } from '../../src/database/connection.js';
import { createChainableMock, createMockReqRes } from './utils.js';

// 1. Mock Database
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

// 2. Mock Modules
vi.mock('../../src/socket/index.js', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

// Mock Validation Schemas to bypass validation logic
vi.mock('../../src/validation/schemas.js', () => ({
    validatePagination: vi.fn().mockImplementation(() => ({ page: 1, limit: 10, offset: 0 })),
    validateBody: vi.fn().mockImplementation((schema, body) => body),
    createUserSchema: {},
    updateUserSchema: {},
    updateSettingsSchema: {},
}));

describe('Admin Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard stats', async () => {
      const mockResult = [{ id: 1, total_amount: 100, status: 'active' }];
      const queryBuilder = createChainableMock(mockResult, null, 10);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryBuilder),
        rpc: vi.fn().mockReturnValue(queryBuilder)
      } as any);
      
      const { getDashboard } = await import('../../src/modules/admin/admin.controller.js');
      const { req, res, next } = createMockReqRes();

      await getDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Object)
      }));
    });
  });

  describe('getUsers', () => {
    it('should return list of users', async () => {
        const mockUsers = [{ id: 'u-1', full_name: 'User 1' }];
        
        const mockSupabase = {
            from: vi.fn((table) => {
                if (table === 'users') {
                    return createChainableMock(mockUsers, null, 1);
                }
                if (table === 'user_roles') {
                    return createChainableMock([{ roles: { name: 'customer' } }]);
                }
                return createChainableMock([]);
            })
        };

        vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

        const { getUsers } = await import('../../src/modules/admin/admin.controller.js');
        const { req, res, next } = createMockReqRes();

        await getUsers(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: [{
                ...mockUsers[0],
                roles: ['customer'] 
            }]
        });
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockDbUser = { id: 'new-id', full_name: 'Test User' };

      const mockSupabase = {
        from: vi.fn()
          .mockReturnValueOnce(createChainableMock(null)) // Check existing (null)
          .mockReturnValueOnce(createChainableMock(mockDbUser)) // Insert (success)
          .mockReturnValueOnce(createChainableMock([])) // Get Roles (none found)
          .mockReturnValueOnce(createChainableMock([])) // Insert Roles
      };

      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { createUser } = await import('../../src/modules/admin/admin.controller.js');
      const { req, res, next } = createMockReqRes({ 
          body: { email: 'test@example.com', full_name: 'Test User', password: 'password', roles: ['staff'] } 
      });

      await createUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: expect.objectContaining({
              ...mockDbUser,
              roles: ['staff']
          })
      }));
    });
  });

  describe('getSettings', () => {
    it('should return settings object', async () => {
      const mockSettings = [
        { key: 'site_name', value: 'My Resort' },
        { key: 'contact_email', value: 'test@resort.com' }
      ];
      
      const queryBuilder = createChainableMock(mockSettings);

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(queryBuilder)
      } as any);

      const { getSettings } = await import('../../src/modules/admin/admin.controller.js');
      const { req, res, next } = createMockReqRes();

      await getSettings(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
            site_name: 'My Resort',
            contact_email: 'test@resort.com'
        })
      });
    });
  });

  describe('updateSettings', () => {
      it('should update settings', async () => {
          const queryBuilder = createChainableMock(null);
          
          vi.mocked(getSupabase).mockReturnValue({
             from: vi.fn().mockReturnValue(queryBuilder)
          } as any);

          const { updateSettings } = await import('../../src/modules/admin/admin.controller.js');
          const { req, res, next } = createMockReqRes({ body: { site_name: 'New Name' } });

          await updateSettings(req, res, next);

          expect(res.json).toHaveBeenCalledWith({
              success: true,
              message: expect.any(String)
          });
      });
  });
  
  describe('getRoles', () => {
     it('should return all roles', async () => {
         const mockRoles = [{ id: 'r-1', name: 'admin' }];
         
         const mockSupabase = {
             from: vi.fn((table) => {
                 if (table === 'roles') return createChainableMock(mockRoles);
                 if (table === 'user_roles') return createChainableMock([]); 
                 if (table === 'role_permissions') return createChainableMock([]); 
                 return createChainableMock([]);
             })
         };
         
         vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

         const { getRoles } = await import('../../src/modules/admin/admin.controller.js');
         const { req, res, next } = createMockReqRes();
         
         await getRoles(req, res, next);
         
         expect(res.json).toHaveBeenCalledWith({
             success: true,
             data: [{
                 ...mockRoles[0],
                 users_count: 0,
                 permissions_count: 0
             }]
         });
     });
  });

});
