/**
 * Booking Engine Import Type Definitions (multi_day_booking engine type)
 * Handles chalets, accommodations, rooms, villas, etc.
 */

export interface AccommodationAddOn {
  name: string;
  price: number;
  pricingType: 'per_night' | 'one_time' | 'per_person';
  description?: string;
}

export interface AccommodationPolicy {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationHours?: number;
  petFriendly?: boolean;
  smokingAllowed?: boolean;
}

export interface ImportedAccommodation {
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  weekendPrice?: number;
  weeklyDiscount?: number;
  amenities?: string[];
  policies?: AccommodationPolicy;
  addOns?: AccommodationAddOn[];
  images?: string[];
  isActive?: boolean;
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface BookingImportResult {
  items: ImportedAccommodation[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface BookingCommitImportRequest {
  items: ImportedAccommodation[];
  moduleId?: string;
}
