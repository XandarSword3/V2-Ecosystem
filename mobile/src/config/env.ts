/**
 * Environment Configuration
 * 
 * Uses Expo Constants to load environment-specific values.
 * Configure in app.json extra or eas.json for EAS builds.
 */

import Constants from 'expo-constants';

// Default values for development
const ENV = {
  development: {
    API_BASE_URL: 'http://192.168.10.154:3005',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',
    STRIPE_MERCHANT_ID: 'merchant.com.v2resort',
    SENTRY_DSN: '',
  },
  staging: {
    API_BASE_URL: 'https://staging-api.v2resort.com',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',
    STRIPE_MERCHANT_ID: 'merchant.com.v2resort',
    SENTRY_DSN: '',
  },
  production: {
    API_BASE_URL: 'https://api.v2resort.com',
    STRIPE_PUBLISHABLE_KEY: 'pk_live_xxx',
    STRIPE_MERCHANT_ID: 'merchant.com.v2resort',
    SENTRY_DSN: '',
  },
};

// Get current environment
type Environment = keyof typeof ENV;
const getEnvironment = (): Environment => {
  const releaseChannel = Constants.expoConfig?.extra?.releaseChannel;
  
  if (releaseChannel === 'production') return 'production';
  if (releaseChannel === 'staging') return 'staging';
  
  // Use __DEV__ for development detection
  if (__DEV__) return 'development';
  
  return 'production';
};

const environment = getEnvironment();
const config = ENV[environment];

// Export configuration values
export const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiBaseUrl || 
  config.API_BASE_URL;

export const STRIPE_PUBLISHABLE_KEY = 
  Constants.expoConfig?.extra?.stripePublishableKey || 
  config.STRIPE_PUBLISHABLE_KEY;

export const STRIPE_MERCHANT_ID = 
  Constants.expoConfig?.extra?.stripeMerchantId || 
  config.STRIPE_MERCHANT_ID;

export const SENTRY_DSN = 
  Constants.expoConfig?.extra?.sentryDsn || 
  config.SENTRY_DSN;

export const IS_DEVELOPMENT = environment === 'development';
export const IS_STAGING = environment === 'staging';
export const IS_PRODUCTION = environment === 'production';

export const CURRENT_ENVIRONMENT = environment;

export default {
  API_BASE_URL,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_MERCHANT_ID,
  SENTRY_DSN,
  IS_DEVELOPMENT,
  IS_STAGING,
  IS_PRODUCTION,
  CURRENT_ENVIRONMENT,
};
