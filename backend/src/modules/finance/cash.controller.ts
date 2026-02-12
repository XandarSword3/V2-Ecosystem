import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';
import { logActivity } from '../../utils/activityLogger.js';

export const cashController = {
    // Open Cash Drawer
    openDrawer: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { amount, notes } = req.body;
            const deviceId = req.headers['x-device-id'] || 'default-pos';

            // Verify no open drawer for this device/user
            // In real scenario, one drawer per device.

            const { data: drawer, error } = await supabase
                .from('cash_drawers')
                .insert({
                    device_id: deviceId,
                    opened_by_user_id: req.user!.userId,
                    opened_at: new Date().toISOString(),
                    starting_balance: amount,
                    current_balance: amount,
                    status: 'open',
                    notes
                })
                .select()
                .single();

            if (error) throw error;

            await logActivity({
                user_id: req.user!.userId,
                action: 'OPEN_DRAWER',
                resource: 'finance',
                details: { drawer_id: drawer.id, amount }
            });

            res.status(201).json({ success: true, data: drawer });
    }),

    // Close Cash Drawer (Z-Report)
    closeDrawer: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { drawerId, actualBalance, notes } = req.body;

            const { data: drawer, error: fetchError } = await supabase
                .from('cash_drawers')
                .select('*')
                .eq('id', drawerId)
                .single();

            if (fetchError || !drawer) throw new Error('Drawer not found');

            // Calculate discrepancy
            const expected = drawer.current_balance;
            const discrepancy = Number(actualBalance) - Number(expected);

            const { data: updated, error } = await supabase
                .from('cash_drawers')
                .update({
                    closed_at: new Date().toISOString(),
                    ending_balance: actualBalance,
                    discrepancy: discrepancy,
                    status: 'closed',
                    notes: notes ? `${drawer.notes || ''}\nClosing Note: ${notes}` : drawer.notes
                })
                .eq('id', drawerId)
                .select()
                .single();

            if (error) throw error;

            await logActivity({
                user_id: req.user!.userId,
                action: 'CLOSE_DRAWER',
                resource: 'finance',
                details: { drawer_id: drawer.id, discrepancy }
            });

            res.json({ success: true, data: updated });
    }),

    // Record Cash Transaction (Pay In / Pay Out)
    recordTransaction: asyncHandler(async (req: Request, res: Response) => {
            const supabase = getSupabase();
            const { drawerId, type, amount, reason, orderId } = req.body;

            const { error } = await supabase
                .from('cash_transactions')
                .insert({
                    drawer_id: drawerId,
                    user_id: req.user!.userId,
                    type, // 'sale', 'refund', 'pay_in', 'pay_out'
                    amount,
                    reason_code: reason,
                    order_id: orderId
                });

            if (error) throw error;

            // Update drawer balance
            // Logic depends on type. Sale/PayIn adds. Refund/PayOut subtracts.
            const signedAmount = (['refund', 'pay_out'].includes(type)) ? -Math.abs(amount) : Math.abs(amount);

            // We need RPC or manual update. Manual for now.
            const { data: drawer } = await supabase.from('cash_drawers').select('current_balance').eq('id', drawerId).single();
            const newBalance = (Number(drawer?.current_balance || 0) + signedAmount);

            await supabase.from('cash_drawers').update({
                current_balance: newBalance,
                updated_at: new Date().toISOString()
            }).eq('id', drawerId);

            res.status(201).json({ success: true, message: 'Transaction recorded' });
    }),

    getDrawers: asyncHandler(async (req: Request, res: Response) => {
        // Implement filtering by date/status
        const supabase = getSupabase();
        const { status } = req.query;
        let q = supabase.from('cash_drawers').select('*').order('opened_at', { ascending: false });

        if (status) q = q.eq('status', status);

        const { data, error } = await q;
        if (error) throw error;

        res.json({ success: true, data });
    })
};


