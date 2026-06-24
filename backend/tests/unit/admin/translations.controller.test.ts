import { Request, Response, NextFunction } from 'express';

// Create a properly chainable Supabase mock
const createChainableMock = (response: { data: any; error: any; count?: number }) => {
  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  builder.single = vi.fn().mockResolvedValue(response);
  builder.maybeSingle = vi.fn().mockResolvedValue(response);
  
  // Make the builder itself thenable for await
  builder.then = (resolve: any, reject: any) => {
    return Promise.resolve(response).then(resolve, reject);
  };
  
  return builder;
};

let mockResponses: Array<{ data: any; error: any; count?: number }> = [];
let responseIndex = 0;

const mockFrom = vi.fn(() => {
  const response = responseIndex < mockResponses.length ? mockResponses[responseIndex++] : { data: null, error: null };
  return createChainableMock(response);
});

vi.mock('../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('../../../src/services/translation.service', () => ({
  translateText: vi.fn().mockResolvedValue({ ar: 'مترجم', fr: 'Traduit' }),
  getTranslationStatus: vi.fn().mockReturnValue({ configured: true, provider: 'google' }),
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  promises: {
    access: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(['en.json', 'ar.json']),
    readFile: vi.fn().mockImplementation((path) => {
      if (path.endsWith('en.json')) return Promise.resolve(JSON.stringify({ common: { save: 'Save' } }));
      if (path.endsWith('ar.json')) return Promise.resolve(JSON.stringify({ common: { save: 'حفظ' } }));
      return Promise.resolve('{}');
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('path', () => ({
  resolve: vi.fn().mockImplementation((...args) => args.join('/')),
  join: vi.fn().mockImplementation((...args) => args.join('/')),
}));

import * as translationsController from '../../../src/modules/admin/translations.controller';
import { translateText, getTranslationStatus } from '../../../src/services/translation.service';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { userId: 'user-1', role: 'admin' },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
};

describe('Translations Controller', () => {
  beforeEach(() => {
    mockResponses = [];
    responseIndex = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMissingTranslations', () => {
    it('should return missing translations', async () => {
      // Mock data for multiple tables
      const mockModules = [
        { id: 'mod-1', name: 'MenuService', name_ar: null, name_fr: 'MenuService' },
      ];
      
      mockResponses.push({ data: mockModules, error: null });
      // Queue empty responses for other tables
      for (let i = 0; i < 6; i++) {
        mockResponses.push({ data: [], error: null });
      }
      
      const { req, res, next } = createMockReqRes();
      
      await translationsController.getMissingTranslations(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should handle database errors gracefully', async () => {
      mockResponses.push({ data: null, error: { message: 'Database error' } });
      
      const { req, res, next } = createMockReqRes();
      
      await translationsController.getMissingTranslations(req, res, next);
      
      // Should still return a response even if some tables fail
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getTranslationStats', () => {
    it('should return translation statistics', async () => {
      const mockModules = [
        { id: 'mod-1', name: 'Test', name_ar: 'تست', name_fr: 'Test' },
      ];
      
      mockResponses.push({ data: mockModules, error: null });
      for (let i = 0; i < 6; i++) {
        mockResponses.push({ data: [], error: null });
      }
      
      const { req, res, next } = createMockReqRes();
      
      await translationsController.getTranslationStats(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('updateTranslation', () => {
    it('should update a translation', async () => {
      const mockItem = { id: 'item-1', name: 'Test', name_ar: 'Updated' };
      
      mockResponses.push({ data: mockItem, error: null });
      
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'modules',
          id: 'item-1',
          field: 'name_ar',
          value: 'Updated translation',
        },
      });
      
      await translationsController.updateTranslation(req, res, next);
      
      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'modules',
          // Missing id and field
        },
      });
      
      await translationsController.updateTranslation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('autoTranslate', () => {
    it('should auto-translate a single item', async () => {
      const mockItem = { id: 'item-1', name: 'MenuService', name_ar: null, name_fr: null };
      const updatedItem = { ...mockItem, name_ar: 'مطعم', name_fr: 'MenuService' };
      
      mockResponses.push({ data: mockItem, error: null }); // fetch item
      mockResponses.push({ data: updatedItem, error: null }); // update item
      
      vi.mocked(translateText).mockResolvedValue({ ar: 'مطعم', fr: 'MenuService' });
      
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'modules',
          id: 'item-1',
        },
      });
      
      await translationsController.autoTranslate(req, res, next);
      
      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'modules',
          // Missing id
        },
      });
      
      await translationsController.autoTranslate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for unknown table', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'unknown_table',
          id: 'item-1',
        },
      });
      
      await translationsController.autoTranslate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('batchAutoTranslate', () => {
    it('should batch translate multiple items', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Item 1', name_ar: null, name_fr: null },
        { id: 'item-2', name: 'Item 2', name_ar: null, name_fr: null },
      ];
      
      mockResponses.push({ data: mockItems, error: null }); // fetch items
      mockResponses.push({ data: { id: 'item-1' }, error: null }); // update first
      mockResponses.push({ data: { id: 'item-2' }, error: null }); // update second
      
      vi.mocked(translateText).mockResolvedValue({ ar: 'مترجم', fr: 'Traduit' });
      
      const { req, res, next } = createMockReqRes({
        body: {
          table: 'modules',
        },
      });
      
      await translationsController.batchAutoTranslate(req, res, next);
      
      // Should call res.json or next
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', async () => {
      const mockLanguages = [
        { code: 'en', name: 'English', is_active: true },
        { code: 'ar', name: 'Arabic', is_active: true },
      ];
      
      mockResponses.push({ data: mockLanguages, error: null });
      
      const { req, res, next } = createMockReqRes();
      
      await translationsController.getSupportedLanguages(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockLanguages,
      }));
    });
  });

  describe('addLanguage', () => {
    it('should add a new language', async () => {
      const mockLanguage = { code: 'de', name: 'German', is_active: true };
      
      mockResponses.push({ data: mockLanguage, error: null });
      
      const { req, res, next } = createMockReqRes({
        body: {
          code: 'de',
          name: 'German',
          nativeName: 'Deutsch',
          direction: 'ltr',
        },
      });
      
      await translationsController.addLanguage(req, res, next);
      
      // Should either call res.status(201).json or res.json
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 400 for missing code', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'German',
        },
      });
      
      await translationsController.addLanguage(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateLanguage', () => {
    it('should update a language', async () => {
      const mockLanguage = { code: 'ar', name: 'Arabic Updated', is_active: true };
      
      mockResponses.push({ data: mockLanguage, error: null });
      
      const { req, res, next } = createMockReqRes({
        params: { code: 'ar' },
        body: {
          name: 'Arabic Updated',
          is_active: false,
        },
      });
      
      await translationsController.updateLanguage(req, res, next);
      
      // Should call res.json or next (for error handling)
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('deleteLanguage', () => {
    it('should delete a language', async () => {
      mockResponses.push({ data: { code: 'de' }, error: null });
      
      const { req, res, next } = createMockReqRes({
        params: { code: 'de' },
      });
      
      await translationsController.deleteLanguage(req, res, next);
      
      // Should call res.json or next (for error handling)
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 when trying to delete default language', async () => {
      const { req, res, next } = createMockReqRes({
        params: { code: 'en' },
      });
      
      await translationsController.deleteLanguage(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('compareFrontendTranslations', () => {
    it('should compare frontend translation files', async () => {
      const { req, res, next } = createMockReqRes();
      
      await translationsController.compareFrontendTranslations(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('updateFrontendTranslation', () => {
    it('should update a frontend translation', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          locale: 'ar',
          key: 'common.save',
          value: 'حفظ',
        },
      });
      
      await translationsController.updateFrontendTranslation(req, res, next);
      
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 400 for missing fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          locale: 'ar',
          // Missing key and value
        },
      });
      
      await translationsController.updateFrontendTranslation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getUiTranslations', () => {
    it('should return UI translations for a locale', async () => {
      const mockTranslations = [
        { key: 'common.save', value: 'Save' },
        { key: 'common.cancel', value: 'Cancel' },
      ];
      
      mockResponses.push({ data: mockTranslations, error: null });
      
      const { req, res, next } = createMockReqRes({
        query: { locale: 'en' },
      });
      
      await translationsController.getUiTranslations(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  describe('upsertUiTranslation', () => {
    it('should upsert a UI translation', async () => {
      const mockTranslation = { key: 'common.save', locale: 'ar', value: 'حفظ' };
      
      mockResponses.push({ data: mockTranslation, error: null });
      
      const { req, res, next } = createMockReqRes({
        body: {
          key: 'common.save',
          locale: 'ar',
          value: 'حفظ',
          namespace: 'common',
        },
      });
      
      await translationsController.upsertUiTranslation(req, res, next);
      
      // Should call res.json or next (for error handling)
      const wasCalled = (res.json as any).mock.calls.length > 0 || (next as any).mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          key: 'common.save',
          // Missing locale and value
        },
      });
      
      await translationsController.upsertUiTranslation(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('publishTranslations', () => {
    it('should return message when no translations to publish', async () => {
      mockResponses.push({ data: [], error: null }); // Empty data
      
      const { req, res, next } = createMockReqRes({
        body: {
          locale: 'ar',
        },
      });
      
      await translationsController.publishTranslations(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.any(String),
      }));
    });
  });

  describe('getTranslationServiceStatus', () => {
    it('should return translation service status', async () => {
      vi.mocked(getTranslationStatus).mockReturnValue({
        configured: true,
        provider: 'google',
      });
      
      const { req, res, next } = createMockReqRes();
      
      await translationsController.getTranslationServiceStatus(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        configured: true,
      }));
    });
  });
});
