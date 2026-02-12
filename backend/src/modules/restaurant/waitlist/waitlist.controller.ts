import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { emitToAll } from '../../../socket/index.js';
import { z } from 'zod';
import { logger } from '../../../utils/logger.js';

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
            const { type } = req.query;
            const supabase = getSupabase();

            let query = supabase
                .from('waitlist_entries')
                .select('*')
                .in('status', ['waiting', 'notified'])
                .order('created_at', { ascending: true });

            // Type filtering stored in notes if needed
            if (type) query = query.ilike('notes', `%type:${type}%`);

            const { data, error } = await query;
            if (error) throw error;

            res.json({ success: true, data });
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

            res.json({ success: true, data });
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

            // Store type in notes field since column doesn't exist
            const notesWithType = notes ? `type:${type} | ${notes}` : `type:${type}`;

            const { data: insertedData, error } = await supabase
                .from('waitlist_entries')
                .insert({
                    customer_name: customerName,
                    phone_number: phone,
                    party_size: partySize,
                    notes: notesWithType,
                    estimated_wait_minutes: quotedTime,
                    status: 'waiting'
                })
                .select()
                .single();

            if (error) throw error;

            // Real-time update
            emitToAll('waitlist.updated', { type, action: 'join', entry: insertedData });

            res.status(201).json({ success: true, data: insertedData });
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

            if (!['notified', 'seated', 'cancelled'].includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }

            const supabase = getSupabase();
            const updates: any = { status, updated_at: new Date().toISOString() };

            if (status === 'notified') updates.notified_at = new Date().toISOString();
            if (status === 'seated') updates.seated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('waitlist_entries')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // TODO: Integrate SMS notification here if status === 'notified'

            emitToAll('waitlist.updated', { action: 'update', entry: data });
            res.json({ success: true, data });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

export const waitlistController = new WaitlistController();


