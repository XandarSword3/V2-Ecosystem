/**
 * Shared test mocks for Next.js page tests.
 * Import this file to get all common mocks pre-configured.
 */
import { vi } from 'vitest';

// ─── Setup Global Mocks ───────────────────────────────
// IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// ─── next-intl ──────────────────────────────────────────
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: any) => children,
}));

// ─── next/navigation ────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
  useParams: () => ({}),
}));

// ─── next/link ──────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    // next/link wraps children in an anchor
    return <a href={href} {...props}>{children}</a>;
  },
}));

// ─── next/image ─────────────────────────────────────────
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

// ─── next/dynamic ───────────────────────────────────────
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<any>) => {
    // Return a simple component that renders nothing
    return function DynamicComponent(props: any) {
      return <div data-testid="dynamic-component" />;
    };
  },
}));

// ─── framer-motion ──────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      // Return a component that renders the HTML element
      return ({ children, initial, animate, exit, variants, whileHover, whileTap, whileInView, transition, ...rest }: any) => {
        const Component = prop as string;
        return <Component {...rest}>{children}</Component>;
      };
    },
  }),
  AnimatePresence: ({ children }: any) => children,
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => 0,
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useSpring: () => ({ get: () => 0 }),
  useInView: () => true,
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

// ─── sonner ─────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

// ─── @/lib/settings-context ─────────────────────────────
const mockSettings = {
  propertyName: 'Test Property',
  phone: '+1-555-0100',
  email: 'test@v2-hub.com',
  address: '123 Resort Rd',
  receptionHours: '24/7',
  currency: 'USD',
  privacyPolicy: '',
  termsOfService: '',
  refundPolicy: '',
  logoUrl: '/logo.png',
  tagline: 'Luxury resort',
};
vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    settings: mockSettings,
    modules: [],
    isLoading: false,
  }),
  SettingsProvider: ({ children }: any) => children,
}));

// ─── @/lib/auth-context ─────────────────────────────────
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockVerify2FA = vi.fn();
const mockUseAuth = vi.fn(() => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: mockLogin,
  logout: mockLogout,
  verify2FA: mockVerify2FA,
  register: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: any) => children,
}));

// ─── @/lib/api ──────────────────────────────────────────
const mockApiGet = vi.fn().mockResolvedValue({ data: { data: [] } });
const mockApiPost = vi.fn().mockResolvedValue({ data: { success: true } });
const mockApiPut = vi.fn().mockResolvedValue({ data: { success: true } });
const mockApiDelete = vi.fn().mockResolvedValue({ data: { success: true } });
vi.mock('@/lib/api', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    delete: mockApiDelete,
  },
  API_BASE_URL: 'http://localhost:3005',
  restaurantApi: {
    getMenu: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getCategories: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  chaletsApi: {
    getAccommodationUnits: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getAvailability: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  poolApi: {
    getSessions: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getAvailability: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  snackApi: {
    getMenu: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

// ─── @/stores/cartStore ─────────────────────────────
vi.mock('@/stores/cartStore', () => ({
  useCartStore: (selector?: any) => {
    const state = {
      items: [],
      addItem: vi.fn(),
      removeItem: vi.fn(),
      updateQuantity: vi.fn(),
      getTotal: () => 0,
      clearCart: vi.fn(),
      getRestaurantTotal: () => 0,
      getSnackTotal: () => 0,
      getRestaurantCount: () => 0,
      getSnackCount: () => 0,
    };
    return selector ? selector(state) : state;
  },
}));

// ─── @/stores/settingsStore ─────────────────────────
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector?: any) => {
    const state = {
      currency: 'USD',
      language: 'en',
      theme: 'light',
    };
    return selector ? selector(state) : state;
  },
}));

// ─── @/lib/utils ────────────────────────────────────────
// We let the real utils run since they're pure functions
// But mock formatCurrency to avoid currency locale issues in test
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    formatCurrency: (amount: number, currency?: string) => `$${amount.toFixed(2)}`,
  };
});

// ─── @/lib/translate ────────────────────────────────────
vi.mock('@/lib/translate', () => ({
  useContentTranslation: () => ({
    ct: (obj: any, field: string) => obj?.[field] || '',
  }),
}));

// ─── @tanstack/react-query ──────────────────────────────
class MockQueryClient {
  constructor() {
    return {
      mount: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
      resetQueries: vi.fn(),
      clear: vi.fn(),
    };
  }
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    resetQueries: vi.fn(),
    clear: vi.fn(),
    refetchQueries: vi.fn(),
  }),
  QueryClient: MockQueryClient,
  QueryClientProvider: ({ children }: any) => children,
}));

// ─── @/hooks/useSocket ──────────────────────────────────
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), once: vi.fn() },
    isConnected: true,
  }),
}));

// ─── @/lib/socket ───────────────────────────────────────
vi.mock('@/lib/socket', () => ({
  getSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), once: vi.fn() }),
  initSocket: vi.fn(),
  useSocket: () => ({
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), once: vi.fn() },
    isConnected: true,
  }),
  useRestaurantOrders: vi.fn(),
  usePoolUpdates: vi.fn(),
  useOrderUpdates: vi.fn(),
  useBookingUpdates: vi.fn(),
}));

// ─── @/lib/animations/presets ───────────────────────────
vi.mock('@/lib/animations/presets', () => ({
  fadeInUp: {},
  fadeIn: {},
  staggerContainer: {},
  slideIn: {},
  scaleIn: {},
}));

// ─── @/components/effects/* ─────────────────────────────
vi.mock('@/components/effects/LoadingScreen', () => ({
  LoadingScreenWrapper: ({ children }: any) => children,
  LoadingScreen: () => null,
}));

vi.mock('@/components/effects/WeatherEffects', () => ({
  WeatherEffects: () => null,
}));

// Premium effect components often imported by pages
vi.mock('@/components/effects/Card3D', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  Card3D: ({ children }: any) => <div>{children}</div>,
  FloatingCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/effects/SpotlightCard', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  SpotlightCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/effects/TextEffects', () => ({
  default: ({ children, text }: any) => <span>{text || children}</span>,
  AnimatedText: ({ children, text }: any) => <span>{text || children}</span>,
  GradientText: ({ children }: any) => <span>{children}</span>,
  BlurReveal: ({ children }: any) => <div>{children}</div>,
  RevealHeading: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock('@/components/effects/AnimatedCounter', () => ({
  default: ({ value }: any) => <span>{value}</span>,
  AnimatedCounter: ({ value }: any) => <span>{value}</span>,
  AnimatedStatsRow: ({ stats }: any) => <div>Stats</div>,
}));

vi.mock('@/components/effects/Aurora', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  Aurora: ({ children }: any) => <div>{children}</div>,
  AuroraBackground: ({ children }: any) => <div>{children}</div>,
  AuroraSection: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/effects/BentoGrid', () => ({
  default: ({ children }: any) => <div>{children}</div>,
  BentoGrid: ({ children }: any) => <div>{children}</div>,
}));

// ─── @/i18n ─────────────────────────────────────────────
vi.mock('@/i18n', () => ({
  getLocaleFromCookie: () => 'en',
  defaultLocale: 'en',
}));

// ─── @/lib/hydrate-settings ─────────────────────────────
vi.mock('@/lib/hydrate-settings', () => ({
  HydrateSettingsFromBackend: () => null,
}));

// ─── @/components/ThemeProvider ──────────────────────────
vi.mock('@/components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => children,
}));

// ─── @/components/ThemeInjector ─────────────────────────
vi.mock('@/components/ThemeInjector', () => ({
  ThemeInjector: () => null,
}));

// ─── @/components/DirectionSync ─────────────────────────
vi.mock('@/components/DirectionSync', () => ({
  DirectionSync: () => null,
  default: () => null,
}));

// ─── @/components/PageTracker ───────────────────────────
vi.mock('@/components/PageTracker', () => ({
  PageTracker: () => null,
}));

// ─── @/components/pwa ───────────────────────────────────
vi.mock('@/components/pwa', () => ({
  PWAPrompt: () => null,
}));

// ─── @/lib/module-utils ─────────────────────────────────
vi.mock('@/lib/module-utils', () => ({
  getActiveModules: () => [],
  isModuleActive: () => true,
  getModuleBySlug: () => null,
  getMainPageModules: () => [],
}));

// ─── @/stores/authStore ─────────────────────────────────
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    user: null,
    setUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ─── @/hooks/useIdleTimer ───────────────────────────────
vi.mock('@/hooks/useIdleTimer', () => ({
  useIdleTimer: () => ({
    isWarningActive: false,
    remainingSeconds: 300,
    extendSession: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ─── @/components/customer/GiftCardPurchase ──────────────
vi.mock('@/components/customer/GiftCardPurchase', () => ({
  GiftCardPurchase: () => <div>GiftCardPurchase</div>,
  GiftCardBalance: () => <div>GiftCardBalance</div>,
}));

// ─── @/components/module-builder/DynamicModuleRenderer ───
vi.mock('@/components/module-builder/DynamicModuleRenderer', () => ({
  DynamicModuleRenderer: () => <div>DynamicModuleRenderer</div>,
}));

// ─── @/config/admin-navigation ─────────────────────────
vi.mock('@/config/admin-navigation', () => ({
  getStaticNavigation: () => [],
  getModuleChildren: () => [],
  moduleTypeIcons: {},
  filterNavigationByRole: () => [],
  flattenNavigation: () => [],
  getInitialExpandedCategories: () => [],
  saveExpandedCategories: vi.fn(),
  SIDEBAR_EXPANDED_KEY: 'sidebar_expanded',
}));

// ─── @/components/ThemeToggle ─────────────────────────
vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div>ThemeToggle</div>,
}));

// ─── @/components/LanguageSwitcher ─────────────────────────
vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div>LanguageSwitcher</div>,
}));

// ─── @/components/CurrencySwitcher ─────────────────────────
vi.mock('@/components/CurrencySwitcher', () => ({
  CurrencySwitcher: () => <div>CurrencySwitcher</div>,
}));

// ─── Global fetch mock ──────────────────────────────────
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, data: {} }),
});
vi.stubGlobal('fetch', mockFetch);

// ─── Export mocks for test assertions ───────────────────
export {
  mockPush,
  mockReplace,
  mockBack,
  mockLogin,
  mockLogout,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiDelete,
  mockSettings,
  mockFetch,
  mockSearchParams,
  mockUseAuth,
};
