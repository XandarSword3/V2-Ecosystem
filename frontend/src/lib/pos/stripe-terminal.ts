/**
 * Stripe Terminal Integration Service
 * 
 * Provides integration with Stripe Terminal for hardware POS:
 * - Reader discovery and connection
 * - Payment collection
 * - Reader status management
 */

import { loadStripeTerminal, Terminal } from '@stripe/terminal-js';
import api from '@/lib/api';

// Types
interface Reader {
  id: string;
  object: 'terminal.reader';
  device_type: string;
  label: string;
  location: string | null;
  serial_number: string;
  status: 'online' | 'offline';
  ip_address?: string;
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface TerminalConfig {
  locationId?: string;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onPaymentStatusChange?: (status: PaymentStatus) => void;
  onUnexpectedReaderDisconnect?: (reader: Reader) => void;
}

type ConnectionStatus = 'not_connected' | 'connecting' | 'connected';
type PaymentStatus = 'not_ready' | 'ready' | 'waiting_for_input' | 'processing';

// Singleton terminal instance
let terminal: Terminal | null = null;
let currentReader: Reader | null = null;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

/**
 * Initialize Stripe Terminal
 */
export async function initializeTerminal(config: TerminalConfig = {}): Promise<Terminal> {
  if (terminal) {
    return terminal;
  }

  const stripeTerminal = await loadStripeTerminal();
  
  if (!stripeTerminal) {
    throw new Error('Failed to load Stripe Terminal SDK');
  }

  terminal = stripeTerminal.create({
    onFetchConnectionToken: fetchConnectionToken,
    onUnexpectedReaderDisconnect: (event) => {
      console.error('Reader unexpectedly disconnected:', event);
      currentReader = null;
      // The event contains error info, not the reader directly
      config.onUnexpectedReaderDisconnect?.({} as Reader);
    },
    onConnectionStatusChange: (event) => {
      console.log('Connection status:', event.status);
      config.onConnectionStatusChange?.(event.status as ConnectionStatus);
    },
    onPaymentStatusChange: (event) => {
      console.log('Payment status:', event.status);
      config.onPaymentStatusChange?.(event.status as PaymentStatus);
    },
  });

  return terminal;
}

/**
 * Fetch connection token from server
 */
async function fetchConnectionToken(): Promise<string> {
  const response = await api.post('/payments/terminal/connection-token');
  return response.data.secret;
}

/**
 * Discover available readers
 */
export async function discoverReaders(options: {
  simulated?: boolean;
  locationId?: string;
} = {}): Promise<Reader[]> {
  if (!terminal) {
    throw new Error('Terminal not initialized');
  }

  const config: any = {
    simulated: options.simulated || false,
  };

  if (options.locationId) {
    config.location = options.locationId;
  }

  const result = await terminal.discoverReaders(config);

  if ('error' in result) {
    throw new Error(result.error.message);
  }

  return result.discoveredReaders as Reader[];
}

/**
 * Connect to a reader
 */
export async function connectReader(reader: Reader): Promise<Reader> {
  if (!terminal) {
    throw new Error('Terminal not initialized');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await terminal.connectReader(reader as any);

  if ('error' in result) {
    throw new Error(result.error.message);
  }

  currentReader = result.reader as Reader;
  return currentReader;
}

/**
 * Disconnect from current reader
 */
export async function disconnectReader(): Promise<void> {
  if (!terminal) {
    throw new Error('Terminal not initialized');
  }

  await terminal.disconnectReader();
  currentReader = null;
}

/**
 * Get currently connected reader
 */
export function getConnectedReader(): Reader | null {
  return currentReader;
}

/**
 * Create a payment intent on the server
 */
async function createPaymentIntent(options: {
  amount: number;
  currency?: string;
  orderId?: string;
  metadata?: Record<string, string>;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const response = await api.post('/payments/terminal/payment-intent', {
    amount: options.amount,
    currency: options.currency || 'usd',
    orderId: options.orderId,
    metadata: options.metadata,
  });

  return response.data;
}

/**
 * Collect payment with terminal
 */
export async function collectPayment(options: {
  amount: number;
  currency?: string;
  orderId?: string;
  metadata?: Record<string, string>;
  skipTipping?: boolean;
}): Promise<PaymentIntent> {
  if (!terminal || !currentReader) {
    throw new Error('No reader connected');
  }

  // Create payment intent on server
  const { clientSecret, paymentIntentId } = await createPaymentIntent({
    amount: options.amount,
    currency: options.currency,
    orderId: options.orderId,
    metadata: options.metadata,
  });

  // Collect payment method
  const collectConfig: any = {
    skip_tipping: options.skipTipping ?? false,
  };

  const collectResult = await terminal.collectPaymentMethod(clientSecret, collectConfig);

  if ('error' in collectResult) {
    throw new Error(collectResult.error.message);
  }

  // Process payment
  const processResult = await terminal.processPayment(collectResult.paymentIntent);

  if ('error' in processResult) {
    throw new Error(processResult.error.message);
  }

  // Capture the payment on server
  await capturePayment(paymentIntentId);

  return processResult.paymentIntent as PaymentIntent;
}

/**
 * Capture payment on server
 */
async function capturePayment(paymentIntentId: string): Promise<void> {
  await api.post('/payments/terminal/capture', { paymentIntentId });
}

/**
 * Cancel current payment collection
 */
export async function cancelPayment(): Promise<void> {
  if (!terminal) {
    throw new Error('Terminal not initialized');
  }

  await terminal.cancelCollectPaymentMethod();
}

/**
 * Set reader display message
 */
export async function setReaderDisplay(options: {
  type: 'cart';
  cart: {
    line_items: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
    tax?: number;
    total: number;
    currency: string;
  };
}): Promise<void> {
  if (!terminal || !currentReader) {
    throw new Error('No reader connected');
  }

  const result = await terminal.setReaderDisplay(options);

  if (result && 'error' in result) {
    throw new Error(result.error.message);
  }
}

/**
 * Clear reader display
 */
export async function clearReaderDisplay(): Promise<void> {
  if (!terminal || !currentReader) {
    throw new Error('No reader connected');
  }

  const result = await terminal.clearReaderDisplay();

  if (result && 'error' in result) {
    throw new Error(result.error.message);
  }
}

/**
 * Collect signature (for readers that support it)
 */
export async function collectSignature(): Promise<string | null> {
  if (!terminal || !currentReader) {
    throw new Error('No reader connected');
  }

  // Check if reader supports signature collection
  if (!['bbpos_wisepos_e', 'stripe_s700'].includes(currentReader.device_type)) {
    return null;
  }

  // Note: Signature collection is handled automatically during payment
  // This is a placeholder for manual signature collection if needed
  return null;
}

/**
 * Simulate reader events (for testing)
 */
export async function simulateReaderEvent(event: string): Promise<void> {
  if (!terminal) {
    throw new Error('Terminal not initialized');
  }

  // Only works in simulated mode
  await (terminal as any).simulateReaderUpdate?.(event);
}

/**
 * Get terminal instance
 */
export function getTerminal(): Terminal | null {
  return terminal;
}

/**
 * Check if terminal is initialized
 */
export function isTerminalInitialized(): boolean {
  return terminal !== null;
}
