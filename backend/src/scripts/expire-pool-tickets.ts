/**
 * Pool Ticket Expiry Job
 * 
 * Automatically expires pool tickets whose session date has passed.
 * Run this as a cron job daily or at the end of each day.
 * 
 * Usage: npx tsx src/scripts/expire-pool-tickets.ts
 * Or via cron: 0 0 * * * cd /app && node dist/scripts/expire-pool-tickets.js
 */

import { getSupabase, initializeDatabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

async function expirePoolTickets() {
  try {
    logger.info('Starting pool ticket expiry job...');
    
    await initializeDatabase();
    const supabase = getSupabase();

    // Get current date at midnight
    const today = dayjs().startOf('day').toISOString();

    // Find all valid tickets where the ticket_date is before today
    const { data: expiredTickets, error: fetchError } = await supabase
      .from('pool_tickets')
      .select('id, ticket_number, ticket_date, session_id')
      .eq('status', 'valid')
      .lt('ticket_date', today);

    if (fetchError) {
      logger.error('Failed to fetch expired tickets:', fetchError);
      throw fetchError;
    }

    if (!expiredTickets || expiredTickets.length === 0) {
      logger.info('No tickets to expire.');
      return { expired: 0 };
    }

    logger.info(`Found ${expiredTickets.length} tickets to expire.`);

    // Update all expired tickets
    const ticketIds = expiredTickets.map(t => t.id);
    
    const { error: updateError } = await supabase
      .from('pool_tickets')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .in('id', ticketIds);

    if (updateError) {
      logger.error('Failed to update expired tickets:', updateError);
      throw updateError;
    }

    logger.info(`Successfully expired ${ticketIds.length} pool tickets.`);
    
    // Log audit entries for expired tickets
    const auditEntries = expiredTickets.map(ticket => ({
      user_id: 'system',
      action: 'ticket_expired',
      resource: 'pool_ticket',
      resource_id: ticket.id,
      new_value: JSON.stringify({ 
        ticket_number: ticket.ticket_number,
        expired_by: 'scheduled_job',
        original_date: ticket.ticket_date 
      }),
    }));

    await supabase.from('audit_logs').insert(auditEntries);

    return { expired: ticketIds.length };
  } catch (error) {
    logger.error('Pool ticket expiry job failed:', error);
    throw error;
  }
}

// Run if called directly
expirePoolTickets()
  .then((result) => {
    console.log(`✅ Expired ${result.expired} pool tickets.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Expiry job failed:', error);
    process.exit(1);
  });

export { expirePoolTickets };
