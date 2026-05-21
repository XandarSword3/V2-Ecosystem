import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CONFIG } from '../config';
import {
    weightedRandom,
    randomDelay,
    randomElement,
} from '../utils/helpers';

// Manager accounts pre-seeded in the system
const MANAGER_ACCOUNTS = [
    { email: 'restaurant.manager@v2ecosystem.com', password: 'staff123', department: 'restaurant' },
    { email: 'chalet.manager@v2ecosystem.com', password: 'staff123', department: 'chalets' },
];

export class ManagerBot {
    public api: ApiClient;
    protected logger: Logger;
    protected botId: number;
    protected isRunning = false;
    private department: string;

    // Cached data
    private pendingApprovals: any[] = [];
    private shifts: any[] = [];
    private lastDashboardCheck = 0;

    constructor(botId: number) {
        this.botId = botId;
        this.api = new ApiClient();
        this.logger = new Logger('Manager', botId);
        this.department = MANAGER_ACCOUNTS[botId % MANAGER_ACCOUNTS.length].department;
    }

    async initialize(): Promise<boolean> {
        const account = MANAGER_ACCOUNTS[this.botId % MANAGER_ACCOUNTS.length];

        const success = await this.api.login(account.email, account.password);

        if (success) {
            this.logger.success(`Logged in as ${account.email} (${this.department} manager)`);
        } else {
            this.logger.error(`Failed to login as ${account.email}`);
        }

        return success;
    }

    async start(): Promise<void> {
        this.isRunning = true;
        this.logger.info(`🏢 Starting ${this.department} manager simulation...`);

        while (this.isRunning) {
            // Managers always check pending approvals first
            if (this.pendingApprovals.length === 0) {
                await this.performAction('VIEW_PENDING_APPROVALS');
            } else {
                const action = weightedRandom(CONFIG.MANAGER_ACTIONS);
                await this.performAction(action);
            }

            await randomDelay(CONFIG.MANAGER_ACTION_INTERVAL.min, CONFIG.MANAGER_ACTION_INTERVAL.max);
        }
    }

    stop(): void {
        this.isRunning = false;
        this.logger.info('Manager signing off...');
    }

    private async performAction(action: string): Promise<void> {
        const startTime = Date.now();
        let success = false;

        try {
            switch (action) {
                // ===== APPROVALS =====
                case 'VIEW_PENDING_APPROVALS':
                    success = await this.viewPendingApprovals();
                    break;
                case 'APPROVE_REQUEST':
                    success = await this.approveRequest();
                    break;
                case 'DENY_REQUEST':
                    success = await this.denyRequest();
                    break;
                case 'VIEW_APPROVAL_STATS':
                    success = await this.viewApprovalStats();
                    break;
                case 'VIEW_ALL_APPROVALS':
                    success = await this.viewAllApprovals();
                    break;

                // ===== SHIFTS =====
                case 'VIEW_SHIFTS':
                    success = await this.viewShifts();
                    break;
                case 'VIEW_TODAY_SCHEDULE':
                    success = await this.viewTodaySchedule();
                    break;
                case 'CREATE_SHIFT':
                    success = await this.createShift();
                    break;
                case 'CLOCK_IN':
                    success = await this.clockIn();
                    break;
                case 'CLOCK_OUT':
                    success = await this.clockOut();
                    break;

                // ===== MONITORING (shared with admin) =====
                case 'VIEW_DASHBOARD':
                    success = await this.viewDashboard();
                    break;
                case 'VIEW_REVENUE_STATS':
                    success = await this.viewRevenueStats();
                    break;

                default:
                    this.logger.warn(`Unknown action: ${action}`);
                    return;
            }

            const latency = Date.now() - startTime;
            globalMetrics.recordRequest(success, latency);
            globalMetrics.recordAction(`Manager.${action}`);

        } catch (error: any) {
            globalMetrics.recordRequest(false, Date.now() - startTime);
            globalMetrics.recordError(`Manager ${this.botId}: ${action} - ${error.message}`);
            this.logger.error(`${action} failed: ${error.message}`);
        }
    }

    // ==================== APPROVALS ====================

    private async viewPendingApprovals(): Promise<boolean> {
        const result = await this.api.getPendingApprovals();
        if (result.success && result.data) {
            const approvals = Array.isArray(result.data) ? result.data : (result.data as any).approvals || [];
            this.pendingApprovals = approvals;
            this.logger.info(`📋 ${approvals.length} pending approval(s)`);
        }
        return result.success;
    }

    private async approveRequest(): Promise<boolean> {
        if (this.pendingApprovals.length === 0) {
            return await this.viewPendingApprovals();
        }

        const approval = this.pendingApprovals.shift();
        if (!approval?.id) return false;

        const notes = randomElement([
            'Approved - looks good',
            'OK, proceed',
            'Approved after review',
            'Verified and approved',
        ]);

        const result = await this.api.reviewApproval(approval.id, 'approved', notes);
        if (result.success) {
            this.logger.success(`✅ Approved request ${approval.id}`);
        }
        return result.success;
    }

    private async denyRequest(): Promise<boolean> {
        if (this.pendingApprovals.length === 0) {
            return await this.viewPendingApprovals();
        }

        const approval = this.pendingApprovals.shift();
        if (!approval?.id) return false;

        const notes = randomElement([
            'Denied - insufficient justification',
            'Rejected - not within budget',
            'Denied - needs more details',
        ]);

        const result = await this.api.reviewApproval(approval.id, 'rejected', notes);
        if (result.success) {
            this.logger.info(`❌ Denied request ${approval.id}`);
        }
        return result.success;
    }

    private async viewApprovalStats(): Promise<boolean> {
        const result = await this.api.getApprovalStats();
        if (result.success) {
            this.logger.info(`📊 Approval stats retrieved`);
        }
        return result.success;
    }

    private async viewAllApprovals(): Promise<boolean> {
        const result = await this.api.getAllApprovals();
        if (result.success) {
            this.logger.info(`📋 All approvals retrieved`);
        }
        return result.success;
    }

    // ==================== SHIFTS ====================

    private async viewShifts(): Promise<boolean> {
        const result = await this.api.getShifts();
        if (result.success && result.data) {
            const shifts = Array.isArray(result.data) ? result.data : (result.data as any).shifts || [];
            this.shifts = shifts;
            this.logger.info(`📅 ${shifts.length} shift(s) loaded`);
        }
        return result.success;
    }

    private async viewTodaySchedule(): Promise<boolean> {
        const result = await this.api.getTodaySchedule();
        if (result.success) {
            this.logger.info(`📅 Today's schedule retrieved`);
        }
        return result.success;
    }

    private async createShift(): Promise<boolean> {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const shiftTypes = ['morning', 'afternoon', 'evening'];
        const shiftType = randomElement(shiftTypes);

        const startHour = shiftType === 'morning' ? 6 : shiftType === 'afternoon' ? 14 : 20;

        const result = await this.api.createShift({
            date: tomorrow.toISOString().split('T')[0],
            startTime: `${startHour}:00`,
            endTime: `${startHour + 8}:00`,
            department: this.department,
            notes: `${shiftType} shift created by manager bot`,
        });

        if (result.success) {
            this.logger.success(`📅 Created ${shiftType} shift for tomorrow`);
        }
        return result.success;
    }

    private async clockIn(): Promise<boolean> {
        if (this.shifts.length === 0) {
            await this.viewShifts();
        }

        // Find a shift that hasn't been clocked in yet
        const shift = this.shifts.find((s: any) => !s.clockedIn);
        if (!shift?.id) {
            this.logger.info('No shifts to clock in');
            return true;
        }

        const result = await this.api.clockIn(shift.id);
        if (result.success) {
            shift.clockedIn = true;
            this.logger.success(`⏰ Clocked in for shift ${shift.id}`);
        }
        return result.success;
    }

    private async clockOut(): Promise<boolean> {
        if (this.shifts.length === 0) {
            await this.viewShifts();
        }

        const shift = this.shifts.find((s: any) => s.clockedIn && !s.clockedOut);
        if (!shift?.id) {
            this.logger.info('No shifts to clock out');
            return true;
        }

        const result = await this.api.clockOut(shift.id);
        if (result.success) {
            shift.clockedOut = true;
            this.logger.info(`⏰ Clocked out of shift ${shift.id}`);
        }
        return result.success;
    }

    // ==================== MONITORING ====================

    private async viewDashboard(): Promise<boolean> {
        const result = await this.api.getDashboard();
        if (result.success) {
            this.lastDashboardCheck = Date.now();
            this.logger.info('📊 Dashboard data loaded');
        }
        return result.success;
    }

    private async viewRevenueStats(): Promise<boolean> {
        const result = await this.api.getRevenueStats();
        if (result.success) {
            this.logger.info('💰 Revenue stats loaded');
        }
        return result.success;
    }
}
