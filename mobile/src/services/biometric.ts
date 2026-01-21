/**
 * Biometric Authentication Service
 * 
 * Provides biometric authentication using device Face ID, Touch ID, or fingerprint.
 * Uses expo-local-authentication for native biometric capabilities.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Storage keys for biometric settings
const BIOMETRIC_KEYS = {
  ENABLED: 'v2_biometric_enabled',
  CREDENTIALS: 'v2_biometric_credentials',
} as const;

// Types
export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometricTypes: BiometricType[];
  isEnrolled: boolean;
  securityLevel: 'none' | 'secret' | 'biometric';
}

export interface BiometricCredentials {
  email: string;
  encryptedPassword: string;
  createdAt: string;
}

// Result types
export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Biometric Authentication Service
 */
export const biometricService = {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      const biometricTypes: BiometricType[] = supportedTypes.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'facial';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'none';
        }
      }).filter(t => t !== 'none');

      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
      
      let securityLevelString: 'none' | 'secret' | 'biometric' = 'none';
      if (securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
          securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK) {
        securityLevelString = 'biometric';
      } else if (securityLevel === LocalAuthentication.SecurityLevel.SECRET) {
        securityLevelString = 'secret';
      }

      return {
        isAvailable: hasHardware,
        biometricTypes,
        isEnrolled,
        securityLevel: securityLevelString,
      };
    } catch (error) {
      console.error('Failed to check biometric capabilities:', error);
      return {
        isAvailable: false,
        biometricTypes: [],
        isEnrolled: false,
        securityLevel: 'none',
      };
    }
  },

  /**
   * Get a human-readable name for the biometric type
   */
  getBiometricName(types: BiometricType[]): string {
    if (types.includes('facial')) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    if (types.includes('fingerprint')) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    if (types.includes('iris')) {
      return 'Iris Recognition';
    }
    return 'Biometric';
  },

  /**
   * Prompt user for biometric authentication
   */
  async authenticate(options?: {
    promptMessage?: string;
    cancelLabel?: string;
    fallbackLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.checkCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication not available',
          errorCode: 'not_available',
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: 'No biometrics enrolled on device',
          errorCode: 'not_enrolled',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: options?.promptMessage || 'Authenticate to continue',
        cancelLabel: options?.cancelLabel || 'Cancel',
        fallbackLabel: options?.fallbackLabel || 'Use Password',
        disableDeviceFallback: options?.disableDeviceFallback ?? false,
      });

      if (result.success) {
        return { success: true };
      }

      // Map error codes
      let errorCode = 'unknown';
      let errorMessage = 'Authentication failed';

      if (result.error === 'user_cancel') {
        errorCode = 'user_cancel';
        errorMessage = 'Authentication cancelled';
      } else if (result.error === 'system_cancel') {
        errorCode = 'system_cancel';
        errorMessage = 'System cancelled authentication';
      } else if (result.error === 'not_enrolled') {
        errorCode = 'not_enrolled';
        errorMessage = 'No biometrics enrolled';
      } else if (result.error === 'lockout') {
        errorCode = 'lockout';
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (result.error === 'lockout_permanent') {
        errorCode = 'lockout_permanent';
        errorMessage = 'Biometric locked. Please unlock device first.';
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
        errorCode: 'error',
      };
    }
  },

  /**
   * Check if biometric login is enabled for this user
   */
  async isBiometricLoginEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEYS.ENABLED);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Enable biometric login by storing encrypted credentials
   * Note: This requires user to authenticate with biometrics first
   */
  async enableBiometricLogin(email: string, password: string): Promise<BiometricAuthResult> {
    try {
      // First verify biometric authentication
      const authResult = await this.authenticate({
        promptMessage: 'Authenticate to enable biometric login',
      });

      if (!authResult.success) {
        return authResult;
      }

      // Store credentials securely
      const credentials: BiometricCredentials = {
        email,
        encryptedPassword: password, // Note: In production, consider additional encryption
        createdAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(
        BIOMETRIC_KEYS.CREDENTIALS,
        JSON.stringify(credentials),
        {
          keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        }
      );

      await SecureStore.setItemAsync(BIOMETRIC_KEYS.ENABLED, 'true');

      return { success: true };
    } catch (error: any) {
      console.error('Failed to enable biometric login:', error);
      return {
        success: false,
        error: error.message || 'Failed to enable biometric login',
        errorCode: 'storage_error',
      };
    }
  },

  /**
   * Disable biometric login
   */
  async disableBiometricLogin(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.ENABLED);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.CREDENTIALS);
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
    }
  },

  /**
   * Get stored credentials after successful biometric authentication
   */
  async getBiometricCredentials(): Promise<BiometricCredentials | null> {
    try {
      // First authenticate with biometrics
      const authResult = await this.authenticate({
        promptMessage: 'Sign in with biometrics',
      });

      if (!authResult.success) {
        return null;
      }

      // Retrieve stored credentials
      const credentialsJson = await SecureStore.getItemAsync(BIOMETRIC_KEYS.CREDENTIALS);
      
      if (!credentialsJson) {
        return null;
      }

      return JSON.parse(credentialsJson);
    } catch (error) {
      console.error('Failed to get biometric credentials:', error);
      return null;
    }
  },

  /**
   * Clear all biometric data (for logout)
   */
  async clearBiometricData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.ENABLED);
      await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.CREDENTIALS);
    } catch (error) {
      console.error('Failed to clear biometric data:', error);
    }
  },
};

export default biometricService;
