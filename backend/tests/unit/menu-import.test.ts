import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as parser from '../../src/modules/restaurant/services/menu-import.parser.js';
import axios from 'axios';

vi.mock('axios');

describe('Menu Import Parsers', () => {
  describe('parseJsonImport', () => {
    it('should parse valid JSON menu items', () => {
      const data = [
        { name: 'Pizza', price: 10, category: 'Main' },
        { name: 'Soda', price: 2, category: 'Drinks', description: 'Cold' }
      ];
      const result = parser.parseJsonImport(data);
      expect(result.successful).toBe(2);
      expect(result.items[0].name).toBe('Pizza');
      expect(result.items[1].description).toBe('Cold');
    });

    it('should handle snake_case fields', () => {
      const data = [{ name: 'Burger', price: 8, is_available: false }];
      const result = parser.parseJsonImport(data);
      expect(result.items[0].is_available).toBe(false);
    });

    it('should add warnings for missing optional but recommended fields', () => {
      const data = [{ name: 'Salad', price: 'invalid' }];
      const result = parser.parseJsonImport(data);
      expect(result.successful).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.items[0].price).toBe(0);
    });

    it('should throw error for missing name', () => {
      const data = [{ price: 10 }];
      const result = parser.parseJsonImport(data);
      expect(result.successful).toBe(0);
      expect(result.errors[0]).toContain('Missing required field: name');
    });
  });

  describe('parseCsvImport', () => {
    it('should parse CSV buffer into items', async () => {
      const csvContent = 'name,price,category\nPizza,12.99,Main\nSalad,8.50,Side';
      const buffer = Buffer.from(csvContent);
      const result = await parser.parseCsvImport(buffer);
      expect(result.successful).toBe(2);
      expect(result.items[0].name).toBe('Pizza');
      expect(result.items[1].category).toBe('Side');
    });
  });

  describe('parseLlmImport', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should parse LLM text output into items', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const mockResponse = {
        data: {
          content: [{
            text: '[{"name": "AI Pizza", "price": 15, "category": "AI"}]'
          }]
        }
      };
      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await parser.parseLlmImport('Some text');
      expect(result.successful).toBe(1);
      expect(result.items[0].name).toBe('AI Pizza');
    });

    it('should handle failed LLM JSON response', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const mockResponse = {
        data: {
          content: [{
            text: 'I cannot parse this.'
          }]
        }
      };
      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await parser.parseLlmImport('garbage');
      expect(result.successful).toBe(0);
      expect(result.errors[0]).toContain('LLM output could not be parsed');
    });
  });
});
