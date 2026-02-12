import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing
vi.mock('../../../src/config/database', () => ({
  prisma: {
    restaurantTable: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'table-1' }),
      update: vi.fn().mockResolvedValue({ id: 'table-1' }),
    },
    restaurantReservation: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'res-1' }),
      update: vi.fn().mockResolvedValue({ id: 'res-1' }),
    },
  },
}));

// Mock supabase
vi.mock('../../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/activityLogger', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  TableStatus,
  ReservationStatus,
} from '../../../src/services/restaurant-table.service';

describe('RestaurantTableService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TableStatus enum', () => {
    it('should have available status', () => {
      expect(TableStatus.AVAILABLE).toBeDefined();
    });

    it('should have occupied status', () => {
      expect(TableStatus.OCCUPIED).toBeDefined();
    });

    it('should have reserved status', () => {
      expect(TableStatus.RESERVED).toBeDefined();
    });

    it('should have cleaning status', () => {
      expect(TableStatus.CLEANING).toBeDefined();
    });

    it('should have out of service status', () => {
      expect(TableStatus.OUT_OF_SERVICE).toBeDefined();
    });
  });

  describe('ReservationStatus enum', () => {
    it('should have pending status', () => {
      expect(ReservationStatus.PENDING).toBeDefined();
    });

    it('should have confirmed status', () => {
      expect(ReservationStatus.CONFIRMED).toBeDefined();
    });

    it('should have seated status', () => {
      expect(ReservationStatus.SEATED).toBeDefined();
    });

    it('should have completed status', () => {
      expect(ReservationStatus.COMPLETED).toBeDefined();
    });

    it('should have cancelled status', () => {
      expect(ReservationStatus.CANCELLED).toBeDefined();
    });

    it('should have no_show status', () => {
      expect(ReservationStatus.NO_SHOW).toBeDefined();
    });
  });
});
