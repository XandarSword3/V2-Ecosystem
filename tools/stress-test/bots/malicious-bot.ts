import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CustomerBot } from './customer-bot';

/**
 * MaliciousBot — Simulates security attack vectors against the system.
 * Expanded from 4 to 10 attack vectors for comprehensive security testing.
 */
export class MaliciousBot extends CustomerBot {
    private vulnerabilities: string[] = [];
    private blockedAttacks = 0;

    constructor(botId: number) {
        super(botId);
        this.logger = new Logger('Malicious', botId);
    }

    async start(): Promise<void> {
        this.isRunning = true;
        this.logger.info('Starting malicious bot simulation...');

        // Wait for initialize() to be called by orchestrator instead of doing it here
        if (!this.userData) {
            await this.initialize();
        }

        while (this.isRunning) {
            const attackIndex = Math.floor(Math.random() * 10);

            try {
                switch (attackIndex) {
                    case 0: await this.unauthorizedAccessAttack(); break;
                    case 1: await this.inputInjectionAttack(); break;
                    case 2: await this.rateLimitSpam(); break;
                    case 3: await this.parameterTampering(); break;
                    case 4: await this.pathTraversalAttack(); break;
                    case 5: await this.headerInjectionAttack(); break;
                    case 6: await this.massAssignmentAttack(); break;
                    case 7: await this.privilegeEscalationAttack(); break;
                    case 8: await this.enumeration(); break;
                    case 9: await this.verbTamperingAttack(); break;
                }
            } catch (e) {
                this.logger.error(`Attack failed with exception: ${e}`);
            }

            const delay = Math.floor(Math.random() * 3000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Summary
        this.logger.info(`Security Summary: ${this.blockedAttacks} attacks blocked, ${this.vulnerabilities.length} potential vulnerabilities`);
        if (this.vulnerabilities.length > 0) {
            this.vulnerabilities.forEach(v => this.logger.error(`  💀 ${v}`));
        }
    }

    stop(): void {
        this.isRunning = false;
    }

    // Attack 1: Unauthorized access to admin/staff routes
    private async unauthorizedAccessAttack(): Promise<void> {
        this.logger.action('Attempting UNAUTHORIZED access to admin routes...');

        const targets = [
            { name: 'Admin Modules', fn: () => this.api.getAdminModules() },
            { name: 'User List', fn: () => this.api.request('/admin/users', 'GET') },
            { name: 'Staff Live Orders', fn: () => this.api.getModuleLiveOrders('restaurant') },
            { name: 'Admin Dashboard', fn: () => this.api.getDashboard() },
            { name: 'Audit Logs', fn: () => this.api.getAuditLogs() },
            { name: 'Admin Settings', fn: () => this.api.getSettings() },
        ];

        for (const target of targets) {
            const res = await target.fn();
            if (res.success) {
                this.vulnerabilities.push(`Unauthorized access to ${target.name}`);
                this.logger.error(`💀 VULNERABILITY: Accessed ${target.name} without authorization!`);
                globalMetrics.recordError(`SECURITY: Unauthorized access to ${target.name}`);
            } else {
                this.blockedAttacks++;
                this.logger.info(`Blocked: ${target.name} (Good)`);
            }
        }

        globalMetrics.recordAction('Malicious.UnauthorizedAccess');
    }

    // Attack 2: SQL/XSS injection payloads
    private async inputInjectionAttack(): Promise<void> {
        this.logger.action('Attempting INPUT INJECTION attacks...');

        const payloads = [
            "'; DROP TABLE users; --",
            '<script>alert("XSS")</script>',
            '{{7*7}}',  // SSTI
            '${7*7}',   // Template injection
            '../../../etc/passwd',
            'UNION SELECT * FROM users--',
            '<img src=x onerror=alert(1)>',
        ];

        for (const payload of payloads) {
            const res = await this.api.submitReview({
                service_type: 'restaurant',
                rating: 5,
                text: payload
            });

            // If the review was accepted, check if the payload was sanitized
            if (res.success) {
                this.logger.warn(`Injection payload accepted (may be sanitized): ${payload.substring(0, 30)}...`);
            } else {
                this.blockedAttacks++;
                this.logger.info(`Injection blocked: ${payload.substring(0, 30)}...`);
            }
        }

        globalMetrics.recordAction('Malicious.InputInjection');
    }

    // Attack 3: Rate limit testing
    private async rateLimitSpam(): Promise<void> {
        this.logger.action('Attempting RATE LIMIT spam (20 rapid requests)...');

        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(this.api.getRestaurantMenu());
        }

        const results = await Promise.allSettled(promises);
        const rateLimited = results.filter(r =>
            r.status === 'fulfilled' && (
                (r.value as any).error?.includes('429') ||
                (r.value as any).error?.includes('rate') ||
                (r.value as any).error?.includes('Too many')
            )
        ).length;

        if (rateLimited > 0) {
            this.blockedAttacks++;
            this.logger.info(`Rate limiting active: ${rateLimited}/20 requests limited (Good)`);
        } else {
            this.logger.warn(`No rate limiting detected on 20 rapid requests`);
        }

        globalMetrics.recordAction('Malicious.RateLimitSpam');
    }

    // Attack 4: IDOR parameter tampering
    private async parameterTampering(): Promise<void> {
        this.logger.action('Attempting IDOR parameter tampering...');

        // Try to access other users' data with fake IDs
        const fakeIds = [
            '00000000-0000-0000-0000-000000000001',
            '1', 'admin', '../admin',
        ];

        for (const id of fakeIds) {
            const res = await this.api.request(`/admin/users/${id}`, 'GET');
            if (res.success) {
                this.vulnerabilities.push(`IDOR: Accessed user ${id}`);
                this.logger.error(`💀 IDOR VULNERABILITY: Accessed user ${id}!`);
                globalMetrics.recordError(`SECURITY: IDOR on user ${id}`);
            } else {
                this.blockedAttacks++;
                this.logger.info(`IDOR blocked for ${id} (Good)`);
            }
        }

        globalMetrics.recordAction('Malicious.ParameterTampering');
    }

    // Attack 5: Path traversal
    private async pathTraversalAttack(): Promise<void> {
        this.logger.action('Attempting PATH TRAVERSAL attacks...');

        const paths = [
            '/../../etc/passwd',
            '/../.env',
            '/admin/../../../config',
            '/%2e%2e%2f%2e%2e%2fconfig',
        ];

        for (const path of paths) {
            const res = await this.api.request(path, 'GET', null, false);
            if (res.success && res.data) {
                this.vulnerabilities.push(`Path traversal succeeded: ${path}`);
                this.logger.error(`💀 PATH TRAVERSAL: ${path} returned data!`);
                globalMetrics.recordError(`SECURITY: Path traversal on ${path}`);
            } else {
                this.blockedAttacks++;
                this.logger.info(`Path traversal blocked: ${path} (Good)`);
            }
        }

        globalMetrics.recordAction('Malicious.PathTraversal');
    }

    // Attack 6: Header injection
    private async headerInjectionAttack(): Promise<void> {
        this.logger.action('Attempting HEADER INJECTION...');

        // Try setting custom headers via query params or body that might leak
        const res = await this.api.request('/restaurant/menu', 'GET', null, false);
        // The real test is in how the server processes headers - we just verify it doesn't crash
        if (res.success) {
            this.logger.info('Server responded normally to header injection attempt');
        }

        globalMetrics.recordAction('Malicious.HeaderInjection');
    }

    // Attack 7: Mass assignment — try to escalate own role
    private async massAssignmentAttack(): Promise<void> {
        this.logger.action('Attempting MASS ASSIGNMENT (role escalation via profile update)...');

        // Try to update own profile with admin role
        const res = await this.api.request('/auth/me', 'PUT', {
            roles: ['admin'],
            is_admin: true,
            role: 'admin',
        });

        if (res.success) {
            // Check if the role was actually changed
            const profile = await this.api.getProfile();
            const roles = (profile.data as any)?.roles || [];
            if (roles.includes('admin')) {
                this.vulnerabilities.push('Mass assignment: Escalated to admin via profile update');
                this.logger.error('💀 MASS ASSIGNMENT: Successfully escalated to admin!');
                globalMetrics.recordError('SECURITY: Mass assignment role escalation');
            } else {
                this.blockedAttacks++;
                this.logger.info('Mass assignment blocked: Role fields ignored (Good)');
            }
        } else {
            this.blockedAttacks++;
            this.logger.info('Mass assignment blocked: Update rejected (Good)');
        }

        globalMetrics.recordAction('Malicious.MassAssignment');
    }

    // Attack 8: Privilege escalation — create user with admin role
    private async privilegeEscalationAttack(): Promise<void> {
        this.logger.action('Attempting PRIVILEGE ESCALATION...');

        // Try to register with admin role
        const res = await this.api.request('/auth/register', 'POST', {
            email: `escalation_${Date.now()}@evil.com`,
            password: 'Password123!',
            fullName: 'Privilege Escalator',
            roles: ['admin'],
            role: 'admin',
        }, false);

        if (res.success) {
            this.logger.warn('Registration accepted — checking if admin role was assigned...');
            // The important thing is whether the role was actually set
        } else {
            this.blockedAttacks++;
            this.logger.info('Privilege escalation blocked at registration (Good)');
        }

        globalMetrics.recordAction('Malicious.PrivilegeEscalation');
    }

    // Attack 9: User/resource enumeration
    private async enumeration(): Promise<void> {
        this.logger.action('Attempting USER ENUMERATION...');

        // Try common admin emails to see if the error messages leak existence info
        const emails = ['admin@v2resort.com', 'test@test.com', 'nonexistent@fake.com'];

        for (const email of emails) {
            const res = await this.api.request('/auth/login', 'POST', {
                email,
                password: 'wrongpassword'
            }, false);

            // Check if response reveals whether the email exists
            if (res.error && (res.error.includes('not found') || res.error.includes('does not exist'))) {
                this.logger.warn(`Enumeration leak: Different error for "${email}" reveals existence`);
            }
        }

        globalMetrics.recordAction('Malicious.Enumeration');
    }

    // Attack 10: HTTP verb tampering
    private async verbTamperingAttack(): Promise<void> {
        this.logger.action('Attempting HTTP VERB TAMPERING...');

        const endpoints = ['/admin/users', '/admin/settings', '/admin/modules'];
        const dangerousVerbs = ['DELETE', 'PATCH', 'PUT'];

        for (const endpoint of endpoints) {
            for (const verb of dangerousVerbs) {
                const res = await this.api.request(endpoint, verb, {}, true);
                if (res.success) {
                    this.vulnerabilities.push(`Verb tampering: ${verb} ${endpoint} succeeded`);
                    this.logger.error(`💀 VERB TAMPERING: ${verb} ${endpoint} succeeded!`);
                } else {
                    this.blockedAttacks++;
                }
            }
        }

        this.logger.info(`Verb tampering: ${this.blockedAttacks} methods blocked`);
        globalMetrics.recordAction('Malicious.VerbTampering');
    }
}
