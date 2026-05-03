/**
 * Menu Import Type Definitions
 */

export interface ModifierOption {
  name: string;
  price: number;
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
