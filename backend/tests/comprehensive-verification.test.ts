
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../src/app';
import { getSupabase } from '../src/database/connection';
import { generateTokens } from '../src/modules/auth/auth.utils';
import { v4 as uuidv4 } from 'uuid';

// Mock Socket.io and other side effects
vi.mock('../src/socket', () => ({
    emitToAll: vi.fn(),
    emitToUser: vi.fn(),
    getIO: () => ({ 
        emit: vi.fn(),
        to: vi.fn().mockReturnThis(),
        of: vi.fn().mockReturnThis() 
    })
}));

vi.mock('../src/middleware/moduleGuard.middleware', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        clearModuleCache: vi.fn(),
    };
});

vi.mock('../src/utils/activityLogger', () => ({
    logActivity: vi.fn()
}));

const supabase = getSupabase();

describe('Comprehensive Verification: Security & Modules', () => {
    const testId = uuidv4().substring(0, 8);
    const moduleSlug = `test-module-${testId}`;
    const testRoleName = `test_role_${testId}`;
    const superAdminId = uuidv4();
    const testUserId = uuidv4();

    // Generate tokens
    const superAdminToken = generateTokens({
        userId: superAdminId,
        email: 'superadmin@test.com',
        roles: ['super_admin']
    }).accessToken;

    const testUserToken = generateTokens({
        userId: testUserId,
        email: 'testuser@test.com',
        roles: [testRoleName]
    }).accessToken;

    let moduleId: string;
    let initialVersion: number;

    beforeAll(async () => {
        // Create a test role
        await supabase.from('roles').insert({ name: testRoleName, description: 'Test Role' });
    });

    afterAll(async () => {
        // Cleanup
        await supabase.from('modules').delete().eq('slug', moduleSlug);
        await supabase.from('roles').delete().eq('name', testRoleName);
        await supabase.from('app_permissions').delete().like('slug', `module:${moduleSlug}%`);
        await supabase.from('payment_ledger').delete().like('webhook_id', `test_webhook_${testId}%`);
    });

    // 1. Module Creation & Permission Generation
    it('should create a module and auto-generate app_permissions', async () => {
        const res = await request(app)
            .post('/api/v1/admin/modules')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: `Test Module ${testId}`,
                slug: moduleSlug,
                template_type: 'menu_service',
                description: 'A test module for verification',
                settings: { color: 'blue' }
            });
        
        expect(res.status).toBe(201);
        expect(res.body.data.slug).toBe(moduleSlug);
        expect(res.body.data.settings_version).toBe(1);
        moduleId = res.body.data.id;
        initialVersion = res.body.data.settings_version;

        // Verify permissions created in DB
        const { data: perms } = await supabase
            .from('app_permissions')
            .select('slug')
            .eq('module_slug', moduleSlug);
        
        expect(perms).toBeDefined();
        expect(perms?.map(p => p.slug)).toContain(`module:${moduleSlug}:manage`);
    });

    // 2. RBAC - Update Module
    it('should deny module update to user without permissions', async () => {
        const res = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${testUserToken}`)
            .send({
                description: 'Hacker Update'
            });
        
        expect(res.status).toBe(403);
    });

    it('should allow module update to user WITH permissions', async () => {
        // Grant permission
        await supabase.from('app_role_permissions').insert({
            role_name: testRoleName,
            permission_slug: `module:${moduleSlug}:manage`
        });

        const res = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${testUserToken}`)
            .send({
                description: 'Authorized Update'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.data.description).toBe('Authorized Update');
    });

    // 3. Module Versioning (Optimistic Locking)
    it('should increment settings_version on update', async () => {
        const res = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                settings: { color: 'red' }, // Updating settings triggers increment
                settings_version: 1 // Providing correct current version (it was 1 initially, but previous test might have bumped it? No, previous test updated description, not settings)
                // Wait, previous test updated description. Controller logic: "Increment version if settings are being updated".
                // So version should still be 1 if the previous test only updated description?
                // logic: `if (validatedData.settings) { updateData.settings_version = ... + 1 }`
                // Yes.
            });

        // Actually if previous test succeeded, the version in DB is whatever module has.
        // Let's refetch current state first to be safe.
        const { data: current } = await supabase.from('modules').select('settings_version').eq('id', moduleId).single();
        const ver = current?.settings_version || 1;

        const res2 = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                settings: { color: 'green' },
                settings_version: ver // Correct version
            });

        expect(res2.status).toBe(200);
        expect(res2.body.data.settings_version).toBe(ver + 1);
    });

    it('should reject update with stale version', async () => {
        // Get current version
        const { data: current } = await supabase.from('modules').select('settings_version').eq('id', moduleId).single();
        const ver = current?.settings_version || 1;

        const res = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                settings: { color: 'purple' },
                settings_version: ver - 1 // Stale version
            });
        
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Version conflict');
    });

    // 4. Payment Idempotency
    it('should enforce unique webhook_id in payment_ledger', async () => {
        const webhookId = `test_webhook_${testId}`;
        const entry = {
            reference_type: 'test_order',
            reference_id: uuidv4(),
            event_type: 'authorized',
            amount: 50.00,
            currency: 'USD',
            status: 'success',
            webhook_id: webhookId
        };

        // First Insert
        const { error: err1 } = await supabase.from('payment_ledger').insert(entry);
        expect(err1).toBeNull();

        // Second Insert (Duplicate)
        const { error: err2 } = await supabase.from('payment_ledger').insert(entry);
        expect(err2).toBeDefined();
        // Postgres error 23505 is unique_violation
        expect(err2?.code).toBe('23505'); 
    });
});
