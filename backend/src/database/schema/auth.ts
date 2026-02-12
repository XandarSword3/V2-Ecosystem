import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// Enums
// ============================================
export const businessUnitEnum = pgEnum('business_unit', ['restaurant', 'snack_bar', 'chalets', 'pool', 'admin']);

// ============================================
// Users & Auth
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  profileImageUrl: text('profile_image_url'),
  preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
  emailVerified: boolean('email_verified').default(false),
  phoneVerified: boolean('phone_verified').default(false),
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at'),
  oauthProvider: varchar('oauth_provider', { length: 50 }),
  oauthProviderId: varchar('oauth_provider_id', { length: 255 }),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  backupCodes: jsonb('backup_codes'),
  lastPasswordChange: timestamp('last_password_change').defaultNow(),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  lastFailedLogin: timestamp('last_failed_login'),
  twoFactorRequired: boolean('two_factor_required').default(false),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  businessUnit: businessUnitEnum('business_unit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  grantedBy: uuid('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  refreshToken: varchar('refresh_token', { length: 500 }).unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const twoFactorPending = pgTable('two_factor_pending', {
  userId: uuid('user_id').references(() => users.id).primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: jsonb('backup_codes'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const twoFactorAuth = pgTable('two_factor_auth', {
  userId: uuid('user_id').references(() => users.id).primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: jsonb('backup_codes'),
  enabledAt: timestamp('enabled_at').defaultNow(),
});

export const biometricCredentials = pgTable('biometric_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type'),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
});

export const passwordHistory = pgTable('password_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appPermissions = pgTable('app_permissions', {
  slug: varchar('slug', { length: 255 }).primaryKey(),
  description: text('description'),
  moduleSlug: varchar('module_slug', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appRolePermissions = pgTable('app_role_permissions', {
  roleName: varchar('role_name', { length: 50 }).notNull(),
  permissionSlug: varchar('permission_slug', { length: 255 }).references(() => appPermissions.slug).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
