/**
 * Menu Import Type Definitions
 */

export interface Ingredient {
  name: string;
  estimatedQuantity: number;
  estimatedUnit: 'g' | 'ml' | 'piece' | 'kg' | 'l';
  inventoryItemName?: string; // For linking to inventory when ingredient is also a modifier
}

export interface ModifierOption {
  name: string;
  price: number;
  modifierType?: 'add' | 'remove' | 'swap';
  inventoryItemName?: string; // Link to inventory item if this option is an ingredient
}

export interface ModifierGroup {
  name: string;
  is_required: boolean;
  options: ModifierOption[];
}

export interface ImportedMenuItem {
  name: string;
  price: number;
  category: string;
  description?: string;
  is_available: boolean;
  discount_price?: number;
  preparation_time?: number;
  calories?: number;
  allergens?: string[];
  modifiers?: ModifierGroup[];
  ingredients?: Ingredient[];
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface ImportResult {
  items: ImportedMenuItem[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface CommitImportRequest {
  moduleId: string;
  items: ImportedMenuItem[];
  categoryMap: Record<string, string | null>;
}
