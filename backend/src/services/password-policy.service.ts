/**
 * Password Policy Service
 * 
 * Server-side password validation with configurable policies.
 */

import { z } from 'zod';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Default password policy
const DEFAULT_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
  passwordHistoryCount: 5, // Prevent reuse of last N passwords
  maxAge: 90, // Days before password expires (0 = never)
  minAge: 1, // Days before password can be changed again
};

export type PasswordPolicy = typeof DEFAULT_POLICY;

// Common passwords list (top 100 most common)
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', '123321', 'welcome', 'shadow', 'ashley',
  'football', 'jesus', 'michael', 'ninja', 'mustang',
  'password1', 'password123', 'letmein', 'abc123', 'monkey',
  'qwerty123', 'admin', 'login', 'princess', 'starwars',
  'hello', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'admin123',
  '000000', '654321', 'qwertyuiop', 'lovely', 'rockyou',
  'nicole', 'daniel', 'babygirl', 'michael1', 'jessica',
]);

interface ValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  score: number;
}

interface UserInfo {
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Get the current password policy
 */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  try {
    const settings = await prisma.systemSettings.findMany({
      where: {
        category: 'security',
        key: {
          startsWith: 'password.'
        }
      }
    });

    const policy = { ...DEFAULT_POLICY };

    for (const setting of settings) {
      const key = setting.key.replace('password.', '') as keyof PasswordPolicy;
      if (key in policy) {
        const value = setting.value;
        if (typeof policy[key] === 'boolean') {
          (policy as any)[key] = value === 'true';
        } else if (typeof policy[key] === 'number') {
          (policy as any)[key] = parseInt(value, 10);
        } else {
          (policy as any)[key] = value;
        }
      }
    }

    return policy;
  } catch (error) {
    logger.warn('Failed to load password policy, using defaults', { error });
    return DEFAULT_POLICY;
  }
}

/**
 * Update password policy
 */
export async function updatePasswordPolicy(
  policy: Partial<PasswordPolicy>,
  userId: string
): Promise<void> {
  const validKeys = Object.keys(DEFAULT_POLICY);
  
  for (const [key, value] of Object.entries(policy)) {
    if (!validKeys.includes(key)) continue;
    
    await prisma.systemSettings.upsert({
      where: { key: `password.${key}` },
      update: {
        value: String(value),
        updatedAt: new Date(),
        updatedBy: userId
      },
      create: {
        key: `password.${key}`,
        value: String(value),
        category: 'security',
        createdBy: userId,
        updatedBy: userId
      }
    });
  }

  logger.info('Password policy updated', { userId, changes: Object.keys(policy) });
}

/**
 * Validate a password against the policy
 */
export async function validatePassword(
  password: string,
  userInfo?: UserInfo,
  previousPasswordHashes?: string[]
): Promise<ValidationResult> {
  const policy = await getPasswordPolicy();
  const errors: string[] = [];
  let score = 0;

  // Length checks
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  } else {
    score += 15;
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // Character type checks
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (policy.requireUppercase) {
    score += 15;
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (policy.requireLowercase) {
    score += 15;
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (policy.requireNumbers) {
    score += 15;
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (policy.requireSpecialChars) {
    score += 15;
  }

  // Common password check
  if (policy.preventCommonPasswords && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password.');
    score -= 20;
  }

  // User info in password check
  if (policy.preventUserInfoInPassword && userInfo) {
    const lowercasePassword = password.toLowerCase();
    const infoToCheck = [
      userInfo.email?.split('@')[0],
      userInfo.firstName,
      userInfo.lastName,
      userInfo.username
    ].filter(Boolean).map(s => s!.toLowerCase());

    for (const info of infoToCheck) {
      if (info.length >= 3 && lowercasePassword.includes(info)) {
        errors.push('Password cannot contain your personal information');
        score -= 10;
        break;
      }
    }
  }

  // Sequential/repeated character check
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
  }

  // Length bonus
  if (password.length >= 12) score += 15;
  else if (password.length >= 10) score += 10;

  // Variety bonus
  const charTypes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ].filter(Boolean).length;
  
  if (charTypes >= 4) score += 10;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine strength level
  let strength: ValidationResult['strength'];
  if (score < 20) strength = 'very-weak';
  else if (score < 40) strength = 'weak';
  else if (score < 60) strength = 'fair';
  else if (score < 80) strength = 'good';
  else strength = 'strong';

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score
  };
}

/**
 * Check if password needs to be changed (expired)
 */
export async function isPasswordExpired(
  lastPasswordChangeDate: Date
): Promise<boolean> {
  const policy = await getPasswordPolicy();
  
  if (policy.maxAge === 0) return false;
  
  const expirationDate = new Date(lastPasswordChangeDate);
  expirationDate.setDate(expirationDate.getDate() + policy.maxAge);
  
  return new Date() > expirationDate;
}

/**
 * Check if password can be changed (min age)
 */
export async function canChangePassword(
  lastPasswordChangeDate: Date
): Promise<{ allowed: boolean; daysRemaining?: number }> {
  const policy = await getPasswordPolicy();
  
  if (policy.minAge === 0) return { allowed: true };
  
  const minChangeDate = new Date(lastPasswordChangeDate);
  minChangeDate.setDate(minChangeDate.getDate() + policy.minAge);
  
  if (new Date() >= minChangeDate) {
    return { allowed: true };
  }
  
  const daysRemaining = Math.ceil(
    (minChangeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  return { allowed: false, daysRemaining };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + special;

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default {
  getPasswordPolicy,
  updatePasswordPolicy,
  validatePassword,
  isPasswordExpired,
  canChangePassword,
  generateSecurePassword
};
