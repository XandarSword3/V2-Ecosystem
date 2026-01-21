/**
 * Type declarations for expo-local-authentication mock
 */
declare module 'expo-local-authentication' {
  export enum AuthenticationType {
    FINGERPRINT = 1,
    FACIAL_RECOGNITION = 2,
    IRIS = 3,
  }

  export enum SecurityLevel {
    NONE = 0,
    SECRET = 1,
    BIOMETRIC_WEAK = 2,
    BIOMETRIC_STRONG = 3,
  }

  export interface LocalAuthenticationOptions {
    promptMessage?: string;
    cancelLabel?: string;
    fallbackLabel?: string;
    disableDeviceFallback?: boolean;
    requireConfirmation?: boolean;
  }

  export interface LocalAuthenticationResult {
    success: boolean;
    error?: string;
    warning?: string;
  }

  export function hasHardwareAsync(): Promise<boolean>;
  export function isEnrolledAsync(): Promise<boolean>;
  export function getEnrolledLevelAsync(): Promise<SecurityLevel>;
  export function supportedAuthenticationTypesAsync(): Promise<AuthenticationType[]>;
  export function authenticateAsync(options?: LocalAuthenticationOptions): Promise<LocalAuthenticationResult>;
  export function cancelAuthenticate(): Promise<void>;
  
  // Mock helpers
  export function __setMockState(state: Partial<{
    hasHardware: boolean;
    isEnrolled: boolean;
    supportedTypes: AuthenticationType[];
    securityLevel: SecurityLevel;
    authSuccess: boolean;
    authError: string | null;
  }>): void;
  export function __resetMockState(): void;
}
