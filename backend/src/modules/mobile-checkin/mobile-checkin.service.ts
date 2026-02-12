/**
 * Mobile Check-in Service
 * Phase 4.1: Pre-arrival Registration, Digital Signatures, Mobile Keys
 * Refactored to use Supabase instead of Prisma
 */

import { format, addDays } from 'date-fns';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../../database/connection.js';
import Stripe from 'stripe';

// Types
interface RegistrationData {
  legalFirstName?: string;
  legalLastName?: string;
  dateOfBirth?: Date;
  nationality?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  mobilePhone?: string;
  email?: string;
  arrivalFlight?: string;
  arrivalTime?: string;
  departureFlight?: string;
  departureTime?: string;
  purposeOfVisit?: string;
  hasVehicle?: boolean;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  specialRequests?: string;
  accessibilityNeeds?: string[];
  dietaryRestrictions?: string[];
}

interface DocumentUpload {
  documentType: string;
  documentNumber?: string;
  issuingCountry?: string;
  issueDate?: Date;
  expiryDate?: Date;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface SignatureData {
  signatureType: string;
  signatureData: string; // Base64 encoded
  signatureFormat?: string;
  documentHash?: string;
  documentVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: any;
  geolocation?: { lat: number; lng: number; accuracy?: number };
}

interface MobileKeyRequest {
  provider: string;
  deviceId: string;
  deviceType: string;
  deviceModel?: string;
  pushToken?: string;
  accessAreas?: string[];
  pin?: string;
}

export class MobileCheckinService {
  private stripe: Stripe;

  private get supabase() {
    return getSupabase();
  }

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }

  // =============================================
  // PRE-ARRIVAL REGISTRATION
  // =============================================

  async createRegistration(bookingId: string): Promise<any> {
    // Get booking details
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('*, guests(email, first_name, last_name)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if registration already exists
    const { data: existing } = await this.supabase
      .from('pre_arrival_registrations')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Generate access token
    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = addDays(new Date(booking.check_in), 1);

    const guest = booking.guests as any;
    const { data: registration, error } = await this.supabase
      .from('pre_arrival_registrations')
      .insert({
        id: uuidv4(),
        property_id: booking.property_id,
        booking_id: bookingId,
        guest_id: booking.guest_id,
        email: guest?.email,
        legal_first_name: guest?.first_name,
        legal_last_name: guest?.last_name,
        access_token: accessToken,
        token_expires_at: tokenExpires.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return registration;
  }

  async getRegistrationByToken(token: string): Promise<any> {
    const { data: registration } = await this.supabase
      .from('pre_arrival_registrations')
      .select(`
        *,
        bookings(confirmation_number, check_in, check_out, room_type_id),
        properties(name, address)
      `)
      .eq('access_token', token)
      .gt('token_expires_at', new Date().toISOString())
      .maybeSingle();

    if (!registration) {
      throw new Error('Invalid or expired registration link');
    }

    // Get any uploaded documents
    const { data: documents } = await this.supabase
      .from('guest_documents')
      .select('*')
      .eq('registration_id', registration.id)
      .order('created_at', { ascending: false });

    // Get any signatures
    const { data: signatures } = await this.supabase
      .from('digital_signatures')
      .select('*')
      .eq('registration_id', registration.id);

    // Get terms that need acceptance
    const { data: allTerms } = await this.supabase
      .from('terms_versions')
      .select('*')
      .eq('property_id', registration.property_id)
      .eq('is_current', true);

    // Filter out already accepted terms
    const { data: acceptedTerms } = await this.supabase
      .from('terms_acceptance')
      .select('terms_id')
      .eq('guest_id', registration.guest_id)
      .eq('booking_id', registration.booking_id);

    const acceptedIds = new Set((acceptedTerms || []).map((t: any) => t.terms_id));
    const pendingTerms = (allTerms || []).filter((t: any) => !acceptedIds.has(t.id));

    return {
      ...registration,
      documents: documents || [],
      signatures: signatures || [],
      pendingTerms
    };
  }

  async updateRegistration(
    registrationId: string,
    data: RegistrationData,
    ipAddress?: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (data.legalFirstName) updateData.legal_first_name = data.legalFirstName;
    if (data.legalLastName) updateData.legal_last_name = data.legalLastName;
    if (data.dateOfBirth) updateData.date_of_birth = format(data.dateOfBirth, 'yyyy-MM-dd');
    if (data.nationality) updateData.nationality = data.nationality;
    if (data.addressLine1) updateData.address_line1 = data.addressLine1;
    if (data.addressLine2) updateData.address_line2 = data.addressLine2;
    if (data.city) updateData.city = data.city;
    if (data.stateProvince) updateData.state_province = data.stateProvince;
    if (data.postalCode) updateData.postal_code = data.postalCode;
    if (data.country) updateData.country = data.country;
    if (data.mobilePhone) updateData.mobile_phone = data.mobilePhone;
    if (data.email) updateData.email = data.email;
    if (data.arrivalFlight) updateData.arrival_flight = data.arrivalFlight;
    if (data.arrivalTime) updateData.arrival_time = data.arrivalTime;
    if (data.departureFlight) updateData.departure_flight = data.departureFlight;
    if (data.departureTime) updateData.departure_time = data.departureTime;
    if (data.purposeOfVisit) updateData.purpose_of_visit = data.purposeOfVisit;
    if (data.hasVehicle !== undefined) updateData.has_vehicle = data.hasVehicle;
    if (data.vehicleMake) updateData.vehicle_make = data.vehicleMake;
    if (data.vehicleModel) updateData.vehicle_model = data.vehicleModel;
    if (data.vehicleColor) updateData.vehicle_color = data.vehicleColor;
    if (data.vehiclePlate) updateData.vehicle_plate = data.vehiclePlate;
    if (data.specialRequests) updateData.special_requests = data.specialRequests;
    if (data.accessibilityNeeds) updateData.accessibility_needs = data.accessibilityNeeds;
    if (data.dietaryRestrictions) updateData.dietary_restrictions = data.dietaryRestrictions;

    // Get current registration to check status
    const { data: current } = await this.supabase
      .from('pre_arrival_registrations')
      .select('status, started_at')
      .eq('id', registrationId)
      .single();

    // Update status if this is the first update
    if (current?.status === 'pending') {
      updateData.status = 'started';
    }
    if (!current?.started_at) {
      updateData.started_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('pre_arrival_registrations')
      .update(updateData)
      .eq('id', registrationId);

    if (error) throw error;
  }

  async submitRegistration(registrationId: string): Promise<void> {
    // Check if all required fields are filled
    const { data: registration } = await this.supabase
      .from('pre_arrival_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Check for required documents
    const { data: docs, count: docCount } = await this.supabase
      .from('guest_documents')
      .select('*', { count: 'exact' })
      .eq('registration_id', registrationId)
      .in('document_type', ['passport', 'national_id', 'drivers_license']);

    if (!docCount || docCount === 0) {
      throw new Error('At least one ID document is required');
    }

    // Check for required signatures
    const { data: sigs, count: sigCount } = await this.supabase
      .from('digital_signatures')
      .select('*', { count: 'exact' })
      .eq('registration_id', registrationId)
      .eq('signature_type', 'registration_form');

    if (!sigCount || sigCount === 0) {
      throw new Error('Signature is required');
    }

    // Update status
    const { error } = await this.supabase
      .from('pre_arrival_registrations')
      .update({
        status: 'documents_uploaded',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (error) throw error;
  }

  async approveRegistration(registrationId: string, userId: string, notes?: string): Promise<void> {
    const { error } = await this.supabase
      .from('pre_arrival_registrations')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        reviewed_by: userId,
        review_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (error) throw error;
  }

  async rejectRegistration(registrationId: string, userId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('pre_arrival_registrations')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', registrationId);

    if (error) throw error;
  }

  async getPendingRegistrations(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('pre_arrival_registrations')
      .select(`
        *,
        bookings(confirmation_number, check_in),
        guests(first_name, last_name, email)
      `)
      .eq('property_id', propertyId)
      .in('status', ['documents_uploaded', 'review_required'])
      .order('bookings(check_in)', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // =============================================
  // DOCUMENT MANAGEMENT
  // =============================================

  async uploadDocument(
    registrationId: string,
    document: DocumentUpload
  ): Promise<any> {
    const { data: registration } = await this.supabase
      .from('pre_arrival_registrations')
      .select('property_id, guest_id')
      .eq('id', registrationId)
      .single();

    if (!registration) {
      throw new Error('Registration not found');
    }

    const { data: doc, error } = await this.supabase
      .from('guest_documents')
      .insert({
        id: uuidv4(),
        property_id: registration.property_id,
        guest_id: registration.guest_id,
        registration_id: registrationId,
        document_type: document.documentType,
        document_number: document.documentNumber,
        issuing_country: document.issuingCountry,
        issue_date: document.issueDate ? format(document.issueDate, 'yyyy-MM-dd') : null,
        expiry_date: document.expiryDate ? format(document.expiryDate, 'yyyy-MM-dd') : null,
        file_url: document.fileUrl,
        file_name: document.fileName,
        file_type: document.fileType,
        file_size: document.fileSize
      })
      .select()
      .single();

    if (error) throw error;
    return doc;
  }

  async verifyDocument(documentId: string, userId: string, ocrData?: any): Promise<void> {
    const { error } = await this.supabase
      .from('guest_documents')
      .update({
        is_verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString(),
        verification_method: ocrData ? 'ocr' : 'manual',
        ocr_data: ocrData,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) throw error;
  }

  async getGuestDocuments(guestId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('guest_documents')
      .select('*')
      .eq('guest_id', guestId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // =============================================
  // DIGITAL SIGNATURES
  // =============================================

  async captureSignature(
    registrationId: string,
    signature: SignatureData
  ): Promise<any> {
    const { data: registration } = await this.supabase
      .from('pre_arrival_registrations')
      .select('property_id, guest_id, booking_id')
      .eq('id', registrationId)
      .single();

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Calculate document hash if content provided
    const documentHash = signature.documentHash || 
      crypto.createHash('sha256').update(signature.signatureType + Date.now()).digest('hex');

    const { data: sig, error } = await this.supabase
      .from('digital_signatures')
      .insert({
        id: uuidv4(),
        property_id: registration.property_id,
        guest_id: registration.guest_id,
        registration_id: registrationId,
        booking_id: registration.booking_id,
        signature_type: signature.signatureType,
        signature_data: signature.signatureData,
        signature_format: signature.signatureFormat || 'image/png',
        document_hash: documentHash,
        document_version: signature.documentVersion || '1.0',
        ip_address: signature.ipAddress,
        user_agent: signature.userAgent,
        device_info: signature.deviceInfo,
        geolocation: signature.geolocation
      })
      .select()
      .single();

    if (error) throw error;
    return sig;
  }

  // =============================================
  // TERMS ACCEPTANCE
  // =============================================

  async acceptTerms(
    guestId: string,
    termsId: string,
    bookingId: string,
    ipAddress?: string,
    userAgent?: string,
    signatureId?: string
  ): Promise<void> {
    const { data: terms } = await this.supabase
      .from('terms_versions')
      .select('property_id')
      .eq('id', termsId)
      .single();

    if (!terms) {
      throw new Error('Terms not found');
    }

    const { error } = await this.supabase
      .from('terms_acceptance')
      .upsert({
        id: uuidv4(),
        guest_id: guestId,
        property_id: terms.property_id,
        terms_id: termsId,
        booking_id: bookingId,
        ip_address: ipAddress,
        user_agent: userAgent,
        signature_id: signatureId
      }, {
        onConflict: 'guest_id,terms_id,booking_id',
        ignoreDuplicates: true
      });

    if (error) throw error;
  }

  async getCurrentTerms(propertyId: string, termsType: string, language: string = 'en'): Promise<any> {
    const { data, error } = await this.supabase
      .from('terms_versions')
      .select('*')
      .eq('property_id', propertyId)
      .eq('terms_type', termsType)
      .eq('language', language)
      .eq('is_current', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // =============================================
  // MOBILE KEYS
  // =============================================

  async requestMobileKey(
    bookingId: string,
    request: MobileKeyRequest
  ): Promise<any> {
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('*, rooms(room_number)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if key already exists for this device
    const { data: existing } = await this.supabase
      .from('mobile_keys')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('device_id', request.deviceId)
      .not('status', 'in', '("revoked","expired")')
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Generate PIN hash if provided
    let pinHash = null;
    if (request.pin) {
      pinHash = crypto.createHash('sha256').update(request.pin).digest('hex');
    }

    // Set access times based on booking
    const accessStarts = new Date(booking.check_in);
    accessStarts.setHours(15, 0, 0, 0); // 3 PM check-in
    const accessEnds = new Date(booking.check_out);
    accessEnds.setHours(11, 0, 0, 0); // 11 AM check-out

    const keyId = uuidv4();
    const { data: key, error } = await this.supabase
      .from('mobile_keys')
      .insert({
        id: keyId,
        property_id: booking.property_id,
        booking_id: bookingId,
        guest_id: booking.guest_id,
        room_id: booking.room_id,
        status: 'pending',
        provider: request.provider,
        device_id: request.deviceId,
        device_type: request.deviceType,
        device_model: request.deviceModel,
        push_token: request.pushToken,
        access_areas: request.accessAreas || ['room'],
        room_access_starts: accessStarts.toISOString(),
        room_access_ends: accessEnds.toISOString(),
        pin_hash: pinHash
      })
      .select()
      .single();

    if (error) throw error;

    // Issue the key
    await this.issueMobileKey(keyId);

    return this.getMobileKeyById(keyId);
  }

  private async issueMobileKey(keyId: string): Promise<void> {
    // In production, this would call the lock provider API
    // (ASSA ABLOY, Salto, dormakaba, OpenKey, etc.)
    
    // Simulating credential issuance
    const providerCredential = {
      credentialId: crypto.randomBytes(16).toString('hex'),
      encryptedKey: crypto.randomBytes(32).toString('base64'),
      issuedAt: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('mobile_keys')
      .update({
        status: 'active',
        issued_at: new Date().toISOString(),
        provider_key_id: providerCredential.credentialId,
        provider_credential: providerCredential,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);

    if (error) throw error;
  }

  async getMobileKeyById(keyId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('mobile_keys')
      .select('*, rooms(room_number), bookings(confirmation_number)')
      .eq('id', keyId)
      .single();

    if (error) throw error;
    return data;
  }

  async getMobileKeyByBooking(bookingId: string, deviceId?: string): Promise<any[]> {
    let query = this.supabase
      .from('mobile_keys')
      .select('*')
      .eq('booking_id', bookingId)
      .not('status', 'in', '("revoked","expired")');

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async revokeMobileKey(keyId: string, userId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('mobile_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
        revoke_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);

    if (error) throw error;
    // In production, would also revoke with lock provider
  }

  async validateKeyAccess(keyId: string, accessPoint: string): Promise<boolean> {
    const { data: key } = await this.supabase
      .from('mobile_keys')
      .select('*, rooms(room_number)')
      .eq('id', keyId)
      .eq('status', 'active')
      .single();

    if (!key) return false;

    const now = new Date();
    const accessStarts = new Date(key.room_access_starts);
    const accessEnds = new Date(key.room_access_ends);

    if (now < accessStarts || now > accessEnds) return false;

    // Check if access point is allowed
    const accessAreas = key.access_areas || ['room'];
    if (accessPoint === 'room' && accessAreas.includes('room')) return true;
    if (accessAreas.includes(accessPoint)) return true;

    return false;
  }

  async logKeyAccess(
    keyId: string,
    accessPoint: string,
    accessPointType: string,
    granted: boolean,
    failureReason?: string,
    deviceInfo?: any
  ): Promise<void> {
    const { data: key } = await this.supabase
      .from('mobile_keys')
      .select('property_id')
      .eq('id', keyId)
      .single();

    if (!key) return;

    const { error } = await this.supabase
      .from('mobile_key_access_log')
      .insert({
        id: uuidv4(),
        mobile_key_id: keyId,
        property_id: key.property_id,
        access_point: accessPoint,
        access_point_type: accessPointType,
        access_granted: granted,
        failure_reason: failureReason,
        access_method: 'mobile_key',
        device_id: deviceInfo?.deviceId
      });

    if (error) throw error;
  }

  // =============================================
  // CHECK-IN SESSIONS
  // =============================================

  async startCheckinSession(
    bookingId: string,
    channel: string,
    deviceInfo?: any
  ): Promise<any> {
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check for existing registration
    const { data: registration } = await this.supabase
      .from('pre_arrival_registrations')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();

    const { data: session, error } = await this.supabase
      .from('checkin_sessions')
      .insert({
        id: uuidv4(),
        property_id: booking.property_id,
        booking_id: bookingId,
        guest_id: booking.guest_id,
        registration_id: registration?.id,
        session_type: 'check_in',
        channel,
        status: 'started',
        current_step: 'identity_verification',
        device_type: deviceInfo?.deviceType,
        device_id: deviceInfo?.deviceId,
        ip_address: deviceInfo?.ipAddress,
        user_agent: deviceInfo?.userAgent
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  }

  async updateCheckinSession(
    sessionId: string,
    step: string,
    data?: any
  ): Promise<void> {
    const { data: session } = await this.supabase
      .from('checkin_sessions')
      .select('steps_completed')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    const stepsCompleted = [...(session.steps_completed || []), step];

    const { error } = await this.supabase
      .from('checkin_sessions')
      .update({
        steps_completed: stepsCompleted,
        current_step: step,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async completeCheckin(
    sessionId: string,
    roomId: string,
    keyType: 'mobile' | 'physical' | 'both',
    mobileKeyId?: string,
    physicalKeyNumber?: string
  ): Promise<void> {
    const { data: session } = await this.supabase
      .from('checkin_sessions')
      .select('booking_id, registration_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    // Update session
    await this.supabase
      .from('checkin_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        assigned_room_id: roomId,
        key_type: keyType,
        mobile_key_id: mobileKeyId,
        physical_key_number: physicalKeyNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    // Update booking
    await this.supabase
      .from('bookings')
      .update({
        status: 'checked_in',
        room_id: roomId,
        actual_check_in: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', session.booking_id);

    // Update registration if exists
    if (session.registration_id) {
      await this.supabase
        .from('pre_arrival_registrations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', session.registration_id);
    }
  }

  // =============================================
  // PUSH NOTIFICATIONS
  // =============================================

  async registerPushToken(
    guestId: string,
    propertyId: string,
    deviceToken: string,
    platform: string,
    deviceInfo?: any
  ): Promise<void> {
    const { error } = await this.supabase
      .from('push_registrations')
      .upsert({
        id: uuidv4(),
        guest_id: guestId,
        property_id: propertyId,
        device_token: deviceToken,
        platform,
        device_id: deviceInfo?.deviceId,
        device_name: deviceInfo?.deviceName,
        app_version: deviceInfo?.appVersion,
        os_version: deviceInfo?.osVersion,
        is_active: true,
        last_active_at: new Date().toISOString()
      }, {
        onConflict: 'guest_id,device_token'
      });

    if (error) throw error;
  }

  async sendPushNotification(
    guestId: string,
    propertyId: string,
    title: string,
    body: string,
    notificationType: string,
    actionData?: any,
    bookingId?: string
  ): Promise<void> {
    // Get active push registrations
    const { data: registrations } = await this.supabase
      .from('push_registrations')
      .select('*')
      .eq('guest_id', guestId)
      .eq('is_active', true);

    if (!registrations || registrations.length === 0) {
      return;
    }

    // Create notification record
    const { error } = await this.supabase
      .from('push_notifications')
      .insert({
        id: uuidv4(),
        property_id: propertyId,
        guest_id: guestId,
        booking_id: bookingId,
        title,
        body,
        notification_type: notificationType,
        action_type: actionData?.type || 'open_app',
        action_data: actionData,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: registrations.length
      });

    if (error) throw error;

    // In production, would send via Firebase/APNS here
    // For each registration, send push notification
  }

  async sendCheckinReminder(bookingId: string): Promise<void> {
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('*, properties(name)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return;
    }

    const propertyName = (booking.properties as any)?.name || 'the property';

    await this.sendPushNotification(
      booking.guest_id,
      booking.property_id,
      'Check-in Now Available',
      `Your room at ${propertyName} is ready! Complete mobile check-in to get your room key.`,
      'check_in_reminder',
      { type: 'open_screen', screen: 'check_in', bookingId },
      bookingId
    );
  }

  async sendRoomReadyNotification(bookingId: string, roomNumber: string): Promise<void> {
    const { data: booking } = await this.supabase
      .from('bookings')
      .select('*, properties(name)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return;
    }

    const propertyName = (booking.properties as any)?.name || 'the property';

    await this.sendPushNotification(
      booking.guest_id,
      booking.property_id,
      'Your Room is Ready! 🔑',
      `Room ${roomNumber} at ${propertyName} is ready for you. Open the app to get your mobile key.`,
      'room_ready',
      { type: 'open_screen', screen: 'mobile_key', bookingId, roomNumber },
      bookingId
    );
  }
}

export const mobileCheckinService = new MobileCheckinService();
