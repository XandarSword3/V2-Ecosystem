import { getSupabase } from '../../database/connection.js';

import crypto from 'crypto';

import { OtaProvider, SiteMinderProvider } from './ota.provider.js';



// Get supabase client (lazy-loaded via proxy to avoid initialization issues)

const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {

  get(_, prop) { return getSupabase()[prop as keyof ReturnType<typeof getSupabase>]; }

});



// Channel codes

export const CHANNELS = {

  BOOKING: { code: 'BOOKING', name: 'Booking.com' },

  EXPEDIA: { code: 'EXPEDIA', name: 'Expedia' },

  AGODA: { code: 'AGODA', name: 'Agoda' },

  AIRBNB: { code: 'AIRBNB', name: 'Airbnb' },

  VRBO: { code: 'VRBO', name: 'VRBO' },

  TRIPADVISOR: { code: 'TRIPADVISOR', name: 'TripAdvisor' },

  GOOGLE: { code: 'GOOGLE', name: 'Google Hotels' },

  HOTELSCOM: { code: 'HOTELSCOM', name: 'Hotels.com' }

} as const;



// SiteMinder API configuration

const SITEMINDER_CONFIG = {

  baseUrl: process.env.SITEMINDER_API_URL || 'https://api.siteminder.com/v2',

  clientId: process.env.SITEMINDER_CLIENT_ID,

  clientSecret: process.env.SITEMINDER_CLIENT_SECRET

};



interface SiteMinderTokenResponse {

  access_token: string;

  token_type: string;

  expires_in: number;

}



interface AvailabilityUpdate {

  date: string;

  roomTypeCode: string;

  available: number;

}



interface RateUpdate {

  date: string;

  roomTypeCode: string;

  rateCode: string;

  rate: number;

  currency: string;

  minStay?: number;

  maxStay?: number;

  closed?: boolean;

}



// ==================== AUTHENTICATION ====================



let siteMinderToken: { token: string; expiresAt: number } | null = null;



async function getSiteMinderToken(): Promise<string> {

  // Check if we have a valid cached token

  if (siteMinderToken && siteMinderToken.expiresAt > Date.now() + 60000) {

    return siteMinderToken.token;

  }



  const response = await fetch(`${SITEMINDER_CONFIG.baseUrl}/oauth/token`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/x-www-form-urlencoded'

    },

    body: new URLSearchParams({

      grant_type: 'client_credentials',

      client_id: SITEMINDER_CONFIG.clientId!,

      client_secret: SITEMINDER_CONFIG.clientSecret!

    })

  });



  if (!response.ok) {

    throw new Error(`SiteMinder auth failed: ${response.status}`);

  }



  const data = await response.json() as SiteMinderTokenResponse;

  

  siteMinderToken = {

    token: data.access_token,

    expiresAt: Date.now() + (data.expires_in * 1000)

  };



  return data.access_token;

}



async function siteMinderRequest(

  endpoint: string,

  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',

  body?: any

): Promise<any> {

  const token = await getSiteMinderToken();



  const response = await fetch(`${SITEMINDER_CONFIG.baseUrl}${endpoint}`, {

    method,

    headers: {

      'Authorization': `Bearer ${token}`,

      'Content-Type': 'application/json'

    },

    body: body ? JSON.stringify(body) : undefined

  });



  if (!response.ok) {

    const errorText = await response.text();

    throw new Error(`SiteMinder API error: ${response.status} - ${errorText}`);

  }



  return response.json();

}



function getOtaProvider(connection: { siteminder_property_id?: string | null }): OtaProvider | null {

  if (connection.siteminder_property_id) {

    return new SiteMinderProvider(siteMinderRequest);

  }

  return null;

}



// ==================== CONNECTION MANAGEMENT ====================



export interface ChannelConnection {

  id: string;

  property_id: string;

  channel_code: string;

  channel_name: string;

  status: 'pending' | 'active' | 'paused' | 'error';

  hotel_code?: string;

  siteminder_property_id?: string;

  last_sync_at?: string;

  last_error?: string;

  config: Record<string, any>;

}



export async function getConnections(propertyId: string): Promise<ChannelConnection[]> {

  const { data, error } = await supabase

    .from('channel_connections')

    .select('*')

    .eq('property_id', propertyId)

    .order('channel_name');



  if (error) throw error;

  return data || [];

}



export async function getConnection(connectionId: string): Promise<ChannelConnection | null> {

  const { data, error } = await supabase

    .from('channel_connections')

    .select('*')

    .eq('id', connectionId)

    .single();



  if (error) return null;

  return data;

}



export async function createConnection(

  propertyId: string,

  channelCode: string,

  hotelCode?: string,

  siteMinderPropertyId?: string

): Promise<ChannelConnection> {

  const channel = Object.values(CHANNELS).find(c => c.code === channelCode);

  if (!channel) {

    throw new Error(`Invalid channel code: ${channelCode}`);

  }



  const { data, error } = await supabase

    .from('channel_connections')

    .insert({

      property_id: propertyId,

      channel_code: channelCode,

      channel_name: channel.name,

      hotel_code: hotelCode,

      siteminder_property_id: siteMinderPropertyId,

      status: 'pending'

    })

    .select()

    .single();



  if (error) throw error;



  // Log sync activity

  await logSyncActivity(data.id, 'connection_created', 'outbound', 'success', {

    channel: channelCode

  });



  return data;

}



export async function updateConnectionStatus(

  connectionId: string,

  status: 'pending' | 'active' | 'paused' | 'error',

  error?: string

): Promise<void> {

  const updateData: Record<string, any> = {

    status,

    last_error: error || null

  };



  if (error) {

    // Increment error count when an error is provided

    const { data } = await supabase

      .from('channel_connections')

      .select('error_count')

      .eq('id', connectionId)

      .single();

    updateData.error_count = (data?.error_count || 0) + 1;

  } else if (status === 'active') {

    // FIX: Iteration 16 - Only reset error count when explicitly activating (not when pausing)

    updateData.error_count = 0;

  }

  // FIX: Iteration 16 - For 'paused' or 'pending' without error, error_count is preserved



  await supabase

    .from('channel_connections')

    .update(updateData)

    .eq('id', connectionId);

}



export async function activateConnection(connectionId: string): Promise<void> {

  // Verify connection with SiteMinder

  const connection = await getConnection(connectionId);

  if (!connection) throw new Error('Connection not found');



  const provider = getOtaProvider(connection);

  if (provider && connection.siteminder_property_id) {

    try {

      await provider.verifyProperty(connection.siteminder_property_id);

      await updateConnectionStatus(connectionId, 'active');

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Verification failed';

      await updateConnectionStatus(connectionId, 'error', message);

      throw err;

    }

  } else {

    // Direct connection - mark as active

    await updateConnectionStatus(connectionId, 'active');

  }

}



export async function deleteConnection(connectionId: string): Promise<void> {

  const client = supabase;



  await client

    .from('channel_connections')

    .delete()

    .eq('id', connectionId);

}



// ==================== ROOM MAPPINGS ====================



export interface RoomMapping {

  id: string;

  connection_id: string;

  room_type_id: string;

  channel_room_code: string;

  channel_room_name: string;

  is_active: boolean;

}



export async function getRoomMappings(connectionId: string): Promise<RoomMapping[]> {

  const { data, error } = await supabase

    .from('channel_room_mappings')

    .select('*, metadatas(name)')

    .eq('connection_id', connectionId);



  if (error) throw error;

  return data || [];

}



export async function createRoomMapping(

  connectionId: string,

  roomTypeId: string,

  channelRoomCode: string,

  channelRoomName: string

): Promise<RoomMapping> {

  const { data, error } = await supabase

    .from('channel_room_mappings')

    .insert({

      connection_id: connectionId,

      room_type_id: roomTypeId,

      channel_room_code: channelRoomCode,

      channel_room_name: channelRoomName

    })

    .select()

    .single();



  if (error) throw error;

  return data;

}



export async function updateRoomMapping(

  mappingId: string,

  updates: Partial<RoomMapping>

): Promise<void> {

  await supabase

    .from('channel_room_mappings')

    .update(updates)

    .eq('id', mappingId);

}



export async function deleteRoomMapping(mappingId: string): Promise<void> {

  await supabase

    .from('channel_room_mappings')

    .delete()

    .eq('id', mappingId);

}



// ==================== RATE MAPPINGS ====================



export interface RateMapping {

  id: string;

  connection_id: string;

  rate_plan_id: string;

  channel_rate_code: string;

  channel_rate_name: string;

  is_active: boolean;

  markup_type: 'percentage' | 'fixed';

  markup_value: number;

  commission_rate?: number;

}



export async function getRateMappings(connectionId: string): Promise<RateMapping[]> {

  const { data, error } = await supabase

    .from('channel_rate_mappings')

    .select('*, rate_plans(name)')

    .eq('connection_id', connectionId);



  if (error) throw error;

  return data || [];

}



export async function createRateMapping(

  connectionId: string,

  ratePlanId: string,

  channelRateCode: string,

  channelRateName: string,

  options?: {

    markupType?: 'percentage' | 'fixed';

    markupValue?: number;

    commissionRate?: number;

  }

): Promise<RateMapping> {

  const { data, error } = await supabase

    .from('channel_rate_mappings')

    .insert({

      connection_id: connectionId,

      rate_plan_id: ratePlanId,

      channel_rate_code: channelRateCode,

      channel_rate_name: channelRateName,

      markup_type: options?.markupType || 'percentage',

      markup_value: options?.markupValue || 0,

      commission_rate: options?.commissionRate

    })

    .select()

    .single();



  if (error) throw error;

  return data;

}



// ==================== AVAILABILITY SYNC ====================



export async function pushAvailability(

  connectionId: string,

  updates: AvailabilityUpdate[]

): Promise<{ success: number; failed: number }> {

  const connection = await getConnection(connectionId);

  if (!connection || connection.status !== 'active') {

    throw new Error('Connection not active');

  }



  const startTime = Date.now();

  let success = 0;

  let failed = 0;



  const client = supabase;



  // Get room mappings

  const roomMappings = await getRoomMappings(connectionId);

  const roomMappingMap = new Map(

    roomMappings.map(m => [(metadata as any)?.room_type_id, m])

  );



  for (const update of updates) {

    const mapping = Array.from(roomMappingMap.values())

      .find(m => m.channel_room_code === update.roomTypeCode);



    if (!mapping) {

      failed++;

      continue;

    }



    // Store the update

    const { data: updateRecord, error: insertError } = await client

      .from('channel_availability_updates')

      .insert({

        connection_id: connectionId,

        room_mapping_id: mapping.id,

        date: update.date,

        available_units: update.available,

        status: 'pending'

      })

      .select()

      .single();



    if (insertError) {

      failed++;

      continue;

    }



    // Push to SiteMinder if configured

    const provider = getOtaProvider(connection);

    if (provider && connection.siteminder_property_id) {

      try {

        await provider.pushAvailability(connection.siteminder_property_id, {

          roomTypeCode: mapping.channel_room_code,

          date: update.date,

          available: update.available,

        });



        await client

          .from('channel_availability_updates')

          .update({

            status: 'confirmed',

            sent_at: new Date().toISOString(),

            confirmed_at: new Date().toISOString()

          })

          .eq('id', updateRecord.id);



        success++;

      } catch (err) {

        const errorMessage = err instanceof Error ? err.message : 'Push failed';

        await client

          .from('channel_availability_updates')

          .update({

            status: 'failed',

            error_message: errorMessage,

            retry_count: 1

          })

          .eq('id', updateRecord.id);



        failed++;

      }

    } else {

      // Direct channel - mark as sent (would need channel-specific API)

      await client

        .from('channel_availability_updates')

        .update({

          status: 'sent',

          sent_at: new Date().toISOString()

        })

        .eq('id', updateRecord.id);



      success++;

    }

  }



  // Log sync activity

  await logSyncActivity(connectionId, 'availability_push', 'outbound', 

    failed === 0 ? 'success' : 'failed', {

      records_processed: success,

      records_failed: failed,

      duration_ms: Date.now() - startTime

    });



  // Update connection last sync

  await client

    .from('channel_connections')

    .update({ last_sync_at: new Date().toISOString() })

    .eq('id', connectionId);



  return { success, failed };

}



export async function pushAvailabilityForDateRange(

  connectionId: string,

  startDate: Date,

  endDate: Date

): Promise<{ success: number; failed: number }> {

  const connection = await getConnection(connectionId);

  if (!connection) throw new Error('Connection not found');



  // Get all room mappings for this connection

  const mappings = await getRoomMappings(connectionId);

  

  // Get availability for date range from our system

  const { data: availability } = await supabase

    .from('room_availability')

    .select('metadata_id, date, available_units')

    .gte('date', startDate.toISOString().split('T')[0])

    .lte('date', endDate.toISOString().split('T')[0])

    .in('room_type_id', mappings.map(m => (metadata as any)?.room_type_id));



  // Transform to updates

  const updates: AvailabilityUpdate[] = (availability || []).map(a => {

    const mapping = mappings.find(m => (metadata as any)?.room_type_id === (metadata as any)?.room_type_id);

    return {

      date: a.date,

      roomTypeCode: mapping?.channel_room_code || '',

      available: a.available_units

    };

  }).filter(u => u.roomTypeCode);



  return pushAvailability(connectionId, updates);

}



// ==================== RATE SYNC ====================



export async function pushRates(

  connectionId: string,

  updates: RateUpdate[]

): Promise<{ success: number; failed: number }> {

  const connection = await getConnection(connectionId);

  if (!connection || connection.status !== 'active') {

    throw new Error('Connection not active');

  }



  const startTime = Date.now();

  let success = 0;

  let failed = 0;



  const client = supabase;

  const roomMappings = await getRoomMappings(connectionId);

  const rateMappings = await getRateMappings(connectionId);



  for (const update of updates) {

    const roomMapping = roomMappings.find(m => m.channel_room_code === update.roomTypeCode);

    const rateMapping = rateMappings.find(m => m.channel_rate_code === update.rateCode);



    if (!roomMapping || !rateMapping) {

      failed++;

      continue;

    }



    // Apply markup

    let finalRate = update.rate;

    if (rateMapping.markup_type === 'percentage') {

      finalRate = update.rate * (1 + rateMapping.markup_value / 100);

    } else {

      finalRate = update.rate + rateMapping.markup_value;

    }



    // Store the update

    const { data: updateRecord, error: insertError } = await client

      .from('channel_rate_updates')

      .insert({

        connection_id: connectionId,

        room_mapping_id: roomMapping.id,

        rate_mapping_id: rateMapping.id,

        date: update.date,

        rate: finalRate,

        currency: update.currency,

        min_stay: update.minStay,

        max_stay: update.maxStay,

        closed: update.closed || false,

        status: 'pending'

      })

      .select()

      .single();



    if (insertError) {

      failed++;

      continue;

    }



    // Push to SiteMinder

    const provider = getOtaProvider(connection);

    if (provider && connection.siteminder_property_id) {

      try {

        await provider.pushRate(connection.siteminder_property_id, {

          roomTypeCode: roomMapping.channel_room_code,

          rateCode: rateMapping.channel_rate_code,

          date: update.date,

          amount: finalRate,

          currency: update.currency,

          minStay: update.minStay,

          maxStay: update.maxStay,

          closed: update.closed,

        });



        await client

          .from('channel_rate_updates')

          .update({

            status: 'confirmed',

            sent_at: new Date().toISOString(),

            confirmed_at: new Date().toISOString()

          })

          .eq('id', updateRecord.id);



        success++;

      } catch (err) {

        const errorMessage = err instanceof Error ? err.message : 'Push failed';

        await client

          .from('channel_rate_updates')

          .update({

            status: 'failed',

            error_message: errorMessage

          })

          .eq('id', updateRecord.id);



        failed++;

      }

    } else {

      success++;

    }

  }



  await logSyncActivity(connectionId, 'rate_push', 'outbound',

    failed === 0 ? 'success' : 'failed', {

      records_processed: success,

      records_failed: failed,

      duration_ms: Date.now() - startTime

    });



  return { success, failed };

}



// ==================== RESERVATION HANDLING ====================



export interface InboundReservation {

  channelBookingRef: string;

  channelGuestId?: string;

  guestName: string;

  guestEmail?: string;

  guestPhone?: string;

  checkIn: string;

  checkOut: string;

  roomTypeCode: string;

  rateCode?: string;

  numAdults: number;

  numChildren: number;

  totalAmount: number;

  currency: string;

  commissionAmount?: number;

  paymentStatus: 'pending' | 'partial' | 'paid';

  bookingStatus: 'new' | 'modified' | 'cancelled';

  specialRequests?: string;

  rawData?: any;

}



export async function processInboundReservation(

  connectionId: string,

  reservation: InboundReservation

): Promise<{ channelReservationId: string; reservationId?: string }> {

  const client = supabase;



  // Get mappings

  const roomMappings = await getRoomMappings(connectionId);

  const rateMappings = await getRateMappings(connectionId);



  const roomMapping = roomMappings.find(m => m.channel_room_code === reservation.roomTypeCode);

  const rateMapping = reservation.rateCode 

    ? rateMappings.find(m => m.channel_rate_code === reservation.rateCode)

    : null;



  // Store channel reservation

  const { data: channelRes, error: channelError } = await client

    .from('channel_reservations')

    .insert({

      connection_id: connectionId,

      channel_booking_ref: reservation.channelBookingRef,

      channel_guest_id: reservation.channelGuestId,

      guest_name: reservation.guestName,

      guest_email: reservation.guestEmail,

      guest_phone: reservation.guestPhone,

      check_in: reservation.checkIn,

      check_out: reservation.checkOut,

      room_mapping_id: roomMapping?.id,

      rate_mapping_id: rateMapping?.id,

      num_adults: reservation.numAdults,

      num_children: reservation.numChildren,

      total_amount: reservation.totalAmount,

      currency: reservation.currency,

      commission_amount: reservation.commissionAmount,

      payment_status: reservation.paymentStatus,

      booking_status: reservation.bookingStatus,

      special_requests: reservation.specialRequests,

      raw_data: reservation.rawData

    })

    .select()

    .single();



  if (channelError) throw channelError;



  // For new reservations, create in our system

  if (reservation.bookingStatus === 'new' && roomMapping) {

    try {

      // Find or create guest

      let guestId: string | undefined;

      if (reservation.guestEmail) {

        const { data: existingGuest } = await client

          .from('guests')

          .select('id')

          .eq('email', reservation.guestEmail)

          .single();



        if (existingGuest) {

          guestId = existingGuest.id;

        } else {

          const nameParts = reservation.guestName.split(' ');

          const { data: newGuest } = await client

            .from('guests')

            .insert({

              full_name: nameParts.join(" ") || '',

              email: reservation.guestEmail,

              phone: reservation.guestPhone

            })

            .select()

            .single();

          

          guestId = newGuest?.id;

        }

      }



      // Create reservation

      const { data: newReservation } = await client

        .from('reservations')

        .insert({

          guest_id: guestId,

          room_type_id: (metadata as any)?.room_type_id,

          check_in: reservation.checkIn,

          check_out: reservation.checkOut,

          num_adults: reservation.numAdults,

          num_children: reservation.numChildren,

          total_amount: reservation.totalAmount,

          currency: reservation.currency,

          status: 'confirmed',

          source: 'channel',

          source_reference: reservation.channelBookingRef,

          special_requests: reservation.specialRequests

        })

        .select()

        .single();



      if (newReservation) {

        // Link channel reservation to our reservation

        await client

          .from('channel_reservations')

          .update({

            reservation_id: newReservation.id,

            processed: true,

            processed_at: new Date().toISOString()

          })

          .eq('id', channelRes.id);



        return {

          channelReservationId: channelRes.id,

          reservationId: newReservation.id

        };

      }

    } catch (err) {

      const errorMessage = err instanceof Error ? err.message : 'Failed to create reservation';

      await client

        .from('channel_reservations')

        .update({ error_message: errorMessage })

        .eq('id', channelRes.id);

    }

  }



  // For modifications or cancellations, update existing

  if (reservation.bookingStatus !== 'new') {

    const { data: existingChannelRes } = await client

      .from('channel_reservations')

      .select('reservation_id')

      .eq('connection_id', connectionId)

      .eq('channel_booking_ref', reservation.channelBookingRef)

      .eq('booking_status', 'new')

      .single();



    if (existingChannelRes?.reservation_id) {

      if (reservation.bookingStatus === 'cancelled') {

        await client

          .from('reservations')

          .update({ status: 'cancelled' })

          .eq('id', existingChannelRes.reservation_id);

      } else if (reservation.bookingStatus === 'modified') {

        await client

          .from('reservations')

          .update({

            check_in: reservation.checkIn,

            check_out: reservation.checkOut,

            num_adults: reservation.numAdults,

            num_children: reservation.numChildren,

            total_amount: reservation.totalAmount

          })

          .eq('id', existingChannelRes.reservation_id);

      }



      await client

        .from('channel_reservations')

        .update({

          reservation_id: existingChannelRes.reservation_id,

          processed: true,

          processed_at: new Date().toISOString()

        })

        .eq('id', channelRes.id);

    }

  }



  return { channelReservationId: channelRes.id };

}



// Webhook handler for SiteMinder reservation notifications

export async function handleSiteMinderWebhook(

  propertyId: string,

  channelCode: string,

  payload: any

): Promise<void> {

  const { data: connection } = await supabase

    .from('channel_connections')

    .select('id')

    .eq('property_id', propertyId)

    .eq('channel_code', channelCode)

    .single();



  if (!connection) {

    throw new Error(`No connection found for property ${propertyId} and channel ${channelCode}`);

  }



  const reservation: InboundReservation = {

    channelBookingRef: payload.booking_id || payload.confirmation_number,

    channelGuestId: payload.guest_id,

    guestName: payload.guest_name || `${payload.full_name}`,

    guestEmail: payload.email,

    guestPhone: payload.phone,

    checkIn: (metadata as any)?.check_in_date || payload.arrival_date,

    checkOut: (metadata as any)?.check_out_date || payload.departure_date,

    roomTypeCode: (metadata as any)?.room_type_code || payload.room_code,

    rateCode: payload.rate_code,

    numAdults: payload.adults || payload.num_adults || 1,

    numChildren: payload.children || payload.num_children || 0,

    totalAmount: payload.total || amount || 0,

    currency: payload.currency || 'USD',

    commissionAmount: payload.commission,

    paymentStatus: payload.payment_status || 'pending',

    bookingStatus: payload.status === 'CXL' ? 'cancelled' : 

                   payload.status === 'MOD' ? 'modified' : 'new',

    specialRequests: payload.special_requests || payload.comments,

    rawData: payload

  };



  await processInboundReservation(connection.id, reservation);



  await logSyncActivity(connection.id, 'reservation_pull', 'inbound', 'success', {

    booking_ref: reservation.channelBookingRef,

    status: reservation.bookingStatus

  });

}



// ==================== SYNC LOG ====================



async function logSyncActivity(

  connectionId: string,

  syncType: string,

  direction: 'inbound' | 'outbound',

  status: 'started' | 'success' | 'failed',

  details?: any

): Promise<void> {

  const client = supabase;



  await client.from('channel_sync_log').insert({

    connection_id: connectionId,

    sync_type: syncType,

    direction,

    status,

    records_processed: details?.records_processed || 0,

    records_failed: details?.records_failed || 0,

    duration_ms: details?.duration_ms,

    error_message: details?.error_message,

    details

  });

}



export async function getSyncLog(

  connectionId: string,

  limit: number = 100

): Promise<any[]> {

  const { data, error } = await supabase

    .from('channel_sync_log')

    .select('*')

    .eq('connection_id', connectionId)

    .order('created_at', { ascending: false })

    .limit(limit);



  if (error) throw error;

  return data || [];

}



// ==================== SCHEDULED SYNC ====================



export async function syncAllActiveConnections(): Promise<void> {

  const client = supabase;



  const { data: connections } = await client

    .from('channel_connections')

    .select('id, property_id')

    .eq('status', 'active');



  const today = new Date();

  const endDate = new Date();

  endDate.setDate(endDate.getDate() + 365); // Sync 1 year ahead



  for (const connection of connections || []) {

    try {

      await pushAvailabilityForDateRange(connection.id, today, endDate);

    } catch (err) {

      console.error(`Sync failed for connection ${connection.id}:`, err);

    }

  }

}



export async function getChannelReservations(

  connectionId: string,

  options?: {

    startDate?: string;

    endDate?: string;

    status?: string;

    limit?: number;

  }

): Promise<any[]> {

  let query = supabase

    .from('channel_reservations')

    .select('*, reservations(*)')

    .eq('connection_id', connectionId)

    .order('received_at', { ascending: false });



  if (options?.startDate) {

    query = query.gte('check_in', options.startDate);

  }

  if (options?.endDate) {

    query = query.filter('metadata->>check_in_date', 'lte', options.endDate);

  }

  if (options?.status) {

    query = query.eq('booking_status', options.status);

  }

  if (options?.limit) {

    query = query.limit(options.limit);

  }



  const { data, error } = await query;

  if (error) throw error;

  return data || [];

}



