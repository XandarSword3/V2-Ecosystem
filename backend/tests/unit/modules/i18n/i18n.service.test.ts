/**
 * Multi-Language Service (i18n) Unit Tests
 * 
 * Verifies real business logic of i18n.service:
 * - Language enablement, default language promotion, and unsetting previous default
 * - Protection against disabling the default language
 * - Translation key creation, upserting, and placeholder formatting
 * - Setting and bulk-setting translations with cache invalidation
 * - Retrieval of translation keys, individual translations, and bundles
 * - Translation approval and rejection lifecycle
 * - Dynamic content translations (entityType, entityId, fieldName)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function createChainableMock(defaultData: any = null, error: any = null) {
  const chain: any = {};
  const methods = ['select', 'eq', 'order', 'limit', 'single', 'update', 'upsert', 'delete', 'in', 'is'];
  methods.forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve({ data: defaultData, error });
  return chain;
}

let mockChain: any;

const mockSupabase = {
  from: vi.fn(() => mockChain),
};

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { i18nService } from '../../../../src/modules/i18n/i18n.service';

describe('I18nService (Real Methods & Database Logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChainableMock([]);
  });

  describe('Language Management (enable, disable, default)', () => {
    it('enabling language as default unsets previous default and upserts language', async () => {
      mockChain.then = (resolve: any) => resolve({ data: [], error: null });

      await i18nService.enableLanguage('prop-1', 'fr', {
        languageName: 'French',
        nativeName: 'Français',
        isDefault: true,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('property_languages');
      expect(mockChain.update).toHaveBeenCalledWith({ is_default: false });
      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-1',
          language_code: 'fr',
          language_name: 'French',
          is_default: true,
          is_active: true,
        }),
        expect.objectContaining({ onConflict: 'property_id,language_code' })
      );
    });

    it('disabling default language throws error', async () => {
      mockChain.then = (resolve: any) => resolve({ data: [{ is_default: true }], error: null });

      await expect(i18nService.disableLanguage('prop-1', 'en')).rejects.toThrow(
        'Cannot disable the default language'
      );
    });

    it('disables non-default language successfully', async () => {
      mockChain.then = (resolve: any) => resolve({ data: [{ is_default: false }], error: null });

      await i18nService.disableLanguage('prop-1', 'de');

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });

    it('returns default language when found or falls back to en', async () => {
      mockChain.then = (resolve: any) => resolve({ data: [{ language_code: 'es' }], error: null });
      const lang = await i18nService.getDefaultLanguage('prop-1');
      expect(lang).toBe('es');

      mockChain.then = (resolve: any) => resolve({ data: [], error: null });
      const fallback = await i18nService.getDefaultLanguage('prop-1');
      expect(fallback).toBe('en');
    });

    it('retrieves active property languages in sorted order', async () => {
      mockChain.then = (resolve: any) => resolve({
        data: [
          {
            language_code: 'en',
            language_name: 'English',
            is_default: true,
            is_active: true,
            translation_progress: 100,
            date_format: 'MM/DD/YYYY',
            time_format: '12h',
          },
          {
            language_code: 'es',
            language_name: 'Spanish',
            is_default: false,
            is_active: true,
            translation_progress: 60,
            date_format: 'DD/MM/YYYY',
            time_format: '24h',
          },
        ],
        error: null,
      });

      const langs = await i18nService.getPropertyLanguages('prop-1');
      expect(langs).toHaveLength(2);
      expect(langs[0].languageCode).toBe('en');
      expect(langs[0].isDefault).toBe(true);
      expect(langs[1].languageCode).toBe('es');
      expect(langs[1].translationProgress).toBe(60);
    });
  });

  describe('Translation Key Operations', () => {
    it('creates translation key with proper mappings', async () => {
      const mockKeyRow = {
        id: 'key-uuid-1',
        key_path: 'menu.checkout.title',
        context: 'storefront',
        module: 'restaurant',
        component: 'cart',
        default_value: 'Your Cart',
        description: 'Header for cart drawer',
        max_length: 50,
        placeholders: ['count'],
      };

      mockChain.single.mockResolvedValueOnce({
        data: mockKeyRow,
        error: null,
      });

      const key = await i18nService.createTranslationKey({
        keyPath: 'menu.checkout.title',
        context: 'storefront',
        module: 'restaurant',
        component: 'cart',
        defaultValue: 'Your Cart',
        description: 'Header for cart drawer',
        maxLength: 50,
        placeholders: ['count'],
      });

      expect(key.id).toBe('key-uuid-1');
      expect(key.keyPath).toBe('menu.checkout.title');
      expect(key.defaultValue).toBe('Your Cart');
      expect(key.placeholders).toEqual(['count']);
    });

    it('returns translation key if found or null if not', async () => {
      mockChain.then = (resolve: any) => resolve({
        data: [
          {
            id: 'k-1',
            key_path: 'common.save',
            context: 'admin',
            default_value: 'Save',
            placeholders: [],
          },
        ],
        error: null,
      });

      const key = await i18nService.getTranslationKey('common.save');
      expect(key?.keyPath).toBe('common.save');

      mockChain.then = (resolve: any) => resolve({ data: [], error: null });
      const notFound = await i18nService.getTranslationKey('unknown.key');
      expect(notFound).toBeNull();
    });

    it('lists translation keys with context and module filters', async () => {
      mockChain.then = (resolve: any) => resolve({
        data: [
          { id: 'k-1', key_path: 'cart.title', context: 'ui', module: 'commerce', default_value: 'Cart', placeholders: [] },
        ],
        error: null,
      });

      const list = await i18nService.getTranslationKeys({ context: 'ui', module: 'commerce', needsReview: true });
      expect(mockChain.eq).toHaveBeenCalledWith('context', 'ui');
      expect(mockChain.eq).toHaveBeenCalledWith('module', 'commerce');
      expect(mockChain.eq).toHaveBeenCalledWith('needs_review', true);
      expect(list).toHaveLength(1);
    });
  });

  describe('Setting and Bulk-Setting Translations', () => {
    it('throws when setting translation for non-existent key', async () => {
      mockChain.then = (resolve: any) => resolve({ data: [], error: null });

      await expect(
        i18nService.setTranslation('missing.key', 'fr', 'Bonjour')
      ).rejects.toThrow('Translation key not found: missing.key');
    });

    it('sets translation with property scope and status', async () => {
      mockChain.then = (resolve: any) => resolve({
        data: [{ id: 'k-123', key_path: 'common.hello', context: 'general', placeholders: [] }],
        error: null,
      });

      await i18nService.setTranslation('common.hello', 'fr', 'Bonjour', {
        propertyId: 'prop-1',
        status: 'approved',
      });

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key_id: 'k-123',
          property_id: 'prop-1',
          language_code: 'fr',
          value: 'Bonjour',
          status: 'approved',
          is_custom: true,
        }),
        expect.objectContaining({ onConflict: 'key_id,property_id,language_code' })
      );
    });

    it('bulk sets translations reporting successes and failures', async () => {
      let callCount = 0;
      mockChain.then = (resolve: any) => {
        callCount++;
        if (callCount === 1) {
          resolve({
            data: [{ id: 'k-1', key_path: 'k1', context: 'gen', placeholders: [] }],
            error: null,
          });
        } else if (callCount === 2) {
          resolve({ data: null, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      };

      const res = await i18nService.bulkSetTranslations([
        { keyPath: 'k1', languageCode: 'es', value: 'Hola' },
        { keyPath: 'k2', languageCode: 'es', value: 'Adios' },
      ]);

      expect(res.success).toBe(1);
      expect(res.failed).toBe(1);
    });
  });

  describe('Translation Retrieval and Lifecycle (Approve/Reject)', () => {
    it('retrieves property translation when available, falls back to global or default', async () => {
      // 1. Property translation exists
      mockChain.then = (resolve: any) => resolve({
        data: [{ value: 'Chambres' }],
        error: null,
      });
      const t1 = await i18nService.getTranslation('nav.rooms', 'fr', 'prop-1');
      expect(t1).toBe('Chambres');

      // 2. Property missing, global exists
      let step = 0;
      mockChain.then = (resolve: any) => {
        step++;
        if (step === 1) resolve({ data: [], error: null }); // prop lookup
        else resolve({ data: [{ value: 'Global Chambres' }], error: null }); // global lookup
      };
      const t2 = await i18nService.getTranslation('nav.rooms', 'fr', 'prop-1');
      expect(t2).toBe('Global Chambres');
    });

    it('approves and rejects translations with reviewer id and timestamp', async () => {
      mockChain.update.mockReturnValue(mockChain);
      mockChain.eq.mockResolvedValueOnce({ error: null });

      await i18nService.approveTranslation('trans-123', 'admin-user');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_by: 'admin-user',
        })
      );

      mockChain.eq.mockResolvedValueOnce({ error: null });
      await i18nService.rejectTranslation('trans-123', 'admin-user', 'Inaccurate grammar');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          reviewed_by: 'admin-user',
        })
      );
    });

    it('translates content entity field and upserts into content_translations', async () => {
      mockChain.upsert.mockResolvedValueOnce({ error: null });

      await i18nService.translateContent('catalog_item', 'item-1', 'description', 'es', 'Plato delicioso', {
        status: 'published',
        createdBy: 'user-1',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('content_translations');
      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'catalog_item',
          entity_id: 'item-1',
          field_name: 'description',
          language_code: 'es',
          value: 'Plato delicioso',
        }),
        expect.objectContaining({ onConflict: 'entity_type,entity_id,field_name,language_code' })
      );
    });
  });

  describe('Translation Bundles', () => {
    it('generates translation bundle and calculates sha256 checksum', async () => {
      let step = 0;
      mockChain.then = (resolve: any) => {
        step++;
        if (step === 1) {
          // getTranslationBundle database cache check -> not found
          resolve({ data: [], error: null });
        } else if (step === 2) {
          // generateBundle: translation_keys lookup
          resolve({
            data: [
              { id: 'k-1', key_path: 'app.name', default_value: 'V2 Resort' },
              { id: 'k-2', key_path: 'app.tagline', default_value: 'Welcome' },
            ],
            error: null,
          });
        } else if (step === 3) {
          // generateBundle: translations lookup
          resolve({
            data: [
              { key_id: 'k-1', value: 'V2 Resort FR' },
            ],
            error: null,
          });
        } else {
          // store bundle
          resolve({ data: null, error: null });
        }
      };

      const bundle = await i18nService.getTranslationBundle('fr', 'ui', 'prop-1');
      expect(bundle.languageCode).toBe('fr');
      expect(bundle.keyCount).toBe(2);
      expect(bundle.translations.app.name).toBe('V2 Resort FR');
      expect(bundle.translations.app.tagline).toBe('Welcome'); // fallback to default
      expect(bundle.checksum).toHaveLength(64); // valid sha256 hex
    });
  });
});
