/**
 * Service execution fulfillment adapter (plan Phase F1 — fourth vertical).
 *
 * Lifecycle:
 *   confirmed → received → working → ready → collected → completed
 */

import type { StateMachineDefinition } from '../../engines/types.js';

export const SERVICE_FULFILLMENT_STATES = [
  'received', 'working', 'ready', 'collected',
] as const;

export type ServiceFulfillmentStatus = (typeof SERVICE_FULFILLMENT_STATES)[number];

export type ServiceFulfillmentMachineStatus =
  | 'confirmed'
  | ServiceFulfillmentStatus
  | 'completed'
  | 'cancelled';

export const serviceFulfillmentStateMachine: StateMachineDefinition<ServiceFulfillmentMachineStatus> = {
  states: ['confirmed', 'received', 'working', 'ready', 'collected', 'completed', 'cancelled'],
  initialState: 'received',
  terminalStates: ['completed', 'cancelled'],
  transitions: [
    { from: 'confirmed', to: 'received', action: 'receive', allowedActors: ['system', 'staff', 'admin'], guardDescription: 'Service request received' },
    { from: 'received', to: 'working', action: 'start_work', allowedActors: ['staff'], guardDescription: 'Staff begins service work' },
    { from: 'working', to: 'ready', action: 'finish_work', allowedActors: ['staff'], guardDescription: 'Service work completed' },
    { from: 'ready', to: 'collected', action: 'collect', allowedActors: ['customer', 'staff'], guardDescription: 'Customer collects or staff hands off' },
    { from: 'collected', to: 'completed', action: 'complete', allowedActors: ['system', 'staff'], guardDescription: 'Collection acknowledged — transaction completes' },
    { from: 'confirmed', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Cancel before work begins' },
    { from: 'received', to: 'cancelled', action: 'cancel', allowedActors: ['staff', 'admin'], guardDescription: 'Cancel after receipt' },
    { from: 'working', to: 'cancelled', action: 'cancel', allowedActors: ['admin'], guardDescription: 'Admin cancel during work' },
  ],
};
