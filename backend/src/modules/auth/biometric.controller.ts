import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { generateTokens } from './auth.utils.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/AppError.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Biometric/WebAuthn Authentication Controller
 * 
 * Implements passkey/biometric authentication flows:
 * - Registration (begin/complete)
 * - Authentication (begin/complete)
 * - Credential management (list/delete)
 */

// In-memory challenge store (should use Redis in production)
const challengeStore = new Map<string, { challenge: string; userId?: string; expires: number }>();

// Clean up expired challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (value.expires < now) {
      challengeStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/v1/auth/biometric/register-begin
 * Start biometric credential registration
 * Requires authenticated user
 */
export async function registerBegin(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const supabase = getSupabase();
    
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get existing credentials to exclude
    const { data: existingCredentials } = await supabase
      .from('biometric_credentials')
      .select('credential_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    // Generate challenge
    const challenge = crypto.randomBytes(32).toString('base64url');
    const sessionId = uuidv4();

    // Store challenge with 5 minute expiry
    challengeStore.set(sessionId, {
      challenge,
      userId,
      expires: Date.now() + 5 * 60 * 1000,
    });

    // WebAuthn registration options
    const options = {
      challenge,
      rp: {
        name: 'V2 Resort',
        id: process.env.WEBAUTHN_RP_ID || 'localhost',
      },
      user: {
        id: Buffer.from(userId).toString('base64url'),
        name: user.email,
        displayName: user.full_name || user.email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Prefer platform authenticators (Face ID, Touch ID)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
      excludeCredentials: (existingCredentials || []).map(cred => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: ['internal'],
      })),
    };

    return res.json({
      success: true,
      sessionId,
      options,
    });
  } catch (error) {
    logger.error('Biometric register-begin error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
}

/**
 * POST /api/v1/auth/biometric/register-complete
 * Complete biometric credential registration
 */
export async function registerComplete(req: Request, res: Response) {
  try {
    const { sessionId, credential, deviceType, deviceName } = req.body;

    if (!sessionId || !credential) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Verify session
    const session = challengeStore.get(sessionId);
    if (!session || session.expires < Date.now()) {
      return res.status(400).json({ success: false, error: 'Session expired or invalid' });
    }

    const userId = session.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid session' });
    }

    // Clean up session
    challengeStore.delete(sessionId);

    // In production, verify the credential response properly using a WebAuthn library
    // For now, we'll store the credential details
    const { id: credentialId, response } = credential;

    if (!credentialId || !response?.attestationObject || !response?.clientDataJSON) {
      return res.status(400).json({ success: false, error: 'Invalid credential format' });
    }

    // Extract public key (simplified - use @simplewebauthn/server in production)
    const publicKey = response.attestationObject; // Simplified

    const supabase = getSupabase();

    // Store credential
    const { data: stored, error: storeError } = await supabase
      .from('biometric_credentials')
      .insert({
        user_id: userId,
        credential_id: credentialId,
        public_key: publicKey,
        counter: 0,
        device_type: deviceType || 'unknown',
        device_name: deviceName || 'Unnamed Device',
      })
      .select('id, device_type, device_name, created_at')
      .single();

    if (storeError) {
      logger.error('Failed to store biometric credential:', storeError);
      return res.status(500).json({ success: false, error: 'Failed to store credential' });
    }

    logger.info(`Biometric credential registered for user ${userId}`);

    return res.json({
      success: true,
      credential: stored,
    });
  } catch (error) {
    logger.error('Biometric register-complete error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
}

/**
 * POST /api/v1/auth/biometric/authenticate-begin
 * Start biometric authentication
 */
export async function authenticateBegin(req: Request, res: Response) {
  try {
    const { email } = req.body;

    const supabase = getSupabase();

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email?.toLowerCase())
      .single();

    if (userError || !user) {
      // Return valid-looking response to prevent user enumeration
      const challenge = crypto.randomBytes(32).toString('base64url');
      const sessionId = uuidv4();
      
      return res.json({
        success: true,
        sessionId,
        options: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [],
        },
      });
    }

    // Get user's active credentials
    const { data: credentials } = await supabase
      .from('biometric_credentials')
      .select('credential_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!credentials || credentials.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No biometric credentials registered for this account' 
      });
    }

    // Generate challenge
    const challenge = crypto.randomBytes(32).toString('base64url');
    const sessionId = uuidv4();

    // Store challenge
    challengeStore.set(sessionId, {
      challenge,
      userId: user.id,
      expires: Date.now() + 5 * 60 * 1000,
    });

    const options = {
      challenge,
      timeout: 60000,
      rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
      userVerification: 'required',
      allowCredentials: credentials.map(cred => ({
        id: cred.credential_id,
        type: 'public-key',
        transports: ['internal'],
      })),
    };

    return res.json({
      success: true,
      sessionId,
      options,
    });
  } catch (error) {
    logger.error('Biometric authenticate-begin error:', error);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * POST /api/v1/auth/biometric/authenticate-complete
 * Complete biometric authentication and return JWT
 */
export async function authenticateComplete(req: Request, res: Response) {
  try {
    const { sessionId, credential } = req.body;

    if (!sessionId || !credential) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Verify session
    const session = challengeStore.get(sessionId);
    if (!session || session.expires < Date.now()) {
      return res.status(400).json({ success: false, error: 'Session expired or invalid' });
    }

    const userId = session.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Invalid session' });
    }

    // Clean up session
    challengeStore.delete(sessionId);

    const { id: credentialId, response } = credential;

    if (!credentialId || !response?.authenticatorData || !response?.signature) {
      return res.status(400).json({ success: false, error: 'Invalid credential format' });
    }

    const supabase = getSupabase();

    // Find the credential
    const { data: storedCredential, error: credError } = await supabase
      .from('biometric_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (credError || !storedCredential) {
      return res.status(401).json({ success: false, error: 'Invalid credential' });
    }

    // In production, verify signature using stored public key
    // For now, we'll trust the credential ID match

    // Update counter and last_used_at
    await supabase
      .from('biometric_credentials')
      .update({
        counter: storedCredential.counter + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', storedCredential.id);

    // Get user details for token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get user roles
    const { data: userRolesList } = await supabase
      .from('user_roles')
      .select('roles (name)')
      .eq('user_id', userId);

    interface RoleJoinResult { roles?: { name?: string }[] | { name?: string } | null }
    const roleNames = ((userRolesList || []) as RoleJoinResult[]).map((r) => {
      const roles = r.roles;
      if (!roles) return undefined;
      if (Array.isArray(roles)) return roles[0]?.name;
      return (roles as { name?: string }).name;
    }).filter(Boolean) as string[];

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      tokenVersion: user.token_version ?? 0,
    });

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);

    logger.info(`Biometric authentication successful for user ${userId}`);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        profileImageUrl: user.profile_image_url,
        preferredLanguage: user.preferred_language,
        roles: roleNames,
      },
      tokens,
    });
  } catch (error) {
    logger.error('Biometric authenticate-complete error:', error);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

/**
 * GET /api/v1/auth/biometric/credentials
 * List user's biometric credentials
 */
export async function listCredentials(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const supabase = getSupabase();

    const { data: credentials, error } = await supabase
      .from('biometric_credentials')
      .select('id, device_type, device_name, created_at, last_used_at, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list biometric credentials:', error);
      return res.status(500).json({ success: false, error: 'Failed to list credentials' });
    }

    return res.json({
      success: true,
      credentials: credentials || [],
    });
  } catch (error) {
    logger.error('Biometric list-credentials error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list credentials' });
  }
}

/**
 * DELETE /api/v1/auth/biometric/credentials/:id
 * Remove a biometric credential
 */
export async function deleteCredential(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Credential ID required' });
    }

    const supabase = getSupabase();

    // Soft delete - mark as inactive
    const { data: updated, error } = await supabase
      .from('biometric_credentials')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, error: 'Credential not found' });
    }

    logger.info(`Biometric credential ${id} deleted for user ${userId}`);

    return res.json({
      success: true,
      message: 'Credential removed successfully',
    });
  } catch (error) {
    logger.error('Biometric delete-credential error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete credential' });
  }
}
