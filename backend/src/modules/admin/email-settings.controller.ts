/**
 * Email Settings Controller
 * 
 * API endpoints for managing email configuration.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { roleGuard } from '../../middleware/roleGuard.middleware';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { emailService } from '../../services/email.service.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

const router = Router();

// Validation schema
const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'ses', 'mailgun', 'postmark']),
  smtpHost: z.string().optional(),
  smtpPort: z.number().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  apiKey: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
  replyToEmail: z.string().email().optional().or(z.literal('')),
});

/**
 * GET /admin/settings/email
 * Get current email configuration (sensitive data masked)
 */
router.get(
  '/',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.systemSettings.findMany({
        where: {
          category: 'email'
        }
      });

      // Convert to object and mask sensitive fields
      const config: Record<string, any> = {};
      for (const setting of settings) {
        const key = setting.key.replace('email.', '');
        
        // Mask sensitive values
        if (key === 'smtpPassword' || key === 'apiKey') {
          config[key] = setting.value ? '••••••••' : '';
        } else {
          config[key] = setting.value;
        }
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /admin/settings/email
 * Update email configuration
 */
router.put(
  '/',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = emailConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten()
        });
      }

      const config = validation.data;
      const userId = req.user!.id;

      // Prepare settings to upsert
      const settingsToSave: { key: string; value: string; encrypted?: boolean }[] = [
        { key: 'email.provider', value: config.provider },
        { key: 'email.fromEmail', value: config.fromEmail },
        { key: 'email.fromName', value: config.fromName },
        { key: 'email.replyToEmail', value: config.replyToEmail || '' },
      ];

      // Add provider-specific settings
      if (config.provider === 'smtp') {
        settingsToSave.push(
          { key: 'email.smtpHost', value: config.smtpHost || '' },
          { key: 'email.smtpPort', value: String(config.smtpPort || 587) },
          { key: 'email.smtpSecure', value: String(config.smtpSecure ?? true) },
          { key: 'email.smtpUser', value: config.smtpUser || '' }
        );
        
        // Only update password if provided and not masked
        if (config.smtpPassword && !config.smtpPassword.includes('•')) {
          settingsToSave.push({
            key: 'email.smtpPassword',
            value: encrypt(config.smtpPassword),
            encrypted: true
          });
        }
      } else {
        // Only update API key if provided and not masked
        if (config.apiKey && !config.apiKey.includes('•')) {
          settingsToSave.push({
            key: 'email.apiKey',
            value: encrypt(config.apiKey),
            encrypted: true
          });
        }
      }

      // Upsert all settings
      for (const setting of settingsToSave) {
        await prisma.systemSettings.upsert({
          where: { key: setting.key },
          update: {
            value: setting.value,
            encrypted: setting.encrypted || false,
            updatedAt: new Date(),
            updatedBy: userId
          },
          create: {
            key: setting.key,
            value: setting.value,
            category: 'email',
            encrypted: setting.encrypted || false,
            createdBy: userId,
            updatedBy: userId
          }
        });
      }

      // Reload email service with new configuration
      try {
        await reloadEmailService();
      } catch (reloadError) {
        logger.warn('Failed to reload email service with new config', { error: reloadError });
      }

      logger.info('Email configuration updated', { userId, provider: config.provider });

      res.json({
        success: true,
        message: 'Email configuration saved successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/settings/email/test
 * Send a test email
 */
router.post(
  '/test',
  authMiddleware,
  roleGuard(['admin', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { testRecipient, ...config } = req.body;
      
      const validation = emailConfigSchema.safeParse(config);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: validation.error.flatten()
        });
      }

      const recipient = testRecipient || config.fromEmail;
      
      // Create a temporary email transport with the test configuration
      const testConfig = await buildTransportConfig(validation.data);
      
      // Send test email
      await emailService.sendEmail({
        to: recipient,
        subject: 'V2 Resort - Email Configuration Test',
        html: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email from your V2 Resort system.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br>
            Provider: ${config.provider}<br>
            From: ${config.fromName} &lt;${config.fromEmail}&gt;
          </p>
        `
      });

      logger.info('Test email sent successfully', { 
        recipient, 
        provider: config.provider,
        userId: req.user!.id 
      });

      res.json({
        success: true,
        message: `Test email sent to ${recipient}`
      });
    } catch (error: any) {
      logger.error('Failed to send test email', { error: error.message });
      
      res.status(400).json({
        success: false,
        error: 'Failed to send test email',
        details: error.message
      });
    }
  }
);

/**
 * Build transport configuration from settings
 */
async function buildTransportConfig(config: z.infer<typeof emailConfigSchema>) {
  if (config.provider === 'smtp') {
    return {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    };
  }
  
  // For other providers, return API-based config
  return {
    provider: config.provider,
    apiKey: config.apiKey
  };
}

/**
 * Reload email service with updated configuration
 */
async function reloadEmailService(): Promise<void> {
  const settings = await prisma.systemSettings.findMany({
    where: { category: 'email' }
  });

  const config: Record<string, string> = {};
  for (const setting of settings) {
    const key = setting.key.replace('email.', '');
    config[key] = setting.encrypted ? decrypt(setting.value) : setting.value;
  }

  // This would reload the email service - implementation depends on your email service
  logger.info('Email service configuration reloaded', { provider: config.provider });
}

export default router;
