import { ApiClient } from './api-client';
import { CONFIG } from '../config';
import { Logger } from './logger';

export class FinancialAuditor {
    private api: ApiClient;
    private logger: Logger;

    constructor() {
        this.api = new ApiClient();
        this.logger = new Logger('System', 'Auditor');
    }

    async runAudit(): Promise<boolean> {
        this.logger.info('🚀 Starting Deep System Audit...');

        // 1. Authenticate as Admin
        const isAuthenticated = await this.api.login(CONFIG.ADMIN_EMAIL, CONFIG.ADMIN_PASSWORD);
        if (!isAuthenticated) {
            this.logger.error('Failed to authenticate as admin for audit!');
            return false;
        }

        let allPassed = true;

        // 2. Concurrency Check: Double Bookings
        const doubleBookingCheck = await this.checkDoubleBookings();
        if (!doubleBookingCheck) allPassed = false;

        // 3. Integrity Check: Negative Quantities
        const negativeQtyCheck = await this.checkNegativeQuantities();
        if (!negativeQtyCheck) allPassed = false;

        // 4. Integrity Check: Price Calculation Accuracy
        const priceIntegrityCheck = await this.checkPriceIntegrity();
        if (!priceIntegrityCheck) allPassed = false;

        if (allPassed) {
            this.logger.success('✅ ALL AUDIT CHECKS PASSED. System integrity verified.');
        } else {
            this.logger.error('❌ AUDIT FAILED. Data corruption or invariants violations detected.');
        }

        return allPassed;
    }

    private async checkDoubleBookings(): Promise<boolean> {
        this.logger.info('🔍 Checking for double bookings...');
        const res = await this.api.request<any[]>('/chalets/staff/bookings', 'GET');

        if (!res.success || !res.data) {
            this.logger.error('Failed to fetch bookings for audit.');
            return false;
        }

        const bookings = res.data.filter((b: any) => b.status !== 'cancelled' && b.status !== 'no_show');
        const overlaps: string[] = [];

        for (let i = 0; i < bookings.length; i++) {
            for (let j = i + 1; j < bookings.length; j++) {
                const b1 = bookings[i];
                const b2 = bookings[j];

                if (b1.chalet_id === b2.chalet_id) {
                    const s1 = new Date(b1.check_in_date).getTime();
                    const e1 = new Date(b1.check_out_date).getTime();
                    const s2 = new Date(b2.check_in_date).getTime();
                    const e2 = new Date(b2.check_out_date).getTime();

                    if (s1 < e2 && e1 > s2) {
                        overlaps.push(`Conflict: ${b1.booking_number || b1.id} and ${b2.booking_number || b2.id} on Chalet ${b1.chalet_id}`);
                    }
                }
            }
        }

        if (overlaps.length > 0) {
            this.logger.error(`💀 DATA CORRUPTION: ${overlaps.length} overlapping bookings detected!`);
            overlaps.slice(0, 10).forEach(o => this.logger.error(`   - ${o}`));
            return false;
        }

        this.logger.success('No double bookings found.');
        return true;
    }

    private async checkNegativeQuantities(): Promise<boolean> {
        this.logger.info('🔍 Checking for negative/zero quantities in orders...');

        const restRes = await this.api.request<any[]>('/restaurant/staff/orders', 'GET');
        const snackRes = await this.api.request<any[]>('/snack/staff/orders', 'GET');

        let issues = 0;

        if (restRes.success && restRes.data) {
            for (const order of restRes.data) {
                for (const item of (order.items || [])) {
                    if (item.quantity <= 0) {
                        this.logger.error(`Invalid Qty: Restaurant Order ${order.order_number || order.id} has item with qty ${item.quantity}`);
                        issues++;
                    }
                }
            }
        }

        if (snackRes.success && snackRes.data) {
            for (const order of snackRes.data) {
                for (const item of (order.items || [])) {
                    if (item.quantity <= 0) {
                        this.logger.error(`Invalid Qty: Snack Order ${order.order_number || order.id} has item with qty ${item.quantity}`);
                        issues++;
                    }
                }
            }
        }

        if (issues > 0) {
            this.logger.error(`💀 INTEGRITY FAILURE: ${issues} items found with invalid quantities!`);
            return false;
        }

        this.logger.success('No negative/zero quantities found.');
        return true;
    }

    private async checkPriceIntegrity(): Promise<boolean> {
        this.logger.info('🔍 Checking price calculation integrity...');

        const res = await this.api.request<any[]>('/chalets/staff/bookings', 'GET');
        if (!res.success || !res.data) return false;

        let issues = 0;
        for (const b of res.data) {
            const expectedTotal = parseFloat(b.base_amount || 0) + parseFloat(b.add_ons_amount || 0);
            const actualTotal = parseFloat(b.total_amount || 0);

            if (Math.abs(expectedTotal - actualTotal) > 0.01) {
                this.logger.error(`Price Mismatch: Booking ${b.booking_number || b.id} Total=${actualTotal}, Expected=${expectedTotal}`);
                issues++;
            }
        }

        if (issues > 0) {
            this.logger.error(`💀 FINANCIAL DISCREPANCY: ${issues} bookings have incorrect total amounts!`);
            return false;
        }

        this.logger.success('Price integrity verified.');
        return true;
    }
}
