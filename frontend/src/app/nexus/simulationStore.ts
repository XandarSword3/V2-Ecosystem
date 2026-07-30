import { create } from 'zustand';

export type ComplexityMode = 'visitor' | 'founder' | 'engineer' | 'investor';
export type ActiveScene = 'boot' | 'galaxy' | 'engines' | 'security' | 'atlas';
export type ScenarioType = 'idle' | 'friday_night' | 'beach_club';
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface LogEntry {
  timestamp: string;
  source: 'middleware' | 'engine' | 'security' | 'db' | 'realtime' | 'system';
  message: string;
}

export interface DbRow {
  id: string;
  table: string;
  tenant_id: string;
  property_id: string;
  data: Record<string, any>;
  timestamp: string;
}

export interface POSItem {
  id: string;
  name: string;
  price: number;
  icon: string;
}

export interface KDSTicket {
  id: string;
  items: POSItem[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  type: string;
  timestamp: string;
}

export interface BookingBlock {
  id: string;
  unit: string;
  startDay: number; // 0 to 6 (Mon to Sun)
  duration: number; // number of slots
  status: 'booked' | 'dirty' | 'cleaning' | 'clean';
}

export interface GuestBubble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'guest' | 'member' | 'intruder';
  size: number;
}

export interface TenantPlanet {
  id: string;
  name: string;
  mrr: number;
  status: BillingStatus;
  color: string;
  coords: { x: number; y: number };
}

interface SimulationState {
  activeMode: ComplexityMode;
  activeScene: ActiveScene;
  activeScenario: ScenarioType;
  billingStatus: BillingStatus;
  timelineStep: number;
  maxSteps: number;
  isPlaying: boolean;
  logs: LogEntry[];
  dbRows: DbRow[];

  // Engine A (POS / Instant Order)
  engineA: {
    cart: POSItem[];
    kdsTickets: KDSTicket[];
    inventoryLevel: number;
    kitchenLoad: number;
    isRushHour: boolean;
  };

  // Engine B (Booking Calendar)
  engineB: {
    bookings: BookingBlock[];
    selectedUnit: string;
    revenueForecast: number;
    occupancyRate: number;
    collisionMessage: string | null;
  };

  // Engine C (Capacity Pool)
  engineC: {
    guestBubbles: GuestBubble[];
    capacityLimit: number;
    qrState: 'idle' | 'success' | 'failed';
    braceletColor: string;
    waterLevel: number; // 0 to 100
  };

  // Engine D (VIP Billing Card)
  engineD: {
    tier: string;
    isFlipped: boolean;
    billingCycleProgress: number;
    isGracePeriod: boolean;
    graceSecondsLeft: number;
    membershipStatus: 'active' | 'dunning' | 'expired' | 'shattered';
    cardHealth: number; // 0 to 100
  };

  // Engine E (SaaS Platform Solar System)
  engineE: {
    tenantsList: TenantPlanet[];
    provisioningStep: string;
    mrrTotal: number;
  };

  // Security Thriller
  hackerAlert: {
    status: 'idle' | 'hacking' | 'blocked' | 'system_locked';
    currentGate: number;
    log: string;
  };

  // Actions
  setMode: (mode: ComplexityMode) => void;
  setScene: (scene: ActiveScene) => void;
  setScenario: (scenario: ScenarioType) => void;
  setBillingStatus: (status: BillingStatus) => void;
  
  addLog: (source: LogEntry['source'], message: string) => void;
  addDbRow: (row: Omit<DbRow, 'id' | 'timestamp'>) => void;
  clearDbRows: () => void;
  
  // Controls
  playSimulation: () => void;
  pauseSimulation: () => void;
  stepForward: () => void;
  resetAll: () => void;

  // Engine A Triggers
  addCartItem: (item: POSItem) => void;
  removeCartItem: (id: string) => void;
  checkoutPOS: (type: string) => void;
  advanceKDSTicket: (id: string) => void;
  triggerRushHour: () => void;
  
  // Engine B Triggers
  updateBookingBlock: (id: string, startDay: number) => void;
  triggerHousekeeping: (id: string) => void;

  // Engine C Triggers
  scanTicketBubble: (type: 'guest' | 'member' | 'intruder') => void;
  clearPool: () => void;
  
  // Engine D Triggers
  toggleCardFlip: () => void;
  advanceBillingCycle: () => void;
  triggerGracePeriod: () => void;
  healCard: () => void;
  shatterVIPCard: () => void;
  
  // Engine E Triggers
  igniteTenant: (name: string) => void;
  setTenantBillingStatus: (tenantId: string, status: BillingStatus) => void;

  // Security Actions
  triggerHackerAttack: () => void;
  resetHacker: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => {
  const getTimestamp = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const initialTenants: TenantPlanet[] = [
    { id: '1', name: 'abccorp.v2platform.com', mrr: 450, status: 'active', color: '#00E5FF', coords: { x: 90, y: 0 } },
    { id: '2', name: 'beachclub.v2platform.com', mrr: 890, status: 'active', color: '#10B981', coords: { x: 180, y: 0 } },
    { id: '3', name: 'spasensation.v2platform.com', mrr: 290, status: 'trialing', color: '#8B5CF6', coords: { x: -110, y: 0 } },
    { id: '4', name: 'grandresort.v2platform.com', mrr: 2500, status: 'past_due', color: '#F59E0B', coords: { x: 230, y: 0 } },
  ];

  const initialBookings: BookingBlock[] = [
    { id: 'b1', unit: 'Ocean Villa 101', startDay: 0, duration: 3, status: 'booked' },
    { id: 'b2', unit: 'Ocean Villa 101', startDay: 4, duration: 2, status: 'dirty' },
    { id: 'b3', unit: 'Beach Cabana A', startDay: 1, duration: 4, status: 'booked' },
  ];

  return {
    activeMode: 'visitor',
    activeScene: 'boot',
    activeScenario: 'idle',
    billingStatus: 'active',
    timelineStep: 0,
    maxSteps: 8,
    isPlaying: false,
    logs: [
      { timestamp: getTimestamp(), source: 'system', message: 'V2 Ecosystem Core Engine Initialized.' },
      { timestamp: getTimestamp(), source: 'db', message: 'Centralized Transactions table listening.' }
    ],
    dbRows: [],

    // Engine A State
    engineA: {
      cart: [],
      kdsTickets: [],
      inventoryLevel: 100,
      kitchenLoad: 20,
      isRushHour: false,
    },

    // Engine B State
    engineB: {
      bookings: initialBookings,
      selectedUnit: 'Ocean Villa 101',
      revenueForecast: 1350,
      occupancyRate: 71,
      collisionMessage: null,
    },

    // Engine C State
    engineC: {
      guestBubbles: [],
      capacityLimit: 30,
      qrState: 'idle',
      braceletColor: 'none',
      waterLevel: 30,
    },

    // Engine D State
    engineD: {
      tier: 'platinum',
      isFlipped: false,
      billingCycleProgress: 45,
      isGracePeriod: false,
      graceSecondsLeft: 0,
      membershipStatus: 'active',
      cardHealth: 100,
    },

    // Engine E State
    engineE: {
      tenantsList: initialTenants,
      provisioningStep: 'Fleet Idle',
      mrrTotal: 4130,
    },

    // Security State
    hackerAlert: {
      status: 'idle',
      currentGate: 0,
      log: 'Security systems reporting green.',
    },

    // Global actions
    setMode: (activeMode) => {
      set({ activeMode });
      get().addLog('system', `Presentation mode switched to: ${activeMode.toUpperCase()}`);
    },
    setScene: (activeScene) => {
      set({ activeScene });
      get().addLog('system', `Camera navigated to scene: ${activeScene.toUpperCase()}`);
    },
    setScenario: (activeScenario) => {
      set({ activeScenario });
      get().addLog('system', `Scenario changed: ${activeScenario.toUpperCase()}`);
      if (activeScenario === 'friday_night') {
        get().triggerRushHour();
      }
    },
    setBillingStatus: (billingStatus) => {
      set({ billingStatus });
      get().addLog('system', `Global operational status updated: ${billingStatus.toUpperCase()}`);
    },
    addLog: (source, message) => {
      set((state) => ({
        logs: [...state.logs.slice(-49), { timestamp: getTimestamp(), source, message }]
      }));
    },
    addDbRow: (row) => {
      set((state) => ({
        dbRows: [
          ...state.dbRows,
          {
            id: 'row_' + Math.random().toString(36).substr(2, 9),
            ...row,
            timestamp: new Date().toISOString()
          }
        ]
      }));
    },
    clearDbRows: () => set({ dbRows: [] }),

    // Controls
    playSimulation: () => set({ isPlaying: true }),
    pauseSimulation: () => set({ isPlaying: false }),
    stepForward: () => {
      set((state) => {
        const nextStep = (state.timelineStep + 1) % state.maxSteps;
        return { timelineStep: nextStep };
      });
      const step = get().timelineStep;
      get().addLog('system', `Timeline advanced to tick ${step}. Checkpoints evaluated.`);
    },
    resetAll: () => {
      set({
        timelineStep: 0,
        billingStatus: 'active',
        activeScenario: 'idle',
        engineA: {
          cart: [],
          kdsTickets: [],
          inventoryLevel: 100,
          kitchenLoad: 20,
          isRushHour: false,
        },
        engineB: {
          bookings: initialBookings,
          selectedUnit: 'Ocean Villa 101',
          revenueForecast: 1350,
          occupancyRate: 71,
          collisionMessage: null,
        },
        engineC: {
          guestBubbles: [],
          capacityLimit: 30,
          qrState: 'idle',
          braceletColor: 'none',
          waterLevel: 30,
        },
        engineD: {
          tier: 'platinum',
          isFlipped: false,
          billingCycleProgress: 45,
          isGracePeriod: false,
          graceSecondsLeft: 0,
          membershipStatus: 'active',
          cardHealth: 100,
        },
        engineE: {
          tenantsList: initialTenants,
          provisioningStep: 'Fleet Idle',
          mrrTotal: 4130,
        },
        hackerAlert: {
          status: 'idle',
          currentGate: 0,
          log: 'Security systems reporting green.',
        }
      });
      get().addLog('system', 'Ecosystem simulation state reset completely.');
    },

    // Engine A triggers
    addCartItem: (item) => {
      set((state) => ({
        engineA: {
          ...state.engineA,
          cart: [...state.engineA.cart, item]
        }
      }));
      get().addLog('engine', `POS: Added item "${item.name}" to cart ($${item.price}).`);
    },
    removeCartItem: (id) => {
      set((state) => ({
        engineA: {
          ...state.engineA,
          cart: state.engineA.cart.filter(item => item.id !== id)
        }
      }));
    },
    checkoutPOS: (type) => {
      const { cart, kdsTickets, inventoryLevel } = get().engineA;
      if (cart.length === 0) return;

      const newTicket: KDSTicket = {
        id: 'T-' + Math.floor(Math.random() * 900 + 100),
        items: [...cart],
        status: 'pending',
        type,
        timestamp: getTimestamp(),
      };

      set((state) => ({
        engineA: {
          ...state.engineA,
          cart: [],
          kdsTickets: [...state.engineA.kdsTickets, newTicket],
          inventoryLevel: Math.max(0, inventoryLevel - cart.length),
          kitchenLoad: Math.min(100, state.engineA.kitchenLoad + 15)
        }
      }));

      get().addLog('engine', `Engine A checkout: Dispatched Ticket #${newTicket.id} to Kitchen.`);
      get().addDbRow({
        table: 'transactions',
        tenant_id: 'abccorp-923f',
        property_id: 'beach-bar',
        data: { ticket_id: newTicket.id, amount: cart.reduce((s, i) => s + i.price, 0), type }
      });
    },
    advanceKDSTicket: (id) => {
      const steps: KDSTicket['status'][] = ['pending', 'preparing', 'ready', 'delivered', 'completed'];
      set((state) => ({
        engineA: {
          ...state.engineA,
          kdsTickets: state.engineA.kdsTickets.map((t) => {
            if (t.id !== id) return t;
            const curIdx = steps.indexOf(t.status);
            const nextStatus = curIdx < steps.length - 1 ? steps[curIdx + 1] : 'completed';
            return { ...t, status: nextStatus };
          })
        }
      }));
      const updated = get().engineA.kdsTickets.find(t => t.id === id);
      if (updated) {
        get().addLog('engine', `KDS Ticket #${id} moved to status: ${updated.status.toUpperCase()}`);
        if (updated.status === 'completed') {
          set((state) => ({
            engineA: {
              ...state.engineA,
              kitchenLoad: Math.max(10, state.engineA.kitchenLoad - 15)
            }
          }));
        }
      }
    },
    triggerRushHour: () => {
      set((state) => ({
        engineA: {
          ...state.engineA,
          isRushHour: true,
          kitchenLoad: 95
        }
      }));
      get().addLog('engine', 'ALERT: Rush Hour scenario triggered. Parallel orders flooding KDS buffer.');
      
      // Spawn some random tickets
      const itemsMock: POSItem[] = [
        { id: '1', name: 'Infinity IPA', price: 9, icon: '🍺' },
        { id: '2', name: 'Beach Burger', price: 18, icon: '🍔' }
      ];
      
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const randTicket: KDSTicket = {
            id: 'T-R' + Math.floor(Math.random() * 900 + 100),
            items: [itemsMock[Math.floor(Math.random() * 2)]],
            status: 'pending',
            type: 'takeaway',
            timestamp: getTimestamp(),
          };
          set((state) => ({
            engineA: {
              ...state.engineA,
              kdsTickets: [...state.engineA.kdsTickets, randTicket]
            }
          }));
        }, i * 300);
      }
    },

    // Engine B triggers
    updateBookingBlock: (id, startDay) => {
      const { bookings } = get().engineB;
      const target = bookings.find(b => b.id === id);
      if (!target) return;

      // Check collision with other bookings of the same unit
      const isCollision = bookings.some((b) => {
        if (b.id === id || b.unit !== target.unit) return false;
        // Overlap check
        const a1 = startDay;
        const a2 = startDay + target.duration;
        const b1 = b.startDay;
        const b2 = b.startDay + b.duration;
        return (a1 < b2 && a2 > b1);
      });

      if (isCollision) {
        set((state) => ({
          engineB: {
            ...state.engineB,
            collisionMessage: `Blocked: Unique Calendar index prevented double booking on ${target.unit}`
          }
        }));
        get().addLog('security', `Transaction collision intercepted: Double booking blocked on ${target.unit}`);
        setTimeout(() => {
          set((state) => ({ engineB: { ...state.engineB, collisionMessage: null } }));
        }, 3000);
      } else {
        set((state) => ({
          engineB: {
            ...state.engineB,
            bookings: state.engineB.bookings.map(b => b.id === id ? { ...b, startDay } : b),
            revenueForecast: state.engineB.revenueForecast + 150
          }
        }));
        get().addLog('engine', `Engine B: Relocated Booking block ${id} to Mon-Sun Day index ${startDay}.`);
      }
    },
    triggerHousekeeping: (id) => {
      set((state) => ({
        engineB: {
          ...state.engineB,
          bookings: state.engineB.bookings.map((b) => {
            if (b.id !== id) return b;
            const nextStatus = b.status === 'dirty' ? 'cleaning' : b.status === 'cleaning' ? 'clean' : 'dirty';
            return { ...b, status: nextStatus };
          })
        }
      }));
      const block = get().engineB.bookings.find(b => b.id === id);
      if (block) {
        get().addLog('engine', `Unit ${block.unit} status changed to: ${block.status.toUpperCase()}`);
        if (block.status === 'cleaning') {
          setTimeout(() => {
            set((state) => ({
              engineB: {
                ...state.engineB,
                bookings: state.engineB.bookings.map(b => b.id === id ? { ...b, status: 'clean' } : b)
              }
            }));
            get().addLog('engine', `Housekeeping completed on ${block.unit}. Rooms set to CLEAN.`);
          }, 3000);
        }
      }
    },

    // Engine C triggers
    scanTicketBubble: (type) => {
      const isSuccess = type !== 'intruder' && get().engineC.guestBubbles.length < get().engineC.capacityLimit;
      set((state) => ({
        engineC: {
          ...state.engineC,
          qrState: isSuccess ? 'success' : 'failed',
          braceletColor: isSuccess ? (type === 'member' ? 'purple' : 'green') : 'red',
        }
      }));

      if (isSuccess) {
        const newBubble: GuestBubble = {
          id: Math.random(),
          x: 100 + Math.random() * 80,
          y: 50 + Math.random() * 60,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          type,
          size: type === 'member' ? 12 : 9
        };

        set((state) => ({
          engineC: {
            ...state.engineC,
            guestBubbles: [...state.engineC.guestBubbles, newBubble],
            waterLevel: Math.min(100, state.engineC.waterLevel + 4)
          }
        }));

        get().addLog('engine', `Engine C checkin: Scanner validated ${type.toUpperCase()} bracelet.`);
        get().addDbRow({
          table: 'loyalty_members',
          tenant_id: 'abccorp-923f',
          property_id: 'beach-bar',
          data: { guest_type: type, status: 'present' }
        });
      } else {
        get().addLog('security', `SECURITY ALARM: Bracelet scan failure. Access revoked for type: ${type.toUpperCase()}`);
      }

      setTimeout(() => {
        set((state) => ({ engineC: { ...state.engineC, qrState: 'idle' } }));
      }, 2500);
    },
    clearPool: () => {
      set((state) => ({
        engineC: {
          ...state.engineC,
          guestBubbles: [],
          waterLevel: 20
        }
      }));
      get().addLog('engine', 'Capacity pool flushed. Guest counters reset.');
    },

    // Engine D triggers
    toggleCardFlip: () => {
      set((state) => ({
        engineD: { ...state.engineD, isFlipped: !state.engineD.isFlipped }
      }));
    },
    advanceBillingCycle: () => {
      set((state) => {
        const nextProgress = (state.engineD.billingCycleProgress + 25) % 100;
        return {
          engineD: {
            ...state.engineD,
            billingCycleProgress: nextProgress,
          }
        };
      });
      get().addLog('engine', `Stripe Subscription cycle updated: ${get().engineD.billingCycleProgress}% complete.`);
    },
    triggerGracePeriod: () => {
      set((state) => ({
        engineD: {
          ...state.engineD,
          isGracePeriod: true,
          graceSecondsLeft: 10,
          membershipStatus: 'dunning',
          cardHealth: 60
        }
      }));
      get().addLog('security', 'STRIPE ALARM: dunning.attempt_1 failed. Entering 10-second grace window.');

      const interval = setInterval(() => {
        set((state) => {
          const nextSecs = state.engineD.graceSecondsLeft - 1;
          if (nextSecs <= 0) {
            clearInterval(interval);
            get().shatterVIPCard();
            return {
              engineD: {
                ...state.engineD,
                isGracePeriod: false,
                graceSecondsLeft: 0,
                membershipStatus: 'shattered',
                cardHealth: 0
              }
            };
          }
          return {
            engineD: {
              ...state.engineD,
              graceSecondsLeft: nextSecs,
              cardHealth: Math.max(10, state.engineD.cardHealth - 6)
            }
          };
        });
      }, 1000);
    },
    healCard: () => {
      set((state) => ({
        engineD: {
          ...state.engineD,
          cardHealth: 100,
          membershipStatus: 'active',
          isGracePeriod: false
        }
      }));
      get().addLog('engine', 'VIP card billing issues cleared. Stripe payment received.');
    },
    shatterVIPCard: () => {
      set((state) => ({
        engineD: {
          ...state.engineD,
          membershipStatus: 'shattered',
          cardHealth: 0,
          isGracePeriod: false
        }
      }));
      get().addLog('security', 'VIP CARD EXPIRED. Stripe subscription cancelled. Card shattered.');
    },

    // Engine E triggers
    igniteTenant: (name) => {
      const { tenantsList } = get().engineE;
      const formatted = name.toLowerCase() + '.v2platform.com';
      if (tenantsList.some(t => t.name === formatted)) return;

      const newTenant: TenantPlanet = {
        id: String(tenantsList.length + 1),
        name: formatted,
        mrr: 450,
        status: 'active',
        color: ['#00E5FF', '#10B981', '#8B5CF6', '#F59E0B'][tenantsList.length % 4],
        coords: { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 80 }
      };

      set((state) => ({
        engineE: {
          ...state.engineE,
          tenantsList: [...state.engineE.tenantsList, newTenant],
          mrrTotal: state.engineE.mrrTotal + 450,
          provisioningStep: `Provisioned db_cluster for ${name}`
        }
      }));

      get().addLog('system', `Engine E: Provisioned sandbox stack for ${formatted}. Default schemas seeded.`);
    },
    setTenantBillingStatus: (tenantId, status) => {
      set((state) => ({
        engineE: {
          ...state.engineE,
          tenantsList: state.engineE.tenantsList.map(t => t.id === tenantId ? { ...t, status } : t)
        }
      }));

      const target = get().engineE.tenantsList.find(t => t.id === tenantId);
      if (target) {
        get().addLog('system', `Tenant ${target.name} subscription status: ${status.toUpperCase()}`);
        if (status === 'suspended') {
          get().addLog('security', `Tenant ${target.name} frozen red. Write logs restricted.`);
        }
      }
    },

    // Security triggers
    triggerHackerAttack: () => {
      set({
        hackerAlert: { status: 'hacking', currentGate: 1, log: 'Hacker payload: POST /api/admin/tenants/delete' }
      });
      get().addLog('security', 'WARNING: Intruder payload detected. Initializing firewall checks.');

      const runGates = () => {
        setTimeout(() => {
          set((state) => {
            const nextGate = state.hackerAlert.currentGate + 1;
            
            if (nextGate === 6) {
              return {
                hackerAlert: {
                  status: 'blocked',
                  currentGate: 6,
                  log: 'FIREWALL DETECTED MALICIOUS ACTION. BLOCKED AT GATE 6 (ROW LEVEL SECURITY).'
                }
              };
            }
            
            return {
              hackerAlert: {
                ...state.hackerAlert,
                currentGate: nextGate,
                log: `Traversing Gate ${nextGate}/12: Checking signatures...`
              }
            };
          });

          const current = get().hackerAlert;
          if (current.status === 'blocked') {
            get().addLog('security', 'FIREWALL BLOCK: Intruder packet lacks tenant_id header. Packet vaporized.');
            get().addLog('db', 'Audit record logged to security_audit_log.');
          } else {
            get().addLog('security', `Firewall check passed Gate ${current.currentGate}: signature validated.`);
            runGates();
          }
        }, 1200);
      };

      runGates();
    },
    resetHacker: () => {
      set({
        hackerAlert: { status: 'idle', currentGate: 0, log: 'Security systems reporting green.' }
      });
      get().addLog('security', 'Security systems cleared. Firewall back to monitoring mode.');
    }
  };
});
