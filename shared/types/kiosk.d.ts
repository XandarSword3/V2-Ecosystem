import type { UUID, BaseEntity } from './index';
export type KioskDeviceStatus = 'online' | 'offline' | 'maintenance' | 'error';
export type KioskDeviceType = 'standard' | 'compact' | 'outdoor';
export type KioskSessionType = 'checkin' | 'checkout' | 'key_replacement' | 'info' | 'payment';
export type KioskSessionStatus = 'started' | 'in_progress' | 'completed' | 'abandoned' | 'timeout' | 'error';
export type KioskTransactionType = 'payment' | 'key_encode' | 'id_scan' | 'receipt_print' | 'card_dispense';
export interface KioskCapabilities {
    hasIdScanner: boolean;
    hasCardReader: boolean;
    hasKeyEncoder: boolean;
    hasReceiptPrinter: boolean;
    hasSignaturePad: boolean;
    hasCamera: boolean;
    hasCashAcceptor: boolean;
    hasCardDispenser: boolean;
}
export interface KioskDevice extends BaseEntity {
    propertyId: UUID;
    deviceName: string;
    deviceCode: string;
    location?: string;
    deviceType: KioskDeviceType;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    capabilities: KioskCapabilities;
    status: KioskDeviceStatus;
    lastHeartbeat?: Date;
    lastError?: string;
    errorCount: number;
    config: Record<string, unknown>;
    operatingHours?: Record<string, {
        open: string;
        close: string;
    }>;
    lastMaintenanceDate?: string;
    nextMaintenanceDate?: string;
    maintenanceNotes?: string;
    isActive: boolean;
}
export interface KioskSession {
    id: UUID;
    kioskId: UUID;
    propertyId: UUID;
    sessionType: KioskSessionType;
    bookingId?: UUID;
    guestId?: UUID;
    confirmationNumber?: string;
    status: KioskSessionStatus;
    currentStep?: string;
    stepsCompleted: string[];
    startedAt: Date;
    lastActivityAt: Date;
    completedAt?: Date;
    durationSeconds?: number;
    inputData: Record<string, unknown>;
    resultStatus?: 'success' | 'partial' | 'failed';
    resultData?: Record<string, unknown>;
    failureReason?: string;
    transferredToDesk: boolean;
    transferReason?: string;
    deskStaffId?: UUID;
    createdAt: Date;
}
export interface KioskTransaction {
    id: UUID;
    sessionId: UUID;
    kioskId: UUID;
    transactionType: KioskTransactionType;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    requestData?: Record<string, unknown>;
    responseData?: Record<string, unknown>;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    paymentReference?: string;
    errorCode?: string;
    errorMessage?: string;
    retryCount: number;
    startedAt: Date;
    completedAt?: Date;
    createdAt: Date;
}
export interface KioskHardwareEvent {
    id: UUID;
    kioskId: UUID;
    eventType: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    component?: string;
    details?: Record<string, unknown>;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: UUID;
    resolutionNotes?: string;
    createdAt: Date;
}
//# sourceMappingURL=kiosk.d.ts.map