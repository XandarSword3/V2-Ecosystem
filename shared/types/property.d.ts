import type { UUID, BaseEntity } from './index';
export interface PropertyGroup extends BaseEntity {
    name: string;
    code?: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    timezone: string;
    currency: string;
    settings: Record<string, unknown>;
    isActive: boolean;
}
export interface Property extends BaseEntity {
    name: string;
    groupId?: UUID;
    propertyCode?: string;
    propertyType: string;
    address?: string;
    city?: string;
    country?: string;
    timezone?: string;
    isActive: boolean;
}
export interface PropertySettings extends BaseEntity {
    propertyId: UUID;
    settingKey: string;
    settingValue: unknown;
    category: string;
    description?: string;
}
export interface UserPropertyAccess {
    id: UUID;
    userId: UUID;
    propertyId: UUID;
    accessLevel: 'read' | 'write' | 'manage' | 'admin';
    isPrimary: boolean;
    grantedAt: Date;
    expiresAt?: Date;
}
export interface UserGroupAccess {
    id: UUID;
    userId: UUID;
    groupId: UUID;
    accessLevel: string;
    roleInGroup?: string;
    grantedAt: Date;
}
//# sourceMappingURL=property.d.ts.map