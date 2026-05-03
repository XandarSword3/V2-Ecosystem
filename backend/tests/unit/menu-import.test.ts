import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as parser from '../../src/modules/restaurant/services/menu-import.parser.js';
import axios from 'axios';

vi.mock('axios');

describe('Menu Import Parsers', () => {
  describe('parseJsonImport', () => {
    it('should handle nested category-keyed objects', () => {
      const data = {
        menu: {
          pizzas: [{ name: 'Margherita', price: 12 }],
          drinks: [{ name: 'Cola', price: 2 }]
        }
      };
      const result = parser.parseJsonImport(data);
      expect(result.successful).toBe(2);
      expect(result.items[0].category).toBe('pizzas');
      expect(result.items[1].category).toBe('drinks');
    });

    it('should map ingredients to description', () => {
      const data = [
        { name: 'Pizza', price: 10, ingredients: ['Tomato', 'Cheese'] }
      ];
      const result = parser.parseJsonImport(data);
      expect(result.successful).toBe(1);
      expect(result.items[0].description).toBe('Tomato, Cheese');
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
      const csvContent = 'name,price,category,allergens\nPizza,12.99,Main,"gluten,dairy"\nSalad,8.50,Side,\n,invalid,Category';
      const buffer = Buffer.from(csvContent);
      const result = await parser.parseCsvImport(buffer);
      
      expect(result.totalParsed).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.items[0].name).toBe('Pizza');
      expect(result.items[0].allergens).toContain('gluten');
      expect(result.items[0].allergens).toContain('dairy');
      expect(result.items[1].category).toBe('Side');
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Row 4: Missing required field: name');
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
