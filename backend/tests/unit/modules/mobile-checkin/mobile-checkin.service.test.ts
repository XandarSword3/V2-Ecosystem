
// Mock data arrays
let mockBookings: Array<Record<string, unknown>> = [];
let mockRegistrations: Array<Record<string, unknown>> = [];
let mockDocuments: Array<Record<string, unknown>> = [];
let mockSignatures: Array<Record<string, unknown>> = [];
let mockTermsVersions: Array<Record<string, unknown>> = [];
let mockTermsAcceptance: Array<Record<string, unknown>> = [];
let mockMobileKeys: Array<Record<string, unknown>> = [];
let mockAccessLogs: Array<Record<string, unknown>> = [];
let mockCheckinSessions: Array<Record<string, unknown>> = [];
let mockPushRegistrations: Array<Record<string, unknown>> = [];
let mockPushNotifications: Array<Record<string, unknown>> = [];

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'filter'];
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
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data: insertData, error: null });
      return Promise.resolve({ data: insertData, error: null });
    }
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

const mockFrom = vi.fn().mockImplementation((table: string) => {
  switch (table) {
    case 'bookings':
    case 'transactions':
      return createQueryMock(() => mockBookings);
    case 'pre_arrival_registrations':
      return createQueryMock(() => mockRegistrations);
    case 'guest_documents':
      return createQueryMock(() => mockDocuments);
    case 'digital_signatures':
      return createQueryMock(() => mockSignatures);
    case 'terms_versions':
      return createQueryMock(() => mockTermsVersions);
    case 'terms_acceptance':
      return createQueryMock(() => mockTermsAcceptance);
    case 'mobile_keys':
      return createQueryMock(() => mockMobileKeys);
    case 'mobile_key_access_log':
      return createQueryMock(() => mockAccessLogs);
    case 'checkin_sessions':
      return createQueryMock(() => mockCheckinSessions);
    case 'push_registrations':
      return createQueryMock(() => mockPushRegistrations);
    case 'push_notifications':
      return createQueryMock(() => mockPushNotifications);
    default:
      return createQueryMock(() => []);
  }
});

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => ({
    from: mockFrom,
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'docs/test.jpg' }, error: null }),
      }),
    },
  })),
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = { create: vi.fn() };
    constructor() {}
  },
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { MobileCheckinService } from '../../../../src/modules/mobile-checkin/mobile-checkin.service';

describe('MobileCheckinService', () => {
  let service: MobileCheckinService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock arrays
    mockBookings = [];
    mockRegistrations = [];
    mockDocuments = [];
    mockSignatures = [];
    mockTermsVersions = [];
    mockTermsAcceptance = [];
    mockMobileKeys = [];
    mockAccessLogs = [];
    mockCheckinSessions = [];
    mockPushRegistrations = [];
    mockPushNotifications = [];
    
    service = new MobileCheckinService();
  });

  // ==================================
  // PRE-ARRIVAL REGISTRATION TESTS
  // ==================================

  describe('createRegistration', () => {
    it('should create a new registration for a valid booking', async () => {
      mockBookings = [{
        id: 'booking-1',
        property_id: 'prop-1',
        guest_id: 'guest-1',
        check_in: '2026-03-01',
        guests: { email: 'john@test.com', first_name: 'John', last_name: 'Doe' }
      }];
      mockRegistrations = [];

      const result = await service.createRegistration('booking-1');

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should return existing registration if one already exists', async () => {
      mockBookings = [{
        id: 'booking-1',
        property_id: 'prop-1',
        guest_id: 'guest-1',
        check_in: '2026-03-01',
        guests: { email: 'john@test.com', first_name: 'John', last_name: 'Doe' }
      }];
      mockRegistrations = [{
        id: 'existing-reg-1',
        booking_id: 'booking-1',
        status: 'pending'
      }];

      const result = await service.createRegistration('booking-1');

      expect(result.id).toBe('existing-reg-1');
    });

    it('should throw error when booking not found', async () => {
      mockBookings = [];

      await expect(service.createRegistration('nonexistent')).rejects.toThrow('Booking not found');
    });
  });

  describe('getRegistrationByToken', () => {
    it('should return registration with documents, signatures, and pending terms', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      mockRegistrations = [{
        id: 'reg-1',
        access_token: 'valid-token',
        token_expires_at: futureDate.toISOString(),
        property_id: 'prop-1',
        guest_id: 'guest-1',
        booking_id: 'booking-1',
        bookings: { confirmation_number: 'CONF123', check_in: '2026-03-01', check_out: '2026-03-05' },
        properties: { name: 'Test Resort', address: '123 Beach Rd' }
      }];
      mockDocuments = [{ id: 'doc-1', document_type: 'passport' }];
      mockSignatures = [{ id: 'sig-1', signature_type: 'registration_form' }];
      mockTermsVersions = [{ id: 'terms-1', terms_type: 'terms_and_conditions', is_current: true }];
      mockTermsAcceptance = [];

      const result = await service.getRegistrationByToken('valid-token');

      expect(result.id).toBe('reg-1');
      expect(result.documents).toBeDefined();
      expect(result.signatures).toBeDefined();
      expect(result.pendingTerms).toBeDefined();
    });

    it('should throw error for invalid or expired token', async () => {
      mockRegistrations = [];

      await expect(service.getRegistrationByToken('invalid-token'))
        .rejects.toThrow('Invalid or expired registration link');
    });
  });

  describe('updateRegistration', () => {
    it('should update registration with provided data', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'pending',
        started_at: null
      }];

      await service.updateRegistration('reg-1', {
        legalFirstName: 'John',
        legalLastName: 'Doe',
        nationality: 'US',
        email: 'john@test.com'
      });

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should change status to started on first update', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'pending',
        started_at: null
      }];

      await service.updateRegistration('reg-1', {
        mobilePhone: '+1234567890'
      });

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should update vehicle information when provided', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'started',
        started_at: new Date().toISOString()
      }];

      await service.updateRegistration('reg-1', {
        hasVehicle: true,
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleColor: 'Blue',
        vehiclePlate: 'ABC123'
      });

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });
  });

  describe('submitRegistration', () => {
    it('should throw error when registration not found', async () => {
      mockRegistrations = [];

      await expect(service.submitRegistration('nonexistent'))
        .rejects.toThrow('Registration not found');
    });

    it('should throw error when no ID document uploaded', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'started'
      }];
      mockDocuments = [];

      await expect(service.submitRegistration('reg-1'))
        .rejects.toThrow('At least one ID document is required');
    });
  });

  describe('approveRegistration', () => {
    it('should approve registration with notes', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'documents_uploaded'
      }];

      await service.approveRegistration('reg-1', 'staff-1', 'All documents verified');

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should approve registration without notes', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'documents_uploaded'
      }];

      await service.approveRegistration('reg-1', 'staff-1');

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });
  });

  describe('rejectRegistration', () => {
    it('should reject registration with reason', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        status: 'documents_uploaded'
      }];

      await service.rejectRegistration('reg-1', 'staff-1', 'Invalid ID document');

      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });
  });

  describe('getPendingRegistrations', () => {
    it('should return pending registrations for property', async () => {
      mockRegistrations = [
        {
          id: 'reg-1',
          property_id: 'prop-1',
          status: 'documents_uploaded',
          bookings: { confirmation_number: 'CONF1', check_in: '2026-03-01' },
          guests: { first_name: 'John', last_name: 'Doe', email: 'john@test.com' }
        },
        {
          id: 'reg-2',
          property_id: 'prop-1',
          status: 'review_required',
          bookings: { confirmation_number: 'CONF2', check_in: '2026-03-02' },
          guests: { first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com' }
        }
      ];

      const result = await service.getPendingRegistrations('prop-1');

      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should return empty array when no pending registrations', async () => {
      mockRegistrations = [];

      const result = await service.getPendingRegistrations('prop-1');

      expect(result).toEqual([]);
    });
  });

  // ==================================
  // DOCUMENT MANAGEMENT TESTS
  // ==================================

  describe('uploadDocument', () => {
    it('should upload document for valid registration', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        property_id: 'prop-1',
        guest_id: 'guest-1'
      }];

      const result = await service.uploadDocument('reg-1', {
        documentType: 'passport',
        documentNumber: 'P12345678',
        issuingCountry: 'US',
        expiryDate: new Date('2030-01-01'),
        fileUrl: 'https://storage.example.com/docs/passport.jpg',
        fileName: 'passport.jpg',
        fileType: 'image/jpeg',
        fileSize: 2048000
      });

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('guest_documents');
    });

    it('should throw error when registration not found', async () => {
      mockRegistrations = [];

      await expect(service.uploadDocument('nonexistent', {
        documentType: 'passport',
        fileUrl: 'https://storage.example.com/docs/passport.jpg',
        fileName: 'passport.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024
      })).rejects.toThrow('Registration not found');
    });
  });

  describe('verifyDocument', () => {
    it('should verify document manually', async () => {
      mockDocuments = [{
        id: 'doc-1',
        is_verified: false
      }];

      await service.verifyDocument('doc-1', 'staff-1');

      expect(mockFrom).toHaveBeenCalledWith('guest_documents');
    });

    it('should verify document with OCR data', async () => {
      mockDocuments = [{
        id: 'doc-1',
        is_verified: false
      }];

      await service.verifyDocument('doc-1', 'staff-1', {
        extractedName: 'John Doe',
        extractedNumber: 'P12345678',
        confidence: 0.95
      });

      expect(mockFrom).toHaveBeenCalledWith('guest_documents');
    });
  });

  describe('getGuestDocuments', () => {
    it('should return all documents for a guest', async () => {
      mockDocuments = [
        { id: 'doc-1', guest_id: 'guest-1', document_type: 'passport' },
        { id: 'doc-2', guest_id: 'guest-1', document_type: 'drivers_license' }
      ];

      const result = await service.getGuestDocuments('guest-1');

      expect(result).toHaveLength(2);
      expect(mockFrom).toHaveBeenCalledWith('guest_documents');
    });

    it('should return empty array when guest has no documents', async () => {
      mockDocuments = [];

      const result = await service.getGuestDocuments('guest-1');

      expect(result).toEqual([]);
    });
  });

  // ==================================
  // DIGITAL SIGNATURES TESTS
  // ==================================

  describe('captureSignature', () => {
    it('should capture signature for valid registration', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        property_id: 'prop-1',
        guest_id: 'guest-1',
        booking_id: 'booking-1'
      }];

      const result = await service.captureSignature('reg-1', {
        signatureType: 'registration_form',
        signatureData: 'base64encodeddata',
        signatureFormat: 'image/png',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceInfo: { model: 'iPhone 14' }
      });

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('digital_signatures');
    });

    it('should throw error when registration not found', async () => {
      mockRegistrations = [];

      await expect(service.captureSignature('nonexistent', {
        signatureType: 'registration_form',
        signatureData: 'base64data'
      })).rejects.toThrow('Registration not found');
    });

    it('should capture signature with geolocation', async () => {
      mockRegistrations = [{
        id: 'reg-1',
        property_id: 'prop-1',
        guest_id: 'guest-1',
        booking_id: 'booking-1'
      }];

      const result = await service.captureSignature('reg-1', {
        signatureType: 'terms_acceptance',
        signatureData: 'base64encodeddata',
        geolocation: { lat: 25.7617, lng: -80.1918, accuracy: 10 }
      });

      expect(result).toBeDefined();
    });
  });

  // ==================================
  // TERMS ACCEPTANCE TESTS
  // ==================================

  describe('acceptTerms', () => {
    it('should accept terms for guest', async () => {
      mockTermsVersions = [{
        id: 'terms-1',
        property_id: 'prop-1',
        terms_type: 'terms_and_conditions',
        is_current: true
      }];

      await service.acceptTerms(
        'guest-1',
        'terms-1',
        'booking-1',
        '192.168.1.1',
        'Mozilla/5.0',
        'sig-1'
      );

      expect(mockFrom).toHaveBeenCalledWith('terms_versions');
      expect(mockFrom).toHaveBeenCalledWith('terms_acceptance');
    });

    it('should throw error when terms not found', async () => {
      mockTermsVersions = [];

      await expect(service.acceptTerms('guest-1', 'nonexistent', 'booking-1'))
        .rejects.toThrow('Terms not found');
    });

    it('should accept terms without optional parameters', async () => {
      mockTermsVersions = [{
        id: 'terms-1',
        property_id: 'prop-1'
      }];

      await service.acceptTerms('guest-1', 'terms-1', 'booking-1');

      expect(mockFrom).toHaveBeenCalledWith('terms_acceptance');
    });
  });

  describe('getCurrentTerms', () => {
    it('should return current terms for property and type', async () => {
      mockTermsVersions = [{
        id: 'terms-1',
        property_id: 'prop-1',
        terms_type: 'terms_and_conditions',
        language: 'en',
        is_current: true,
        content: 'Terms content here...'
      }];

      const result = await service.getCurrentTerms('prop-1', 'terms_and_conditions');

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('terms_versions');
    });

    it('should return terms for specific language', async () => {
      mockTermsVersions = [{
        id: 'terms-es',
        property_id: 'prop-1',
        terms_type: 'privacy_policy',
        language: 'es',
        is_current: true
      }];

      const result = await service.getCurrentTerms('prop-1', 'privacy_policy', 'es');

      expect(result).toBeDefined();
    });

    it('should return null when no current terms exist', async () => {
      mockTermsVersions = [];

      const result = await service.getCurrentTerms('prop-1', 'house_rules');

      expect(result).toBeNull();
    });
  });

  // ==================================
  // MOBILE KEYS TESTS
  // ==================================

  describe('requestMobileKey', () => {
    it('should return existing key if already exists for device', async () => {
      mockBookings = [{
        id: 'booking-1',
        property_id: 'prop-1',
        guest_id: 'guest-1',
        check_in: '2026-03-01',
        check_out: '2026-03-05'
      }];
      mockMobileKeys = [{
        id: 'key-1',
        booking_id: 'booking-1',
        device_id: 'device-123',
        status: 'active'
      }];

      const result = await service.requestMobileKey('booking-1', {
        provider: 'assa_abloy',
        deviceId: 'device-123',
        deviceType: 'ios'
      });

      expect(result.id).toBe('key-1');
    });

    it('should throw error when booking not found', async () => {
      mockBookings = [];

      await expect(service.requestMobileKey('nonexistent', {
        provider: 'salto',
        deviceId: 'device-123',
        deviceType: 'android'
      })).rejects.toThrow('Booking not found');
    });
  });

  describe('getMobileKeyById', () => {
    it('should return mobile key with room and booking info', async () => {
      mockMobileKeys = [{
        id: 'key-1',
        status: 'active',
        rooms: { room_number: '101' },
        bookings: { confirmation_number: 'CONF123' }
      }];

      const result = await service.getMobileKeyById('key-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('key-1');
      expect(mockFrom).toHaveBeenCalledWith('mobile_keys');
    });
  });

  describe('getMobileKeyByBooking', () => {
    it('should return all active keys for booking', async () => {
      mockMobileKeys = [
        { id: 'key-1', booking_id: 'booking-1', device_id: 'device-1', status: 'active' },
        { id: 'key-2', booking_id: 'booking-1', device_id: 'device-2', status: 'active' }
      ];

      const result = await service.getMobileKeyByBooking('booking-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by device ID when provided', async () => {
      mockMobileKeys = [
        { id: 'key-1', booking_id: 'booking-1', device_id: 'device-1', status: 'active' }
      ];

      const result = await service.getMobileKeyByBooking('booking-1', 'device-1');

      expect(result).toHaveLength(1);
      expect(result[0].device_id).toBe('device-1');
    });

    it('should return empty array when no keys exist', async () => {
      mockMobileKeys = [];

      const result = await service.getMobileKeyByBooking('booking-1');

      expect(result).toEqual([]);
    });
  });

  describe('revokeMobileKey', () => {
    it('should revoke mobile key with reason', async () => {
      mockMobileKeys = [{
        id: 'key-1',
        status: 'active'
      }];

      await service.revokeMobileKey('key-1', 'staff-1', 'Guest requested cancellation');

      expect(mockFrom).toHaveBeenCalledWith('mobile_keys');
    });
  });

  describe('validateKeyAccess', () => {
    it('should return true for valid key and access point', async () => {
      const now = new Date();
      const accessStarts = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
      const accessEnds = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow

      mockMobileKeys = [{
        id: 'key-1',
        status: 'active',
        access_areas: ['room', 'gym', 'pool'],
        room_access_starts: accessStarts.toISOString(),
        room_access_ends: accessEnds.toISOString(),
        rooms: { room_number: '101' }
      }];

      const result = await service.validateKeyAccess('key-1', 'room');

      expect(result).toBe(true);
    });

    it('should return false for inactive key', async () => {
      mockMobileKeys = [];

      const result = await service.validateKeyAccess('nonexistent', 'room');

      expect(result).toBe(false);
    });

    it('should return false for expired access window', async () => {
      const now = new Date();
      const accessStarts = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 2 days ago
      const accessEnds = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday

      mockMobileKeys = [{
        id: 'key-1',
        status: 'active',
        access_areas: ['room'],
        room_access_starts: accessStarts.toISOString(),
        room_access_ends: accessEnds.toISOString()
      }];

      const result = await service.validateKeyAccess('key-1', 'room');

      expect(result).toBe(false);
    });

    it('should return false for unauthorized access point', async () => {
      const now = new Date();
      const accessStarts = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const accessEnds = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      mockMobileKeys = [{
        id: 'key-1',
        status: 'active',
        access_areas: ['room'],
        room_access_starts: accessStarts.toISOString(),
        room_access_ends: accessEnds.toISOString()
      }];

      const result = await service.validateKeyAccess('key-1', 'spa');

      expect(result).toBe(false);
    });
  });

  describe('logKeyAccess', () => {
    it('should log successful access attempt', async () => {
      mockMobileKeys = [{
        id: 'key-1',
        property_id: 'prop-1'
      }];

      await service.logKeyAccess(
        'key-1',
        'room-101',
        'room_door',
        true,
        undefined,
        { deviceId: 'device-123' }
      );

      expect(mockFrom).toHaveBeenCalledWith('mobile_key_access_log');
    });

    it('should log failed access attempt with reason', async () => {
      mockMobileKeys = [{
        id: 'key-1',
        property_id: 'prop-1'
      }];

      await service.logKeyAccess(
        'key-1',
        'gym',
        'facility_door',
        false,
        'Access window expired'
      );

      expect(mockFrom).toHaveBeenCalledWith('mobile_key_access_log');
    });

    it('should not log if key not found', async () => {
      mockMobileKeys = [];

      await service.logKeyAccess('nonexistent', 'room', 'door', false);

      // Should not throw, just return silently
    });
  });

  // ==================================
  // CHECK-IN SESSIONS TESTS
  // ==================================

  describe('startCheckinSession', () => {
    it('should start check-in session for valid booking', async () => {
      mockBookings = [{
        id: 'booking-1',
        property_id: 'prop-1',
        guest_id: 'guest-1'
      }];
      mockRegistrations = [{
        id: 'reg-1',
        booking_id: 'booking-1'
      }];

      const result = await service.startCheckinSession('booking-1', 'mobile', {
        deviceType: 'ios',
        deviceId: 'device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Safari'
      });

      expect(result).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('checkin_sessions');
    });

    it('should throw error when booking not found', async () => {
      mockBookings = [];

      await expect(service.startCheckinSession('nonexistent', 'kiosk'))
        .rejects.toThrow('Booking not found');
    });

    it('should start session without existing registration', async () => {
      mockBookings = [{
        id: 'booking-1',
        property_id: 'prop-1',
        guest_id: 'guest-1'
      }];
      mockRegistrations = [];

      const result = await service.startCheckinSession('booking-1', 'web');

      expect(result).toBeDefined();
    });
  });

  describe('updateCheckinSession', () => {
    it('should update session with completed step', async () => {
      mockCheckinSessions = [{
        id: 'session-1',
        steps_completed: ['identity_verification']
      }];

      await service.updateCheckinSession('session-1', 'document_upload', {
        documentId: 'doc-1'
      });

      expect(mockFrom).toHaveBeenCalledWith('checkin_sessions');
    });

    it('should throw error when session not found', async () => {
      mockCheckinSessions = [];

      await expect(service.updateCheckinSession('nonexistent', 'step'))
        .rejects.toThrow('Session not found');
    });

    it('should handle first step completion', async () => {
      mockCheckinSessions = [{
        id: 'session-1',
        steps_completed: []
      }];

      await service.updateCheckinSession('session-1', 'first_step');

      expect(mockFrom).toHaveBeenCalledWith('checkin_sessions');
    });
  });

  describe('completeCheckin', () => {
    it('should complete check-in with mobile key only', async () => {
      mockCheckinSessions = [{
        id: 'session-1',
        booking_id: 'booking-1',
        registration_id: 'reg-1'
      }];

      await service.completeCheckin('session-1', 'room-101', 'mobile', 'key-1');

      expect(mockFrom).toHaveBeenCalledWith('checkin_sessions');
      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockFrom).toHaveBeenCalledWith('pre_arrival_registrations');
    });

    it('should complete check-in with physical key only', async () => {
      mockCheckinSessions = [{
        id: 'session-1',
        booking_id: 'booking-1',
        registration_id: null
      }];

      await service.completeCheckin('session-1', 'room-102', 'physical', undefined, 'KEY-789');

      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('should complete check-in with both key types', async () => {
      mockCheckinSessions = [{
        id: 'session-1',
        booking_id: 'booking-1',
        registration_id: 'reg-1'
      }];

      await service.completeCheckin('session-1', 'room-103', 'both', 'key-1', 'KEY-456');

      expect(mockFrom).toHaveBeenCalledWith('checkin_sessions');
    });

    it('should throw error when session not found', async () => {
      mockCheckinSessions = [];

      await expect(service.completeCheckin('nonexistent', 'room-101', 'mobile'))
        .rejects.toThrow('Session not found');
    });
  });

  // ==================================
  // PUSH NOTIFICATIONS TESTS
  // ==================================

  describe('registerPushToken', () => {
    it('should register push token with device info', async () => {
      await service.registerPushToken(
        'guest-1',
        'prop-1',
        'fcm-token-abc123',
        'android',
        {
          deviceId: 'device-123',
          deviceName: 'Google Pixel 8',
          appVersion: '2.1.0',
          osVersion: '14.0'
        }
      );

      expect(mockFrom).toHaveBeenCalledWith('push_registrations');
    });

    it('should register push token without device info', async () => {
      await service.registerPushToken(
        'guest-1',
        'prop-1',
        'apns-token-xyz789',
        'ios'
      );

      expect(mockFrom).toHaveBeenCalledWith('push_registrations');
    });
  });

  describe('sendPushNotification', () => {
    it('should send notification when registrations exist', async () => {
      mockPushRegistrations = [
        { id: 'reg-1', guest_id: 'guest-1', device_token: 'token-1', is_active: true },
        { id: 'reg-2', guest_id: 'guest-1', device_token: 'token-2', is_active: true }
      ];

      await service.sendPushNotification(
        'guest-1',
        'prop-1',
        'Welcome!',
        'Your room is ready',
        'room_ready',
        { type: 'open_screen', screen: 'mobile_key' },
        'booking-1'
      );

      expect(mockFrom).toHaveBeenCalledWith('push_registrations');
      expect(mockFrom).toHaveBeenCalledWith('push_notifications');
    });

    it('should not send notification when no registrations exist', async () => {
      mockPushRegistrations = [];

      await service.sendPushNotification(
        'guest-1',
        'prop-1',
        'Test',
        'Test body',
        'test_type'
      );

      // Should not create notification record
      const calls = mockFrom.mock.calls.filter((call: unknown[]) => call[0] === 'push_notifications');
      expect(calls.length).toBe(0);
    });
  });

  describe('sendCheckinReminder', () => {
    it('should send check-in reminder for valid booking', async () => {
      mockBookings = [{
        id: 'booking-1',
        guest_id: 'guest-1',
        property_id: 'prop-1',
        properties: { name: 'Beach Resort' }
      }];
      mockPushRegistrations = [
        { id: 'reg-1', guest_id: 'guest-1', is_active: true }
      ];

      await service.sendCheckinReminder('booking-1');

      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockFrom).toHaveBeenCalledWith('push_registrations');
    });

    it('should not send reminder when booking not found', async () => {
      mockBookings = [];

      await service.sendCheckinReminder('nonexistent');

      // Should return silently without creating notification
    });
  });

  describe('sendRoomReadyNotification', () => {
    it('should send room ready notification', async () => {
      mockBookings = [{
        id: 'booking-1',
        guest_id: 'guest-1',
        property_id: 'prop-1',
        properties: { name: 'Mountain Lodge' }
      }];
      mockPushRegistrations = [
        { id: 'reg-1', guest_id: 'guest-1', is_active: true }
      ];

      await service.sendRoomReadyNotification('booking-1', '301');

      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('should not send notification when booking not found', async () => {
      mockBookings = [];

      await service.sendRoomReadyNotification('nonexistent', '101');

      // Should return silently
    });
  });
});
