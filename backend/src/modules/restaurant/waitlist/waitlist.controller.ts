import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { emitToAll } from '../../../socket/index.js';
import { z } from 'zod';
import { logger } from '../../../utils/logger.js';
import { smsService } from '../../../services/sms.service.js';

const joinWaitlistSchema = z.object({
    // Accept both naming conventions
    customerName: z.string().min(1).optional(),
    guest_name: z.string().min(1).optional(),
    phone: z.string().optional(),
    phone_number: z.string().optional(),
    partySize: z.number().int().positive().optional(),
    party_size: z.number().int().positive().optional(),
    type: z.enum(['restaurant', 'pool']).optional().default('restaurant'),
    quotedTime: z.number().int().optional(),
    notes: z.string().optional(),
}).refine(data => data.customerName || data.guest_name, {
    message: 'Customer name is required'
}).refine(data => data.partySize || data.party_size, {
    message: 'Party size is required'
});

export class WaitlistController {

    /**
     * Get Current Waitlist
     */
    async getWaitlist(req: Request, res: Response) {
        try {
            const { type, moduleId } = req.query;
            const supabase = getSupabase();

            let query = supabase
                .from('waitlist_entries')
                .select('*')
                .in('status', ['waiting', 'notified'])
                .order('created_at', { ascending: true });

            if (type) query = query.eq('type', type as string);
            if (moduleId) query = query.eq('module_id', moduleId as string);

            const { data, error } = await query;
            if (error) throw error;

            // Add computed position and estimated_wait to each entry
            const enriched = (data || []).map((entry: any, index: number) => ({
                ...entry,
                guest_name: entry.customer_name,
                phone: entry.phone_number,
                position: index + 1,
                estimated_wait: entry.estimated_wait_minutes || (index + 1) * 10
            }));

            res.json({ success: true, data: enriched });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Get Single Entry by ID
     */
    async getEntry(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const supabase = getSupabase();

            const { data, error } = await supabase
                .from('waitlist_entries')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ success: false, error: 'Entry not found' });
                }
                throw error;
            }

            // Compute position: count entries with status waiting/notified created before this one
            let position = 1;
            if (data.status === 'waiting' || data.status === 'notified') {
                const { count } = await supabase
                    .from('waitlist_entries')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['waiting', 'notified'])
                    .lt('created_at', data.created_at);
                position = (count || 0) + 1;
            }

            const enriched = {
                ...data,
                guest_name: data.customer_name,
                phone: data.phone_number,
                position,
                estimated_wait: data.estimated_wait_minutes || position * 10
            };

            res.json({ success: true, data: enriched });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Join Waitlist
     */
    async join(req: Request, res: Response) {
        try {
            const validation = joinWaitlistSchema.safeParse(req.body);
            if (!validation.success) return res.status(400).json({ success: false, error: validation.error.errors });

            const supabase = getSupabase();
            const data = validation.data;

            // Normalize field names (accept both conventions)
            const customerName = data.customerName || data.guest_name!;
            const phone = data.phone || data.phone_number;
            const partySize = data.partySize || data.party_size!;
            const { type, quotedTime, notes } = data;

            // Store type in dedicated column and module_id if provided
            const moduleId = req.body.module_id;

            const { data: insertedData, error } = await supabase
                .from('waitlist_entries')
                .insert({
                    customer_name: customerName,
                    phone_number: phone,
                    party_size: partySize,
                    type: type,
                    module_id: moduleId || null,
                    notes: notes || null,
                    estimated_wait_minutes: quotedTime,
                    status: 'waiting'
                })
                .select()
                .single();

            if (error) throw error;

            // Compute position: count current waiting/notified entries
            const { count } = await supabase
                .from('waitlist_entries')
                .select('*', { count: 'exact', head: true })
                .in('status', ['waiting', 'notified'])
                .lte('created_at', insertedData.created_at);

            const enriched = {
                ...insertedData,
                guest_name: insertedData.customer_name,
                phone: insertedData.phone_number,
                position: count || 1,
                estimated_wait: insertedData.estimated_wait_minutes || (count || 1) * 10
            };

            // Real-time update
            emitToAll('waitlist.updated', { type, action: 'join', entry: enriched });

            res.status(201).json({ success: true, data: enriched });
        } catch (error: any) {
            logger.error('Waitlist Join Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Update Status (Notify / Seat / Cancel)
     */
    async updateStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status } = req.body; // 'notified', 'seated', 'cancelled'

            if (!['notified', 'seated', 'cancelled', 'no_show'].includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }

            const supabase = getSupabase();
            const updates: any = { status, updated_at: new Date().toISOString() };

            if (status === 'notified') updates.notified_at = new Date().toISOString();
            if (status === 'seated') updates.seated_at = new Date().toISOString();
            if (status === 'no_show') updates.seated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('waitlist_entries')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Send SMS notification when guest is notified their table is ready
            if (status === 'notified' && data.phone_number) {
                smsService.sendTemplatedSMS(
                    data.phone_number,
                    'waitlist-ready',
                    { guest_name: data.customer_name, party_size: data.party_size }
                ).catch(err => logger.warn('Failed to send waitlist SMS notification:', err));
            }

            emitToAll('waitlist.updated', { action: 'update', entry: data });
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

export const waitlistController = new WaitlistController();


