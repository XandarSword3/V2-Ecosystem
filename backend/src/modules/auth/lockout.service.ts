/**
 * Account Lockout Service
 * 
 * Provides protection against brute force attacks by implementing
 * progressive delays and account lockouts after failed login attempts.
 */

import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';
import { emailService } from '../../services/email.service';

interface LockoutInfo {
  failedAttempts: number;
  lastAttempt: number;
  lockedUntil: number | null;
  notificationSent: boolean;
}

// Configuration
const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  attemptWindowMs: 15 * 60 * 1000, // 15 minutes
  progressiveDelays: [0, 2000, 5000, 15000, 30000], // ms delays after each attempt
  captchaThreshold: 3, // Require CAPTCHA after this many attempts
};

const LOCKOUT_KEY_PREFIX = 'lockout:';

/**
 * Get lockout info for an identifier (email or IP)
 */
async function getLockoutInfo(identifier: string): Promise<LockoutInfo | null> {
  try {
    const key = `${LOCKOUT_KEY_PREFIX}${identifier}`;
    return await cache.get<LockoutInfo>(key);
  } catch (error) {
    logger.warn('Failed to get lockout info from cache, allowing attempt', { identifier });
    return null;
  }
}

/**
 * Set lockout info for an identifier
 */
async function setLockoutInfo(identifier: string, info: LockoutInfo): Promise<void> {
  try {
    const key = `${LOCKOUT_KEY_PREFIX}${identifier}`;
    // Store for the lockout window duration plus some buffer
    const ttl = Math.ceil((LOCKOUT_CONFIG.lockoutDurationMs + LOCKOUT_CONFIG.attemptWindowMs) / 1000);
    await cache.set(key, info, ttl);
  } catch (error) {
    logger.warn('Failed to set lockout info in cache', { identifier });
  }
}

/**
 * Clear lockout info for an identifier (on successful login)
 */
async function clearLockoutInfo(identifier: string): Promise<void> {
  try {
    const key = `${LOCKOUT_KEY_PREFIX}${identifier}`;
    await cache.del(key);
  } catch (error) {
    logger.warn('Failed to clear lockout info from cache', { identifier });
  }
}

/**
 * Check if an account is currently locked
 */
export async function isAccountLocked(identifier: string): Promise<{
  locked: boolean;
  remainingMs?: number;
  message?: string;
}> {
  const info = await getLockoutInfo(identifier);
  
  if (!info) {
    return { locked: false };
  }
  
  // Check if locked and lock hasn't expired
  if (info.lockedUntil && Date.now() < info.lockedUntil) {
    const remainingMs = info.lockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    
    return {
      locked: true,
      remainingMs,
      message: `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
    };
  }
  
  return { locked: false };
}

/**
 * Check if CAPTCHA is required for this identifier
 */
export async function isCaptchaRequired(identifier: string): Promise<boolean> {
  const info = await getLockoutInfo(identifier);
  
  if (!info) {
    return false;
  }
  
  // Check if attempts are within the window
  const withinWindow = Date.now() - info.lastAttempt < LOCKOUT_CONFIG.attemptWindowMs;
  
  return withinWindow && info.failedAttempts >= LOCKOUT_CONFIG.captchaThreshold;
}

/**
 * Get the progressive delay for the current attempt count
 */
export async function getProgressiveDelay(identifier: string): Promise<number> {
  const info = await getLockoutInfo(identifier);
  
  if (!info) {
    return 0;
  }
  
  // Check if attempts are within the window
  const withinWindow = Date.now() - info.lastAttempt < LOCKOUT_CONFIG.attemptWindowMs;
  
  if (!withinWindow) {
    return 0;
  }
  
  const delayIndex = Math.min(info.failedAttempts, LOCKOUT_CONFIG.progressiveDelays.length - 1);
  return LOCKOUT_CONFIG.progressiveDelays[delayIndex];
}

/**
 * Record a failed login attempt
 */
export async function recordFailedAttempt(
  identifier: string,
  email?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  locked: boolean;
  remainingAttempts: number;
  requiresCaptcha: boolean;
  delayMs: number;
}> {
  let info = await getLockoutInfo(identifier);
  const now = Date.now();
  
  if (!info) {
    info = {
      failedAttempts: 0,
      lastAttempt: now,
      lockedUntil: null,
      notificationSent: false
    };
  }
  
  // Reset if outside the window
  if (now - info.lastAttempt > LOCKOUT_CONFIG.attemptWindowMs) {
    info.failedAttempts = 0;
    info.notificationSent = false;
  }
  
  // Increment failed attempts
  info.failedAttempts++;
  info.lastAttempt = now;
  
  // Check if we should lock the account
  if (info.failedAttempts >= LOCKOUT_CONFIG.maxAttempts) {
    info.lockedUntil = now + LOCKOUT_CONFIG.lockoutDurationMs;
    
    // Send notification email (only once per lockout)
    if (!info.notificationSent && email) {
      try {
        await sendLockoutNotification(email, ipAddress, userAgent);
        info.notificationSent = true;
      } catch (error) {
        logger.error('Failed to send lockout notification email', { email, error });
      }
    }
    
    logger.warn('Account locked due to too many failed attempts', {
      identifier,
      attempts: info.failedAttempts,
      lockedUntil: new Date(info.lockedUntil).toISOString()
    });
  }
  
  await setLockoutInfo(identifier, info);
  
  const delayIndex = Math.min(info.failedAttempts - 1, LOCKOUT_CONFIG.progressiveDelays.length - 1);
  
  return {
    locked: info.lockedUntil !== null && now < info.lockedUntil,
    remainingAttempts: Math.max(0, LOCKOUT_CONFIG.maxAttempts - info.failedAttempts),
    requiresCaptcha: info.failedAttempts >= LOCKOUT_CONFIG.captchaThreshold,
    delayMs: LOCKOUT_CONFIG.progressiveDelays[delayIndex]
  };
}

/**
 * Record a successful login (clears lockout info)
 */
export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  await clearLockoutInfo(identifier);
  logger.debug('Cleared lockout info after successful login', { identifier });
}

/**
 * Manually unlock an account (admin action)
 */
export async function unlockAccount(
  identifier: string,
  adminUserId: string
): Promise<{ success: boolean; message: string }> {
  const info = await getLockoutInfo(identifier);
  
  if (!info || !info.lockedUntil || Date.now() >= info.lockedUntil) {
    return { success: false, message: 'Account is not currently locked' };
  }
  
  await clearLockoutInfo(identifier);
  
  logger.info('Account manually unlocked by admin', {
    identifier,
    adminUserId,
    previousLockUntil: new Date(info.lockedUntil).toISOString()
  });
  
  return { success: true, message: 'Account has been unlocked successfully' };
}

/**
 * Get lockout status for admin view
 */
export async function getLockoutStatus(identifier: string): Promise<{
  failedAttempts: number;
  isLocked: boolean;
  lockedUntil: string | null;
  lastAttempt: string | null;
}> {
  const info = await getLockoutInfo(identifier);
  
  if (!info) {
    return {
      failedAttempts: 0,
      isLocked: false,
      lockedUntil: null,
      lastAttempt: null
    };
  }
  
  const now = Date.now();
  const isLocked = info.lockedUntil !== null && now < info.lockedUntil;
  
  return {
    failedAttempts: info.failedAttempts,
    isLocked,
    lockedUntil: isLocked && info.lockedUntil ? new Date(info.lockedUntil).toISOString() : null,
    lastAttempt: new Date(info.lastAttempt).toISOString()
  };
}

/**
 * Send lockout notification email
 */
async function sendLockoutNotification(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const html = `
    <h2>Account Security Alert</h2>
    <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
    
    <h3>Details:</h3>
    <ul>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      ${ipAddress ? `<li><strong>IP Address:</strong> ${ipAddress}</li>` : ''}
      ${userAgent ? `<li><strong>Device:</strong> ${userAgent}</li>` : ''}
      <li><strong>Lock Duration:</strong> 15 minutes</li>
    </ul>
    
    <p>If this was you, please wait 15 minutes before trying again.</p>
    <p>If this wasn't you, we recommend changing your password immediately after regaining access.</p>
    
    <p style="color: #666; font-size: 12px;">
      This is an automated security notification. If you did not attempt to log in,
      someone may be trying to access your account.
    </p>
  `;
  
  await emailService.sendEmail({
    to: email,
    subject: 'Security Alert: Account Temporarily Locked',
    html
  });
}

/**
 * Apply progressive delay before allowing login attempt
 */
export async function applyProgressiveDelay(identifier: string): Promise<void> {
  const delayMs = await getProgressiveDelay(identifier);
  
  if (delayMs > 0) {
    logger.debug('Applying progressive delay', { identifier, delayMs });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

export default {
  isAccountLocked,
  isCaptchaRequired,
  getProgressiveDelay,
  recordFailedAttempt,
  recordSuccessfulLogin,
  unlockAccount,
  getLockoutStatus,
  applyProgressiveDelay
};
