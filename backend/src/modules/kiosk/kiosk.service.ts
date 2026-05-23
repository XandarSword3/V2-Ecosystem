/**
 * Self-Service Kiosk Service
 * Phase 4.2: Kiosk device management, sessions, and operations
 * Refactored to use Supabase client
 */

import { getSupabase } from '../../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

// =============================================
// TYPES
// =============================================

interface KioskDevice {
  id: string;
  propertyId: string;
  property_id: string;
  deviceName: string;
  name: string;
  deviceCode: string;
  location?: string;
  deviceType: string;
  capabilities: any;
  status: string;
  config: Record<string, any>;
  last_heartbeat?: string;
  key_stock: number;
  is_active: boolean;
  error_count: number;
  [key: string]: any;
}

interface KioskCapabilities {
  hasIdScanner: boolean;
  hasCardReader: boolean;
  hasKeyEncoder: boolean;
  hasReceiptPrinter: boolean;
  hasSignaturePad: boolean;
  hasCamera: boolean;
  hasCashAcceptor: boolean;
  hasCardDispenser: boolean;
}

interface KioskSession {
  id: string;
  kioskId: string;
  sessionType: string;
  bookingId?: string;
  guestId?: string;
  status: string;
  currentStep?: string;
  stepsCompleted: string[];
  inputData: Record<string, any>;
}

// =============================================
// KIOSK SERVICE CLASS
// =============================================

class KioskService {
  private get supabase() {
    return getSupabase();
  }

  // =============================================
  // DEVICE MANAGEMENT
  // =============================================

  async registerDevice(
    propertyId: string,
    data: {
      deviceName: string;
      deviceCode: string;
      location?: string;
      deviceType?: string;
      manufacturer?: string;
      model?: string;
      serialNumber?: string;
      capabilities?: Partial<KioskCapabilities>;
      config?: Record<string, any>;
    }
  ): Promise<KioskDevice> {
    const { data: device, error } = await this.supabase
      .from('kiosk_devices')
      .insert({
        property_id: propertyId,
        device_name: data.deviceName,
        device_code: data.deviceCode,
        location: data.location || null,
        device_type: data.deviceType || 'standard',
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serial_number: data.serialNumber || null,
        has_id_scanner: data.capabilities?.hasIdScanner || false,
        has_card_reader: data.capabilities?.hasCardReader || false,
        has_key_encoder: data.capabilities?.hasKeyEncoder || false,
        has_receipt_printer: data.capabilities?.hasReceiptPrinter || false,
        has_signature_pad: data.capabilities?.hasSignaturePad || false,
        has_camera: data.capabilities?.hasCamera || false,
        has_cash_acceptor: data.capabilities?.hasCashAcceptor || false,
        has_card_dispenser: data.capabilities?.hasCardDispenser || false,
        config: data.config || {},
        status: 'offline'
      })
      .select()
      .single();

    if (error) throw error;

    // Initialize key stock if device has key encoder
    if (data.capabilities?.hasKeyEncoder) {
      await this.supabase
        .from('kiosk_key_stock')
        .insert({
          kiosk_id: device.id,
          current_stock: 0,
          minimum_stock: 20,
          maximum_stock: 200
        });
    }

    return this.mapDevice(device);
  }

  async getDevice(deviceId: string): Promise<KioskDevice | null> {
    const { data: device, error } = await this.supabase
      .from('kiosk_devices')
      .select('*, kiosk_key_stock(current_stock)')
      .eq('id', deviceId)
      .single();

    if (error || !device) return null;
    return this.mapDevice(device);
  }

  async getDeviceByCode(propertyId: string, deviceCode: string): Promise<KioskDevice | null> {
    const { data: device, error } = await this.supabase
      .from('kiosk_devices')
      .select('*, kiosk_key_stock(current_stock)')
      .eq('property_id', propertyId)
      .eq('device_code', deviceCode)
      .single();

    if (error || !device) return null;
    return this.mapDevice(device);
  }

  async getPropertyDevices(propertyId: string, includeInactive = false): Promise<KioskDevice[]> {
    let query = this.supabase
      .from('kiosk_devices')
      .select('*, kiosk_key_stock(current_stock)')
      .eq('property_id', propertyId)
      .order('device_code');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: devices, error } = await query;
    if (error) throw error;
    return (devices || []).map(d => this.mapDevice(d));
  }

  async updateDeviceStatus(
    deviceId: string,
    status: string,
    error?: string
  ): Promise<void> {
    await this.supabase
      .from('kiosk_devices')
      .update({
        status,
        last_error: error || null,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);
  }

  async updateDeviceConfig(
    deviceId: string,
    config: Record<string, any>
  ): Promise<void> {
    await this.supabase
      .from('kiosk_devices')
      .update({
        config,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);
  }

  async setDeviceMaintenanceMode(
    deviceId: string,
    enabled: boolean,
    notes?: string
  ): Promise<void> {
    if (enabled) {
      await this.supabase
        .from('kiosk_devices')
        .update({
          status: 'maintenance',
          maintenance_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } else {
      await this.supabase
        .from('kiosk_devices')
        .update({
          status: 'offline',
          last_maintenance_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    }
  }

  async deactivateDevice(deviceId: string): Promise<void> {
    await this.supabase
      .from('kiosk_devices')
      .update({
        is_active: false,
        status: 'offline',
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);
  }

  // =============================================
  // SESSION MANAGEMENT
  // =============================================

  async startSession(
    kioskId: string,
    sessionType: string,
    data?: {
      bookingId?: string;
      guestId?: string;
      confirmationNumber?: string;
    }
  ): Promise<KioskSession> {
    const device = await this.getDevice(kioskId);
    if (!device) {
      throw new Error('Kiosk device not found');
    }
    if (device.status !== 'online') {
      throw new Error(`Kiosk is not available (status: ${device.status})`);
    }

    const { data: session, error } = await this.supabase
      .from('kiosk_sessions')
      .insert({
        kiosk_id: kioskId,
        property_id: device.propertyId,
        session_type: sessionType,
        booking_id: data?.bookingId || null,
        guest_id: data?.guestId || null,
        confirmation_number: data?.confirmationNumber || null,
        status: 'started',
        current_step: 'welcome',
        steps_completed: [],
        input_data: {},
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapSession(session);
  }

  async getSession(sessionId: string): Promise<KioskSession | null> {
    const { data: session, error } = await this.supabase
      .from('kiosk_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) return null;
    return this.mapSession(session);
  }

  async updateSessionStep(
    sessionId: string,
    step: string,
    data?: Record<string, any>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const stepsCompleted = [...session.stepsCompleted];
    if (session.currentStep && !stepsCompleted.includes(session.currentStep)) {
      stepsCompleted.push(session.currentStep);
    }

    const inputData = {
      ...session.inputData,
      ...(data || {}),
      [`${step}_timestamp`]: new Date().toISOString()
    };

    await this.supabase
      .from('kiosk_sessions')
      .update({
        current_step: step,
        steps_completed: stepsCompleted,
        input_data: inputData,
        status: 'in_progress',
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  async completeSession(
    sessionId: string,
    resultStatus: string,
    resultData?: Record<string, any>
  ): Promise<void> {
    await this.supabase
      .from('kiosk_sessions')
      .update({
        status: 'completed',
        result_status: resultStatus,
        result_data: resultData || {},
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  async abandonSession(sessionId: string, reason?: string): Promise<void> {
    await this.supabase
      .from('kiosk_sessions')
      .update({
        status: 'abandoned',
        result_status: 'abandoned',
        failure_reason: reason || 'User cancelled',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  async timeoutSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('kiosk_sessions')
      .update({
        status: 'timeout',
        result_status: 'timeout',
        failure_reason: 'Session timed out due to inactivity',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  async transferToDesk(
    sessionId: string,
    reason: string,
    staffId?: string
  ): Promise<void> {
    await this.supabase
      .from('kiosk_sessions')
      .update({
        transferred_to_desk: true,
        transfer_reason: reason,
        desk_staff_id: staffId || null,
        status: 'completed',
        result_status: 'transferred',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  }

  async processTimeouts(timeoutMinutes: number = 2): Promise<number> {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    
    const { data: sessions } = await this.supabase
      .from('kiosk_sessions')
      .select('id')
      .in('status', ['started', 'in_progress'])
      .lt('last_activity_at', cutoffTime);

    if (!sessions || sessions.length === 0) return 0;

    for (const session of sessions) {
      await this.timeoutSession(session.id);
    }

    return sessions.length;
  }

  // =============================================
  // KIOSK TRANSACTIONS
  // =============================================

  async createTransaction(
    sessionId: string,
    kioskId: string,
    transactionType: string,
    requestData?: Record<string, any>
  ): Promise<string> {
    const { data: transaction, error } = await this.supabase
      .from('kiosk_transactions')
      .insert({
        session_id: sessionId,
        kiosk_id: kioskId,
        transaction_type: transactionType,
        status: 'pending',
        request_data: requestData || {}
      })
      .select('id')
      .single();

    if (error) throw error;
    return transaction.id;
  }

  async updateTransaction(
    transactionId: string,
    status: string,
    responseData?: Record<string, any>,
    error?: { code?: string; message?: string }
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status,
      response_data: responseData || {},
      error_code: error?.code || null,
      error_message: error?.message || null
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from('kiosk_transactions')
      .update(updateData)
      .eq('id', transactionId);
  }

  // =============================================
  // ID SCANNING
  // =============================================

  async scanId(
    sessionId: string,
    kioskId: string,
    scanData: {
      documentType: string;
      frontImage: string;
      backImage?: string;
      rawData?: Record<string, any>;
    }
  ): Promise<{
    transactionId: string;
    extractedData?: Record<string, any>;
    verified: boolean;
  }> {
    const transactionId = await this.createTransaction(
      sessionId,
      kioskId,
      'id_scan',
      scanData
    );

    try {
      const extractedData = this.simulateIdExtraction(scanData);
      await this.updateTransaction(transactionId, 'completed', { extractedData });
      await this.updateSessionStep(sessionId, 'id_verified', {
        documentType: scanData.documentType,
        guestData: extractedData
      });

      return {
        transactionId,
        extractedData,
        verified: true
      };
    } catch (error) {
      await this.updateTransaction(transactionId, 'failed', undefined, {
        message: error instanceof Error ? error.message : 'ID scan failed'
      });
      throw error;
    }
  }

  private simulateIdExtraction(scanData: Record<string, any>): Record<string, any> {
    return {
      firstName: 'JOHN',
      lastName: 'DOE',
      dateOfBirth: '1985-06-15',
      documentNumber: 'AB1234567',
      expirationDate: '2028-06-15',
      nationality: 'US',
      extractedAt: new Date().toISOString()
    };
  }

  // =============================================
  // KEY ENCODING
  // =============================================

  async encodeKey(
    sessionId: string,
    kioskId: string,
    keyData: {
      roomNumber: string;
      guestName: string;
      checkInDate: Date;
      checkOutDate: Date;
      accessPoints?: string[];
    }
  ): Promise<{
    transactionId: string;
    keyNumber: string;
    success: boolean;
  }> {
    const stock = await this.getKeyStock(kioskId);
    if (stock && stock.currentStock <= 0) {
      throw new Error('Key stock depleted - please visit front desk');
    }

    const transactionId = await this.createTransaction(
      sessionId,
      kioskId,
      'key_encode',
      keyData
    );

    try {
      const keyNumber = this.generateKeyNumber();
      await new Promise(resolve => setTimeout(resolve, 500));

      await this.updateTransaction(transactionId, 'completed', {
        keyNumber,
        encodedAt: new Date().toISOString()
      });

      await this.decrementKeyStock(kioskId);

      return {
        transactionId,
        keyNumber,
        success: true
      };
    } catch (error) {
      await this.updateTransaction(transactionId, 'failed', undefined, {
        message: error instanceof Error ? error.message : 'Key encoding failed'
      });
      throw error;
    }
  }

  private generateKeyNumber(): string {
    return `K${Date.now().toString(36).toUpperCase()}`;
  }

  // =============================================
  // PAYMENT PROCESSING
  // =============================================

  async processPayment(
    sessionId: string,
    kioskId: string,
    paymentData: {
      amount: number;
      currency: string;
      paymentMethod: string;
      description?: string;
      stripePaymentMethodId?: string; // Required for real card processing
    }
  ): Promise<{
    transactionId: string;
    paymentReference: string;
    clientSecret?: string;
    success: boolean;
  }> {
    const transactionId = await this.createTransaction(
      sessionId,
      kioskId,
      'payment',
      paymentData
    );

    try {
      const paymentReference = `PAY-${uuidv4().substring(0, 8).toUpperCase()}`;

      await this.supabase
        .from('kiosk_transactions')
        .update({
          amount: paymentData.amount,
          currency: paymentData.currency,
          payment_method: paymentData.paymentMethod
        })
        .eq('id', transactionId);

      // Real Stripe payment: create a PaymentIntent server-side
      // The kiosk terminal confirms via Stripe Terminal SDK on the device
      const stripeModule = await import('stripe');
      const { data: settings } = await this.supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'payments')
        .single();

      const secretKey = settings?.value?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;

      if (!secretKey) {
        throw new Error('Stripe not configured — cannot process kiosk payment');
      }

      const stripe = new stripeModule.default(secretKey, { apiVersion: '2023-10-16' });
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100),
        currency: paymentData.currency.toLowerCase(),
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        description: paymentData.description || 'Kiosk payment',
        metadata: {
          kiosk_id: kioskId,
          session_id: sessionId,
          transaction_id: transactionId,
        },
      });

      await this.updateTransaction(transactionId, 'completed', {
        paymentReference,
        stripePaymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        processedAt: new Date().toISOString()
      });

      await this.supabase
        .from('kiosk_transactions')
        .update({ payment_reference: paymentReference })
        .eq('id', transactionId);

      return {
        transactionId,
        paymentReference,
        clientSecret: intent.client_secret ?? undefined,
        success: true
      };
    } catch (error) {
      await this.updateTransaction(transactionId, 'failed', undefined, {
        message: error instanceof Error ? error.message : 'Payment failed'
      });
      throw error;
    }
  }

  // =============================================
  // RECEIPT PRINTING
  // =============================================

  async printReceipt(
    sessionId: string,
    kioskId: string,
    receiptData: {
      type: string;
      guestName: string;
      confirmationNumber: string;
      roomNumber?: string;
      checkInDate?: Date;
      checkOutDate?: Date;
      items?: Array<{ description: string; amount: number }>;
      total?: number;
    }
  ): Promise<{ transactionId: string; success: boolean }> {
    const transactionId = await this.createTransaction(
      sessionId,
      kioskId,
      'receipt_print',
      receiptData
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await this.updateTransaction(transactionId, 'completed', {
        printedAt: new Date().toISOString()
      });

      return {
        transactionId,
        success: true
      };
    } catch (error) {
      await this.updateTransaction(transactionId, 'failed', undefined, {
        message: error instanceof Error ? error.message : 'Receipt printing failed'
      });
      throw error;
    }
  }

  // =============================================
  // KEY STOCK MANAGEMENT
  // =============================================

  async getKeyStock(kioskId: string): Promise<{
    currentStock: number;
    minimumStock: number;
    maximumStock: number;
    isLow: boolean;
  } | null> {
    const { data: stock, error } = await this.supabase
      .from('kiosk_key_stock')
      .select('*')
      .eq('kiosk_id', kioskId)
      .single();

    if (error || !stock) return null;

    return {
      currentStock: stock.current_stock,
      minimumStock: stock.minimum_stock,
      maximumStock: stock.maximum_stock,
      isLow: stock.current_stock <= stock.minimum_stock
    };
  }

  async refillKeyStock(
    kioskId: string,
    quantity: number,
    refillerId: string
  ): Promise<void> {
    const stock = await this.getKeyStock(kioskId);
    if (!stock) throw new Error('Key stock record not found');

    const newStock = Math.min(stock.currentStock + quantity, stock.maximumStock);

    await this.supabase
      .from('kiosk_key_stock')
      .update({
        current_stock: newStock,
        last_refill_date: new Date().toISOString(),
        last_refill_quantity: quantity,
        last_refill_by: refillerId,
        low_stock_alert_sent: false,
        updated_at: new Date().toISOString()
      })
      .eq('kiosk_id', kioskId);
  }

  private async decrementKeyStock(kioskId: string): Promise<void> {
    const stock = await this.getKeyStock(kioskId);
    if (!stock) return;

    const newStock = Math.max(stock.currentStock - 1, 0);

    await this.supabase
      .from('kiosk_key_stock')
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('kiosk_id', kioskId);

    const updatedStock = await this.getKeyStock(kioskId);
    if (updatedStock?.isLow) {
      await this.logHardwareEvent(kioskId, 'key_stock_low', 'warning', 'key_encoder', {
        currentStock: updatedStock.currentStock,
        minimumStock: updatedStock.minimumStock
      });
    }
  }

  // =============================================
  // HARDWARE EVENTS
  // =============================================

  async logHardwareEvent(
    kioskId: string,
    eventType: string,
    severity: string,
    component: string,
    details?: Record<string, any>
  ): Promise<string> {
    const { data: event, error } = await this.supabase
      .from('kiosk_hardware_events')
      .insert({
        kiosk_id: kioskId,
        event_type: eventType,
        severity,
        component,
        details: details || {}
      })
      .select('id')
      .single();

    if (error) throw error;
    return event.id;
  }

  async resolveHardwareEvent(
    eventId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.supabase
      .from('kiosk_hardware_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        resolution_notes: notes || null
      })
      .eq('id', eventId);
  }

  async getUnresolvedEvents(kioskId?: string): Promise<any[]> {
    if (kioskId) {
      const { data, error } = await this.supabase
        .from('kiosk_hardware_events')
        .select('*')
        .eq('kiosk_id', kioskId)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    const { data, error } = await this.supabase
      .from('kiosk_hardware_events')
      .select('*, kiosk_devices(device_name, device_code)')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(e => ({
      ...e,
      device_name: e.kiosk_devices?.device_name,
      device_code: e.kiosk_devices?.device_code
    }));
  }

  // =============================================
  // SCREEN FLOWS
  // =============================================

  async getScreenFlow(
    propertyId: string,
    flowType: string
  ): Promise<{
    id: string;
    name: string;
    steps: any[];
    settings: Record<string, any>;
  } | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data: flows, error } = await this.supabase
      .from('kiosk_screen_flows')
      .select('*')
      .eq('property_id', propertyId)
      .eq('flow_type', flowType)
      .eq('is_active', true)
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !flows || flows.length === 0) return null;

    const flow = flows[0];
    return {
      id: flow.id,
      name: flow.name,
      steps: flow.steps,
      settings: {
        timeoutSeconds: flow.timeout_seconds,
        enableHelpButton: flow.enable_help_button,
        enableCancelButton: flow.enable_cancel_button,
        enableLanguageSelector: flow.enable_language_selector,
        defaultLanguage: flow.default_language,
        availableLanguages: flow.available_languages
      }
    };
  }

  async getScreenContent(
    flowId: string,
    stepKey: string,
    language: string = 'en'
  ): Promise<{
    title: string;
    subtitle?: string;
    instructions?: string;
    buttonLabels: Record<string, string>;
    media?: Record<string, string>;
  } | null> {
    const { data: content, error } = await this.supabase
      .from('kiosk_screen_content')
      .select('*')
      .eq('flow_id', flowId)
      .eq('step_key', stepKey)
      .in('language', [language, 'en'])
      .order('language', { ascending: language === 'en' })
      .limit(1);

    if (error || !content || content.length === 0) return null;

    const c = content[0];
    return {
      title: c.title,
      subtitle: c.subtitle,
      instructions: c.instructions,
      buttonLabels: c.button_labels || {},
      media: {
        imageUrl: c.image_url,
        videoUrl: c.video_url,
        animationType: c.animation_type
      }
    };
  }

  // =============================================
  // CHECK-IN FLOW
  // =============================================

  async performKioskCheckin(
    kioskId: string,
    confirmationNumber: string
  ): Promise<KioskSession> {
    // FIX: Iteration 16 - Allow check-in only from 1 day before to today (prevents stale bookings from months ago)
    const today = new Date();
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: bookings, error } = await this.supabase
      .from('transactions')
      .select('*, guests(first_name, last_name)')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('confirmation_number', confirmationNumber)
      .eq('status', 'confirmed')
      .gte('check_in_date', oneDayAgo.toISOString().split('T')[0])
      .lte('check_in_date', today.toISOString().split('T')[0]);

    if (error || !bookings || bookings.length === 0) {
      throw new Error('Booking not found or not eligible for check-in');
    }

    const booking = bookings[0];
    const session = await this.startSession(kioskId, 'checkin', {
      bookingId: booking.id,
      guestId: booking.guest_id,
      confirmationNumber
    });

    await this.updateSessionStep(session.id, 'booking_found', {
      guestName: `${booking.guests?.first_name} ${booking.guests?.last_name}`,
      checkInDate: (booking.metadata as any)?.check_in_date_date,
      checkOutDate: (booking.metadata as any)?.check_out_date_date
    });

    return (await this.getSession(session.id)) as KioskSession;
  }

  async finalizeKioskCheckin(
    sessionId: string,
    roomNumber: string,
    issueKey: boolean = true
  ): Promise<{
    success: boolean;
    roomNumber: string;
    keyNumber?: string;
    receiptPrinted: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (!session.bookingId) throw new Error('No booking associated with session');

    const device = await this.getDevice(session.kioskId);
    if (!device) throw new Error('Kiosk device not found');

    let keyNumber: string | undefined;
    let receiptPrinted = false;

    if (issueKey && device.capabilities.hasKeyEncoder) {
      const { data: bookings } = await this.supabase
        .from('transactions')
        .select('*, guests(first_name, last_name)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', session.bookingId);

      if (bookings && bookings.length > 0) {
        const booking = bookings[0];
        const keyResult = await this.encodeKey(sessionId, session.kioskId, {
          roomNumber,
          guestName: `${booking.guests?.first_name} ${booking.guests?.last_name}`,
          checkInDate: new Date((booking.metadata as any)?.check_in_date_date),
          checkOutDate: new Date((booking.metadata as any)?.check_out_date_date)
        });
        keyNumber = keyResult.keyNumber;
      }
    }

    if (device.capabilities.hasReceiptPrinter) {
      const { data: bookings } = await this.supabase
        .from('transactions')
        .select('*, guests(first_name, last_name), properties(name)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', session.bookingId);

      if (bookings && bookings.length > 0) {
        const booking = bookings[0];
        await this.printReceipt(sessionId, session.kioskId, {
          type: 'checkin_confirmation',
          guestName: `${booking.guests?.first_name} ${booking.guests?.last_name}`,
          confirmationNumber: booking.confirmation_number,
          roomNumber,
          checkInDate: new Date((booking.metadata as any)?.check_in_date_date),
          checkOutDate: new Date((booking.metadata as any)?.check_out_date_date)
        });
        receiptPrinted = true;
      }
    }

    await this.supabase
      .from('transactions')
      .update({
        status: 'checked_in',
        metadata: { actual_check_in: new Date().toISOString() }
      })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', session.bookingId);

    await this.completeSession(sessionId, 'success', {
      roomNumber,
      keyNumber,
      receiptPrinted
    });

    return {
      success: true,
      roomNumber,
      keyNumber,
      receiptPrinted
    };
  }

  // =============================================
  // CHECK-OUT FLOW
  // =============================================

  async performKioskCheckout(
    kioskId: string,
    roomNumber: string
  ): Promise<KioskSession> {
    const { data: bookings, error } = await this.supabase
      .from('transactions')
      .select('*, guests(first_name, last_name), rooms(room_number)')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('rooms.room_number', roomNumber)
      .eq('status', 'checked_in');

    if (error || !bookings || bookings.length === 0) {
      throw new Error('No active booking found for this room');
    }

    const booking = bookings[0];
    const session = await this.startSession(kioskId, 'checkout', {
      bookingId: booking.id,
      guestId: booking.guest_id
    });

    const { data: folioResult } = await this.supabase
      .from('folio_transactions')
      .select('amount, type')
      .eq('booking_id', booking.id);

    const balance = (folioResult || []).reduce((sum, t) => {
      return sum + (t.type === 'charge' ? t.amount : -t.amount);
    }, 0);

    await this.updateSessionStep(session.id, 'folio_review', {
      guestName: `${booking.guests?.first_name} ${booking.guests?.last_name}`,
      roomNumber,
      balance
    });

    return (await this.getSession(session.id)) as KioskSession;
  }

  async finalizeKioskCheckout(
    sessionId: string,
    paymentData?: {
      amount: number;
      paymentMethod: string;
    }
  ): Promise<{
    success: boolean;
    paymentProcessed: boolean;
    receiptPrinted: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (!session.bookingId) throw new Error('No booking associated with session');

    const device = await this.getDevice(session.kioskId);
    if (!device) throw new Error('Kiosk device not found');

    let paymentProcessed = false;
    let receiptPrinted = false;

    if (paymentData && paymentData.amount > 0 && device.capabilities.hasCardReader) {
      await this.processPayment(sessionId, session.kioskId, {
        amount: paymentData.amount,
        currency: 'USD',
        paymentMethod: paymentData.paymentMethod,
        description: 'Check-out payment'
      });
      paymentProcessed = true;
    }

    if (device.capabilities.hasReceiptPrinter) {
      const { data: bookings } = await this.supabase
        .from('transactions')
        .select('*, guests(first_name, last_name)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', session.bookingId);

      if (bookings && bookings.length > 0) {
        const booking = bookings[0];
        await this.printReceipt(sessionId, session.kioskId, {
          type: 'checkout_confirmation',
          guestName: `${booking.guests?.first_name} ${booking.guests?.last_name}`,
          confirmationNumber: booking.confirmation_number,
          checkOutDate: new Date()
        });
        receiptPrinted = true;
      }
    }

    await this.supabase
      .from('transactions')
      .update({
        status: 'checked_out',
        metadata: { actual_check_out: new Date().toISOString() }
      })
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('id', session.bookingId);

    await this.completeSession(sessionId, 'success', {
      paymentProcessed,
      receiptPrinted
    });

    return {
      success: true,
      paymentProcessed,
      receiptPrinted
    };
  }

  // =============================================
  // ANALYTICS
  // =============================================

  async getKioskAnalytics(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    kioskId?: string
  ): Promise<{
    summary: Record<string, any>;
    dailyData: any[];
    deviceBreakdown: any[];
  }> {
    let summaryQuery = this.supabase
      .from('kiosk_analytics')
      .select('total_sessions, completed_sessions, abandoned_sessions, checkins_completed, checkouts_completed, avg_session_duration_seconds')
      .eq('property_id', propertyId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (kioskId) {
      summaryQuery = summaryQuery.eq('kiosk_id', kioskId);
    }

    const { data: summaryData } = await summaryQuery;

    const summary = (summaryData || []).reduce((acc, row) => ({
      total_sessions: (acc.total_sessions || 0) + (row.total_sessions || 0),
      completed_sessions: (acc.completed_sessions || 0) + (row.completed_sessions || 0),
      abandoned_sessions: (acc.abandoned_sessions || 0) + (row.abandoned_sessions || 0),
      checkins_completed: (acc.checkins_completed || 0) + (row.checkins_completed || 0),
      checkouts_completed: (acc.checkouts_completed || 0) + (row.checkouts_completed || 0),
      avg_duration_sum: (acc.avg_duration_sum || 0) + (row.avg_session_duration_seconds || 0),
      count: (acc.count || 0) + 1
    }), {} as Record<string, number>);

    const { data: dailyData } = await this.supabase
      .from('kiosk_analytics')
      .select('date, total_sessions, completed_sessions, abandoned_sessions')
      .eq('property_id', propertyId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date');

    const { data: deviceBreakdown } = await this.supabase
      .from('kiosk_analytics')
      .select('kiosk_id, total_sessions, completed_sessions, avg_session_duration_seconds, kiosk_devices(device_name, device_code)')
      .eq('property_id', propertyId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    return {
      summary: {
        totalSessions: summary.total_sessions || 0,
        completedSessions: summary.completed_sessions || 0,
        abandonedSessions: summary.abandoned_sessions || 0,
        checkinsCompleted: summary.checkins_completed || 0,
        checkoutsCompleted: summary.checkouts_completed || 0,
        avgDurationSeconds: summary.count > 0 ? Math.round(summary.avg_duration_sum / summary.count) : 0,
        completionRate: summary.total_sessions > 0
          ? Math.round((summary.completed_sessions / summary.total_sessions) * 100)
          : 0
      },
      dailyData: dailyData || [],
      deviceBreakdown: (deviceBreakdown || []).map((d: any) => ({
        kioskId: d.kiosk_id,
        deviceName: (d.kiosk_devices as any)?.device_name,
        deviceCode: (d.kiosk_devices as any)?.device_code,
        sessions: d.total_sessions,
        completed: d.completed_sessions,
        avgDuration: d.avg_session_duration_seconds
      }))
    };
  }

  // =============================================
  // HELPERS
  // =============================================

  private mapDevice(row: any): KioskDevice {
    // Build capabilities as both object and string array for frontend compatibility
    const capabilityMap: Record<string, boolean> = {
      id_scanner: row.has_id_scanner,
      card_reader: row.has_card_reader,
      key_encoder: row.has_key_encoder,
      receipt_printer: row.has_receipt_printer,
      signature_pad: row.has_signature_pad,
      camera: row.has_camera,
      cash_acceptor: row.has_cash_acceptor,
      card_dispenser: row.has_card_dispenser
    };
    const capabilitiesArray = Object.entries(capabilityMap)
      .filter(([, v]) => v)
      .map(([k]) => k);

    // Attach boolean accessors for internal use (e.g. device.capabilities.hasKeyEncoder)
    const capabilities: any = capabilitiesArray;
    capabilities.hasIdScanner = !!row.has_id_scanner;
    capabilities.hasCardReader = !!row.has_card_reader;
    capabilities.hasKeyEncoder = !!row.has_key_encoder;
    capabilities.hasReceiptPrinter = !!row.has_receipt_printer;
    capabilities.hasSignaturePad = !!row.has_signature_pad;
    capabilities.hasCamera = !!row.has_camera;
    capabilities.hasCashAcceptor = !!row.has_cash_acceptor;
    capabilities.hasCardDispenser = !!row.has_card_dispenser;

    return {
      id: row.id,
      propertyId: row.property_id,
      property_id: row.property_id,
      deviceName: row.device_name,
      name: row.device_name,
      deviceCode: row.device_code,
      location: row.location,
      deviceType: row.device_type,
      capabilities,
      status: row.status,
      config: row.config || {},
      last_heartbeat: row.last_heartbeat,
      key_stock: row.kiosk_key_stock?.[0]?.current_stock ?? row.kiosk_key_stock?.current_stock ?? 0,
      is_active: row.is_active ?? true,
      error_count: row.error_count ?? 0,
    };
  }

  private mapSession(row: any): KioskSession {
    return {
      id: row.id,
      kioskId: row.kiosk_id,
      sessionType: row.session_type,
      bookingId: row.booking_id,
      guestId: row.guest_id,
      status: row.status,
      currentStep: row.current_step,
      stepsCompleted: row.steps_completed || [],
      inputData: row.input_data || {}
    };
  }
}

export const kioskService = new KioskService();
