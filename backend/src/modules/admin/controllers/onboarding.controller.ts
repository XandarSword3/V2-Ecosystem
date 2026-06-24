import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { logActivity } from '../../../utils/activityLogger.js';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { secretsManager } from '../../../config/secrets.config.js';
import { TEMPLATE_TO_ENGINE } from '../../../engines/types.js';

/**
 * Onboarding Controller
 * Handles setup progress tracking, credential verification, and property provisioning
 */

interface StepData {
  status: 'pending' | 'completed' | 'skipped';
  completed_at: string | null;
  skipped_at: string | null;
  data?: Record<string, any>;
}

interface OnboardingState {
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  current_step: string;
  steps: Record<string, StepData>;
}

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  started_at: null,
  completed_at: null,
  current_step: 'welcome',
  steps: {},
};

/**
 * GET /api/v1/admin/onboarding
 * Get the current site onboarding state
 */
export const getOnboardingState = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'onboarding_state')
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const state = (data?.value as unknown as OnboardingState) || DEFAULT_STATE;
  res.json({ success: true, data: state });
});

/**
 * PUT /api/v1/admin/onboarding
 * Update the onboarding state
 */
export const updateOnboardingState = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const userId = req.user?.userId;
  const newState = req.body;

  if (!newState || typeof newState !== 'object') {
    res.status(400).json({ success: false, error: 'Invalid onboarding state payload' });
    return;
  }

  // Ensure started_at is populated if current_step changed from welcome
  const existing = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'onboarding_state')
    .maybeSingle();
  
  const oldState = (existing.data?.value as unknown as OnboardingState) || DEFAULT_STATE;
  
  // Deep-merge steps so a partial PUT (e.g. saving one step) never wipes
  // progress from other steps that were already saved.
  const mergedSteps = {
    ...(oldState.steps ?? {}),
    ...(newState.steps ?? {}),
  };

  const updatedState = {
    ...oldState,
    ...newState,
    steps:      mergedSteps,
    started_at: oldState.started_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'onboarding_state',
      value: updatedState,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  res.json({ success: true, data: updatedState });
});

/**
 * POST /api/v1/admin/onboarding/verify-stripe
 * Test Stripe API credentials
 */
export const verifyStripe = asyncHandler(async (req: Request, res: Response) => {
  const { secretKey } = req.body;

  if (!secretKey) {
    res.status(400).json({ success: false, error: 'Stripe secret key is required' });
    return;
  }

  try {
    const stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
    
    // Attempt simple retrieval of account details
    const account = await stripeClient.accounts.retrieve();
    
    res.json({
      success: true,
      message: 'Stripe connection successful',
      data: {
        accountId: account.id,
        businessName: account.business_profile?.name || account.email,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
      },
    });
  } catch (err: any) {
    logger.warn('Stripe connection verification failed', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || 'Stripe connection failed',
    });
  }
});

/**
 * POST /api/v1/admin/onboarding/test-email
 * Test transactional email credentials (SMTP/SendGrid)
 */
export const testEmail = asyncHandler(async (req: Request, res: Response) => {
  const { provider, host, port, secure, user, pass, apiKey, fromEmail, toEmail } = req.body;

  if (!toEmail) {
    res.status(400).json({ success: false, error: 'Recipient email (toEmail) is required' });
    return;
  }

  try {
    let transporter;

    if (provider === 'sendgrid') {
      if (!apiKey) {
        res.status(400).json({ success: false, error: 'SendGrid API key is required' });
        return;
      }
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: apiKey,
        },
      });
    } else {
      // Standard SMTP
      if (!host || !port) {
        res.status(400).json({ success: false, error: 'SMTP host and port are required' });
        return;
      }
      transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: secure === true || secure === 'true',
        auth: user && pass ? { user, pass } : undefined,
      });
    }

    // Verify transporter
    await transporter.verify();

    // Send verification email
    await transporter.sendMail({
      from: fromEmail || 'noreply@v2ecosystem.com',
      to: toEmail,
      subject: 'V2 Ecosystem Onboarding - Email Verification',
      text: 'Congratulations! Your transactional email configuration is correct.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; max-width: 600px; margin: auto;">
          <h2 style="color: #6366f1;">Email System Working!</h2>
          <p>This is a test email sent from the V2 Ecosystem Ecosystem onboarding setup wizard.</p>
          <p>Your mail server settings are fully valid and operational.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <small style="color: #999;">Sent at: ${new Date().toISOString()}</small>
        </div>
      `,
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err: any) {
    logger.warn('Email connection verification failed', { error: err.message });
    res.status(400).json({
      success: false,
      error: err.message || 'SMTP authentication failed',
    });
  }
});

/**
 * POST /api/v1/admin/onboarding/finalize
 * Finalize onboarding, provision properties, modules, settings, and generate Operations Guide
 */
export const finalizeOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  // 1. Fetch onboarding state draft
  const { data: stateData } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'onboarding_state')
    .single();

  const state = (stateData?.value as unknown as OnboardingState) || DEFAULT_STATE;

  if (state.completed) {
    res.status(400).json({ success: false, error: 'Onboarding is already completed' });
    return;
  }

  // Atomically mark onboarding_state completed to prevent race conditions (Bug #8)
  const { data: updateResult, error: updateErr } = await supabase
    .from('site_settings')
    .update({
      value: { ...state, completed: true }
    })
    .eq('key', 'onboarding_state')
    .eq('value->>completed', 'false')
    .select();

  if (updateErr || !updateResult || updateResult.length === 0) {
    res.status(400).json({ success: false, error: 'Onboarding is already completed or currently processing' });
    return;
  }

  // Extract data from completed steps
  const steps = state.steps || {};
  const brandData = steps['property_details']?.data || steps['resort_details']?.data || {};
  const themeData = steps['visual_design']?.data || {};
  const hoursData = {
    timezone: 'UTC',
    receptionHours: '24/7',
  };
  const modulesData = steps['modules']?.data || { modules: [] };
  const gatewayData = steps['payment_gateway']?.data || {};
  const smtpData = steps['transactional_emails']?.data || {};
  const staffData = steps['staff_invitations']?.data || { invitations: [] };
  const taxData   = steps['taxes']?.data || {};

  const propertyName = brandData.name || 'My Property';

  // Read credentials from request body with database state fallback (Bug #4)
  const stripeSecret = req.body.stripeSecretKey || gatewayData.secretKey;
  const smtpApiKey = req.body.smtpApiKey || smtpData.apiKey;
  const smtpPass = req.body.smtpPass || smtpData.pass;

  try {
    // 2. Start provisioning within a transaction context
    // First, create the default property group if not exists
    let groupId: string | null = null;
    const { data: existingGroup } = await supabase
      .from('property_groups')
      .select('id')
      .limit(1);

    if (existingGroup && existingGroup.length > 0) {
      groupId = existingGroup[0].id;
    } else {
      const { data: newGroup, error: groupErr } = await supabase
        .from('property_groups')
        .insert({
          name: 'Default Group',
          description: 'Primary property group',
        })
        .select()
        .single();

      if (groupErr) throw groupErr;
      groupId = newGroup.id;
    }

    // 3. Create the property (Bug #5: remove slug, map address to address_line1)
    const { data: newProperty, error: propErr } = await supabase
      .from('properties')
      .insert({
        name: propertyName,
        address_line1: brandData.address || '',
        phone: brandData.phone || '',
        email: brandData.email || '',
        group_id: groupId,
      })
      .select()
      .single();

    if (propErr) throw propErr;
    const propertyId = newProperty.id;

    // 4. Associate the creator with the property as admin
    const { error: accessErr } = await supabase
      .from('user_property_access')
      .insert({
        user_id: userId,
        property_id: propertyId,
        access_level: 'admin',
      });

    if (accessErr) throw accessErr;

    // 5. Seed Property Settings (Inheritance)
    const brandingSettings = {
      themeColor: themeData.themeColor || '#6366f1',
      accentColor: themeData.accentColor || '#4f46e5',
      logoUrl: themeData.logoUrl || null,
      faviconUrl: themeData.faviconUrl || null,
    };

    // Pass the secret keys directly to the secrets manager / environment variables (New Bug #1)
    if (stripeSecret) {
      await secretsManager.rotate('STRIPE_SECRET_KEY', stripeSecret);
      process.env.STRIPE_SECRET_KEY = stripeSecret;
    }
    if (smtpPass) {
      process.env.SMTP_PASS = smtpPass;
    }
    if (smtpApiKey) {
      await secretsManager.rotate('SENDGRID_API_KEY', smtpApiKey);
      process.env.SENDGRID_API_KEY = smtpApiKey;
    }

    const finalGatewaySettings = {
      publicKey: gatewayData.publicKey ? `${gatewayData.publicKey.substring(0, 8)}...` : '',
      configured: !!stripeSecret,
    };
    const finalSmtpSettings = {
      host: smtpData.host || '',
      port: smtpData.port || '',
      user: smtpData.user || '',
      fromEmail: smtpData.fromEmail || '',
      configured: !!(smtpPass || smtpApiKey || smtpData.host),
    };

    const taxSettings = {
      taxRate:       parseFloat(taxData.taxRate ?? '0') || 0,
      serviceCharge: parseFloat(taxData.serviceCharge ?? '0') || 0,
    };

    const settingsToInsert = [
      { property_id: propertyId, setting_key: 'branding',          setting_value: brandingSettings,    category: 'appearance' },
      { property_id: propertyId, setting_key: 'operational_hours', setting_value: hoursData,           category: 'general' },
      { property_id: propertyId, setting_key: 'payment_gateway',   setting_value: finalGatewaySettings, category: 'finance' },
      { property_id: propertyId, setting_key: 'smtp_config',       setting_value: finalSmtpSettings,   category: 'system' },
      { property_id: propertyId, setting_key: 'tax_config',        setting_value: taxSettings,         category: 'finance' },
    ];

    const { error: settingsErr } = await supabase
      .from('property_settings')
      .insert(settingsToInsert);

    if (settingsErr) throw settingsErr;

    // 6. Provision Modules
    const selectedModules: string[] = modulesData.modules || [];
    const modulesToInsert = selectedModules.map((modSlug) => ({
      property_id: propertyId,
      name: modSlug.charAt(0).toUpperCase() + modSlug.slice(1).replace(/_/g, ' '),
      slug: modSlug,
      template_type: modSlug,
      type: TEMPLATE_TO_ENGINE[modSlug as keyof typeof TEMPLATE_TO_ENGINE] || 'instant_transaction',
      is_active: true,
    }));

    if (modulesToInsert.length > 0) {
      const { error: modErr } = await supabase
        .from('modules')
        .insert(modulesToInsert);
      if (modErr) throw modErr;
    }

    // 7. Invite Staff Members
    const staffInvitations = staffData.invitations || [];
    for (const staff of staffInvitations) {
      if (staff.email) {
        let userAuthId: string | null = null;
        
        // Invite user via Supabase Auth admin client
        const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
          staff.email,
          {
            data: {
              full_name: staff.name || staff.email.split('@')[0],
            }
          }
        );

        if (inviteErr) {
          logger.warn('Failed to invite staff user via auth, checking if profile exists', {
            email: staff.email,
            error: inviteErr.message,
          });
          // If user already exists in Auth, retrieve their ID from the public users table
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', staff.email)
            .maybeSingle();
          
          if (existingUser) {
            userAuthId = existingUser.id;
          }
        } else if (inviteData?.user) {
          userAuthId = inviteData.user.id;
        }

        if (userAuthId) {
          // Upsert user profile in public users table using the auth user's ID
          const { data: newUser, error: uErr } = await supabase
            .from('users')
            .upsert({
              id: userAuthId,
              email: staff.email,
              full_name: staff.name || staff.email.split('@')[0],
              role: staff.role || 'staff',
              is_active: true,
            })
            .select()
            .single();
          
          if (!uErr && newUser) {
            // Grant property access
            await supabase
              .from('user_property_access')
              .upsert({
                user_id: userAuthId,
                property_id: propertyId,
                access_level: staff.role === 'admin' ? 'admin' : 'write',
              });
          }
        }
      }
    }

    // 8. Generate Printable Operations Manual (Bug #9: XSS Escape user inputs)
    const manualHtml = generateOperationsManual({
      siteName: propertyName,
      address: brandData.address || 'N/A',
      phone: brandData.phone || 'N/A',
      email: brandData.email || 'N/A',
      modules: selectedModules,
      themeColor: brandingSettings.themeColor,
      stripeEnabled: !!stripeSecret,
      smtpEnabled: !!smtpApiKey || !!smtpData.host,
    });

    // Save Operations Manual to site_settings under 'operations_manual' for download
    await supabase
      .from('site_settings')
      .upsert({
        key: `operations_manual_${propertyId}`,
        value: { html: manualHtml, generated_at: new Date().toISOString() },
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

    // 9. Complete Onboarding
    const finalState: OnboardingState = {
      ...state,
      completed: true,
      completed_at: new Date().toISOString(),
      current_step: 'completed',
    };

    await supabase
      .from('site_settings')
      .upsert({
        key: 'onboarding_state',
        value: finalState,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

    // Log final activity
    await logActivity({
      user_id: userId,
      action: 'COMPLETE_ONBOARDING',
      resource: 'site_settings',
      resource_id: 'onboarding_state',
      property_id: propertyId,
    });

    res.json({
      success: true,
      message: 'Onboarding setup finalized successfully!',
      data: {
        propertyId,
        propertyName,
        manualUrl: `/api/v1/admin/onboarding/manual?property_id=${propertyId}`,
      },
    });
  } catch (err: any) {
    logger.error('Onboarding finalization failed, reverting completed status', { error: err.message });
    // Revert completed status to allow retries
    await supabase
      .from('site_settings')
      .update({
        value: { ...state, completed: false }
      })
      .eq('key', 'onboarding_state');

    res.status(500).json({
      success: false,
      error: err.message || 'Onboarding finalization failed',
    });
  }
});

/**
 * GET /api/v1/admin/onboarding/manual
 * Download/stream the generated Operations Manual
 */
export const getOperationsManual = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { property_id } = req.query;

  if (!property_id) {
    res.status(400).json({ success: false, error: 'property_id is required' });
    return;
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', `operations_manual_${property_id}`)
    .maybeSingle();

  if (error || !data) {
    res.status(404).send('Operations Manual not found. Please complete onboarding first.');
    return;
  }

  const manual = data.value as { html: string };
  res.setHeader('Content-Type', 'text/html');
  res.send(manual.html);
});

/**
 * HTML Escaper and Color Sanitizer helpers to prevent XSS and CSS injection (Bug #9)
 */
const esc = (s: any): string => {
  if (s == null) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const sanitizeColor = (color: any): string => {
  if (typeof color !== 'string') return '#6366f1';
  // Limit color inputs to valid CSS colors and hex values, preventing CSS injection escape
  const safeColor = color.replace(/[^a-zA-Z0-9#(),.%-]/g, '');
  return safeColor || '#6366f1';
};

/**
 * Helper to generate a beautiful printable operations manual HTML
 */
function generateOperationsManual(details: any): string {
  const siteName = esc(details.siteName);
  const email = esc(details.email);
  const phone = esc(details.phone);
  const address = esc(details.address);
  const themeColor = sanitizeColor(details.themeColor);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${siteName} - Operations Manual</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid ${themeColor}; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: ${themeColor}; font-size: 32px; font-weight: bold; margin: 0; }
        .subtitle { color: #666; font-size: 18px; margin-top: 5px; }
        .section { margin-bottom: 30px; background: #fafafa; padding: 20px; border-radius: 8px; border-left: 4px solid ${themeColor}; }
        .section-title { font-size: 20px; font-weight: bold; color: ${themeColor}; margin-top: 0; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
        th { background: #eee; }
        .badge { display: inline-block; padding: 4px 8px; font-size: 12px; border-radius: 4px; color: white; background: #10b981; }
        .badge.inactive { background: #ef4444; }
        .print-btn { display: block; width: 200px; padding: 12px; background: ${themeColor}; color: white; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 40px auto; }
        @media print { .print-btn { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${siteName}</h1>
        <div class="subtitle">Official Operations &amp; Setup Manual</div>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="section">
        <h2 class="section-title">1. Directory & Contact Information</h2>
        <table>
          <tr><th>Attribute</th><th>Detail</th></tr>
          <tr><td>Property Name</td><td>${siteName}</td></tr>
          <tr><td>Contact Email</td><td>${email}</td></tr>
          <tr><td>Contact Phone</td><td>${phone}</td></tr>
          <tr><td>Address</td><td>${address}</td></tr>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">2. Active Modules & Channels</h2>
        <ul>
          ${details.modules.map((m: string) => `
            <li>
              <strong>${esc(m.toUpperCase())} Module</strong> - Active and configured.
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="section">
        <h2 class="section-title">3. Gateway & Commerce Details</h2>
        <table>
          <tr><th>System</th><th>Status</th></tr>
          <tr><td>Stripe Payments</td><td><span class="badge ${details.stripeEnabled ? '' : 'inactive'}">${details.stripeEnabled ? 'Configured' : 'Disabled'}</span></td></tr>
          <tr><td>System SMTP E-mailing</td><td><span class="badge ${details.smtpEnabled ? '' : 'inactive'}">${details.smtpEnabled ? 'Configured' : 'Disabled'}</span></td></tr>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">4. Guest Portal Direct Access</h2>
        <p>Your guest portal is ready for launch! Print and place QR codes pointing to the room service and kiosk portals across the property to begin accepting guest orders.</p>
      </div>

      <a href="#" onclick="window.print()" class="print-btn">Print Operations Manual</a>
    </body>
    </html>
  `;
}
