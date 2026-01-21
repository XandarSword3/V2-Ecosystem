/**
 * Root Layout
 * 
 * App entry point using expo-router.
 * Handles:
 * - Auth state initialization
 * - Splash screen
 * - Font loading
 * - Stripe provider (native only)
 * - Push notification setup
 */

import { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../global.css';

import { useAuthStore } from '../src/store/auth';
import { STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_ID } from '../src/config/env';
import { 
  registerDevice, 
  setupNotificationListeners,
  getInitialNotification,
  handleNotificationData 
} from '../src/services/push-notifications';
import {
  setupDeepLinkListener,
  getInitialURL,
  handleDeepLink
} from '../src/services/deep-linking';

// Conditionally import Stripe for native platforms only
let StripeProvider: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  // Dynamic import for native platforms
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
}

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

/**
 * Auth guard - redirect based on auth state
 */
function useProtectedRoute() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated but in auth group
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isInitialized, segments]);
}

import { useThemeSync } from '../src/hooks/useTheme';

export default function RootLayout() {
  const { initialize, isInitialized, isAuthenticated } = useAuthStore();
  useThemeSync(); // Sync theme on load

  // Initialize auth state
  useEffect(() => {
    initialize();
  }, []);

  // Setup push notifications after auth
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    // Register device for push notifications
    registerDevice();

    // Setup notification listeners
    const unsubscribeNotifications = setupNotificationListeners();

    // Check for initial notification (app opened from notification)
    getInitialNotification().then((notification) => {
      if (notification) {
        const data = notification.notification.request.content.data;
        handleNotificationData(data as Record<string, any>);
      }
    });

    return () => {
      unsubscribeNotifications();
    };
  }, [isInitialized, isAuthenticated]);

  // Setup deep linking
  useEffect(() => {
    const unsubscribeDeepLink = setupDeepLinkListener();

    // Check for initial deep link
    getInitialURL().then((url) => {
      if (url) {
        // Delay to ensure navigation is ready
        setTimeout(() => {
          handleDeepLink(url);
        }, 100);
      }
    });

    return () => {
      unsubscribeDeepLink();
    };
  }, []);

  // Hide splash screen when ready
  const onLayoutRootView = useCallback(async () => {
    if (isInitialized) {
      await SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Use auth protection
  useProtectedRoute();

  if (!isInitialized) {
    return null;
  }

  // Wrapper component for Stripe (only on native)
  const AppContent = (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {Platform.OS !== 'web' && StripeProvider ? (
          <StripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier={STRIPE_MERCHANT_ID}
            urlScheme="v2resort"
          >
            {AppContent}
          </StripeProvider>
        ) : (
          AppContent
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
