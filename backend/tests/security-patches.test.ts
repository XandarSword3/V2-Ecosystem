
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSupabase } from '../src/database/supabase';

describe('Security Hardening Migration Checks', () => {
    const supabase = getSupabase();
    const testPermissionSlug = 'security_test:run_check';
    const testLedgerWebhookId = 'webhook_test_' + Date.now();

    it('should allow creating dynamic application permissions in app_permissions', async () => {
        const { data, error } = await supabase
            .from('app_permissions')
            .insert({
                slug: testPermissionSlug,
                description: 'Temporary permission for verification test',
                module_slug: 'security_module'
            })
            .select()
            .single();

        if (error) console.error('Permission Insert Error:', error);
        expect(error).toBeNull();
        expect(data).toHaveProperty('slug', testPermissionSlug);

        // Clean up
        await supabase.from('app_permissions').delete().eq('slug', testPermissionSlug);
    });

    it('should prevent modification of payment_ledger financial fields', async () => {
        // 1. Create a ledger entry
        const { data: ledgerEntry, error: insertError } = await supabase
            .from('payment_ledger')
            .insert({
                reference_type: 'test_order',
                reference_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
                event_type: 'authorized',
                amount: 100.00,
                currency: 'USD',
                status: 'success',
                webhook_id: testLedgerWebhookId
            })
            .select()
            .single();
        
        expect(insertError).toBeNull();
        expect(ledgerEntry).toBeDefined();

        // 2. Attempt to Update Amount (Should Fail)
        const { error: updateError } = await supabase
            .from('payment_ledger')
            .update({ amount: 999.99 })
            .eq('id', ledgerEntry.id);

        expect(updateError).toBeDefined();
        // The error message from trigger: "Modifying financial fields in payment_ledger is forbidden."
        expect(updateError?.message).toContain('forbidden'); 
        
        // 3. Attempt to Delete (Should Fail)
        const { error: deleteError } = await supabase
            .from('payment_ledger')
            .delete()
            .eq('id', ledgerEntry.id);

        expect(deleteError).toBeDefined();
        expect(deleteError?.message).toContain('Deleting from payment_ledger is strictly forbidden');
    });
});
