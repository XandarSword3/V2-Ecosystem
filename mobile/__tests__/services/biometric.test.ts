/**
 * Biometric Service Tests
 */
import { biometricService, BiometricCapabilities } from '../../src/services/biometric';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// The mocks are set up in jest.setup.js

describe('biometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCapabilities', () => {
    it('should return capabilities when biometrics available', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
      );

      const result = await biometricService.checkCapabilities();

      expect(result.isAvailable).toBe(true);
      expect(result.isEnrolled).toBe(true);
      expect(result.biometricTypes).toContain('fingerprint');
      expect(result.securityLevel).toBe('biometric');
    });

    it('should return not available when no hardware', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([]);
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.NONE
      );

      const result = await biometricService.checkCapabilities();

      expect(result.isAvailable).toBe(false);
      expect(result.isEnrolled).toBe(false);
      expect(result.biometricTypes).toEqual([]);
    });

    it('should handle facial recognition', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(
        LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK
      );

      const result = await biometricService.checkCapabilities();

      expect(result.biometricTypes).toContain('facial');
      expect(result.securityLevel).toBe('biometric');
    });

    it('should handle errors gracefully', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockRejectedValue(new Error('Test error'));

      const result = await biometricService.checkCapabilities();

      expect(result.isAvailable).toBe(false);
      expect(result.biometricTypes).toEqual([]);
      expect(result.securityLevel).toBe('none');
    });
  });

  describe('getBiometricName', () => {
    it('should return name for facial type', () => {
      const name = biometricService.getBiometricName(['facial']);
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    });

    it('should return name for fingerprint type', () => {
      const name = biometricService.getBiometricName(['fingerprint']);
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
    });

    it('should return Biometric for no types', () => {
      const name = biometricService.getBiometricName([]);
      expect(name).toBe('Biometric');
    });

    it('should return name for iris type', () => {
      const name = biometricService.getBiometricName(['iris']);
      expect(name).toBe('Iris Recognition');
    });
  });

  describe('isBiometricLoginEnabled', () => {
    it('should return true when enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('v2_biometric_enabled');
    });

    it('should return false when not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(false);
    });

    it('should handle errors and return false', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Test'));

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(false);
    });
  });

  describe('authenticate', () => {
    beforeEach(() => {
      // Setup capabilities to be available
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([1]);
      (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(3);
    });

    it('should authenticate successfully', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result = await biometricService.authenticate();

      expect(result.success).toBe(true);
    });

    it('should fail when biometrics not available', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

      const result = await biometricService.authenticate();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('not_available');
    });

    it('should fail when not enrolled', async () => {
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

      const result = await biometricService.authenticate();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('not_enrolled');
    });

    it('should handle user cancellation', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.authenticate();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('user_cancel');
    });

    it('should handle authentication errors', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValue(new Error('Test'));

      const result = await biometricService.authenticate();

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('error');
    });
  });
});
