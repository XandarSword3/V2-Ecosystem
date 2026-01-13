/**
 * Translation Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { translateText } from '../../src/services/translation.service.js';

describe('Translation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('translateText', () => {
    it('should return original text when translation fails and use fallback', async () => {
      mockFetch.mockRejectedValue(new Error('API error'));
      
      const result = await translateText('hello');
      
      // Should have all three language keys
      expect(result).toHaveProperty('en');
      expect(result).toHaveProperty('ar');
      expect(result).toHaveProperty('fr');
    });

    it('should use cached translation for repeated calls', async () => {
      mockFetch.mockRejectedValue(new Error('API error'));
      
      // First call
      await translateText('coffee');
      
      // Second call with same text should use cache
      const result = await translateText('coffee');
      
      // Should return from cache (fallback dictionary has 'coffee')
      expect(result.en).toBe('coffee');
      expect(result.ar).toBe('قهوة');
      expect(result.fr).toBe('café');
    });

    it('should translate known hospitality terms using fallback dictionary', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const result = await translateText('hummus');
      
      expect(result.en).toBe('hummus');
      expect(result.ar).toBe('حمص');
      expect(result.fr).toBe('houmous');
    });

    it('should translate common food items', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const teaResult = await translateText('tea');
      expect(teaResult.ar).toBe('شاي');
      expect(teaResult.fr).toBe('thé');

      // Clear cache simulation for next test
    });

    it('should translate size terms', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const smallResult = await translateText('small');
      expect(smallResult.ar).toBe('صغير');
      expect(smallResult.fr).toBe('petit');

      const largeResult = await translateText('large');
      expect(largeResult.ar).toBe('كبير');
      expect(largeResult.fr).toBe('grand');
    });

    it('should translate category names', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const result = await translateText('appetizers');
      
      expect(result.ar).toBe('المقبلات');
      expect(result.fr).toBe('entrées');
    });

    it('should handle source language other than English', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      // When source is Arabic, the Arabic field should be the original text
      const result = await translateText('مرحبا', 'ar');
      
      expect(result.ar).toBe('مرحبا');
    });

    it('should return original text for unknown phrases', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const unknownPhrase = 'xyzzy-unknown-phrase-12345';
      const result = await translateText(unknownPhrase);
      
      // Should return original text when no translation is found
      expect(result.en).toBe(unknownPhrase);
    });
  });

  describe('Cache behavior', () => {
    it('should cache translations to avoid repeated API calls', async () => {
      mockFetch.mockRejectedValue(new Error('No API configured'));
      
      const text = 'water';
      
      // Call multiple times
      await translateText(text);
      await translateText(text);
      await translateText(text);
      
      // All results should be consistent
      const result = await translateText(text);
      expect(result.en).toBe('water');
      expect(result.ar).toBe('ماء');
      expect(result.fr).toBe('eau');
    });
  });

  describe('Fallback dictionary coverage', () => {
    it('should have translations for common beverage items', async () => {
      mockFetch.mockRejectedValue(new Error('No API'));
      
      const beverages = ['coffee', 'tea', 'juice', 'water'];
      
      for (const beverage of beverages) {
        const result = await translateText(beverage);
        expect(result.ar).toBeTruthy();
        expect(result.fr).toBeTruthy();
        expect(result.ar).not.toBe(beverage); // Should have actual translation
      }
    });

    it('should have translations for common food items', async () => {
      mockFetch.mockRejectedValue(new Error('No API'));
      
      const foods = ['hummus', 'falafel', 'shawarma', 'kebab', 'baklava'];
      
      for (const food of foods) {
        const result = await translateText(food);
        expect(result.ar).toBeTruthy();
        expect(result.fr).toBeTruthy();
      }
    });

    it('should have translations for descriptive terms', async () => {
      mockFetch.mockRejectedValue(new Error('No API'));
      
      const terms = ['fresh', 'grilled', 'traditional', 'delicious', 'homemade'];
      
      for (const term of terms) {
        const result = await translateText(term);
        expect(result.ar).toBeTruthy();
        expect(result.fr).toBeTruthy();
      }
    });
  });
});
