import { getSupabase } from '../../database/connection.js';



// Lazy-initialized Supabase client - use proxy to defer getSupabase() call

const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {

  get(_, prop) { return getSupabase()[prop as keyof ReturnType<typeof getSupabase>]; }

});



interface ParityConfig {

  id: string;

  property_id: string;

  is_enabled: boolean;

  check_frequency_hours: number;

  tolerance_percentage: number;

  tolerance_amount: number;

  channels_to_monitor: string[];

  alert_on_undercut: boolean;

  alert_on_overpriced: boolean;

  undercut_threshold_percentage: number;

  notification_emails: string[];

  slack_webhook_url?: string;

  last_check_at?: string;

  next_check_at?: string;

}



interface ParityCheck {

  id: string;

  property_id: string;

  room_type_id: string;

  check_date: string;

  our_rate: number;

  our_currency: string;

  status: 'pending' | 'compliant' | 'violation' | 'error';

}



interface ParityResult {

  id: string;

  check_id: string;

  channel_code: string;

  channel_name: string;

  channel_rate?: number;

  currency: string;

  rate_difference?: number;

  difference_percentage?: number;

  is_parity: boolean;

  violation_type?: 'undercut' | 'overpriced' | null;

}



interface ParityAlert {

  id: string;

  property_id: string;

  check_id: string;

  result_id?: string;

  alert_type: string;

  severity: 'low' | 'medium' | 'high' | 'critical';

  channel_code: string;

  channel_name: string;

  room_type_id: string;

  check_date: string;

  our_rate?: number;

  channel_rate?: number;

  difference_amount?: number;

  difference_percentage?: number;

  status: 'new' | 'acknowledged' | 'resolved' | 'ignored';

}



interface ScrapedRate {

  channelCode: string;

  channelName: string;

  rate: number | null;

  currency: string;

  available: boolean;

  rawData?: any;

}



// ==================== CONFIGURATION ====================



export async function getParityConfig(propertyId: string): Promise<ParityConfig | null> {

  const { data, error } = await supabase

    .from('rate_parity_config')

    .select('*')

    .eq('property_id', propertyId)

    .single();



  if (error) return null;

  return data;

}



export async function createOrUpdateParityConfig(

  propertyId: string,

  config: Partial<ParityConfig>

): Promise<ParityConfig> {

  const { data, error } = await supabase

    .from('rate_parity_config')

    .upsert({

      property_id: propertyId,

      ...config

    }, {

      onConflict: 'property_id'

    })

    .select()

    .single();



  if (error) throw error;

  return data;

}



export async function updateNextCheckTime(propertyId: string): Promise<void> {

  const config = await getParityConfig(propertyId);

  if (!config) return;



  const nextCheck = new Date();

  nextCheck.setHours(nextCheck.getHours() + config.check_frequency_hours);



  await supabase

    .from('rate_parity_config')

    .update({

      last_check_at: new Date().toISOString(),

      next_check_at: nextCheck.toISOString()

    })

    .eq('property_id', propertyId);

}



// ==================== RATE SCRAPING ====================



// RapidAPI-based rate scraping (Booking.com example)

async function scrapeBookingRate(

  propertyName: string,

  checkInDate: string,

  checkOutDate: string,

  adults: number = 2

): Promise<ScrapedRate | null> {

  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {

    console.warn('RAPIDAPI_KEY not configured');

    return null;

  }



  try {

    // Search for property

    const searchResponse = await fetch(

      `https://booking-com.p.rapidapi.com/v1/hotels/search?` +

      `checkin_date=${checkInDate}&` +

      `checkout_date=${checkOutDate}&` +

      `adults_number=${adults}&` +

      `filter_by_currency=USD&` +

      `order_by=popularity&` +

      `units=metric&` +

      `room_number=1&` +

      `dest_type=city&` +

      `locale=en-gb`,

      {

        headers: {

          'X-RapidAPI-Key': apiKey,

          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'

        }

      }

    );



    if (!searchResponse.ok) {

      throw new Error(`Booking.com API error: ${searchResponse.status}`);

    }



    const searchData = (await searchResponse.json()) as { result?: any[] };

    

    // Find matching property

    const hotel = searchData.result?.find((h: any) => 

      h.hotel_name?.toLowerCase().includes(propertyName.toLowerCase())

    );



    if (!hotel) {

      return {

        channelCode: 'BOOKING',

        channelName: 'Booking.com',

        rate: null,

        currency: 'USD',

        available: false,

        rawData: { error: 'Property not found' }

      };

    }



    return {

      channelCode: 'BOOKING',

      channelName: 'Booking.com',

      rate: hotel.min_total_price || hotel.price_breakdown?.gross_price,

      currency: hotel.currencycode || 'USD',

      available: true,

      rawData: {

        hotel_id: hotel.hotel_id,

        hotel_name: hotel.hotel_name,

        review_score: hotel.review_score

      }

    };

  } catch (error) {

    console.error('Booking.com scraping error:', error);

    return {

      channelCode: 'BOOKING',

      channelName: 'Booking.com',

      rate: null,

      currency: 'USD',

      available: false,

      rawData: { error: error instanceof Error ? error.message : 'Unknown error' }

    };

  }

}



// Generic scraper dispatcher

async function scrapeChannelRate(

  channelCode: string,

  propertyName: string,

  checkInDate: string,

  checkOutDate: string

): Promise<ScrapedRate | null> {

  switch (channelCode) {

    case 'BOOKING':

      return scrapeBookingRate(propertyName, checkInDate, checkOutDate);

    // Add more channels here

    default:

      console.warn(`No scraper available for channel: ${channelCode}`);

      return null;

  }

}



// ==================== PARITY CHECKING ====================



export async function runParityCheck(

  propertyId: string,

  roomTypeId: string,

  checkDate: string,

  ourRate: number

): Promise<ParityCheck> {

  const client = supabase;



  // Get property config

  const config = await getParityConfig(propertyId);

  if (!config || !config.is_enabled) {

    throw new Error('Rate parity monitoring is not enabled for this property');

  }



  // Get property details

  const { data: property } = await client

    .from('properties')

    .select('name')

    .eq('id', propertyId)

    .single();



  if (!property) {

    throw new Error('Property not found');

  }



  // Create parity check record

  const { data: check, error: checkError } = await client

    .from('rate_parity_checks')

    .insert({

      property_id: propertyId,

      room_type_id: roomTypeId,

      check_date: checkDate,

      our_rate: ourRate,

      our_currency: 'USD',

      status: 'pending'

    })

    .select()

    .single();



  if (checkError) throw checkError;



  // Calculate checkout date (assume 1 night)

  const checkIn = new Date(checkDate);

  const checkOut = new Date(checkIn);

  checkOut.setDate(checkOut.getDate() + 1);

  const checkOutStr = checkOut.toISOString().split('T')[0];



  let hasViolation = false;

  const results: ParityResult[] = [];



  // Scrape rates from each monitored channel

  for (const channelCode of config.channels_to_monitor) {

    const scrapedRate = await scrapeChannelRate(

      channelCode,

      property.name,

      checkDate,

      checkOutStr

    );



    if (!scrapedRate) continue;



    // Calculate parity

    let isParity = true;

    let violationType: 'undercut' | 'overpriced' | null = null;

    let difference = 0;

    let diffPercentage = 0;



    if (scrapedRate.rate !== null) {

      difference = scrapedRate.rate - ourRate;

      diffPercentage = (difference / ourRate) * 100;



      // Check tolerance

      const withinPercentageTolerance = Math.abs(diffPercentage) <= config.tolerance_percentage;

      const withinAmountTolerance = Math.abs(difference) <= config.tolerance_amount;



      if (!withinPercentageTolerance && !withinAmountTolerance) {

        isParity = false;

        hasViolation = true;



        if (difference < 0) {

          violationType = 'undercut'; // Channel is cheaper

        } else {

          violationType = 'overpriced'; // Channel is more expensive (less common issue)

        }

      }

    }



    // Store result

    const { data: result } = await client

      .from('rate_parity_results')

      .insert({

        check_id: check.id,

        channel_code: scrapedRate.channelCode,

        channel_name: scrapedRate.channelName,

        channel_rate: scrapedRate.rate,

        currency: scrapedRate.currency,

        rate_difference: difference,

        difference_percentage: diffPercentage,

        is_parity: isParity,

        violation_type: violationType,

        raw_data: scrapedRate.rawData

      })

      .select()

      .single();



    if (result) {

      results.push(result);



      // Create alert if violation

      if (!isParity && violationType) {

        const shouldAlert = 

          (violationType === 'undercut' && config.alert_on_undercut) ||

          (violationType === 'overpriced' && config.alert_on_overpriced);



        if (shouldAlert) {

          // Determine severity

          let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

          if (violationType === 'undercut') {

            if (Math.abs(diffPercentage) >= 10) severity = 'critical';

            else if (Math.abs(diffPercentage) >= 5) severity = 'high';

            else if (Math.abs(diffPercentage) >= config.undercut_threshold_percentage) severity = 'medium';

            else severity = 'low';

          }



          await createParityAlert({

            property_id: propertyId,

            check_id: check.id,

            result_id: result.id,

            alert_type: violationType,

            severity,

            channel_code: scrapedRate.channelCode,

            channel_name: scrapedRate.channelName,

            room_type_id: roomTypeId,

            check_date: checkDate,

            our_rate: ourRate,

            channel_rate: scrapedRate.rate || undefined,

            difference_amount: difference,

            difference_percentage: diffPercentage

          });

        }

      }

    }

  }



  // Update check status

  await client

    .from('rate_parity_checks')

    .update({

      status: hasViolation ? 'violation' : 'compliant'

    })

    .eq('id', check.id);



  // Update last check time

  await updateNextCheckTime(propertyId);



  return { ...check, status: hasViolation ? 'violation' : 'compliant' };

}



export async function runFullParityCheck(propertyId: string): Promise<{ checks: number; violations: number }> {

  const client = supabase;



  // Get all room types for property

  const { data: roomTypes } = await client

    .from('room_types')

    .select('id')

    .eq('property_id', propertyId);



  if (!roomTypes || roomTypes.length === 0) {

    throw new Error('No room types found for property');

  }



  // Get current rates

  const today = new Date().toISOString().split('T')[0];

  const { data: rates } = await client

    .from('room_rates')

    .select('room_type_id, rate')

    .in('room_type_id', roomTypes.map(rt => rt.id))

    .gte('date', today)

    .limit(1);



  let checks = 0;

  let violations = 0;



  for (const roomType of roomTypes) {

    const rate = rates?.find(r => r.room_type_id === roomType.id);

    if (!rate) continue;



    try {

      const check = await runParityCheck(

        propertyId,

        roomType.id,

        today,

        rate.rate

      );



      checks++;

      if (check.status === 'violation') violations++;

    } catch (error) {

      console.error(`Parity check failed for room type ${roomType.id}:`, error);

    }

  }



  return { checks, violations };

}



// ==================== ALERTS ====================



async function createParityAlert(alert: Omit<ParityAlert, 'id' | 'status'>): Promise<void> {

  const client = supabase;



  await client.from('rate_parity_alerts').insert({

    ...alert,

    status: 'new'

  });



  // Send notifications

  const config = await getParityConfig(alert.property_id);

  if (config) {

    // Email notifications

    if (config.notification_emails && config.notification_emails.length > 0) {

      // TODO: Integrate with email service

      console.log(`Would send parity alert email to: ${config.notification_emails.join(', ')}`);

    }



    // Slack notification

    if (config.slack_webhook_url) {

      await sendSlackAlert(config.slack_webhook_url, alert);

    }

  }

}



async function sendSlackAlert(webhookUrl: string, alert: Omit<ParityAlert, 'id' | 'status'>): Promise<void> {

  const severityEmoji: Record<string, string> = {

    low: '🟡',

    medium: '🟠',

    high: '🔴',

    critical: '🚨'

  };



  const message = {

    blocks: [

      {

        type: 'header',

        text: {

          type: 'plain_text',

          text: `${severityEmoji[alert.severity]} Rate Parity Alert - ${alert.channel_name}`,

          emoji: true

        }

      },

      {

        type: 'section',

        fields: [

          {

            type: 'mrkdwn',

            text: `*Alert Type:*\n${alert.alert_type}`

          },

          {

            type: 'mrkdwn',

            text: `*Severity:*\n${alert.severity.toUpperCase()}`

          },

          {

            type: 'mrkdwn',

            text: `*Your Rate:*\n$${alert.our_rate?.toFixed(2)}`

          },

          {

            type: 'mrkdwn',

            text: `*Channel Rate:*\n$${alert.channel_rate?.toFixed(2)}`

          },

          {

            type: 'mrkdwn',

            text: `*Difference:*\n${alert.difference_percentage?.toFixed(1)}%`

          },

          {

            type: 'mrkdwn',

            text: `*Date:*\n${alert.check_date}`

          }

        ]

      }

    ]

  };



  try {

    await fetch(webhookUrl, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(message)

    });

  } catch (error) {

    console.error('Failed to send Slack alert:', error);

  }

}



export async function getAlerts(

  propertyId: string,

  options?: {

    status?: string;

    severity?: string;

    limit?: number;

  }

): Promise<ParityAlert[]> {

  let query = supabase

    .from('rate_parity_alerts')

    .select('*')

    .eq('property_id', propertyId)

    .order('created_at', { ascending: false });



  if (options?.status) {

    query = query.eq('status', options.status);

  }

  if (options?.severity) {

    query = query.eq('severity', options.severity);

  }

  if (options?.limit) {

    query = query.limit(options.limit);

  }



  const { data, error } = await query;

  if (error) throw error;

  return data || [];

}



export async function acknowledgeAlert(

  alertId: string,

  userId: string,

  notes?: string

): Promise<void> {

  await supabase

    .from('rate_parity_alerts')

    .update({

      status: 'acknowledged',

      acknowledged_by: userId,

      acknowledged_at: new Date().toISOString(),

      notes

    })

    .eq('id', alertId);

}



export async function resolveAlert(alertId: string, notes?: string): Promise<void> {

  await supabase

    .from('rate_parity_alerts')

    .update({

      status: 'resolved',

      resolved_at: new Date().toISOString(),

      notes

    })

    .eq('id', alertId);

}



export async function ignoreAlert(alertId: string, notes?: string): Promise<void> {

  await supabase

    .from('rate_parity_alerts')

    .update({

      status: 'ignored',

      notes

    })

    .eq('id', alertId);

}



// ==================== DASHBOARD DATA ====================



export async function getParityDashboard(propertyId: string): Promise<{

  config: ParityConfig | null;

  recentAlerts: ParityAlert[];

  stats: {

    totalChecksToday: number;

    violationsToday: number;

    complianceRate: number;

    mostProblematicChannel: string | null;

  };

  recentChecks: ParityCheck[];

}> {

  const client = supabase;

  const today = new Date().toISOString().split('T')[0];



  // Get config

  const config = await getParityConfig(propertyId);



  // Get recent alerts

  const recentAlerts = await getAlerts(propertyId, { limit: 10 });



  // Get today's checks

  const { data: todayChecks } = await client

    .from('rate_parity_checks')

    .select('*')

    .eq('property_id', propertyId)

    .gte('created_at', `${today}T00:00:00`)

    .order('created_at', { ascending: false });



  const checks = todayChecks || [];

  const violations = checks.filter(c => c.status === 'violation');

  const complianceRate = checks.length > 0 

    ? ((checks.length - violations.length) / checks.length) * 100 

    : 100;



  // Find most problematic channel

  const { data: channelViolations } = await client

    .from('rate_parity_alerts')

    .select('channel_code')

    .eq('property_id', propertyId)

    .eq('status', 'new')

    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());



  let mostProblematicChannel: string | null = null;

  if (channelViolations && channelViolations.length > 0) {

    const channelCounts: Record<string, number> = {};

    for (const v of channelViolations) {

      channelCounts[v.channel_code] = (channelCounts[v.channel_code] || 0) + 1;

    }

    mostProblematicChannel = Object.entries(channelCounts)

      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  }



  return {

    config,

    recentAlerts,

    stats: {

      totalChecksToday: checks.length,

      violationsToday: violations.length,

      complianceRate,

      mostProblematicChannel

    },

    recentChecks: checks.slice(0, 20)

  };

}



export async function getCheckHistory(

  propertyId: string,

  startDate: string,

  endDate: string

): Promise<any[]> {

  const { data, error } = await supabase

    .from('rate_parity_checks')

    .select(`

      *,

      rate_parity_results(*)

    `)

    .eq('property_id', propertyId)

    .gte('check_date', startDate)

    .lte('check_date', endDate)

    .order('check_date', { ascending: false });



  if (error) throw error;

  return data || [];

}



