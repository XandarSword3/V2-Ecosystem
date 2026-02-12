import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================
// MOCK SETUP
// =============================================

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// Test data
const mockDeviceRow = {
  id: 'kiosk-1',
  property_id: 'prop-1',
  device_name: 'Lobby Kiosk 1',
  device_code: 'K001',
  location: 'Main Lobby',
  device_type: 'standard',
  has_id_scanner: true,
  has_card_reader: true,
  has_key_encoder: true,
  has_receipt_printer: true,
  has_signature_pad: false,
  has_camera: true,
  has_cash_acceptor: false,
  has_card_dispenser: false,
  status: 'online',
  config: { brightness: 80 },
  is_active: true
};

const mockSessionRow = {
  id: 'session-1',
  kiosk_id: 'kiosk-1',
  property_id: 'prop-1',
  session_type: 'checkin',
  booking_id: 'booking-1',
  guest_id: 'guest-1',
  status: 'in_progress',
  current_step: 'id_verification',
  steps_completed: ['welcome', 'booking_found'],
  input_data: { guestName: 'John Doe' }
};

const mockKeyStock = {
  kiosk_id: 'kiosk-1',
  current_stock: 50,
  minimum_stock: 20,
  maximum_stock: 200
};

const mockTransaction = {
  id: 'txn-1',
  session_id: 'session-1',
  kiosk_id: 'kiosk-1',
  transaction_type: 'payment',
  status: 'completed'
};

const mockHardwareEvent = {
  id: 'event-1',
  kiosk_id: 'kiosk-1',
  event_type: 'key_stock_low',
  severity: 'warning',
  component: 'key_encoder',
  resolved: false,
  details: {},
  kiosk_devices: { device_name: 'Lobby Kiosk 1', device_code: 'K001' }
};

const mockScreenFlow = {
  id: 'flow-1',
  property_id: 'prop-1',
  flow_type: 'checkin',
  name: 'Standard Check-In',
  steps: [{ key: 'welcome' }, { key: 'id_scan' }],
  timeout_seconds: 120,
  enable_help_button: true,
  enable_cancel_button: true,
  enable_language_selector: true,
  default_language: 'en',
  available_languages: ['en', 'es', 'fr'],
  is_active: true
};

const mockScreenContent = {
  flow_id: 'flow-1',
  step_key: 'welcome',
  language: 'en',
  title: 'Welcome',
  subtitle: 'Touch to begin',
  instructions: 'Please touch the screen to start',
  button_labels: { continue: 'Continue', cancel: 'Cancel' },
  image_url: '/images/welcome.png',
  video_url: null,
  animation_type: 'fade'
};

const mockBooking = {
  id: 'booking-1',
  confirmation_number: 'CONF123',
  guest_id: 'guest-1',
  status: 'confirmed',
  check_in_date: '2026-02-07',
  check_out_date: '2026-02-10',
  guests: { first_name: 'John', last_name: 'Doe' },
  rooms: { room_number: '101' },
  properties: { name: 'Test Resort' }
};

const mockAnalyticsRow = {
  date: '2026-02-07',
  property_id: 'prop-1',
  kiosk_id: 'kiosk-1',
  total_sessions: 25,
  completed_sessions: 20,
  abandoned_sessions: 5,
  checkins_completed: 15,
  checkouts_completed: 5,
  avg_session_duration_seconds: 180,
  kiosk_devices: { device_name: 'Lobby Kiosk 1', device_code: 'K001' }
};

let currentMockData: Record<string, unknown[]> = {};

const mockFrom = vi.fn().mockImplementation((table: string) => {
  return createQueryMock(() => currentMockData[table] || []);
});

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: () => ({
    from: mockFrom
  })
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234'
}));

import { kioskService } from '../../../../src/modules/kiosk/kiosk.service';

describe('KioskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockData = {};
  });

  // =============================================
  // INSTANCE TESTS
  // =============================================

  describe('kioskService instance', () => {
    it('should be defined', () => {
      expect(kioskService).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof kioskService).toBe('object');
    });

    it('should have all device management methods', () => {
      expect(typeof kioskService.registerDevice).toBe('function');
      expect(typeof kioskService.getDevice).toBe('function');
      expect(typeof kioskService.getDeviceByCode).toBe('function');
      expect(typeof kioskService.getPropertyDevices).toBe('function');
      expect(typeof kioskService.updateDeviceStatus).toBe('function');
      expect(typeof kioskService.updateDeviceConfig).toBe('function');
      expect(typeof kioskService.setDeviceMaintenanceMode).toBe('function');
      expect(typeof kioskService.deactivateDevice).toBe('function');
    });

    it('should have all session management methods', () => {
      expect(typeof kioskService.startSession).toBe('function');
      expect(typeof kioskService.getSession).toBe('function');
      expect(typeof kioskService.updateSessionStep).toBe('function');
      expect(typeof kioskService.completeSession).toBe('function');
      expect(typeof kioskService.abandonSession).toBe('function');
      expect(typeof kioskService.timeoutSession).toBe('function');
      expect(typeof kioskService.transferToDesk).toBe('function');
      expect(typeof kioskService.processTimeouts).toBe('function');
    });

    it('should have all transaction methods', () => {
      expect(typeof kioskService.createTransaction).toBe('function');
      expect(typeof kioskService.updateTransaction).toBe('function');
    });

    it('should have all operation methods', () => {
      expect(typeof kioskService.scanId).toBe('function');
      expect(typeof kioskService.encodeKey).toBe('function');
      expect(typeof kioskService.processPayment).toBe('function');
      expect(typeof kioskService.printReceipt).toBe('function');
    });

    it('should have all key stock methods', () => {
      expect(typeof kioskService.getKeyStock).toBe('function');
      expect(typeof kioskService.refillKeyStock).toBe('function');
    });

    it('should have all hardware event methods', () => {
      expect(typeof kioskService.logHardwareEvent).toBe('function');
      expect(typeof kioskService.resolveHardwareEvent).toBe('function');
      expect(typeof kioskService.getUnresolvedEvents).toBe('function');
    });

    it('should have screen flow methods', () => {
      expect(typeof kioskService.getScreenFlow).toBe('function');
      expect(typeof kioskService.getScreenContent).toBe('function');
    });

    it('should have check-in/out flow methods', () => {
      expect(typeof kioskService.performKioskCheckin).toBe('function');
      expect(typeof kioskService.finalizeKioskCheckin).toBe('function');
      expect(typeof kioskService.performKioskCheckout).toBe('function');
      expect(typeof kioskService.finalizeKioskCheckout).toBe('function');
    });

    it('should have analytics methods', () => {
      expect(typeof kioskService.getKioskAnalytics).toBe('function');
    });
  });

  // =============================================
  // DEVICE MANAGEMENT TESTS
  // =============================================

  describe('registerDevice', () => {
    it('should register a new device', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow];

      const result = await kioskService.registerDevice('prop-1', {
        deviceName: 'Lobby Kiosk 1',
        deviceCode: 'K001',
        location: 'Main Lobby',
        deviceType: 'standard',
        capabilities: {
          hasIdScanner: true,
          hasCardReader: true,
          hasKeyEncoder: true,
          hasReceiptPrinter: true
        },
        config: { brightness: 80 }
      });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.deviceName).toBe('Lobby Kiosk 1');
      expect(result.deviceCode).toBe('K001');
      expect(result.capabilities).toBeDefined();
    });

    it('should register a device with minimal data', async () => {
      currentMockData['kiosk_devices'] = [];

      const result = await kioskService.registerDevice('prop-1', {
        deviceName: 'Simple Kiosk',
        deviceCode: 'K002'
      });

      expect(result.deviceName).toBe('Simple Kiosk');
      expect(result.deviceCode).toBe('K002');
    });

    it('should initialize key stock when device has key encoder', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['kiosk_key_stock'] = [mockKeyStock];

      await kioskService.registerDevice('prop-1', {
        deviceName: 'Kiosk with Keys',
        deviceCode: 'K003',
        capabilities: { hasKeyEncoder: true }
      });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_key_stock');
    });
  });

  describe('getDevice', () => {
    it('should return device when found', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow];

      const result = await kioskService.getDevice('kiosk-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
      expect(result).toMatchObject({
        id: 'kiosk-1',
        deviceName: 'Lobby Kiosk 1'
      });
    });

    it('should return null when device not found', async () => {
      currentMockData['kiosk_devices'] = [];

      const result = await kioskService.getDevice('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDeviceByCode', () => {
    it('should return device by property and code', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow];

      const result = await kioskService.getDeviceByCode('prop-1', 'K001');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
      expect(result?.deviceCode).toBe('K001');
    });

    it('should return null when not found', async () => {
      currentMockData['kiosk_devices'] = [];

      const result = await kioskService.getDeviceByCode('prop-1', 'INVALID');

      expect(result).toBeNull();
    });
  });

  describe('getPropertyDevices', () => {
    it('should return all active devices for property', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow, { ...mockDeviceRow, id: 'kiosk-2', device_code: 'K002' }];

      const result = await kioskService.getPropertyDevices('prop-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
      expect(result).toHaveLength(2);
    });

    it('should include inactive when specified', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow, { ...mockDeviceRow, is_active: false }];

      const result = await kioskService.getPropertyDevices('prop-1', true);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no devices', async () => {
      currentMockData['kiosk_devices'] = [];

      const result = await kioskService.getPropertyDevices('prop-99');

      expect(result).toEqual([]);
    });
  });

  describe('updateDeviceStatus', () => {
    it('should update device status', async () => {
      await kioskService.updateDeviceStatus('kiosk-1', 'online');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });

    it('should update device status with error', async () => {
      await kioskService.updateDeviceStatus('kiosk-1', 'error', 'Connection timeout');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });
  });

  describe('updateDeviceConfig', () => {
    it('should update device configuration', async () => {
      await kioskService.updateDeviceConfig('kiosk-1', { brightness: 90, volume: 50 });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });
  });

  describe('setDeviceMaintenanceMode', () => {
    it('should enable maintenance mode', async () => {
      await kioskService.setDeviceMaintenanceMode('kiosk-1', true, 'Scheduled maintenance');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });

    it('should disable maintenance mode', async () => {
      await kioskService.setDeviceMaintenanceMode('kiosk-1', false);

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });
  });

  describe('deactivateDevice', () => {
    it('should deactivate device', async () => {
      await kioskService.deactivateDevice('kiosk-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
    });
  });

  // =============================================
  // SESSION MANAGEMENT TESTS
  // =============================================

  describe('startSession', () => {
    it('should start a new session for online device', async () => {
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['kiosk_sessions'] = [mockSessionRow];

      const result = await kioskService.startSession('kiosk-1', 'checkin', {
        bookingId: 'booking-1',
        confirmationNumber: 'CONF123'
      });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_devices');
      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
      expect(result.sessionType).toBe('checkin');
    });

    it('should throw error for non-existent device', async () => {
      currentMockData['kiosk_devices'] = [];

      await expect(kioskService.startSession('invalid', 'checkin'))
        .rejects.toThrow('Kiosk device not found');
    });

    it('should throw error for offline device', async () => {
      currentMockData['kiosk_devices'] = [{ ...mockDeviceRow, status: 'offline' }];

      await expect(kioskService.startSession('kiosk-1', 'checkin'))
        .rejects.toThrow('Kiosk is not available');
    });
  });

  describe('getSession', () => {
    it('should return session when found', async () => {
      currentMockData['kiosk_sessions'] = [mockSessionRow];

      const result = await kioskService.getSession('session-1');

      expect(result).toMatchObject({
        id: 'session-1',
        sessionType: 'checkin',
        status: 'in_progress'
      });
    });

    it('should return null when not found', async () => {
      currentMockData['kiosk_sessions'] = [];

      const result = await kioskService.getSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateSessionStep', () => {
    it('should update session step and data', async () => {
      currentMockData['kiosk_sessions'] = [mockSessionRow];

      await kioskService.updateSessionStep('session-1', 'payment', { amount: 100 });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });

    it('should throw error when session not found', async () => {
      currentMockData['kiosk_sessions'] = [];

      await expect(kioskService.updateSessionStep('invalid', 'payment'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('completeSession', () => {
    it('should complete session with success status', async () => {
      await kioskService.completeSession('session-1', 'success', { roomNumber: '101' });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });

    it('should complete session with failure status', async () => {
      await kioskService.completeSession('session-1', 'failed', { reason: 'Payment declined' });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });
  });

  describe('abandonSession', () => {
    it('should abandon session with reason', async () => {
      await kioskService.abandonSession('session-1', 'User cancelled');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });

    it('should abandon session without reason', async () => {
      await kioskService.abandonSession('session-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });
  });

  describe('timeoutSession', () => {
    it('should timeout session', async () => {
      await kioskService.timeoutSession('session-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });
  });

  describe('transferToDesk', () => {
    it('should transfer session to desk', async () => {
      await kioskService.transferToDesk('session-1', 'Guest needs assistance', 'staff-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });

    it('should transfer without staff ID', async () => {
      await kioskService.transferToDesk('session-1', 'Technical issue');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
    });
  });

  describe('processTimeouts', () => {
    it('should process timed out sessions', async () => {
      const staleSession = { ...mockSessionRow, status: 'in_progress' };
      currentMockData['kiosk_sessions'] = [staleSession];

      const count = await kioskService.processTimeouts(2);

      expect(mockFrom).toHaveBeenCalledWith('kiosk_sessions');
      expect(count).toBe(1);
    });

    it('should return 0 when no timeouts', async () => {
      currentMockData['kiosk_sessions'] = [];

      const count = await kioskService.processTimeouts();

      expect(count).toBe(0);
    });
  });

  // =============================================
  // TRANSACTION TESTS
  // =============================================

  describe('createTransaction', () => {
    it('should create a transaction', async () => {
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const transactionId = await kioskService.createTransaction(
        'session-1',
        'kiosk-1',
        'payment',
        { amount: 100 }
      );

      expect(mockFrom).toHaveBeenCalledWith('kiosk_transactions');
      expect(transactionId).toBeDefined();
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction status to completed', async () => {
      await kioskService.updateTransaction('txn-1', 'completed', { reference: 'PAY-123' });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_transactions');
    });

    it('should update transaction with error', async () => {
      await kioskService.updateTransaction('txn-1', 'failed', undefined, {
        code: 'DECLINED',
        message: 'Card declined'
      });

      expect(mockFrom).toHaveBeenCalledWith('kiosk_transactions');
    });
  });

  // =============================================
  // ID SCANNING TESTS
  // =============================================

  describe('scanId', () => {
    it('should scan and extract ID data', async () => {
      currentMockData['kiosk_transactions'] = [mockTransaction];
      currentMockData['kiosk_sessions'] = [mockSessionRow];

      const result = await kioskService.scanId('session-1', 'kiosk-1', {
        documentType: 'passport',
        frontImage: 'base64image',
        backImage: 'base64back'
      });

      expect(result.verified).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.extractedData).toBeDefined();
      expect(result.extractedData?.firstName).toBe('JOHN');
    });
  });

  // =============================================
  // KEY ENCODING TESTS
  // =============================================

  describe('encodeKey', () => {
    it('should encode a room key', async () => {
      currentMockData['kiosk_key_stock'] = [mockKeyStock];
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.encodeKey('session-1', 'kiosk-1', {
        roomNumber: '101',
        guestName: 'John Doe',
        checkInDate: new Date('2026-02-07'),
        checkOutDate: new Date('2026-02-10'),
        accessPoints: ['main_entrance', 'pool']
      });

      expect(result.success).toBe(true);
      expect(result.keyNumber).toBeDefined();
      expect(result.keyNumber).toMatch(/^K/);
    });

    it('should throw error when key stock depleted', async () => {
      currentMockData['kiosk_key_stock'] = [{ ...mockKeyStock, current_stock: 0 }];

      await expect(kioskService.encodeKey('session-1', 'kiosk-1', {
        roomNumber: '101',
        guestName: 'John Doe',
        checkInDate: new Date(),
        checkOutDate: new Date()
      })).rejects.toThrow('Key stock depleted');
    });
  });

  // =============================================
  // PAYMENT PROCESSING TESTS
  // =============================================

  describe('processPayment', () => {
    it('should process a payment', async () => {
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.processPayment('session-1', 'kiosk-1', {
        amount: 250.00,
        currency: 'USD',
        paymentMethod: 'credit_card',
        description: 'Room charge payment'
      });

      expect(result.success).toBe(true);
      expect(result.paymentReference).toMatch(/^PAY-/);
    });
  });

  // =============================================
  // RECEIPT PRINTING TESTS
  // =============================================

  describe('printReceipt', () => {
    it('should print a check-in receipt', async () => {
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.printReceipt('session-1', 'kiosk-1', {
        type: 'checkin_confirmation',
        guestName: 'John Doe',
        confirmationNumber: 'CONF123',
        roomNumber: '101',
        checkInDate: new Date('2026-02-07'),
        checkOutDate: new Date('2026-02-10')
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should print a folio receipt with items', async () => {
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.printReceipt('session-1', 'kiosk-1', {
        type: 'folio',
        guestName: 'John Doe',
        confirmationNumber: 'CONF123',
        items: [
          { description: 'Room Charge', amount: 200 },
          { description: 'Restaurant', amount: 45 }
        ],
        total: 245
      });

      expect(result.success).toBe(true);
    });
  });

  // =============================================
  // KEY STOCK MANAGEMENT TESTS
  // =============================================

  describe('getKeyStock', () => {
    it('should return key stock info', async () => {
      currentMockData['kiosk_key_stock'] = [mockKeyStock];

      const result = await kioskService.getKeyStock('kiosk-1');

      expect(result).toEqual({
        currentStock: 50,
        minimumStock: 20,
        maximumStock: 200,
        isLow: false
      });
    });

    it('should indicate low stock', async () => {
      currentMockData['kiosk_key_stock'] = [{ ...mockKeyStock, current_stock: 15 }];

      const result = await kioskService.getKeyStock('kiosk-1');

      expect(result?.isLow).toBe(true);
    });

    it('should return null when no stock record', async () => {
      currentMockData['kiosk_key_stock'] = [];

      const result = await kioskService.getKeyStock('kiosk-99');

      expect(result).toBeNull();
    });
  });

  describe('refillKeyStock', () => {
    it('should refill key stock', async () => {
      currentMockData['kiosk_key_stock'] = [mockKeyStock];

      await kioskService.refillKeyStock('kiosk-1', 100, 'staff-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_key_stock');
    });

    it('should throw error when no stock record', async () => {
      currentMockData['kiosk_key_stock'] = [];

      await expect(kioskService.refillKeyStock('kiosk-99', 50, 'staff-1'))
        .rejects.toThrow('Key stock record not found');
    });
  });

  // =============================================
  // HARDWARE EVENTS TESTS
  // =============================================

  describe('logHardwareEvent', () => {
    it('should log a hardware event', async () => {
      currentMockData['kiosk_hardware_events'] = [mockHardwareEvent];

      const eventId = await kioskService.logHardwareEvent(
        'kiosk-1',
        'paper_jam',
        'error',
        'receipt_printer',
        { location: 'tray 1' }
      );

      expect(mockFrom).toHaveBeenCalledWith('kiosk_hardware_events');
      expect(eventId).toBeDefined();
    });
  });

  describe('resolveHardwareEvent', () => {
    it('should resolve a hardware event', async () => {
      await kioskService.resolveHardwareEvent('event-1', 'staff-1', 'Paper replaced');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_hardware_events');
    });

    it('should resolve without notes', async () => {
      await kioskService.resolveHardwareEvent('event-1', 'staff-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_hardware_events');
    });
  });

  describe('getUnresolvedEvents', () => {
    it('should get unresolved events for a kiosk', async () => {
      currentMockData['kiosk_hardware_events'] = [mockHardwareEvent];

      const events = await kioskService.getUnresolvedEvents('kiosk-1');

      expect(mockFrom).toHaveBeenCalledWith('kiosk_hardware_events');
      expect(events).toHaveLength(1);
    });

    it('should get all unresolved events when no kiosk specified', async () => {
      currentMockData['kiosk_hardware_events'] = [
        mockHardwareEvent,
        { ...mockHardwareEvent, id: 'event-2', kiosk_id: 'kiosk-2' }
      ];

      const events = await kioskService.getUnresolvedEvents();

      expect(events).toHaveLength(2);
      expect(events[0].device_name).toBe('Lobby Kiosk 1');
    });
  });

  // =============================================
  // SCREEN FLOWS TESTS
  // =============================================

  describe('getScreenFlow', () => {
    it('should return screen flow configuration', async () => {
      currentMockData['kiosk_screen_flows'] = [mockScreenFlow];

      const result = await kioskService.getScreenFlow('prop-1', 'checkin');

      expect(result).toEqual({
        id: 'flow-1',
        name: 'Standard Check-In',
        steps: [{ key: 'welcome' }, { key: 'id_scan' }],
        settings: {
          timeoutSeconds: 120,
          enableHelpButton: true,
          enableCancelButton: true,
          enableLanguageSelector: true,
          defaultLanguage: 'en',
          availableLanguages: ['en', 'es', 'fr']
        }
      });
    });

    it('should return null when flow not found', async () => {
      currentMockData['kiosk_screen_flows'] = [];

      const result = await kioskService.getScreenFlow('prop-1', 'unknown');

      expect(result).toBeNull();
    });
  });

  describe('getScreenContent', () => {
    it('should return screen content for step', async () => {
      currentMockData['kiosk_screen_content'] = [mockScreenContent];

      const result = await kioskService.getScreenContent('flow-1', 'welcome', 'en');

      expect(result).toEqual({
        title: 'Welcome',
        subtitle: 'Touch to begin',
        instructions: 'Please touch the screen to start',
        buttonLabels: { continue: 'Continue', cancel: 'Cancel' },
        media: {
          imageUrl: '/images/welcome.png',
          videoUrl: null,
          animationType: 'fade'
        }
      });
    });

    it('should return null when content not found', async () => {
      currentMockData['kiosk_screen_content'] = [];

      const result = await kioskService.getScreenContent('flow-1', 'unknown');

      expect(result).toBeNull();
    });
  });

  // =============================================
  // CHECK-IN FLOW TESTS
  // =============================================

  describe('performKioskCheckin', () => {
    it('should start check-in for valid booking', async () => {
      currentMockData['bookings'] = [mockBooking];
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['kiosk_sessions'] = [mockSessionRow];

      const result = await kioskService.performKioskCheckin('kiosk-1', 'CONF123');

      expect(mockFrom).toHaveBeenCalledWith('bookings');
      expect(result.sessionType).toBe('checkin');
    });

    it('should throw error for invalid booking', async () => {
      currentMockData['bookings'] = [];
      currentMockData['kiosk_devices'] = [mockDeviceRow];

      await expect(kioskService.performKioskCheckin('kiosk-1', 'INVALID'))
        .rejects.toThrow('Booking not found');
    });
  });

  describe('finalizeKioskCheckin', () => {
    it('should finalize check-in with key and receipt', async () => {
      currentMockData['kiosk_sessions'] = [mockSessionRow];
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['bookings'] = [mockBooking];
      currentMockData['kiosk_key_stock'] = [mockKeyStock];
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.finalizeKioskCheckin('session-1', '101', true);

      expect(result.success).toBe(true);
      expect(result.roomNumber).toBe('101');
    });

    it('should throw error for missing session', async () => {
      currentMockData['kiosk_sessions'] = [];

      await expect(kioskService.finalizeKioskCheckin('invalid', '101'))
        .rejects.toThrow('Session not found');
    });

    it('should throw error for session without booking', async () => {
      currentMockData['kiosk_sessions'] = [{ ...mockSessionRow, booking_id: null }];

      await expect(kioskService.finalizeKioskCheckin('session-1', '101'))
        .rejects.toThrow('No booking associated with session');
    });
  });

  // =============================================
  // CHECK-OUT FLOW TESTS
  // =============================================

  describe('performKioskCheckout', () => {
    it('should start checkout for active booking', async () => {
      const checkedInBooking = { ...mockBooking, status: 'checked_in' };
      currentMockData['bookings'] = [checkedInBooking];
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['kiosk_sessions'] = [{ ...mockSessionRow, session_type: 'checkout' }];
      currentMockData['folio_transactions'] = [
        { amount: 200, type: 'charge' },
        { amount: 50, type: 'payment' }
      ];

      const result = await kioskService.performKioskCheckout('kiosk-1', '101');

      expect(result.sessionType).toBe('checkout');
    });

    it('should throw error when no active booking for room', async () => {
      currentMockData['bookings'] = [];
      currentMockData['kiosk_devices'] = [mockDeviceRow];

      await expect(kioskService.performKioskCheckout('kiosk-1', '999'))
        .rejects.toThrow('No active booking found');
    });
  });

  describe('finalizeKioskCheckout', () => {
    it('should finalize checkout with payment', async () => {
      currentMockData['kiosk_sessions'] = [{ ...mockSessionRow, session_type: 'checkout' }];
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['bookings'] = [{ ...mockBooking, status: 'checked_in' }];
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.finalizeKioskCheckout('session-1', {
        amount: 150,
        paymentMethod: 'credit_card'
      });

      expect(result.success).toBe(true);
      expect(result.paymentProcessed).toBe(true);
    });

    it('should finalize checkout without payment', async () => {
      currentMockData['kiosk_sessions'] = [{ ...mockSessionRow, session_type: 'checkout' }];
      currentMockData['kiosk_devices'] = [mockDeviceRow];
      currentMockData['bookings'] = [{ ...mockBooking, status: 'checked_in' }];
      currentMockData['kiosk_transactions'] = [mockTransaction];

      const result = await kioskService.finalizeKioskCheckout('session-1');

      expect(result.success).toBe(true);
      expect(result.paymentProcessed).toBe(false);
    });

    it('should throw error for missing session', async () => {
      currentMockData['kiosk_sessions'] = [];

      await expect(kioskService.finalizeKioskCheckout('invalid'))
        .rejects.toThrow('Session not found');
    });
  });

  // =============================================
  // ANALYTICS TESTS
  // =============================================

  describe('getKioskAnalytics', () => {
    it('should return analytics summary', async () => {
      currentMockData['kiosk_analytics'] = [mockAnalyticsRow];

      const result = await kioskService.getKioskAnalytics(
        'prop-1',
        new Date('2026-02-01'),
        new Date('2026-02-07')
      );

      expect(result.summary).toBeDefined();
      expect(result.summary.totalSessions).toBe(25);
      expect(result.summary.completedSessions).toBe(20);
      expect(result.summary.completionRate).toBe(80);
    });

    it('should return analytics for specific kiosk', async () => {
      currentMockData['kiosk_analytics'] = [mockAnalyticsRow];

      const result = await kioskService.getKioskAnalytics(
        'prop-1',
        new Date('2026-02-01'),
        new Date('2026-02-07'),
        'kiosk-1'
      );

      expect(result.deviceBreakdown).toBeDefined();
    });

    it('should handle empty analytics', async () => {
      currentMockData['kiosk_analytics'] = [];

      const result = await kioskService.getKioskAnalytics(
        'prop-99',
        new Date('2026-01-01'),
        new Date('2026-01-07')
      );

      expect(result.summary.totalSessions).toBe(0);
      expect(result.summary.completionRate).toBe(0);
    });
  });
});
