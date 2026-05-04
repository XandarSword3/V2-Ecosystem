/**
 * Loyalty Import Type Definitions
 */

export interface ImportedLoyaltyTier {
  name: string;
  minPoints: number;
  pointsMultiplier: number;
  color?: string;
  benefits?: string[];
  description?: string;
  pointsExpiryDays?: number;
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface LoyaltyImportResult {
  items: ImportedLoyaltyTier[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface LoyaltyCommitImportRequest {
  items: ImportedLoyaltyTier[];
}
