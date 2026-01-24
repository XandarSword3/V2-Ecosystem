/**
 * V2 Resort - Email Unsubscribe Handler
 * Manages email unsubscribe links and one-click unsubscribe
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { notificationPreferencesService } from '../services/notification-preferences.service';
import { activityLogger } from '../utils/activityLogger';

const router = Router();

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'unsubscribe-secret';
const TOKEN_EXPIRY = '30d'; // Unsubscribe tokens valid for 30 days

export interface UnsubscribeToken {
  userId: string;
  email: string;
  type: 'all' | 'promotional' | 'newsletter' | 'list';
  listId?: string;
  exp?: number;
}

/**
 * Generate unsubscribe token for email headers
 */
export function generateUnsubscribeToken(
  userId: string,
  email: string,
  type: 'all' | 'promotional' | 'newsletter' | 'list' = 'all',
  listId?: string
): string {
  const payload: UnsubscribeToken = { userId, email, type };
  if (listId) {
    payload.listId = listId;
  }

  return jwt.sign(payload, UNSUBSCRIBE_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Generate List-Unsubscribe header value
 */
export function generateUnsubscribeHeaders(
  userId: string,
  email: string,
  type: 'all' | 'promotional' | 'newsletter' = 'all'
): {
  'List-Unsubscribe': string;
  'List-Unsubscribe-Post': string;
} {
  const token = generateUnsubscribeToken(userId, email, type);
  const baseUrl = process.env.BACKEND_URL || 'https://api.v2resort.com';

  return {
    'List-Unsubscribe': `<${baseUrl}/unsubscribe?token=${token}>, <mailto:unsubscribe@v2resort.com?subject=Unsubscribe-${token}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeToken | null {
  try {
    return jwt.verify(token, UNSUBSCRIBE_SECRET) as UnsubscribeToken;
  } catch (error) {
    console.error('[Unsubscribe] Invalid token:', error);
    return null;
  }
}

/**
 * GET /unsubscribe - Render unsubscribe confirmation page
 */
router.get('/', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).send(renderPage('Invalid Unsubscribe Link', 'The unsubscribe link is invalid or has expired.', true));
  }

  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return res.status(400).send(renderPage('Invalid Unsubscribe Link', 'The unsubscribe link is invalid or has expired.', true));
  }

  // Render confirmation page
  const html = renderUnsubscribePage(decoded, token);
  res.send(html);
});

/**
 * POST /unsubscribe - Handle unsubscribe action
 * Supports both form submission and one-click unsubscribe (RFC 8058)
 */
router.post('/', async (req: Request, res: Response) => {
  let token = req.body.token || req.query.token;

  // Handle one-click unsubscribe (just POST with no body)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid unsubscribe request' });
  }

  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return res.status(400).json({ error: 'Invalid or expired unsubscribe token' });
  }

  try {
    // Process unsubscribe
    await notificationPreferencesService.handleUnsubscribe(
      decoded.userId,
      decoded.type === 'list' ? 'all' : decoded.type
    );

    // Record in database for compliance
    await supabase.from('email_unsubscribes').insert({
      user_id: decoded.userId,
      email: decoded.email,
      type: decoded.type,
      list_id: decoded.listId,
      method: req.body['List-Unsubscribe'] === 'One-Click' ? 'one-click' : 'form',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    // Log activity
    await activityLogger.log({
      action: 'email_unsubscribed',
      entity_type: 'user',
      entity_id: decoded.userId,
      user_id: decoded.userId,
      details: {
        email: decoded.email,
        type: decoded.type,
        method: req.body['List-Unsubscribe'] === 'One-Click' ? 'one-click' : 'form',
      },
    });

    // Return appropriate response
    if (req.headers['accept']?.includes('text/html')) {
      res.send(renderPage(
        'Successfully Unsubscribed',
        `You have been unsubscribed from ${getTypeDescription(decoded.type)} emails. You can manage your notification preferences in your account settings.`,
        false
      ));
    } else {
      res.json({ success: true, message: 'Successfully unsubscribed' });
    }
  } catch (error) {
    console.error('[Unsubscribe] Error processing:', error);
    if (req.headers['accept']?.includes('text/html')) {
      res.status(500).send(renderPage('Error', 'An error occurred while processing your request. Please try again.', true));
    } else {
      res.status(500).json({ error: 'Failed to process unsubscribe' });
    }
  }
});

/**
 * GET /unsubscribe/preferences - Redirect to preferences page
 */
router.get('/preferences', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.redirect(`${process.env.FRONTEND_URL || 'https://v2resort.com'}/settings/notifications`);
  }

  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return res.redirect(`${process.env.FRONTEND_URL || 'https://v2resort.com'}/settings/notifications`);
  }

  // Generate a temporary auth token for the preferences page
  // In production, this would go through proper auth flow
  res.redirect(`${process.env.FRONTEND_URL || 'https://v2resort.com'}/settings/notifications?email=${encodeURIComponent(decoded.email)}`);
});

function getTypeDescription(type: string): string {
  switch (type) {
    case 'all': return 'all';
    case 'promotional': return 'promotional';
    case 'newsletter': return 'newsletter';
    case 'list': return 'mailing list';
    default: return type;
  }
}

function renderUnsubscribePage(decoded: UnsubscribeToken, token: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe - V2 Resort</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .logo {
            text-align: center;
            margin-bottom: 24px;
        }
        .logo svg {
            width: 64px;
            height: 64px;
        }
        h1 {
            color: #1a1a2e;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 8px;
        }
        .subtitle {
            color: #6b7280;
            text-align: center;
            margin-bottom: 32px;
        }
        .email-preview {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 24px;
        }
        .email-preview strong { color: #374151; }
        .options {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }
        .option {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .option:hover { border-color: #667eea; background: #f5f3ff; }
        .option input { display: none; }
        .option.selected { border-color: #667eea; background: #f5f3ff; }
        .radio {
            width: 20px;
            height: 20px;
            border: 2px solid #d1d5db;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .option.selected .radio {
            border-color: #667eea;
        }
        .option.selected .radio::after {
            content: '';
            width: 10px;
            height: 10px;
            background: #667eea;
            border-radius: 50%;
        }
        .option-text h3 { font-size: 14px; font-weight: 600; color: #374151; }
        .option-text p { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .btn {
            width: 100%;
            padding: 14px 24px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover { background: #5a67d8; }
        .btn-secondary {
            background: transparent;
            color: #667eea;
            margin-top: 12px;
        }
        .btn-secondary:hover { background: #f5f3ff; }
        .footer {
            text-align: center;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
        }
        .footer a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="30" fill="#667eea" opacity="0.1"/>
                <path d="M20 44V28l12-10 12 10v16H20z" fill="#667eea"/>
                <rect x="28" y="34" width="8" height="10" fill="white"/>
            </svg>
        </div>
        <h1>Manage Your Emails</h1>
        <p class="subtitle">Choose your email preferences for V2 Resort</p>
        
        <div class="email-preview">
            <strong>${decoded.email}</strong>
        </div>
        
        <form action="/unsubscribe" method="POST">
            <input type="hidden" name="token" value="${token}">
            
            <div class="options">
                <label class="option ${decoded.type === 'promotional' ? 'selected' : ''}" onclick="selectOption(this, 'promotional')">
                    <input type="radio" name="type" value="promotional" ${decoded.type === 'promotional' ? 'checked' : ''}>
                    <span class="radio"></span>
                    <div class="option-text">
                        <h3>Unsubscribe from promotional emails</h3>
                        <p>Stop receiving special offers and promotions</p>
                    </div>
                </label>
                
                <label class="option ${decoded.type === 'newsletter' ? 'selected' : ''}" onclick="selectOption(this, 'newsletter')">
                    <input type="radio" name="type" value="newsletter" ${decoded.type === 'newsletter' ? 'checked' : ''}>
                    <span class="radio"></span>
                    <div class="option-text">
                        <h3>Unsubscribe from newsletters</h3>
                        <p>Stop receiving monthly newsletters and updates</p>
                    </div>
                </label>
                
                <label class="option ${decoded.type === 'all' ? 'selected' : ''}" onclick="selectOption(this, 'all')">
                    <input type="radio" name="type" value="all" ${decoded.type === 'all' ? 'checked' : ''}>
                    <span class="radio"></span>
                    <div class="option-text">
                        <h3>Unsubscribe from all emails</h3>
                        <p>Stop all email communications (except essential booking info)</p>
                    </div>
                </label>
            </div>
            
            <button type="submit" class="btn btn-primary">Confirm Unsubscribe</button>
        </form>
        
        <a href="/unsubscribe/preferences?token=${token}" class="btn btn-secondary">
            Manage all notification preferences
        </a>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} V2 Resort. All rights reserved.</p>
            <p><a href="${process.env.FRONTEND_URL || 'https://v2resort.com'}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    
    <script>
        function selectOption(element, value) {
            document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            element.querySelector('input').checked = true;
        }
    </script>
</body>
</html>
`;
}

function renderPage(title: string, message: string, isError: boolean): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - V2 Resort</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
        }
        .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${isError ? '#fee2e2' : '#d1fae5'};
        }
        .icon svg { width: 32px; height: 32px; }
        h1 {
            color: #1a1a2e;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        p {
            color: #6b7280;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-block;
            padding: 14px 28px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
        }
        .btn:hover { background: #5a67d8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            ${isError
              ? '<svg viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="#10b981"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'}
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${process.env.FRONTEND_URL || 'https://v2resort.com'}" class="btn">Return to V2 Resort</a>
    </div>
</body>
</html>
`;
}

export const unsubscribeRouter = router;
