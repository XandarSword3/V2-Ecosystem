"use strict";
// ============================================
// Engine Type System - First Principles
// ============================================
//
// The V2 Resort platform reduces ALL hospitality commerce
// to four economic patterns (engines):
//
//   A. Instant Transaction   — Order → Prepare → Deliver → Done
//   B. Time-Exclusive Reservation — Reserve → Confirm → Check-In → Occupy → Check-Out
//   C. Shared Capacity Access — Purchase → Validate → Enter → Exit
//   D. Ongoing Entitlement   — Subscribe → Activate → Use → Renew/Cancel
//
// Every "module" is a configuration instance of one of these engines.
// The engine defines:  state machine + pricing pipeline + interaction contracts.
// The module configures: names, prices, UI, categories, available add-ons.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGINE_TO_TEMPLATE = exports.TEMPLATE_TO_ENGINE = void 0;
/** Database template_type → engine type mapping */
exports.TEMPLATE_TO_ENGINE = {
    menu_service: 'instant_transaction',
    multi_day_booking: 'time_exclusive_reservation',
    session_access: 'shared_capacity_access',
    subscription: 'ongoing_entitlement',
};
exports.ENGINE_TO_TEMPLATE = {
    instant_transaction: 'menu_service',
    time_exclusive_reservation: 'multi_day_booking',
    shared_capacity_access: 'session_access',
    ongoing_entitlement: 'subscription',
};
//# sourceMappingURL=engines.js.map