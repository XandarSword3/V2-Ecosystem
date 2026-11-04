
import request from 'supertest';
import app from '../src/app';
import { getSupabase } from '../src/database/connection';
import { generateTokens } from '../src/modules/auth/auth.utils';
import { v4 as uuidv4 } from 'uuid';

// Skip these tests in unit test mode - they require a live database connection
const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

// Mock Socket.io and other side effects
vi.mock('../src/socket', () => ({
    emitToAll: vi.fn(),
    emitToUser: vi.fn(),
    initializeSocketServer: vi.fn(),
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

describe.skipIf(!shouldRunIntegrationTests)('Comprehensive Verification: Security & Modules', () => {

    const testId = uuidv4().substring(0, 8);
    const moduleSlug = `test-module-${testId}`;
    const testRoleName = `test_role_${testId}`;
    const superAdminId = uuidv4();
    const testUserId = uuidv4();

    let superAdminToken: string;
    let testUserToken: string;

    let moduleId: string;
    let initialVersion: number;

    let platformTenantId: string | null = null;
    let testPropertyId: string | null = null;

    beforeAll(async () => {
        // Create a test role
        await supabase.from('roles').insert({ name: testRoleName, description: 'Test Role' });

        // Look up the platform root tenant (seeded by migration) to satisfy
        // the NOT NULL tenant_id constraint on payment_ledger and app_permissions.
        const { data: platformTenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('subdomain', 'platform')
            .maybeSingle();
        platformTenantId = platformTenant?.id ?? null;

        const { data: prop } = await supabase.from('properties').select('id').limit(1).maybeSingle();
        testPropertyId = prop?.id ?? null;

        // Generate tokens with tenant context
        superAdminToken = generateTokens({
            userId: superAdminId,
            email: 'superadmin@test.com',
            scope: 'super_admin',
            roles: ['super_admin'],
            tenantId: platformTenantId ?? undefined,
        }).accessToken;

        testUserToken = generateTokens({
            userId: testUserId,
            email: 'testuser@test.com',
            scope: 'super_admin',
            roles: [testRoleName],
            tenantId: platformTenantId ?? undefined,
        }).accessToken;

        // Seed users referenced by generated JWTs.
        // scope = 'super_admin' bypasses chk_scope_tenant (which requires
        // tenant_id for non-platform scopes). These are platform-level test
        // identities, not tenant-scoped customers.
        await supabase.from('users').upsert([
            {
                id: superAdminId,
                email: 'superadmin@test.com',
                full_name: 'Super Admin',
                password_hash: 'test-hash',
                is_active: true,
                email_verified: true,
                token_version: 0,
                scope: 'super_admin',
                tenant_id: platformTenantId,
            },
            {
                id: testUserId,
                email: 'testuser@test.com',
                full_name: 'Test User',
                password_hash: 'test-hash',
                is_active: true,
                email_verified: true,
                token_version: 0,
                scope: 'super_admin',
                tenant_id: platformTenantId,
            },
        ], { onConflict: 'id' });

        if (testPropertyId && platformTenantId) {
            await supabase.from('user_property_access').upsert([
                {
                    user_id: superAdminId,
                    property_id: testPropertyId,
                    access_level: 'admin',
                    tenant_id: platformTenantId,
                },
                {
                    user_id: testUserId,
                    property_id: testPropertyId,
                    access_level: 'staff',
                    tenant_id: platformTenantId,
                },
            ]);
        }
    });

    afterAll(async () => {
        // Cleanup
        await supabase.from('user_property_access').delete().in('user_id', [superAdminId, testUserId]);
        await supabase.from('modules').delete().eq('slug', moduleSlug);
        await supabase.from('roles').delete().eq('name', testRoleName);
        await supabase.from('app_permissions').delete().like('slug', `module:${moduleSlug}%`);
        await supabase.from('payment_ledger').delete().like('webhook_id', `test_webhook_${testId}%`);
        await supabase.from('users').delete().in('id', [superAdminId, testUserId]);
    });

    // 1. Module Creation & Permission Generation
    it('should create a module and auto-generate app_permissions', async () => {
        const res = await request(app)
            .post('/api/v1/admin/modules')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .set('X-Property-Id', testPropertyId || '')
            .send({
                name: `Test Module ${testId}`,
                slug: moduleSlug,
                engine_type: 'instant_transaction',
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
            .set('X-Property-Id', testPropertyId || '')
            .send({
                description: 'Hacker Update'
            });

        expect(res.status).toBe(403);
    });

    it('should allow module update to user WITH permissions', async () => {
        // Grant permission
        const { error: permError } = await supabase.from('app_role_permissions').insert({
            role_name: testRoleName,
            permission_slug: `module:${moduleSlug}:manage`,
            tenant_id: platformTenantId!,
            property_id: testPropertyId!,
        });
        expect(permError).toBeNull();

        const res = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${testUserToken}`)
            .set('X-Property-Id', testPropertyId || '')
            .send({
                description: 'Authorized Update'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.description).toBe('Authorized Update');
    });

    // 3. Module Versioning (Optimistic Locking)
    it('should increment settings_version on update', async () => {
        // Refetch current state first
        const { data: current } = await supabase.from('modules').select('settings_version').eq('id', moduleId).single();
        const ver = current?.settings_version || 1;

        const res2 = await request(app)
            .put(`/api/v1/admin/modules/${moduleId}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .set('X-Property-Id', testPropertyId || '')
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
            .set('X-Property-Id', testPropertyId || '')
            .send({
                settings: { color: 'purple' },
                settings_version: Math.max(1, ver - 1) // Stale version
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Version conflict');
    });

    // 4. Payment Idempotency
    it('should enforce unique webhook_id in payment_ledger', async () => {
        const webhookId = `test_webhook_${testId}`;
        const entry: Record<string, unknown> = {
            reference_type: 'test_order',
            reference_id: uuidv4(),
            event_type: 'authorized',
            amount: 50.00,
            currency: 'USD',
            status: 'success',
            webhook_id: webhookId
        };

        // Include tenant_id when available — the isolation remediation
        // migration added tenant_id to payment_ledger (may be NOT NULL).
        if (platformTenantId) {
            entry.tenant_id = platformTenantId;
        }
        if (testPropertyId) {
            entry.property_id = testPropertyId;
        }

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
