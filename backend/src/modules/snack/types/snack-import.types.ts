/**
 * Snack Bar Import Type Definitions
 */

export type SnackCategory = 'drinks' | 'snacks' | 'ice_cream' | 'sandwiches' | 'other';

export interface SnackIngredient {
  name: string;
  estimatedQuantity: number;
  estimatedUnit: 'g' | 'ml' | 'piece' | 'kg' | 'l';
}

export interface SnackVariant {
  name: string;
  price: number;
}

export interface ImportedSnackItem {
  name: string;
  price: number;
  category: SnackCategory;
  description?: string;
  is_available?: boolean;
  discount_price?: number;
  calories?: number;
  allergens?: string[];
  variants?: SnackVariant[];
  ingredients?: SnackIngredient[];
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface SnackImportResult {
  items: ImportedSnackItem[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface SnackCommitImportRequest {
  items: ImportedSnackItem[];
}
