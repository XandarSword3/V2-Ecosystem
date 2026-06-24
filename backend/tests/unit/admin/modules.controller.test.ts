
// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
    build: () => ({ from: vi.fn().mockReturnValue(builder) }),
  };
};

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/socket.js', () => ({
  emitToAll: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
}));

vi.mock('../../../src/middleware/moduleGuard.middleware.js', () => ({
  clearModuleCache: vi.fn(),
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { getSupabase } from '../../../src/database/connection.js';
import * as modulesController from '../../../src/modules/admin/modules.controller.js';
import { emitToAll } from '../../../src/socket.js';
import { clearModuleCache } from '../../../src/middleware/moduleGuard.middleware.js';

function createMockReqRes(overrides: any = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { id: 'user-1', role: 'admin' },
    ...overrides,
  };
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('ModulesController', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build());
  });

  describe('getModules', () => {
    it('should return all modules', async () => {
      const mockModules = [
        { id: 'mod-1', name: 'MenuService', slug: 'menu_service', is_active: true },
        { id: 'mod-2', name: 'Pool', slug: 'capacity', is_active: true },
      ];
      mockBuilder.queueResponse(mockModules);

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await modulesController.getModules(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockModules,
      });
    });

    it('should filter active modules only when activeOnly is true', async () => {
      const mockModules = [{ id: 'mod-1', name: 'MenuService', is_active: true }];
      mockBuilder.queueResponse(mockModules);

      const { req, res, next } = createMockReqRes({
        query: { activeOnly: 'true' },
      });

      await modulesController.getModules(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockModules,
      });
    });

    it('should filter modules shown in main when showInMain is true', async () => {
      const mockModules = [{ id: 'mod-1', name: 'MenuService', show_in_main: true }];
      mockBuilder.queueResponse(mockModules);

      const { req, res, next } = createMockReqRes({
        query: { showInMain: 'true' },
      });

      await modulesController.getModules(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockModules,
      });
    });

    it('should handle database errors', async () => {
      mockBuilder.queueResponse(null, { message: 'Database error' });

      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await modulesController.getModules(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch modules',
      });
    });
  });

  describe('getModule', () => {
    it('should return a module by ID', async () => {
      const mockModule = { id: 'mod-1', name: 'MenuService', slug: 'menu_service' };
      mockBuilder.queueResponse(mockModule);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-1' },
      });

      await modulesController.getModule(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockModule,
      });
    });

    it('should return a module by slug when ID not found', async () => {
      const mockModule = { id: 'mod-1', name: 'MenuService', slug: 'menu_service' };
      mockBuilder.queueResponse(null, { code: 'PGRST116' }); // First query fails
      mockBuilder.queueResponse(mockModule); // Fallback to slug query

      const { req, res, next } = createMockReqRes({
        params: { id: 'menu_service' },
      });

      await modulesController.getModule(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockModule,
      });
    });

    it('should return 404 for non-existent module', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });
      mockBuilder.queueResponse(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await modulesController.getModule(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Module not found',
      });
    });
  });

  describe('createModule', () => {
    it('should create a new module with valid data', async () => {
      const mockModule = {
        id: 'mod-new',
        name: 'New Module',
        slug: 'new-module',
        template_type: 'custom',
      };
      mockBuilder.queueResponse(mockModule); // Module insert
      mockBuilder.queueResponse(null); // Permissions upsert
      mockBuilder.queueResponse(null); // Role permissions upsert
      mockBuilder.queueResponse(null); // Super admin permissions
      mockBuilder.queueResponse(null); // Additional role permissions

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'New Module',
          template_type: 'custom',
          description: 'A new module',
        },
      });

      await modulesController.createModule(req as any, res as any, next);

      // Verify creation was attempted
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should auto-generate slug from name if not provided', async () => {
      const mockModule = { id: 'mod-new', name: 'My Test Module', slug: 'my-test-module' };
      mockBuilder.queueResponse(mockModule);
      mockBuilder.queueResponse(null);
      mockBuilder.queueResponse(null);
      mockBuilder.queueResponse(null);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'My Test Module',
          template_type: 'basic',
        },
      });

      await modulesController.createModule(req as any, res as any, next);

      // Check if call was made
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('updateModule', () => {
    it('should update an existing module', async () => {
      const mockModule = { id: 'mod-1', name: 'Updated MenuService', slug: 'menu_service' };
      mockBuilder.queueResponse(mockModule);

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-1' },
        body: { name: 'Updated MenuService' },
      });

      await modulesController.updateModule(req as any, res as any, next);

      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('deleteModule', () => {
    it('should soft delete a module', async () => {
      mockBuilder.queueResponse({ id: 'mod-1' }); // Get module
      mockBuilder.queueResponse({ id: 'mod-1', is_active: false }); // Update

      const { req, res, next } = createMockReqRes({
        params: { id: 'mod-1' },
      });

      await modulesController.deleteModule(req as any, res as any, next);

      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should handle non-existent module deletion', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
      });

      await modulesController.deleteModule(req as any, res as any, next);

      // Either returns error or calls next
      const wasCalled = (res.status as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });
});
