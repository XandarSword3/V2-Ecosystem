/**
 * Phase 2 Verification Program — Shared State
 *
 * Stores IDs and tokens created during the admin setup sequence (Part 1)
 * and used throughout all subsequent journeys (Parts 2–5) within a single run.
 */

export interface Phase2State {
  // Auth tokens
  adminToken: string;
  kitchenStaffToken: string;
  capacityStaffToken: string;
  accommodationStaffToken: string;
  hkStaffToken: string;
  managerToken: string;
  aliceToken: string;
  bobToken: string;
  carolToken: string;

  // Module IDs
  menuServiceModuleId: string;
  accommodationModuleId: string;
  capacityModuleId: string;
  kioskModuleId: string;

  // MenuService category IDs
  appetizersCatId: string;
  mainsCatId: string;
  dessertsCatId: string;
  beveragesCatId: string;
  snacksCatId: string;

  // Menu item IDs
  bruschettaId: string;
  salmonId: string;
  cakeId: string;
  espressoId: string;
  wagyuId: string;
  clubSandwichId: string;
  freshJuiceId: string;

  // Modifier group IDs
  tempGroupId: string;
  sideGroupId: string;

  // Modifier option IDs
  rareOptionId: string;
  mediumRareOptionId: string;
  mediumOptionId: string;
  wellDoneOptionId: string;
  friesOptionId: string;
  saladOptionId: string;
  mashedOptionId: string;

  // Table IDs
  table1Id: string;
  table2Id: string;
  tableT1Id: string;

  // AccommodationUnit IDs
  unitAId: string; // Mountain View A
  unitBId: string; // Lakeside B
  unitCId: string; // Garden C

  // AccommodationUnit pricing rule IDs
  summerPeakRuleId: string;
  mountainPremiumRuleId: string;

  // AccommodationUnit add-on IDs
  bbqAddonId: string;
  basketAddonId: string;
  beddingAddonId: string;

  // Pool session IDs
  morningSessionId: string;
  afternoonSessionId: string;
  eveningSessionId: string;

  // Staff user IDs
  kitchenStaffId: string;
  poolStaffId: string;
  chaletStaffId: string;
  hkStaffId: string;
  managerId: string;

  // Customer user IDs
  aliceId: string;
  bobId: string;
  carolId: string;

  // Loyalty
  aliceLoyaltyId: string;

  // Coupon IDs
  welcome10Id: string;
  fixed5Id: string;
  poolOnlyId: string;
  expired1Id: string;

  // Gift card codes
  gcBobCode: string;
  gcAliceCode: string;
  gcBobId: string;
  gcAliceId: string;

  // Housekeeping task type IDs
  standardCleaningTypeId: string;
  deepCleanTypeId: string;

  // Created during journeys
  j01OrderId: string;
  j02OrderId: string;
  j03BookingId: string;
  j04TicketId: string;
  j05TicketId: string;
  j06BookingId: string;
  j08OrderId: string;
  j09BookingId: string;
  j12BookingId: string;
  j12TicketId: string;
  j12OrderId: string;
}

/**
 * Global shared state — populated by Part 1 setup, consumed by all journeys.
 * Partial because fields are populated incrementally.
 */
export const state: Partial<Phase2State> = {};

/**
 * Compatibility no-op.
 * State is intentionally in-memory only to avoid cross-test file coupling.
 */
export function saveState(): void {
  return;
}

/**
 * Compatibility no-op.
 * All phase2 suites now share state through the same test process.
 */
export function loadState(): void {
  return;
}

/**
 * Clear all in-memory state fields.
 */
export function resetPhase2State(): void {
  for (const key of Object.keys(state)) {
    delete (state as Record<string, unknown>)[key];
  }
}

/**
 * Assert that a state field is set, returning it with proper type.
 */
export function requireState<K extends keyof Phase2State>(key: K): Phase2State[K] {
  const value = state[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Phase2 state.${key} is not set in this run.`);
  }
  return value as Phase2State[K];
}
