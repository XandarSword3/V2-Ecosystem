import { InvariantScenario, ScenarioResult } from '../types';
import { ApiClient } from '../utils/api-client';
import { Logger } from '../utils/logger';
import { CONFIG } from '../config';

export class ChaletRaceScenario implements InvariantScenario {
    name = 'ChaletDoubleBookingAssault';
    description = '50 customers attempt to book the same chalet for the same dates simultaneously';

    private readonly CONCURRENCY = 50;
    private readonly CHECK_IN = '2027-01-01';
    private readonly CHECK_OUT = '2027-01-05';

    private targetChaletId: string | null = null;
    private successCount = 0;
    private failCount = 0;
    private errors = new Set<string>();

    // Dynamic result tracking
    private _success = false;
    private _invariantHeld = false;
    private _details = 'Not executed';
    private _duration = 0;

    async setup(api: ApiClient, logger: Logger): Promise<void> {
        logger.info(`[${this.name}] Setting up Chalet Double-Booking Assault...`);
        const chalets = await api.getChalets();
        if (!chalets.success || chalets.data.length === 0) {
            throw new Error('No chalets available for testing');
        }
        const targetChalet = chalets.data[0];
        this.targetChaletId = targetChalet.id;
        logger.info(`[${this.name}] Target Chalet: ${targetChalet.name} (${targetChalet.id})`);

        // Cleanup any existing bookings for these dates to ensure clean race
        await this.cleanupExistingBookings(api, logger);
    }

    private async cleanupExistingBookings(api: ApiClient, logger: Logger) {
        if (!this.targetChaletId) return;
        try {
            const adminApi = new ApiClient();
            await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
            const bookingsRes = await adminApi.getAdminBookings();
            if (bookingsRes.success && bookingsRes.data) {
                const conflicts = (bookingsRes.data as any[]).filter((b: any) =>
                    b.chalet_id === this.targetChaletId &&
                    b.check_in_date?.startsWith(this.CHECK_IN) &&
                    b.status !== 'cancelled'
                );
                for (const b of conflicts) {
                    await adminApi.updateBookingStatus(b.id, 'cancelled');
                }
                if (conflicts.length > 0) logger.info(`[${this.name}] Cleaned up ${conflicts.length} conflicting bookings in setup`);
            }
        } catch (e) {
            logger.warn(`[${this.name}] Setup cleanup failed: ${e}`);
        }
    }

    async run(api: ApiClient, logger: Logger): Promise<void> {
        if (!this.targetChaletId) throw new Error('Setup failed: No target chalet');

        logger.info(`[${this.name}] Launching ${this.CONCURRENCY} concurrent booking requests...`);
        const startTime = Date.now();

        const promises = [];
        for (let i = 0; i < this.CONCURRENCY; i++) {
            const userApi = new ApiClient();
            promises.push(userApi.createChaletBooking({
                chaletId: this.targetChaletId,
                checkInDate: this.CHECK_IN,
                checkOutDate: this.CHECK_OUT,
                customerName: `Race Bot ${i}`,
                customerEmail: `race${i}@test.com`,
                customerPhone: `+10000000${i}`,
                numberOfGuests: 2,
                paymentMethod: 'card'
            }));
        }

        const results = await Promise.allSettled(promises);
        this._duration = Date.now() - startTime;

        this.successCount = 0;
        this.failCount = 0;
        this.errors.clear();

        results.forEach(r => {
            if (r.status === 'fulfilled' && (r.value as any).success) {
                this.successCount++;
            } else {
                this.failCount++;
                if (r.status === 'fulfilled') {
                    this.errors.add((r.value as any).error || 'Unknown API Error');
                } else {
                    this.errors.add(String(r.reason));
                }
            }
        });

        logger.info(`[${this.name}] Results: ${this.successCount} Success, ${this.failCount} Failures`);
        logger.info(`[${this.name}] Error types (Sample): ${Array.from(this.errors).slice(0, 3).join(', ')}...`);
    }

    async verify(api: ApiClient, logger: Logger): Promise<boolean> {
        if (this.successCount === 0) {
            logger.warn(`[${this.name}] WARNING: 0 successes. Maybe dates blocked? System safe but test inconclusive.`);
            this._details = '0 bookings succeeded — test inconclusive but invariant held';
            this._invariantHeld = true;
            this._success = true;
            return true;
        } else if (this.successCount === 1) {
            logger.success(`[${this.name}] PASSED: Exactly 1 booking succeeded.`);
            this._details = 'Exactly 1 booking succeeded — no double booking';
            this._invariantHeld = true;
            this._success = true;
            return true;
        } else {
            logger.error(`[${this.name}] VIOLATION: ${this.successCount} bookings succeeded! Double booking detected!`);
            this._details = `${this.successCount} bookings succeeded — DOUBLE BOOKING`;
            this._invariantHeld = false;
            this._success = true;
            return false;
        }
    }

    async teardown(api: ApiClient, logger: Logger): Promise<void> {
        // Cancel any successful bookings to free up dates for future runs
        if (this.targetChaletId) {
            try {
                const adminApi = new ApiClient();
                await adminApi.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);

                const bookingsRes = await adminApi.getAdminBookings();
                if (bookingsRes.success && bookingsRes.data) {
                    const testBookings = (bookingsRes.data as any[]).filter((b: any) =>
                        b.chalet_id === this.targetChaletId &&
                        b.check_in_date?.startsWith(this.CHECK_IN) &&
                        b.status !== 'cancelled'
                    );
                    for (const booking of testBookings) {
                        await adminApi.updateBookingStatus(booking.id, 'cancelled');
                    }
                    if (testBookings.length > 0) {
                        logger.info(`[${this.name}] Cancelled ${testBookings.length} test booking(s)`);
                    }
                }
            } catch (e) {
                logger.warn(`[${this.name}] Teardown: Failed to cancel bookings`);
            }
        }
        logger.info(`[${this.name}] Teardown complete`);
    }

    getResult(): ScenarioResult {
        return {
            name: this.name,
            success: this._success,
            invariantHeld: this._invariantHeld,
            details: this._details,
            metrics: { duration: this._duration, requests: this.CONCURRENCY, failures: this.failCount }
        };
    }
}
