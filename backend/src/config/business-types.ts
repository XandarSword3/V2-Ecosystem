// File: backend/src/config/business-types.ts
// White-label engine type defaults.
// Keyed by canonical ModuleTemplateType — the four customer-facing commerce
// engines plus platform_entitlement: the platform operator's own control
// plane (plans/tenants/billing), which lives in the registry for type
// exhaustiveness but is never customer-facing (see
// security/template-permission-presets.ts where its `order` preset is false).
// No hardcoded business-type names (resort, hotel, etc.) — those are operator-defined.
// Operators configure their own module names and terminology through the UI.

import type { ModuleTemplateType } from '../security/template-permission-presets.js';

export interface EngineTypeConfig {
    id: ModuleTemplateType;
    description: string;
    terminologyOverrides: Record<string, string>;
}

export const ENGINE_TYPE_DEFAULTS: Record<ModuleTemplateType, EngineTypeConfig> = {
    instant_transaction: {
        id: 'instant_transaction',
        description: 'Immediate point-of-sale transactions — items ordered and fulfilled on the spot.',
        terminologyOverrides: {
            item_singular:  'Item',
            item_plural:    'Items',
            order_singular: 'Order',
            order_plural:   'Orders',
        },
    },
    shared_capacity_access: {
        id: 'shared_capacity_access',
        description: 'Shared-capacity access sold by the session — guests book a slot in a limited pool of spaces.',
        terminologyOverrides: {
            unit_singular:    'Session',
            unit_plural:      'Sessions',
            booking_singular: 'Booking',
            booking_plural:   'Bookings',
        },
    },
    time_exclusive_reservation: {
        id: 'time_exclusive_reservation',
        description: 'Exclusive-use units reserved for a defined time window — one guest per unit at a time.',
        terminologyOverrides: {
            unit_singular:    'Unit',
            unit_plural:      'Units',
            booking_singular: 'Reservation',
            booking_plural:   'Reservations',
        },
    },
    ongoing_entitlement: {
        id: 'ongoing_entitlement',
        description: 'Recurring access granted through a membership or subscription.',
        terminologyOverrides: {
            unit_singular:   'Membership',
            unit_plural:     'Memberships',
            action_singular: 'Subscription',
            action_plural:   'Subscriptions',
        },
    },
    platform_entitlement: {
        id: 'platform_entitlement',
        description: 'Platform operator control plane — subscription plans, tenant lifecycle and SaaS billing. Operator-only; never customer-facing.',
        terminologyOverrides: {
            unit_singular:   'Plan',
            unit_plural:     'Plans',
            action_singular: 'Subscription',
            action_plural:   'Subscriptions',
        },
    },
};
