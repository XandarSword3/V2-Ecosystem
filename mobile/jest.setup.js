/**
 * Jest Setup File for V2 Resort Mobile App
 * 
 * Configures test environment with all necessary mocks for:
 * - React Native modules
 * - Expo modules (SecureStore, Notifications, Device, etc.)
 * - Navigation
 * - Async Storage
 * - NativeWind
 */

// Import testing library matchers
require('@testing-library/react-native');

// Create a shared storage object for SecureStore at module level
// This must be defined BEFORE jest.mock is hoisted
global.__secureStoreStorage = {};

// Mock expo-secure-store with a factory that uses the global storage
jest.mock('expo-secure-store', () => {
  // Access storage through global to bypass Jest hoisting issues
  const getStorage = () => global.__secureStoreStorage;
  
  return {
    getItemAsync: jest.fn(async (key) => {
      const storage = getStorage();
      return storage[key] !== undefined ? storage[key] : null;
    }),
    setItemAsync: jest.fn(async (key, value) => {
      const storage = getStorage();
      storage[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key) => {
      const storage = getStorage();
      delete storage[key];
    }),
    isAvailableAsync: jest.fn(async () => true),
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    _getStorage: () => getStorage(),
    _clearStorage: () => {
      const storage = getStorage();
      Object.keys(storage).forEach(key => delete storage[key]);
    },
  };
});

// Now import the mock
const SecureStore = require('expo-secure-store');

// Mock @react-native-async-storage/async-storage with its own module-level storage
jest.mock('@react-native-async-storage/async-storage', () => {
  let storage = {};
  
  const mockImpl = {
    getItem: jest.fn(async (key) => storage[key] || null),
    setItem: jest.fn(async (key, value) => {
      storage[key] = value;
    }),
    removeItem: jest.fn(async (key) => {
      delete storage[key];
    }),
    clear: jest.fn(async () => {
      storage = {};
    }),
    getAllKeys: jest.fn(async () => Object.keys(storage)),
    multiGet: jest.fn(async (keys) =>
      keys.map(key => [key, storage[key] || null])
    ),
    multiSet: jest.fn(async (pairs) => {
      pairs.forEach(([key, value]) => {
        storage[key] = value;
      });
    }),
    multiRemove: jest.fn(async (keys) => {
      keys.forEach(key => delete storage[key]);
    }),
    _clearStorage: () => {
      storage = {};
    },
  };
  
  mockImpl.default = mockImpl;
  return mockImpl;
});

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      releaseChannel: 'development',
    },
  },
  manifest: {
    extra: {},
  },
  default: {
    expoConfig: {
      extra: {
        releaseChannel: 'development',
      },
    },
    manifest: {
      extra: {},
    },
  },
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  applicationName: 'V2 Resort',
  applicationId: 'com.v2resort.mobile',
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'Apple',
  manufacturer: 'Apple',
  modelName: 'iPhone 14',
  deviceName: 'Test Device',
  deviceType: 2,
  osName: 'iOS',
  osVersion: '17.0',
  DeviceType: {
    UNKNOWN: 0,
    PHONE: 1,
    TABLET: 2,
    DESKTOP: 3,
    TV: 4,
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    expires: 'never',
    granted: true,
    canAskAgain: true,
  })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    type: 'expo',
    data: 'ExponentPushToken[mock-token-12345]',
  })),
  getDevicePushTokenAsync: jest.fn(async () => ({
    type: 'fcm',
    data: 'mock-fcm-token-12345',
  })),
  scheduleNotificationAsync: jest.fn(async () => 'notification-id'),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissAllNotificationsAsync: jest.fn(),
  getBadgeCountAsync: jest.fn(async () => 0),
  setBadgeCountAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 1,
    NONE: 2,
    MIN: 3,
    LOW: 4,
    DEFAULT: 5,
    HIGH: 6,
    MAX: 7,
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `v2resort://${path}`),
  parse: jest.fn((url) => ({ path: url, queryParams: {} })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(async () => null),
  openURL: jest.fn(),
  canOpenURL: jest.fn(async () => true),
  openSettings: jest.fn(),
}));

// Mock expo-tracking-transparency
jest.mock('expo-tracking-transparency', () => ({
  getTrackingPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  })),
  requestTrackingPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  })),
  isAvailable: jest.fn(() => true),
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
  hasStringAsync: jest.fn(async () => false),
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => true),
}));

// Router mock values
const mockRouterObject = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => false),
  navigate: jest.fn(),
  setParams: jest.fn(),
};

const mockSegmentsArray = [];
const mockPathnameValue = '/';
const mockParamsObject = {};

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => mockRouterObject,
  useLocalSearchParams: () => mockParamsObject,
  useGlobalSearchParams: () => mockParamsObject,
  useSegments: () => mockSegmentsArray,
  usePathname: () => mockPathnameValue,
  useFocusEffect: jest.fn((callback) => callback()),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => () => {}),
  }),
  Link: ({ children }) => children,
  Redirect: () => null,
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
  Slot: () => null,
  router: mockRouterObject,
}));

// Mock @stripe/stripe-react-native
jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({ children }) => children,
  useStripe: () => ({
    initPaymentSheet: jest.fn(async () => ({ error: null })),
    presentPaymentSheet: jest.fn(async () => ({ error: null })),
    confirmPayment: jest.fn(async () => ({ paymentIntent: { status: 'Succeeded' }, error: null })),
    createToken: jest.fn(async () => ({ token: { id: 'tok_test' }, error: null })),
    handleURLCallback: jest.fn(async () => true),
  }),
  CardField: () => null,
  CardForm: () => null,
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  return {
    Svg: ({ children }) => mockReact.createElement('Svg', null, children),
    Circle: (props) => mockReact.createElement('Circle', props),
    Ellipse: (props) => mockReact.createElement('Ellipse', props),
    G: ({ children }) => mockReact.createElement('G', null, children),
    Text: ({ children }) => mockReact.createElement('SvgText', null, children),
    TSpan: (props) => mockReact.createElement('TSpan', props),
    TextPath: (props) => mockReact.createElement('TextPath', props),
    Path: (props) => mockReact.createElement('Path', props),
    Polygon: (props) => mockReact.createElement('Polygon', props),
    Polyline: (props) => mockReact.createElement('Polyline', props),
    Line: (props) => mockReact.createElement('Line', props),
    Rect: (props) => mockReact.createElement('Rect', props),
    Use: (props) => mockReact.createElement('Use', props),
    Image: (props) => mockReact.createElement('SvgImage', props),
    Symbol: (props) => mockReact.createElement('Symbol', props),
    Defs: ({ children }) => mockReact.createElement('Defs', null, children),
    LinearGradient: (props) => mockReact.createElement('LinearGradient', props),
    RadialGradient: (props) => mockReact.createElement('RadialGradient', props),
    Stop: (props) => mockReact.createElement('Stop', props),
    ClipPath: (props) => mockReact.createElement('ClipPath', props),
    Pattern: (props) => mockReact.createElement('Pattern', props),
    Mask: (props) => mockReact.createElement('Mask', props),
    default: ({ children }) => mockReact.createElement('Svg', null, children),
  };
});

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => {
  const mockReact = require('react');
  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === '__esModule') return true;
      return (props) => mockReact.createElement('Icon', { name: prop, ...props });
    },
  });
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const mockReanimated = require('react-native-reanimated/mock');
  mockReanimated.default.call = () => {};
  return mockReanimated;
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => mockReact.createElement('SafeAreaView', null, children),
    useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 44, right: 0, bottom: 34, left: 0 },
    },
  };
});

// Mock NativeWind styling
jest.mock('nativewind', () => ({
  styled: (Component) => Component,
  useColorScheme: () => ({ colorScheme: 'light', toggleColorScheme: jest.fn() }),
}));

// Global helpers
global.mockRouter = mockRouterObject;

// Global helper to clear all mock storage
global.clearAllMockStorage = () => {
  // Clear SecureStore mock storage
  const SecureStore = require('expo-secure-store');
  if (SecureStore._clearStorage) {
    SecureStore._clearStorage();
  }
  
  // Clear AsyncStorage mock storage  
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  if (AsyncStorage._clearStorage) {
    AsyncStorage._clearStorage();
  }
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Clear SecureStore mock storage
  if (SecureStore._clearStorage) {
    SecureStore._clearStorage();
  }
  
  // Clear AsyncStorage mock storage  
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  if (AsyncStorage._clearStorage) {
    AsyncStorage._clearStorage();
  }
});

// Silence specific console warnings that clutter test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render') ||
      args[0]?.includes?.('Warning: An update to') ||
      args[0]?.includes?.('Warning: Cannot update a component') ||
      args[0]?.includes?.('act(...)') ||
      args[0]?.includes?.('not wrapped in act')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      args[0]?.includes?.('Animated: `useNativeDriver`') ||
      args[0]?.includes?.('componentWillReceiveProps') ||
      args[0]?.includes?.('componentWillMount') ||
      args[0]?.includes?.('Require cycle')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
