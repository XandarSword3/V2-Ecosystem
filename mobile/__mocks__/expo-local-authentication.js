/**
 * Mock for expo-local-authentication
 * 
 * Provides mock implementations for biometric authentication testing
 */

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

export const SecurityLevel = {
  NONE: 0,
  SECRET: 1,
  BIOMETRIC_WEAK: 2,
  BIOMETRIC_STRONG: 3,
};

// Mock state for controlling test behavior
let mockState = {
  hasHardware: true,
  isEnrolled: true,
  supportedTypes: [AuthenticationType.FINGERPRINT],
  securityLevel: SecurityLevel.BIOMETRIC_STRONG,
  authSuccess: true,
  authError: null,
};

export const __setMockState = (state) => {
  mockState = { ...mockState, ...state };
};

export const __resetMockState = () => {
  mockState = {
    hasHardware: true,
    isEnrolled: true,
    supportedTypes: [AuthenticationType.FINGERPRINT],
    securityLevel: SecurityLevel.BIOMETRIC_STRONG,
    authSuccess: true,
    authError: null,
  };
};

export const hasHardwareAsync = jest.fn().mockImplementation(async () => {
  return mockState.hasHardware;
});

export const isEnrolledAsync = jest.fn().mockImplementation(async () => {
  return mockState.isEnrolled;
});

export const supportedAuthenticationTypesAsync = jest.fn().mockImplementation(async () => {
  return mockState.supportedTypes;
});

export const getEnrolledLevelAsync = jest.fn().mockImplementation(async () => {
  return mockState.securityLevel;
});

export const authenticateAsync = jest.fn().mockImplementation(async (options?: {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
}) => {
  if (mockState.authSuccess) {
    return { success: true };
  }
  return {
    success: false,
    error: mockState.authError || 'user_cancel',
  };
});

export default {
  AuthenticationType,
  SecurityLevel,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  getEnrolledLevelAsync,
  authenticateAsync,
  __setMockState,
  __resetMockState,
};
