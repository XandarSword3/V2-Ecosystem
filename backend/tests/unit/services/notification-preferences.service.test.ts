
// Mock supabase - getPreferences queries 'users' table
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  activityLogger: {
    logActivity: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { notificationPreferencesService, DEFAULT_PREFERENCES } from '../../../src/services/notification-preferences.service';
import { supabase } from '../../../src/lib/supabase';

describe('NotificationPreferencesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_PREFERENCES', () => {
    it('should have email enabled by default', () => {
      expect(DEFAULT_PREFERENCES.email.enabled).toBe(true);
    });

    it('should have SMS disabled by default (opt-in)', () => {
      expect(DEFAULT_PREFERENCES.sms.enabled).toBe(false);
    });

    it('should have push enabled by default', () => {
      expect(DEFAULT_PREFERENCES.push.enabled).toBe(true);
    });

    it('should have quiet hours configured', () => {
      expect(DEFAULT_PREFERENCES.quiet_hours).toBeDefined();
      expect(DEFAULT_PREFERENCES.quiet_hours.enabled).toBe(false);
    });

    it('should have language set to english by default', () => {
      expect(DEFAULT_PREFERENCES.language).toBe('en');
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences merged with defaults', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { notification_preferences: { language: 'fr' } },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await notificationPreferencesService.getPreferences('user-1');

      expect(result.language).toBe('fr');
      // Should merge with defaults
      expect(result.email).toBeDefined();
    });

    it('should return default preferences on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      } as any);

      const result = await notificationPreferencesService.getPreferences('user-1');

      expect(result).toEqual(DEFAULT_PREFERENCES);
    });

    it('should return default preferences when user has no preferences', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { notification_preferences: null },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await notificationPreferencesService.getPreferences('user-1');

      expect(result.email.enabled).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('should update and return merged preferences', async () => {
      // First call for getPreferences, second for update
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { notification_preferences: DEFAULT_PREFERENCES },
                error: null,
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        } as any);

      const result = await notificationPreferencesService.updatePreferences('user-1', {
        language: 'de',
      });

      expect(result.language).toBe('de');
    });

    it('should throw on update error', async () => {
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { notification_preferences: DEFAULT_PREFERENCES },
                error: null,
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error('Update failed') }),
          }),
        } as any);

      await expect(
        notificationPreferencesService.updatePreferences('user-1', { language: 'de' })
      ).rejects.toThrow();
    });
  });

  describe('shouldNotify', () => {
    it('should return true when channel and type are enabled', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                notification_preferences: {
                  ...DEFAULT_PREFERENCES,
                  email: { ...DEFAULT_PREFERENCES.email, enabled: true },
                },
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await notificationPreferencesService.shouldNotify(
        'user-1',
        'email',
        'booking_confirmation'
      );

      expect(result).toBe(true);
    });

    it('should return false when channel is disabled', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                notification_preferences: {
                  ...DEFAULT_PREFERENCES,
                  email: { ...DEFAULT_PREFERENCES.email, enabled: false },
                },
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await notificationPreferencesService.shouldNotify(
        'user-1',
        'email',
        'booking_confirmation'
      );

      expect(result).toBe(false);
    });
  });
});
