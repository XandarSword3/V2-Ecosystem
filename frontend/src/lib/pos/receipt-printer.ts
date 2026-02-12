/**
 * ESC/POS Receipt Printer Service
 * 
 * Provides printing capabilities for thermal receipt printers:
 * - USB and Network printer support
 * - ESC/POS command generation
 * - Receipt and kitchen ticket templates
 */

// WebUSB types (for browsers that support it)
import api from '@/lib/api';
declare global {
  interface Navigator {
    usb?: {
      requestDevice(options: { filters: Array<{ vendorId?: number; productId?: number }> }): Promise<USBDevice>;
      getDevices(): Promise<USBDevice[]>;
    };
  }
  
  interface USBDevice {
    configuration: USBConfiguration | null;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
  }
  
  interface USBConfiguration {
    configurationValue: number;
    interfaces: USBInterface[];
  }
  
  interface USBInterface {
    interfaceNumber: number;
    alternate: USBAlternateInterface;
  }
  
  interface USBAlternateInterface {
    endpoints: USBEndpoint[];
  }
  
  interface USBEndpoint {
    direction: 'in' | 'out';
    endpointNumber: number;
  }
  
  interface USBOutTransferResult {
    bytesWritten: number;
    status: 'ok' | 'stall' | 'babble';
  }
}

// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const ESCPOS = {
  // Text formatting
  INIT: [ESC, 0x40], // Initialize printer
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  DOUBLE_WIDTH: [GS, 0x21, 0x10],
  DOUBLE_HEIGHT: [GS, 0x21, 0x01],
  NORMAL_SIZE: [GS, 0x21, 0x00],
  
  // Alignment
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  
  // Paper control
  CUT_PAPER: [GS, 0x56, 0x00], // Full cut
  PARTIAL_CUT: [GS, 0x56, 0x01],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
  
  // Cash drawer
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xfa],
  
  // Barcode
  BARCODE_HEIGHT: (n: number) => [GS, 0x68, n],
  BARCODE_WIDTH: (n: number) => [GS, 0x77, n],
  BARCODE_CODE39: (data: string) => [GS, 0x6b, 0x04, ...textToBytes(data), 0x00],
  
  // QR Code
  QR_SIZE: (n: number) => [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, n],
  QR_DATA: (data: string) => {
    const bytes = textToBytes(data);
    const len = bytes.length + 3;
    return [GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes];
  },
  QR_PRINT: [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30],
};

function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

// Printer interface
interface PrinterConfig {
  type: 'usb' | 'network' | 'bluetooth';
  address?: string; // IP address for network printer
  port?: number; // Port for network printer (default 9100)
  vendorId?: number; // USB vendor ID
  productId?: number; // USB product ID
  characterSet?: 'cp437' | 'cp850' | 'cp858' | 'utf8';
  width?: 48 | 42 | 32; // Characters per line
}

interface PrintJob {
  id: string;
  data: Uint8Array;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

// Print queue
const printQueue: PrintJob[] = [];
let isProcessing = false;

/**
 * ESC/POS Document Builder
 */
export class ReceiptBuilder {
  private buffer: number[] = [];
  private width: number;

  constructor(width: number = 48) {
    this.width = width;
    this.init();
  }

  init(): this {
    this.buffer.push(...ESCPOS.INIT);
    return this;
  }

  text(content: string): this {
    this.buffer.push(...textToBytes(content));
    return this;
  }

  newLine(): this {
    this.buffer.push(LF);
    return this;
  }

  line(content: string): this {
    return this.text(content).newLine();
  }

  bold(enabled = true): this {
    this.buffer.push(...(enabled ? ESCPOS.BOLD_ON : ESCPOS.BOLD_OFF));
    return this;
  }

  underline(enabled = true): this {
    this.buffer.push(...(enabled ? ESCPOS.UNDERLINE_ON : ESCPOS.UNDERLINE_OFF));
    return this;
  }

  doubleWidth(): this {
    this.buffer.push(...ESCPOS.DOUBLE_WIDTH);
    return this;
  }

  doubleHeight(): this {
    this.buffer.push(...ESCPOS.DOUBLE_HEIGHT);
    return this;
  }

  normalSize(): this {
    this.buffer.push(...ESCPOS.NORMAL_SIZE);
    return this;
  }

  alignLeft(): this {
    this.buffer.push(...ESCPOS.ALIGN_LEFT);
    return this;
  }

  alignCenter(): this {
    this.buffer.push(...ESCPOS.ALIGN_CENTER);
    return this;
  }

  alignRight(): this {
    this.buffer.push(...ESCPOS.ALIGN_RIGHT);
    return this;
  }

  divider(char = '-'): this {
    return this.line(char.repeat(this.width));
  }

  row(left: string, right: string): this {
    const spaces = this.width - left.length - right.length;
    return this.line(left + ' '.repeat(Math.max(1, spaces)) + right);
  }

  feed(lines = 1): this {
    this.buffer.push(...ESCPOS.FEED_LINES(lines));
    return this;
  }

  cut(partial = false): this {
    this.buffer.push(...(partial ? ESCPOS.PARTIAL_CUT : ESCPOS.CUT_PAPER));
    return this;
  }

  openDrawer(): this {
    this.buffer.push(...ESCPOS.OPEN_DRAWER);
    return this;
  }

  qrCode(data: string, size = 6): this {
    this.buffer.push(...ESCPOS.QR_SIZE(size));
    this.buffer.push(...ESCPOS.QR_DATA(data));
    this.buffer.push(...ESCPOS.QR_PRINT);
    return this;
  }

  barcode(data: string, height = 50): this {
    this.buffer.push(...ESCPOS.BARCODE_HEIGHT(height));
    this.buffer.push(...ESCPOS.BARCODE_CODE39(data));
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Receipt Template - Customer Receipt
 */
export function buildCustomerReceipt(order: {
  orderNumber: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
  }>;
  subtotal: number;
  tax: number;
  tip?: number;
  total: number;
  paymentMethod: string;
  serverName?: string;
  tableName?: string;
  businessInfo: {
    name: string;
    address?: string;
    phone?: string;
    website?: string;
  };
}): Uint8Array {
  const builder = new ReceiptBuilder(48);

  // Header
  builder
    .alignCenter()
    .bold()
    .doubleHeight()
    .line(order.businessInfo.name)
    .normalSize()
    .bold(false);

  if (order.businessInfo.address) {
    builder.line(order.businessInfo.address);
  }
  if (order.businessInfo.phone) {
    builder.line(order.businessInfo.phone);
  }

  builder
    .newLine()
    .divider('=')
    .alignLeft()
    .line(`Order: #${order.orderNumber}`)
    .line(`Date: ${order.date.toLocaleDateString()} ${order.date.toLocaleTimeString()}`);

  if (order.tableName) {
    builder.line(`Table: ${order.tableName}`);
  }
  if (order.serverName) {
    builder.line(`Server: ${order.serverName}`);
  }

  builder.divider();

  // Items
  for (const item of order.items) {
    const itemTotal = (item.quantity * item.price).toFixed(2);
    builder.row(`${item.quantity}x ${item.name}`, `$${itemTotal}`);
    
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        builder.line(`   - ${mod}`);
      }
    }
  }

  builder.divider();

  // Totals
  builder
    .row('Subtotal:', `$${order.subtotal.toFixed(2)}`)
    .row('Tax:', `$${order.tax.toFixed(2)}`);

  if (order.tip) {
    builder.row('Tip:', `$${order.tip.toFixed(2)}`);
  }

  builder
    .divider()
    .bold()
    .row('TOTAL:', `$${order.total.toFixed(2)}`)
    .bold(false)
    .newLine()
    .line(`Paid by: ${order.paymentMethod}`);

  // Footer
  builder
    .newLine()
    .alignCenter()
    .line('Thank you for dining with us!')
    .newLine();

  if (order.businessInfo.website) {
    builder.line(order.businessInfo.website);
  }

  builder.feed(3).cut();

  return builder.build();
}

/**
 * Kitchen Ticket Template
 */
export function buildKitchenTicket(order: {
  orderNumber: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
    station?: string;
  }>;
  tableName?: string;
  serverName?: string;
  notes?: string;
  priority?: 'normal' | 'rush';
}): Uint8Array {
  const builder = new ReceiptBuilder(42);

  // Header with large text
  builder
    .alignCenter()
    .bold()
    .doubleWidth()
    .doubleHeight();

  if (order.priority === 'rush') {
    builder.line('*** RUSH ***');
  }

  builder
    .line(`#${order.orderNumber}`)
    .normalSize()
    .bold(false)
    .newLine();

  // Order info
  builder
    .alignLeft()
    .line(`Time: ${order.date.toLocaleTimeString()}`);

  if (order.tableName) {
    builder.bold().line(`Table: ${order.tableName}`).bold(false);
  }
  if (order.serverName) {
    builder.line(`Server: ${order.serverName}`);
  }

  builder.divider('=');

  // Items
  for (const item of order.items) {
    builder
      .bold()
      .doubleHeight()
      .line(`${item.quantity}x ${item.name}`)
      .normalSize()
      .bold(false);

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        builder.line(`  ** ${mod}`);
      }
    }

    if (item.notes) {
      builder.line(`  NOTE: ${item.notes}`);
    }

    builder.newLine();
  }

  // Order notes
  if (order.notes) {
    builder
      .divider()
      .bold()
      .line('ORDER NOTES:')
      .bold(false)
      .line(order.notes);
  }

  builder.feed(3).cut();

  return builder.build();
}

/**
 * Network Printer Connection
 */
export async function printToNetworkPrinter(
  address: string,
  port: number,
  data: Uint8Array
): Promise<void> {
  // In a real implementation, this would use WebSocket or a backend proxy
  // because browsers can't directly open TCP connections
  const response = await api.post('/pos/print', {
    printerAddress: address,
    printerPort: port,
    data: Array.from(data),
  });

  if (!response.data?.success && response.status >= 400) {
    throw new Error(response.data?.message || 'Print failed');
  }
}

/**
 * USB Printer Connection (WebUSB API)
 */
export async function connectUSBPrinter(): Promise<USBDevice | null> {
  if (!navigator.usb) {
    console.warn('WebUSB not supported');
    return null;
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [
        // Common receipt printer vendor IDs
        { vendorId: 0x0416 }, // Winbond (Star printers)
        { vendorId: 0x04b8 }, // Seiko Epson
        { vendorId: 0x0519 }, // Star Micronics
        { vendorId: 0x0dd4 }, // Custom Engineering
      ],
    });

    await device.open();
    
    // Select first configuration
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    
    // Claim first interface
    await device.claimInterface(0);
    
    return device;
  } catch (error) {
    console.error('Failed to connect USB printer:', error);
    return null;
  }
}

export async function printToUSBPrinter(device: USBDevice, data: Uint8Array): Promise<void> {
  // Find the OUT endpoint
  const endpoint = device.configuration?.interfaces[0]?.alternate.endpoints.find(
    (e) => e.direction === 'out'
  );

  if (!endpoint) {
    throw new Error('No OUT endpoint found');
  }

  await device.transferOut(endpoint.endpointNumber, data);
}

/**
 * Open cash drawer
 */
export async function openCashDrawer(printer: {
  type: 'usb' | 'network';
  device?: USBDevice;
  address?: string;
  port?: number;
}): Promise<void> {
  const command = new Uint8Array(ESCPOS.OPEN_DRAWER);

  if (printer.type === 'usb' && printer.device) {
    await printToUSBPrinter(printer.device, command);
  } else if (printer.type === 'network' && printer.address) {
    await printToNetworkPrinter(printer.address, printer.port || 9100, command);
  }
}
