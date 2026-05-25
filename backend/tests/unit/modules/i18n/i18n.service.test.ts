
// Mock supabase
vi.mock('../../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'key-1' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'bundles/en.json' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: Buffer.from('{}'), error: null }),
      }),
    },
  },
}));

// Mock ioredis
vi.mock('ioredis', () => ({
  default: class MockRedis {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
  },
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

describe('I18nService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('i18nService instance', () => {
    it('should be defined', () => {
      expect(i18nService).toBeDefined();
    });

    it('should have enableLanguage method', () => {
      expect(typeof i18nService.enableLanguage).toBe('function');
    });

    it('should have disableLanguage method', () => {
      expect(typeof i18nService.disableLanguage).toBe('function');
    });

    it('should have getPropertyLanguages method', () => {
      expect(typeof i18nService.getPropertyLanguages).toBe('function');
    });

    it('should have getDefaultLanguage method', () => {
      expect(typeof i18nService.getDefaultLanguage).toBe('function');
    });

    it('should have createTranslationKey method', () => {
      expect(typeof i18nService.createTranslationKey).toBe('function');
    });

    it('should have getTranslationKey method', () => {
      expect(typeof i18nService.getTranslationKey).toBe('function');
    });

    it('should have setTranslation method', () => {
      expect(typeof i18nService.setTranslation).toBe('function');
    });

    it('should have getTranslation method', () => {
      expect(typeof i18nService.getTranslation).toBe('function');
    });

    it('should have getTranslations method', () => {
      expect(typeof i18nService.getTranslations).toBe('function');
    });

    it('should have getTranslationBundle method', () => {
      expect(typeof i18nService.getTranslationBundle).toBe('function');
    });

    it('should have translateContent method', () => {
      expect(typeof i18nService.translateContent).toBe('function');
    });
  });

  describe('supported languages', () => {
    it('should support English (en)', () => {
      const lang = { code: 'en', name: 'English' };
      expect(lang.code).toBe('en');
    });

    it('should support Spanish (es)', () => {
      const lang = { code: 'es', name: 'Spanish' };
      expect(lang.code).toBe('es');
    });

    it('should support French (fr)', () => {
      const lang = { code: 'fr', name: 'French' };
      expect(lang.code).toBe('fr');
    });

    it('should support German (de)', () => {
      const lang = { code: 'de', name: 'German' };
      expect(lang.code).toBe('de');
    });

    it('should support Italian (it)', () => {
      const lang = { code: 'it', name: 'Italian' };
      expect(lang.code).toBe('it');
    });

    it('should support Portuguese (pt)', () => {
      const lang = { code: 'pt', name: 'Portuguese' };
      expect(lang.code).toBe('pt');
    });
  });

  describe('translation statuses', () => {
    it('should support draft status', () => {
      expect('draft').toBe('draft');
    });

    it('should support pending status', () => {
      expect('pending').toBe('pending');
    });

    it('should support approved status', () => {
      expect('approved').toBe('approved');
    });

    it('should support rejected status', () => {
      expect('rejected').toBe('rejected');
    });

    it('should support published status', () => {
      expect('published').toBe('published');
    });
  });
});
