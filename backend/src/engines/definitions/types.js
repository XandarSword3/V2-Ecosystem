export const TEMPLATE_TO_ENGINE = {
    // ── Real engine type names (1:1) — new modules use these ──────────────────
    instant_transaction: 'instant_transaction',
    time_exclusive_reservation: 'time_exclusive_reservation',
    shared_capacity_access: 'shared_capacity_access',
    ongoing_entitlement: 'ongoing_entitlement',
    platform_entitlement: 'platform_entitlement',
    // ── Legacy alias names — kept for backwards compat with existing DB rows ──
    menu_service: 'instant_transaction',
    multi_day_booking: 'time_exclusive_reservation',
    session_access: 'shared_capacity_access',
    subscription: 'ongoing_entitlement',
    membership_access: 'ongoing_entitlement',
    class_scheduling: 'shared_capacity_access',
    appointment_booking: 'time_exclusive_reservation',
    saas_subscription: 'platform_entitlement',
};
export const ENGINE_TO_TEMPLATE = {
    instant_transaction: 'instant_transaction',
    time_exclusive_reservation: 'time_exclusive_reservation',
    shared_capacity_access: 'shared_capacity_access',
    ongoing_entitlement: 'ongoing_entitlement',
    platform_entitlement: 'platform_entitlement',
};
