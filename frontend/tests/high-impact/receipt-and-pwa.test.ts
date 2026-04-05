import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPostMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({
  default: {
    post: apiPostMock,
  },
}));

import {
  ESCPOS,
  ReceiptBuilder,
  buildCustomerReceipt,
  buildKitchenTicket,
  connectUSBPrinter,
  openCashDrawer,
  printToNetworkPrinter,
  printToUSBPrinter,
} from '../../src/lib/pos/receipt-printer';

import {
  canInstall,
  isPWASupported,
  isPushSupported,
  promptInstall,
  requestNotificationPermission,
  setupInstallPrompt,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../src/lib/pwa';

describe('receipt printer and pwa utilities', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds ESC/POS command streams for customer and kitchen receipts', () => {
    const customer = buildCustomerReceipt({
      orderNumber: '123',
      date: new Date('2026-01-01T10:00:00Z'),
      items: [
        { name: 'Burger', quantity: 2, price: 12.5, modifiers: ['No onions'] },
      ],
      subtotal: 25,
      tax: 2.5,
      tip: 3,
      total: 30.5,
      paymentMethod: 'card',
      serverName: 'Alex',
      tableName: 'T1',
      businessInfo: {
        name: 'V2 Bistro',
        address: 'Main Street',
        phone: '+123',
        website: 'https://example.com',
      },
    });

    const kitchen = buildKitchenTicket({
      orderNumber: 'K-7',
      date: new Date('2026-01-01T10:10:00Z'),
      items: [{ name: 'Pasta', quantity: 1, notes: 'Extra spicy', modifiers: ['No cheese'] }],
      tableName: 'T2',
      priority: 'rush',
    });

    expect(customer).toBeInstanceOf(Uint8Array);
    expect(kitchen).toBeInstanceOf(Uint8Array);
    expect(customer.length).toBeGreaterThan(50);
    expect(kitchen.length).toBeGreaterThan(30);
  });

  it('supports builder chaining and qr/barcode commands', () => {
    const data = new ReceiptBuilder(32)
      .bold()
      .alignCenter()
      .line('Test')
      .barcode('ABC123', 60)
      .qrCode('https://example.com', 5)
      .feed(2)
      .cut(true)
      .build();

    expect(data[0]).toBe(ESCPOS.INIT[0]);
    expect(Array.from(data)).toContain(ESCPOS.PARTIAL_CUT[0]);
    expect(data.length).toBeGreaterThan(20);
  });

  it('prints to network printer and throws on backend failure', async () => {
    apiPostMock.mockResolvedValueOnce({ status: 200, data: { success: true } });
    await printToNetworkPrinter('10.0.0.5', 9100, new Uint8Array([1, 2, 3]));

    apiPostMock.mockResolvedValueOnce({ status: 500, data: { success: false, message: 'boom' } });
    await expect(
      printToNetworkPrinter('10.0.0.5', 9100, new Uint8Array([1, 2, 3]))
    ).rejects.toThrow('boom');
  });

  it('handles usb printer connection and endpoint validation', async () => {
    const fakeDevice = {
      configuration: {
        interfaces: [
          {
            interfaceNumber: 0,
            alternate: {
              endpoints: [{ direction: 'out', endpointNumber: 1 }],
            },
          },
        ],
      },
      open: vi.fn(),
      close: vi.fn(),
      selectConfiguration: vi.fn(),
      claimInterface: vi.fn(),
      releaseInterface: vi.fn(),
      transferOut: vi.fn(),
    };

    Object.defineProperty(navigator, 'usb', {
      value: {
        requestDevice: vi.fn().mockResolvedValue(fakeDevice),
        getDevices: vi.fn().mockResolvedValue([]),
      },
      configurable: true,
    });

    const connected = await connectUSBPrinter();
    expect(connected).toBe(fakeDevice);

    await printToUSBPrinter(fakeDevice as unknown as USBDevice, new Uint8Array([0x1b, 0x40]));
    expect(fakeDevice.transferOut).toHaveBeenCalled();

    const noEndpointDevice = {
      configuration: {
        interfaces: [{ interfaceNumber: 0, alternate: { endpoints: [] } }],
      },
      transferOut: vi.fn(),
    };

    await expect(
      printToUSBPrinter(noEndpointDevice as unknown as USBDevice, new Uint8Array([1, 2]))
    ).rejects.toThrow('No OUT endpoint found');
  });

  it('opens cash drawer using usb and network printers', async () => {
    const usbDevice = {
      configuration: {
        interfaces: [
          {
            interfaceNumber: 0,
            alternate: { endpoints: [{ direction: 'out', endpointNumber: 3 }] },
          },
        ],
      },
      transferOut: vi.fn(),
    };

    await openCashDrawer({ type: 'usb', device: usbDevice as unknown as USBDevice });
    expect(usbDevice.transferOut).toHaveBeenCalled();

    apiPostMock.mockResolvedValueOnce({ status: 200, data: { success: true } });
    await openCashDrawer({ type: 'network', address: '192.168.1.20', port: 9100 });
    expect(apiPostMock).toHaveBeenCalled();
  });

  it('checks pwa feature support and notification permission', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn() } }) },
      configurable: true,
    });

    Object.defineProperty(window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      configurable: true,
    });

    expect(isPWASupported()).toBe(true);
    expect(isPushSupported()).toBe(true);
    await expect(requestNotificationPermission()).resolves.toBe('granted');
  });

  it('sets up install prompt lifecycle and resolves promptInstall', async () => {
    setupInstallPrompt();

    const beforeInstall = new Event('beforeinstallprompt') as Event & {
      preventDefault: () => void;
      prompt: () => void;
      userChoice: Promise<{ outcome: string }>;
    };

    beforeInstall.preventDefault = vi.fn();
    beforeInstall.prompt = vi.fn();
    beforeInstall.userChoice = Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(beforeInstall);
    expect(canInstall()).toBe(true);
    await expect(promptInstall()).resolves.toBe(true);

    window.dispatchEvent(new Event('appinstalled'));
    expect(canInstall()).toBe(false);
  });

  it('subscribes and unsubscribes push notifications', async () => {
    const subscription = {
      endpoint: 'https://push.example/sub',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };

    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null).mockResolvedValueOnce(subscription),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager }) },
      configurable: true,
    });

    Object.defineProperty(window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });

    const subscribed = await subscribeToPush('SGVsbG8');
    expect(subscribed).toBeTruthy();

    pushManager.getSubscription = vi.fn().mockResolvedValue(subscription);
    const unsubscribed = await unsubscribeFromPush();
    expect(unsubscribed).toBe(true);
  });
});
