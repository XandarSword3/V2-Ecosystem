/**
 * Housekeeping Import Type Definitions
 */

export type TaskCategory = 'room' | 'common_area' | 'pool' | 'kitchen' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RequiredSupply {
  name: string;
  quantity: number;
  unit: string;
}

export interface ImportedHousekeepingTemplate {
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  checklist?: string[];
  requiredSupplies?: RequiredSupply[];
  assignableRoles?: string[];
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface HousekeepingImportResult {
  items: ImportedHousekeepingTemplate[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface HousekeepingCommitImportRequest {
  items: ImportedHousekeepingTemplate[];
}
