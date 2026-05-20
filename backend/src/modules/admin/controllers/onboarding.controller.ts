import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { logActivity } from '../../../utils/activityLogger.js';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

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
  
  const updatedState = {
    ...oldState,
    ...newState,
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
      from: fromEmail || 'noreply@v2resort.com',
      to: toEmail,
      subject: 'V2 Ecosystem Onboarding - Email Verification',
      text: 'Congratulations! Your transactional email configuration is correct.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0; max-width: 600px; margin: auto;">
          <h2 style="color: #6366f1;">Email System Working!</h2>
          <p>This is a test email sent from the V2 Resort Ecosystem onboarding setup wizard.</p>
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

  // Extract data from completed steps
  const steps = state.steps || {};
  const brandData = steps['brand_identity']?.data || {};
  const themeData = steps['visual_design']?.data || {};
  const hoursData = steps['hours']?.data || {};
  const modulesData = steps['modules']?.data || { modules: [] };
  const gatewayData = steps['payment_gateway']?.data || {};
  const smtpData = steps['transactional_emails']?.data || {};
  const staffData = steps['staff_invitations']?.data || { invitations: [] };

  const propertyName = brandData.resortName || 'My Resort';
  const propertySlug = brandData.slug || 'my-resort';

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

  // 3. Create the property
  const { data: newProperty, error: propErr } = await supabase
    .from('properties')
    .insert({
      name: propertyName,
      slug: propertySlug,
      address: brandData.address || '',
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

  const settingsToInsert = [
    { property_id: propertyId, setting_key: 'branding', setting_value: brandingSettings, category: 'appearance' },
    { property_id: propertyId, setting_key: 'operational_hours', setting_value: hoursData, category: 'general' },
    { property_id: propertyId, setting_key: 'payment_gateway', setting_value: gatewayData, category: 'finance' },
    { property_id: propertyId, setting_key: 'smtp_config', setting_value: smtpData, category: 'system' },
  ];

  const { error: settingsErr } = await supabase
    .from('property_settings')
    .insert(settingsToInsert);

  if (settingsErr) throw settingsErr;

  // 6. Provision Modules
  const selectedModules: string[] = modulesData.modules || [];
  const modulesToInsert = selectedModules.map((modSlug) => {
    let engineType = 'instant_transaction';
    if (modSlug === 'hotel' || modSlug === 'chalet') engineType = 'time_exclusive_reservation';
    else if (modSlug === 'pool' || modSlug === 'beach') engineType = 'shared_capacity_access';
    else if (modSlug === 'membership') engineType = 'ongoing_entitlement';

    return {
      property_id: propertyId,
      name: modSlug.charAt(0).toUpperCase() + modSlug.slice(1),
      slug: modSlug,
      type: engineType,
      is_active: true,
    };
  });

  if (modulesToInsert.length > 0) {
    const { error: modErr } = await supabase
      .from('modules')
      .insert(modulesToInsert);
    if (modErr) throw modErr;
  }

  // 7. Invite Staff Members
  const staffInvitations = staffData.invitations || [];
  for (const staff of staffInvitations) {
    // Create users if they do not exist, or send invite link
    // For local onboarding simplicity, we create user profiles directly
    if (staff.email) {
      const { data: newUser, error: uErr } = await supabase
        .from('users')
        .insert({
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
          .insert({
            user_id: newUser.id,
            property_id: propertyId,
            access_level: staff.role === 'admin' ? 'admin' : 'write',
          });
      }
    }
  }

  // 8. Generate Printable Operations Manual
  const manualHtml = generateOperationsManual({
    resortName: propertyName,
    address: brandData.address || 'N/A',
    phone: brandData.phone || 'N/A',
    email: brandData.email || 'N/A',
    modules: selectedModules,
    themeColor: brandingSettings.themeColor,
    stripeEnabled: !!gatewayData.secretKey,
    smtpEnabled: !!smtpData.apiKey || !!smtpData.host,
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
 * Helper to generate a beautiful printable operations manual HTML
 */
function generateOperationsManual(details: any): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${details.resortName} - Operations Manual</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
        .header { text-align: center; border-bottom: 2px solid ${details.themeColor}; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: ${details.themeColor}; font-size: 32px; font-weight: bold; margin: 0; }
        .subtitle { color: #666; font-size: 18px; margin-top: 5px; }
        .section { margin-bottom: 30px; background: #fafafa; padding: 20px; border-radius: 8px; border-left: 4px solid ${details.themeColor}; }
        .section-title { font-size: 20px; font-weight: bold; color: ${details.themeColor}; margin-top: 0; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
        th { background: #eee; }
        .badge { display: inline-block; padding: 4px 8px; font-size: 12px; border-radius: 4px; color: white; background: #10b981; }
        .badge.inactive { background: #ef4444; }
        .print-btn { display: block; width: 200px; padding: 12px; background: ${details.themeColor}; color: white; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 40px auto; }
        @media print { .print-btn { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${details.resortName}</h1>
        <div class="subtitle">Official Resort Operations & Setup Manual</div>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
      </div>

      <div class="section">
        <h2 class="section-title">1. Directory & Contact Information</h2>
        <table>
          <tr><th>Attribute</th><th>Detail</th></tr>
          <tr><td>Resort Name</td><td>${details.resortName}</td></tr>
          <tr><td>Contact Email</td><td>${details.email}</td></tr>
          <tr><td>Contact Phone</td><td>${details.phone}</td></tr>
          <tr><td>Address</td><td>${details.address}</td></tr>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">2. Active Modules & Channels</h2>
        <ul>
          ${details.modules.map((m: string) => `
            <li>
              <strong>${m.toUpperCase()} Module</strong> - Active and configured.
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
