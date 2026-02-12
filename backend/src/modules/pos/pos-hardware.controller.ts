/**
 * POS Hardware Controller
 * 
 * Backend endpoints for hardware POS operations:
 * - Stripe Terminal connection tokens
 * - Payment intent creation/capture
 * - Network printer proxy
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import Stripe from 'stripe';
import net from 'net';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Create Stripe Terminal connection token
 */
export const createConnectionToken = asyncHandler(async (req: Request, res: Response) => {
    const connectionToken = await stripe.terminal.connectionTokens.create();
    
    res.json({
      secret: connectionToken.secret,
    });
});

/**
 * Create payment intent for Terminal
 */
export const createTerminalPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
    const { amount, currency = 'usd', orderId, metadata = {} } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency,
      payment_method_types: ['card_present'],
      capture_method: 'manual', // We'll capture after terminal confirms
      metadata: {
        orderId: orderId || '',
        source: 'terminal',
        ...metadata,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
});

/**
 * Capture terminal payment
 */
export const captureTerminalPayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    res.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      },
    });
});

/**
 * Cancel terminal payment
 */
export const cancelTerminalPayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    res.json({
      success: true,
      status: paymentIntent.status,
    });
});

/**
 * List registered readers
 */
export const listReaders = asyncHandler(async (req: Request, res: Response) => {
    const { locationId } = req.query;
    
    const params: Stripe.Terminal.ReaderListParams = {
      limit: 100,
    };
    
    if (locationId) {
      params.location = locationId as string;
    }

    const readers = await stripe.terminal.readers.list(params);

    res.json({
      readers: readers.data.map(reader => ({
        id: reader.id,
        deviceType: reader.device_type,
        label: reader.label,
        location: reader.location,
        serialNumber: reader.serial_number,
        status: reader.status,
        ipAddress: reader.ip_address,
      })),
    });
});

/**
 * Register a new reader
 */
export const registerReader = asyncHandler(async (req: Request, res: Response) => {
    const { registrationCode, label, locationId } = req.body;
    
    if (!registrationCode || !locationId) {
      return res.status(400).json({ error: 'Registration code and location ID required' });
    }

    const reader = await stripe.terminal.readers.create({
      registration_code: registrationCode,
      label: label || 'POS Terminal',
      location: locationId,
    });

    res.json({
      success: true,
      reader: {
        id: reader.id,
        deviceType: reader.device_type,
        label: reader.label,
        serialNumber: reader.serial_number,
      },
    });
});

/**
 * Create/get terminal location
 */
export const getOrCreateLocation = asyncHandler(async (req: Request, res: Response) => {
    const { displayName, address } = req.body;
    
    // List existing locations
    const locations = await stripe.terminal.locations.list({ limit: 10 });
    
    // Check if location with same name exists
    const existing = locations.data.find(loc => loc.display_name === displayName);
    
    if (existing) {
      return res.json({
        location: {
          id: existing.id,
          displayName: existing.display_name,
          address: existing.address,
        },
      });
    }
    
    // Create new location
    if (!displayName || !address) {
      return res.status(400).json({ error: 'Display name and address required for new location' });
    }

    const location = await stripe.terminal.locations.create({
      display_name: displayName,
      address: {
        line1: address.line1,
        city: address.city,
        state: address.state,
        postal_code: address.postalCode,
        country: address.country || 'US',
      },
    });

    res.json({
      location: {
        id: location.id,
        displayName: location.display_name,
        address: location.address,
      },
    });
});

/**
 * Helper: Send buffer to network printer
 */
async function sendToNetworkPrinter(address: string, port: number, data: Buffer): Promise<void> {
    // Validate printer address (basic security check)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const hostnameRegex = /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*$/;
    
    if (!ipRegex.test(address) && !hostnameRegex.test(address)) {
      throw new Error('Invalid printer address');
    }

    return new Promise<void>((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(10000); // 10 second timeout
      
      client.connect(port, address, () => {
        client.write(data, (err) => {
          if (err) {
            reject(err);
          } else {
            client.end();
            resolve();
          }
        });
      });

      client.on('error', (err) => reject(err));
      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Connection timeout'));
      });
    });
}

/**
 * Network printer proxy - sends print data to network printer
 */
export async function printToNetworkPrinter(req: Request, res: Response, next: NextFunction) {
  try {
    const { printerAddress, printerPort = 9100, data } = req.body;
    
    if (!printerAddress || !data) {
      return res.status(400).json({ error: 'Printer address and data required' });
    }

    const printData = Buffer.from(data);
    await sendToNetworkPrinter(printerAddress, printerPort, printData);

    res.json({ success: true });
  } catch (error) {
    console.error('Print failed:', error);
    res.status(500).json({ 
      error: 'Print failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Trigger Cash Drawer (via Printer)
 */
export async function openCashDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const { printerAddress, printerPort = 9100 } = req.body;
    
    if (!printerAddress) {
      return res.status(400).json({ error: 'Printer address required' });
    }

    // Standard ESC/POS kick command (Pin 2, 25x2ms pulse)
    // ESC p 0 25 250
    const kickCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    
    await sendToNetworkPrinter(printerAddress, printerPort, kickCommand);

    res.json({ success: true, message: 'Cash drawer triggered' });
  } catch (error) {
    console.error('Cash drawer trigger failed:', error);
    res.status(500).json({ 
      error: 'Failed to open cash drawer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get printer status (for network printers that support SNMP)
 */
export const getPrinterStatus = asyncHandler(async (req: Request, res: Response) => {
    const { printerAddress } = req.query;
    
    if (!printerAddress) {
      return res.status(400).json({ error: 'Printer address required' });
    }

    // Try to connect to printer to check if it's online
    const isOnline = await new Promise<boolean>((resolve) => {
      const client = new net.Socket();
      
      client.setTimeout(3000);
      
      client.connect(9100, printerAddress as string, () => {
        client.end();
        resolve(true);
      });

      client.on('error', () => {
        resolve(false);
      });

      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
    });

    res.json({
      address: printerAddress,
      status: isOnline ? 'online' : 'offline',
      checkedAt: new Date().toISOString(),
    });
});

/**
 * Save printer configuration
 */
export const savePrinterConfig = asyncHandler(async (req: Request, res: Response) => {
    const { getSupabase } = await import('../../database/connection.js');
    const supabase = getSupabase();
    
    const { printers } = req.body;
    
    // Store in site_settings
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: 'printer_config',
        value: { printers },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (error) throw error;

    res.json({ success: true });
});

/**
 * Get printer configuration
 */
export const getPrinterConfig = asyncHandler(async (req: Request, res: Response) => {
    const { getSupabase } = await import('../../database/connection.js');
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'printer_config')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      printers: data?.value?.printers || [],
    });
});


