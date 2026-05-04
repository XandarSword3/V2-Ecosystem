/**
 * Pool Sessions Import Type Definitions
 */

export type GenderRestriction = 'mixed' | 'male' | 'female';

export interface ImportedPoolSession {
  name: string;
  startTime: string;
  endTime: string;
  adultPrice: number;
  childPrice?: number;
  capacity: number;
  genderRestriction?: GenderRestriction;
  daysOfWeek?: number[];
  isActive?: boolean;
  memberDiscount?: number;
  description?: string;
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface PoolImportResult {
  items: ImportedPoolSession[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface PoolCommitImportRequest {
  items: ImportedPoolSession[];
  moduleId?: string;
}
