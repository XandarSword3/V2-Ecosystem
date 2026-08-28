/**
 * Shipment fulfillment adapter (plan Phase F1 — third vertical).
 *
 * Lifecycle:
 *   confirmed → allocated → picking → packed → shipped → in_transit → delivered → completed
 */

import type { StateMachineDefinition } from '../../engines/types.js';

export const SHIPMENT_FULFILLMENT_STATES = [
  'allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered',
] as const;

export type ShipmentFulfillmentStatus = (typeof SHIPMENT_FULFILLMENT_STATES)[number];

export type ShipmentFulfillmentMachineStatus =
  | 'confirmed'
  | ShipmentFulfillmentStatus
  | 'completed'
  | 'cancelled';

export const shipmentFulfillmentStateMachine: StateMachineDefinition<ShipmentFulfillmentMachineStatus> = {
  states: ['confirmed', 'allocated', 'picking', 'packed', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled'],
  initialState: 'allocated',
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    { from: 'confirmed', to: 'allocated', action: 'allocate', allowedActors: ['system'], guardDescription: 'Inventory allocated for shipment' },
    { from: 'allocated', to: 'picking', action: 'start_picking', allowedActors: ['staff'], guardDescription: 'Staff begins picking items' },
    { from: 'picking', to: 'packed', action: 'pack', allowedActors: ['staff'], guardDescription: 'Items packed for shipment' },
    { from: 'packed', to: 'shipped', action: 'ship', allowedActors: ['staff'], guardDescription: 'Package handed to carrier' },
    { from: 'shipped', to: 'in_transit', action: 'mark_in_transit', allowedActors: ['system'], guardDescription: 'Carrier confirms in transit' },
    { from: 'in_transit', to: 'delivered', action: 'deliver', allowedActors: ['system'], guardDescription: 'Carrier confirms delivery' },
    { from: 'delivered', to: 'completed', action: 'complete', allowedActors: ['system', 'staff'], guardDescription: 'Delivery acknowledged — transaction completes' },
    { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Cancel before allocation' },
    { from: 'allocated', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Cancel during allocation' },
    { from: 'picking', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin cancel during picking' },
    { from: 'packed', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin cancel after packing' },
  ],
};
