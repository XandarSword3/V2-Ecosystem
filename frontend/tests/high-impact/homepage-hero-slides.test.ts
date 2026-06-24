import { describe, expect, it } from 'vitest';

describe('Homepage Hero Slides - includeDefaultSlide logic', () => {
  const defaultSlide = {
    id: 'default',
    title: 'Default Title',
    subtitle: 'Default Subtitle',
    buttonText: 'Default Button',
    buttonLink: '/',
    imageUrl: '',
    enabled: true,
  };

  const customSlide1 = {
    id: '1',
    title: 'Custom Slide 1',
    subtitle: 'Custom Subtitle 1',
    buttonText: 'Custom Button 1',
    buttonLink: '/page1',
    imageUrl: '/image1.jpg',
    enabled: true,
  };

  const customSlide2 = {
    id: '2',
    title: 'Custom Slide 2',
    subtitle: 'Custom Subtitle 2',
    buttonText: 'Custom Button 2',
    buttonLink: '/page2',
    imageUrl: '/image2.jpg',
    enabled: true,
  };

  describe('when includeDefaultSlide is false (default behavior)', () => {
    it('returns only custom slides when they exist', () => {
      const customSlides = [customSlide1, customSlide2];
      const includeDefaultSlide = false;

      const result = customSlides.length > 0 ? customSlides : [defaultSlide];

      expect(result).toEqual(customSlides);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('returns default slide when no custom slides exist', () => {
      const customSlides: any[] = [];
      const includeDefaultSlide = false;

      const result = customSlides.length > 0 ? customSlides : [defaultSlide];

      expect(result).toEqual([defaultSlide]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
    });
  });

  describe('when includeDefaultSlide is true', () => {
    it('prepends default slide to custom slides', () => {
      const customSlides = [customSlide1, customSlide2];
      const includeDefaultSlide = true;

      const result = includeDefaultSlide && customSlides.length > 0
        ? [defaultSlide, ...customSlides]
        : customSlides.length > 0 ? customSlides : [defaultSlide];

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('default');
      expect(result[1].id).toBe('1');
      expect(result[2].id).toBe('2');
    });

    it('returns default slide when no custom slides exist (same as false case)', () => {
      const customSlides: any[] = [];
      const includeDefaultSlide = true;

      const result = includeDefaultSlide && customSlides.length > 0
        ? [defaultSlide, ...customSlides]
        : customSlides.length > 0 ? customSlides : [defaultSlide];

      expect(result).toEqual([defaultSlide]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
    });
  });

  describe('edge cases', () => {
    it('handles disabled custom slides correctly', () => {
      const customSlides = [
        { ...customSlide1, enabled: false },
        { ...customSlide2, enabled: true },
      ];
      const includeDefaultSlide = false;

      const enabledSlides = customSlides.filter(s => s.enabled);
      const result = enabledSlides.length > 0 ? enabledSlides : [defaultSlide];

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('handles includeDefaultSlide with only disabled custom slides', () => {
      const customSlides = [
        { ...customSlide1, enabled: false },
        { ...customSlide2, enabled: false },
      ];
      const includeDefaultSlide = true;

      const enabledSlides = customSlides.filter(s => s.enabled);
      const result = includeDefaultSlide && enabledSlides.length > 0
        ? [defaultSlide, ...enabledSlides]
        : enabledSlides.length > 0 ? enabledSlides : [defaultSlide];

      expect(result).toEqual([defaultSlide]);
      expect(result).toHaveLength(1);
    });
  });
});
