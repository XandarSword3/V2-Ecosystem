/**
 * Chalets Import Type Definitions
 */

export interface ChaletAddOn {
  name: string;
  price: number;
  pricingType: 'per_night' | 'one_time' | 'per_person';
  description?: string;
}

export interface ChaletPolicy {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationHours?: number;
  petFriendly?: boolean;
  smokingAllowed?: boolean;
}

export interface ImportedChalet {
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  weekendPrice?: number;
  weeklyDiscount?: number;
  amenities?: string[];
  policies?: ChaletPolicy;
  addOns?: ChaletAddOn[];
  images?: string[];
  isActive?: boolean;
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface ChaletImportResult {
  items: ImportedChalet[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface ChaletCommitImportRequest {
  items: ImportedChalet[];
  moduleId?: string;
}
