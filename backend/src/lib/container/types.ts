// ─── Notification types (existing) ───────────────────────────────────────────
export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationTargetType = 'all' | 'admin' | 'staff' | 'user' | 'customer';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─── Logger ──────────────────────────────────────────────────────────────────
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'room_charge' | 'gift_card' | 'other';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  processedBy: string;
  processedAt: string;
  transactionId?: string | null;
  notes?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  reservationId?: string | null;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  dueDate?: string | null;
  paidDate?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
}

// ─── Guest ────────────────────────────────────────────────────────────────────
export type GuestStatus = 'active' | 'inactive' | 'vip' | 'banned';

export interface GuestProfile {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  status: GuestStatus;
  preferences: Record<string, unknown>;
  notes: string | null;
  tags: string[];
  totalStays: number;
  totalSpent: number;
  lastVisit: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Amenity ──────────────────────────────────────────────────────────────────
export type AmenityCategory = 'pool' | 'spa' | 'fitness' | 'dining' | 'entertainment' | 'sports' | 'recreation' | 'business' | 'kids' | 'other';
export type AmenityStatus = 'available' | 'maintenance' | 'closed' | 'reserved';

export interface AmenitySchedule {
  id: string;
  amenityId: string;
  dayOfWeek: number;
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
}

export type AmenityReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface AmenityReservation {
  id: string;
  amenityId: string;
  guestId: string;
  guestName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  status: AmenityReservationStatus;
  notes?: string | null;
  cost: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface Amenity {
  id: string;
  name: string;
  description: string;
  category: AmenityCategory;
  location: string;
  capacity?: number | null;
  openingTime: string;
  closingTime: string;
  requiresReservation: boolean;
  pricePerHour: number;
  isComplimentary: boolean;
  isActive: boolean;
  status: AmenityStatus;
  images: string[];
  rules: string[];
  ageRestriction?: number | null;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
export type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'carpentry' | 'painting' | 'cleaning' | 'landscaping' | 'appliance' | 'structural' | 'safety' | 'it' | 'general';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'pending_parts' | 'completed' | 'cancelled';
export type LocationType = 'room' | 'lobby' | 'pool' | 'gym' | 'restaurant' | 'parking' | 'exterior' | 'common_area' | 'office' | 'other';

export interface WorkOrderPart {
  id: string;
  workOrderId: string;
  partName: string;
  partNumber?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier?: string | null;
  notes?: string | null;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  locationId: string;
  locationType: LocationType;
  reportedBy: string;
  assignedTo: string | null;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  laborCost: number | null;
  partsCost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export type TaskCategory = 'maintenance' | 'cleaning' | 'repair' | 'inspection' | 'delivery' | 'setup' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  createdByName: string;
  location: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  completedAt: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string | null;
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────
export type WaitlistPriority = 'normal' | 'vip' | 'reservation';
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';

export interface WaitlistEntry {
  id: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  partySize: number;
  priority: WaitlistPriority;
  status: WaitlistStatus;
  estimatedWaitMinutes: number;
  notifiedAt: string | null;
  seatedAt: string | null;
  tableId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'windy' | 'snowy';
export type AlertType = 'warning' | 'watch' | 'advisory' | 'statement';
export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme';
export type ActivityCategory = 'outdoor' | 'indoor' | 'water' | 'sports' | 'relaxation' | 'cultural';
export type DifficultyLevel = 'easy' | 'moderate' | 'challenging';

export interface WeatherData {
  id: string;
  location: string;
  date: string;
  condition: WeatherCondition;
  temperatureHigh: number;
  temperatureLow: number;
  temperatureCurrent: number;
  humidity: number;
  windSpeed: number;
  windDirection: string | null;
  uvIndex: number | null;
  precipitation: number | null;
  visibility: number | null;
  sunrise: string | null;
  sunset: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WeatherAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface WeatherActivity {
  id: string;
  name: string;
  description: string;
  category: ActivityCategory;
  suitableConditions: WeatherCondition[];
  minTemperature: number | null;
  maxTemperature: number | null;
  maxWindSpeed: number | null;
  maxPrecipitation: number | null;
  duration: number | null;
  difficulty: DifficultyLevel | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────
export type FeedbackType = 'general' | 'service' | 'complaint' | 'suggestion' | 'compliment';
export type FeedbackStatus = 'pending' | 'reviewed' | 'responded' | 'resolved' | 'archived';
export type FeedbackSentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type QuestionType = 'text' | 'rating' | 'yesno' | 'choice';

export interface Feedback {
  id: string;
  guestName: string;
  guestEmail: string;
  guestId?: string | null;
  type: FeedbackType;
  subject: string;
  message: string;
  rating: number | null;
  status: FeedbackStatus;
  sentiment: FeedbackSentiment | null;
  department: string | null;
  assignedTo: string | null;
  response: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  question: string;
  type: QuestionType;
  options: string[] | null;
  required: boolean;
  order: number;
  createdAt: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  questionId: string;
  answer: string;
  ratingValue: number | null;
  createdAt: string;
}

// ─── Membership ───────────────────────────────────────────────────────────────
export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'cancelled';
export type MembershipPaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface MembershipPlan {
  id: string;
  name: string;
  tier: MembershipTier;
  description: string;
  price: number;
  currency: string;
  durationMonths: number;
  benefits: string[];
  discountPercentage: number;
  guestPasses: number;
  maxFamilyMembers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  familyMembers: string[];
  guestPassesRemaining: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface MembershipPayment {
  id: string;
  membershipId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string | null;
  paymentStatus: MembershipPaymentStatus;
  paidAt: string;
}

// ─── Event / Venue ────────────────────────────────────────────────────────────
export type VenueStatus = 'available' | 'booked' | 'maintenance' | 'closed';
export type EventType = 'wedding' | 'conference' | 'party' | 'gala' | 'meeting' | 'concert' | 'exhibition' | 'corporate' | 'social' | 'other';
export type EventStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

export interface Venue {
  id: string;
  name: string;
  description: string;
  capacity: number;
  indoorCapacity: number;
  outdoorCapacity: number;
  amenities: string[];
  hourlyRate: number;
  dailyRate: number;
  currency: string;
  status: VenueStatus;
  images: string[];
  location: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  venueId: string;
  organizerId: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  actualGuests: number | null;
  status: EventStatus;
  budget: number | null;
  actualCost: number | null;
  notes: string | null;
  requirements: string[];
  createdAt: string;
  updatedAt: string | null;
}

// ─── Package ──────────────────────────────────────────────────────────────────
export type PackageType = 'room_only' | 'bed_and_breakfast' | 'half_board' | 'full_board' | 'all_inclusive' | 'romantic' | 'family' | 'honeymoon' | 'adventure' | 'spa' | 'golf' | 'business';
export type PackageStatus = 'draft' | 'active' | 'inactive' | 'expired' | 'sold_out';

export interface Package {
  id: string;
  name: string;
  code: string;
  type: PackageType;
  description: string;
  includes: string[];
  basePrice: number;
  discountPercentage: number;
  finalPrice: number;
  currency: string;
  minNights: number | null;
  maxNights: number | null;
  maxRedemptions: number | null;
  currentRedemptions: number;
  validFrom: string;
  validTo: string;
  status: PackageStatus;
  eligibleRoomTypes: string[];
  blackoutDates: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface PackageRedemption {
  id: string;
  packageId: string;
  bookingId: string;
  guestId: string;
  nights: number | null;
  baseAmount: number;
  discountAmount: number;
  totalAmount: number;
  redeemedAt: string;
}

// ─── Container (DI) ──────────────────────────────────────────────────────────
export interface Container {
  logger?: Logger;
  invoiceRepository?: unknown;
  guestRepository?: unknown;
  amenityRepository?: unknown;
  maintenanceRepository?: unknown;
  taskRepository?: unknown;
  waitlistRepository?: unknown;
  weatherRepository?: unknown;
  feedbackRepository?: unknown;
  membershipRepository?: unknown;
  eventRepository?: unknown;
  packageRepository?: unknown;
  [key: string]: unknown;
}
