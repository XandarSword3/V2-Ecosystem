import { Request, Response, NextFunction } from 'express';

// Mock the i18n service
vi.mock('../../../src/modules/i18n/i18n.service', () => ({
  i18nService: {
    enableLanguage: vi.fn().mockResolvedValue(undefined),
    disableLanguage: vi.fn().mockResolvedValue(undefined),
    getPropertyLanguages: vi.fn().mockResolvedValue([{ code: 'en', name: 'English' }]),
    createTranslationKey: vi.fn().mockResolvedValue({ id: 'key-1', key: 'common.save' }),
    getTranslationKeys: vi.fn().mockResolvedValue([{ id: 'key-1', key: 'common.save' }]),
    setTranslation: vi.fn().mockResolvedValue({ id: 'trans-1', value: 'Save' }),
    bulkSetTranslations: vi.fn().mockResolvedValue({ success: 5, failed: 0 }),
    getTranslation: vi.fn().mockResolvedValue('Save'),
    approveTranslation: vi.fn().mockResolvedValue(undefined),
    rejectTranslation: vi.fn().mockResolvedValue(undefined),
    getTranslationBundle: vi.fn().mockResolvedValue({ checksum: 'abc123', translations: {} }),
    generateBundle: vi.fn().mockResolvedValue({ checksum: 'abc123', translations: {} }),
    getBundleChecksum: vi.fn().mockResolvedValue('abc123'),
    translateContent: vi.fn().mockResolvedValue(undefined),
    getContentTranslation: vi.fn().mockResolvedValue('Translated'),
    getEntityTranslations: vi.fn().mockResolvedValue([{ field: 'name', value: 'Test' }]),
    publishContentTranslation: vi.fn().mockResolvedValue(undefined),
    setGuestLanguage: vi.fn().mockResolvedValue(undefined),
    getGuestLanguage: vi.fn().mockResolvedValue('en'),
    detectGuestLanguage: vi.fn().mockResolvedValue('en'),
    updateTranslationProgress: vi.fn().mockResolvedValue({ total: 100, translated: 80 }),
    getMissingTranslations: vi.fn().mockResolvedValue([{ key: 'missing.key' }]),
    interpolate: vi.fn().mockReturnValue('Hello, World!'),
  },
}));

import * as i18nController from '../../../src/modules/i18n/i18n.controller';
import { i18nService } from '../../../src/modules/i18n/i18n.service';

const createMockReqRes = (overrides: { params?: any; query?: any; body?: any; user?: any; headers?: any } = {}) => {
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    user: overrides.user || { id: 'user-1', role: 'admin' },
    headers: overrides.headers || {},
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
};

describe('i18n Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enableLanguage', () => {
    it('should enable a language for a property', async () => {
      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1', languageCode: 'ar' },
        body: { isDefault: false },
      });

      await i18nController.enableLanguage(req, res, next);

      expect(i18nService.enableLanguage).toHaveBeenCalledWith('prop-1', 'ar', { isDefault: false });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next on error', async () => {
      vi.mocked(i18nService.enableLanguage).mockRejectedValueOnce(new Error('Failed'));

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1', languageCode: 'ar' },
      });

      await i18nController.enableLanguage(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('disableLanguage', () => {
    it('should disable a language for a property', async () => {
      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1', languageCode: 'ar' },
      });

      await i18nController.disableLanguage(req, res, next);

      expect(i18nService.disableLanguage).toHaveBeenCalledWith('prop-1', 'ar');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getPropertyLanguages', () => {
    it('should return enabled languages for a property', async () => {
      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
      });

      await i18nController.getPropertyLanguages(req, res, next);

      expect(i18nService.getPropertyLanguages).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [{ code: 'en', name: 'English' }],
      }));
    });
  });

  describe('createTranslationKey', () => {
    it('should create a new translation key', async () => {
      const { req, res, next } = createMockReqRes({
        body: { key: 'common.save', context: 'common', module: 'core' },
      });

      await i18nController.createTranslationKey(req, res, next);

      expect(i18nService.createTranslationKey).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getTranslationKeys', () => {
    it('should return translation keys', async () => {
      const { req, res, next } = createMockReqRes({
        query: { context: 'common' },
      });

      await i18nController.getTranslationKeys(req, res, next);

      expect(i18nService.getTranslationKeys).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should filter by needsReview flag', async () => {
      const { req, res, next } = createMockReqRes({
        query: { needsReview: 'true' },
      });

      await i18nController.getTranslationKeys(req, res, next);

      expect(i18nService.getTranslationKeys).toHaveBeenCalledWith(expect.objectContaining({
        needsReview: true,
      }));
    });
  });

  describe('setTranslation', () => {
    it('should set a translation value', async () => {
      const { req, res, next } = createMockReqRes({
        params: { keyId: 'key-1', locale: 'ar' },
        body: { value: 'حفظ' },
      });

      await i18nController.setTranslation(req, res, next);

      expect(i18nService.setTranslation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('bulkSetTranslations', () => {
    it('should set multiple translations', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          translations: [
            { keyId: 'key-1', locale: 'ar', value: 'حفظ' },
            { keyId: 'key-2', locale: 'ar', value: 'إلغاء' },
          ],
        },
      });

      await i18nController.bulkSetTranslations(req, res, next);

      expect(i18nService.bulkSetTranslations).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getTranslation', () => {
    it('should return a translation value', async () => {
      const { req, res, next } = createMockReqRes({
        params: { keyId: 'key-1', locale: 'en' },
      });

      await i18nController.getTranslation(req, res, next);

      expect(i18nService.getTranslation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('approveTranslation', () => {
    it('should approve a translation', async () => {
      const { req, res, next } = createMockReqRes({
        params: { translationId: 'trans-1' },
        user: { id: 'user-1' },
      });

      await i18nController.approveTranslation(req, res, next);

      expect(i18nService.approveTranslation).toHaveBeenCalledWith('trans-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('rejectTranslation', () => {
    it('should reject a translation', async () => {
      const { req, res, next } = createMockReqRes({
        params: { translationId: 'trans-1' },
        body: { reason: 'Incorrect translation' },
      });

      await i18nController.rejectTranslation(req, res, next);

      expect(i18nService.rejectTranslation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getTranslationBundle', () => {
    it('should return a translation bundle', async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        end: vi.fn(),
      };
      const { req, next } = createMockReqRes({
        params: { languageCode: 'en' },
        query: { context: 'ui', propertyId: 'prop-1' },
        headers: {},
      });

      await i18nController.getTranslationBundle(req, mockRes as any, next);

      expect(i18nService.getTranslationBundle).toHaveBeenCalledWith('en', 'ui', 'prop-1');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('regenerateBundle', () => {
    it('should regenerate the translation bundle', async () => {
      const { req, res, next } = createMockReqRes({
        params: { languageCode: 'ar' },
        body: { context: 'ui', propertyId: 'prop-1' },
      });

      await i18nController.regenerateBundle(req, res, next);

      expect(i18nService.generateBundle).toHaveBeenCalledWith('ar', 'ui', 'prop-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getBundleChecksum', () => {
    it('should return bundle checksum', async () => {
      const { req, res, next } = createMockReqRes({
        params: { languageCode: 'en', context: 'ui' },
        query: { propertyId: 'prop-1' },
      });

      await i18nController.getBundleChecksum(req, res, next);

      expect(i18nService.getBundleChecksum).toHaveBeenCalledWith('en', 'ui', 'prop-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { checksum: 'abc123' },
      }));
    });
  });

  describe('translateContent', () => {
    it('should translate entity content', async () => {
      const { req, res, next } = createMockReqRes({
        params: { entityType: 'catalog_items', entityId: 'item-1', fieldName: 'name', languageCode: 'ar' },
        body: { value: 'مقبلات', status: 'pending' },
        user: { id: 'user-1' },
      });

      await i18nController.translateContent(req, res, next);

      expect(i18nService.translateContent).toHaveBeenCalledWith(
        'catalog_items', 'item-1', 'name', 'ar', 'مقبلات',
        expect.objectContaining({ status: 'pending' })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getContentTranslation', () => {
    it('should return content translation', async () => {
      const { req, res, next } = createMockReqRes({
        params: { entityType: 'catalog_items', entityId: 'item-1', locale: 'ar', field: 'name' },
      });

      await i18nController.getContentTranslation(req, res, next);

      expect(i18nService.getContentTranslation).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getEntityTranslations', () => {
    it('should return all translations for an entity', async () => {
      const { req, res, next } = createMockReqRes({
        params: { entityType: 'accommodation_units', entityId: 'accommodation unit-1', languageCode: 'ar' },
      });

      await i18nController.getEntityTranslations(req, res, next);

      expect(i18nService.getEntityTranslations).toHaveBeenCalledWith('accommodation_units', 'accommodation unit-1', 'ar');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('publishContentTranslation', () => {
    it('should publish content translation', async () => {
      const { req, res, next } = createMockReqRes({
        params: { entityType: 'catalog_items', entityId: 'item-1', languageCode: 'ar' },
      });

      await i18nController.publishContentTranslation(req, res, next);

      expect(i18nService.publishContentTranslation).toHaveBeenCalledWith('catalog_items', 'item-1', 'ar');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('setGuestLanguage', () => {
    it('should set guest language preference', async () => {
      const { req, res, next } = createMockReqRes({
        params: { guestId: 'guest-1' },
        body: { languageCode: 'ar' },
      });

      await i18nController.setGuestLanguage(req, res, next);

      expect(i18nService.setGuestLanguage).toHaveBeenCalledWith('guest-1', { languageCode: 'ar' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getGuestLanguage', () => {
    it('should return guest language preference', async () => {
      const { req, res, next } = createMockReqRes({
        params: { guestId: 'guest-1' },
      });

      await i18nController.getGuestLanguage(req, res, next);

      expect(i18nService.getGuestLanguage).toHaveBeenCalledWith('guest-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { preferredLanguage: 'en' },
      }));
    });
  });

  describe('detectLanguage', () => {
    it('should detect language from accept-language header', async () => {
      const { req, res, next } = createMockReqRes({
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      });

      await i18nController.detectLanguage(req, res, next);

      expect(i18nService.detectGuestLanguage).toHaveBeenCalledWith('en-US,en;q=0.9');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { detectedLanguage: 'en' },
      }));
    });
  });

  describe('getTranslationProgress', () => {
    it('should return translation progress stats', async () => {
      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1', languageCode: 'ar' },
      });

      await i18nController.getTranslationProgress(req, res, next);

      expect(i18nService.updateTranslationProgress).toHaveBeenCalledWith('prop-1', 'ar');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getMissingTranslations', () => {
    it('should return missing translations', async () => {
      const { req, res, next } = createMockReqRes({
        params: { languageCode: 'fr' },
        query: { propertyId: 'prop-1', context: 'ui' },
      });

      await i18nController.getMissingTranslations(req, res, next);

      expect(i18nService.getMissingTranslations).toHaveBeenCalledWith('fr', 'prop-1', 'ui');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('interpolateString', () => {
    it('should interpolate a string with values', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          template: 'Hello, {{name}}!',
          values: { name: 'World' },
        },
      });

      await i18nController.interpolateString(req, res, next);

      expect(i18nService.interpolate).toHaveBeenCalledWith('Hello, {{name}}!', { name: 'World' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
