/**
 * Tabs Layout (Main App Navigation)
 * Refactored for V2 Design System
 */

import { Tabs } from 'expo-router';
import { Home, UtensilsCrossed, Waves, BedDouble, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Fallback Palette for TabBar (NativeWind classes don't apply to screenOptions directly in v2 without workarounds)
  // We use the hex codes defined in Strategy/Global CSS
  const colors = {
    active: '#0ea5e9',   // Primary 500
    inactive: isDark ? '#94a3b8' : '#64748b', // Slate 400/500
    bg: isDark ? '#0f172a' : '#ffffff',       // Slate 900 / White
    border: isDark ? '#1e293b' : '#e2e8f0',   // Slate 800 / 200
  };

  // Dynamic tab bar height based on safe area
  const TAB_BAR_BASE_HEIGHT = 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      
      {/* Dynamic Module: Dining */}
      <Tabs.Screen
        name="restaurant"
        options={{
          title: 'Dining',
          tabBarIcon: ({ color, size }) => (
            <UtensilsCrossed size={size} color={color} />
          ),
        }}
      />
      
      {/* Dynamic Module: Pool */}
      <Tabs.Screen
        name="pool"
        options={{
          title: 'Pool',
          tabBarIcon: ({ color, size }) => (
            <Waves size={size} color={color} />
          ),
        }}
      />
      
      {/* Dynamic Module: Chalets */}
      <Tabs.Screen
        name="chalets"
        options={{
          title: 'Chalets',
          tabBarIcon: ({ color, size }) => (
            <BedDouble size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="account"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
