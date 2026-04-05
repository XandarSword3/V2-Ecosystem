import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.hoisted(() => vi.fn());
const apiCallableMock = vi.hoisted(() => vi.fn());

const terminalMock = vi.hoisted(() => ({
  discoverReaders: vi.fn(),
  connectReader: vi.fn(),
  disconnectReader: vi.fn(),
  collectPaymentMethod: vi.fn(),
  processPayment: vi.fn(),
  cancelCollectPaymentMethod: vi.fn(),
  setReaderDisplay: vi.fn(),
  clearReaderDisplay: vi.fn(),
  simulateReaderUpdate: vi.fn(),
}));

const createMock = vi.hoisted(() => vi.fn(() => terminalMock));
const loadStripeTerminalMock = vi.hoisted(() => vi.fn(async () => ({ create: createMock })));

vi.mock('@/lib/api', () => {
  const callable = Object.assign(apiCallableMock, { post: apiPostMock });
  return {
    default: callable,
  };
});

vi.mock('@stripe/terminal-js', () => ({
  loadStripeTerminal: loadStripeTerminalMock,
}));

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/pos/stripe-terminal');
}

describe('stripe terminal integration', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    apiCallableMock.mockReset();
    createMock.mockClear();
    loadStripeTerminalMock.mockClear();

    Object.values(terminalMock).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockReset' in mockFn) {
        (mockFn as ReturnType<typeof vi.fn>).mockReset();
      }
    });
  });

  it('initializes singleton terminal and discovers/connects readers', async () => {
    const stripe = await loadModule();

    const terminal = await stripe.initializeTerminal();
    expect(terminal).toBeTruthy();
    expect(stripe.isTerminalInitialized()).toBe(true);

    terminalMock.discoverReaders.mockResolvedValue({
      discoveredReaders: [
        {
          id: 'reader-1',
          object: 'terminal.reader',
          device_type: 'bbpos_wisepos_e',
          label: 'Front Desk',
          location: 'loc-1',
          serial_number: 'SN-1',
          status: 'online',
        },
      ],
    });

    const readers = await stripe.discoverReaders({ simulated: true, locationId: 'loc-1' });
    expect(readers).toHaveLength(1);

    terminalMock.connectReader.mockResolvedValue({ reader: readers[0] });
    const connected = await stripe.connectReader(
      readers[0] as unknown as Parameters<typeof stripe.connectReader>[0]
    );

    expect(connected.id).toBe('reader-1');
    expect(stripe.getConnectedReader()?.id).toBe('reader-1');

    await stripe.disconnectReader();
    expect(terminalMock.disconnectReader).toHaveBeenCalled();
  });

  it('collects and captures payments through terminal flow', async () => {
    const stripe = await loadModule();

    await stripe.initializeTerminal();

    const reader = {
      id: 'reader-2',
      object: 'terminal.reader',
      device_type: 'bbpos_wisepos_e',
      label: 'Bar',
      location: null,
      serial_number: 'SN-2',
      status: 'online',
    };

    terminalMock.connectReader.mockResolvedValue({ reader });
    await stripe.connectReader(
      reader as unknown as Parameters<typeof stripe.connectReader>[0]
    );

    apiPostMock
      .mockResolvedValueOnce({ data: { clientSecret: 'pi_secret', paymentIntentId: 'pi_1' } })
      .mockResolvedValueOnce({ data: { ok: true } });

    terminalMock.collectPaymentMethod.mockResolvedValue({
      paymentIntent: {
        id: 'pi_1',
        amount: 1000,
        currency: 'usd',
        status: 'requires_capture',
      },
    });

    terminalMock.processPayment.mockResolvedValue({
      paymentIntent: {
        id: 'pi_1',
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
      },
    });

    const result = await stripe.collectPayment({
      amount: 1000,
      currency: 'usd',
      orderId: 'order-1',
      skipTipping: true,
    });

    expect(result.status).toBe('succeeded');
    expect(apiPostMock).toHaveBeenCalledWith('/payments/terminal/payment-intent', expect.any(Object));
    expect(apiPostMock).toHaveBeenCalledWith('/payments/terminal/capture', { paymentIntentId: 'pi_1' });
  });

  it('throws terminal errors and supports display controls', async () => {
    const stripe = await loadModule();
    await stripe.initializeTerminal();

    const reader = {
      id: 'reader-3',
      object: 'terminal.reader',
      device_type: 'bbpos_wisepos_e',
      label: 'Patio',
      location: null,
      serial_number: 'SN-3',
      status: 'online',
    };

    terminalMock.connectReader.mockResolvedValue({ reader });
    await stripe.connectReader(
      reader as unknown as Parameters<typeof stripe.connectReader>[0]
    );

    terminalMock.setReaderDisplay.mockResolvedValue({});
    await stripe.setReaderDisplay({
      type: 'cart',
      cart: {
        line_items: [{ description: 'Meal', amount: 2200, quantity: 1 }],
        total: 2200,
        currency: 'usd',
      },
    });

    terminalMock.clearReaderDisplay.mockResolvedValue({});
    await stripe.clearReaderDisplay();

    terminalMock.collectPaymentMethod.mockResolvedValue({ error: { message: 'declined' } });
    apiPostMock.mockResolvedValue({ data: { clientSecret: 'pi_secret', paymentIntentId: 'pi_2' } });

    await expect(
      stripe.collectPayment({
        amount: 2200,
        currency: 'usd',
        orderId: 'order-2',
      })
    ).rejects.toThrow('declined');

    await stripe.simulateReaderEvent('payment_collected');
    expect(terminalMock.simulateReaderUpdate).toHaveBeenCalledWith('payment_collected');

    await stripe.cancelPayment();
    expect(terminalMock.cancelCollectPaymentMethod).toHaveBeenCalled();

    expect(stripe.getTerminal()).toBeTruthy();
  });
});
