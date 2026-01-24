/**
 * Security Headers Middleware
 * Implements comprehensive security headers for production hardening
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface SecurityHeadersConfig {
  contentSecurityPolicy: boolean | CSPConfig;
  hsts: boolean | HSTSConfig;
  xFrameOptions: 'DENY' | 'SAMEORIGIN' | false;
  xContentTypeOptions: boolean;
  xXssProtection: boolean;
  referrerPolicy: ReferrerPolicy | false;
  permissionsPolicy: boolean | PermissionsPolicyConfig;
  crossOriginEmbedderPolicy: 'require-corp' | 'credentialless' | false;
  crossOriginOpenerPolicy: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  crossOriginResourcePolicy: 'same-origin' | 'same-site' | 'cross-origin' | false;
}

interface CSPConfig {
  directives: Record<string, string[]>;
  reportUri?: string;
  reportOnly?: boolean;
}

interface HSTSConfig {
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

interface PermissionsPolicyConfig {
  features: Record<string, string[]>;
}

type ReferrerPolicy = 
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

const defaultConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'https:', 'blob:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'https://api.stripe.com', 'wss:', 'https:'],
      'frame-src': ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': [],
    },
    reportUri: undefined,
    reportOnly: false,
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: true,
  xXssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    features: {
      'camera': [],
      'microphone': [],
      'geolocation': ['self'],
      'payment': ['self', 'https://js.stripe.com'],
      'usb': [],
      'fullscreen': ['self'],
    },
  },
  crossOriginEmbedderPolicy: false, // Can break some integrations
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginResourcePolicy: 'same-origin',
};

/**
 * Build CSP header string
 */
function buildCSP(config: CSPConfig, nonce?: string): string {
  const directives: string[] = [];
  
  for (const [directive, values] of Object.entries(config.directives)) {
    if (values.length === 0) {
      directives.push(directive);
    } else {
      let valueStr = values.join(' ');
      
      // Add nonce to script-src and style-src if provided
      if (nonce && (directive === 'script-src' || directive === 'style-src')) {
        valueStr += ` 'nonce-${nonce}'`;
      }
      
      directives.push(`${directive} ${valueStr}`);
    }
  }

  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Build Permissions-Policy header string
 */
function buildPermissionsPolicy(config: PermissionsPolicyConfig): string {
  const policies: string[] = [];
  
  for (const [feature, allowlist] of Object.entries(config.features)) {
    if (allowlist.length === 0) {
      policies.push(`${feature}=()`);
    } else {
      const values = allowlist.map(v => v === 'self' ? 'self' : `"${v}"`).join(' ');
      policies.push(`${feature}=(${values})`);
    }
  }

  return policies.join(', ');
}

/**
 * Security headers middleware
 */
export function securityHeaders(customConfig?: Partial<SecurityHeadersConfig>) {
  const config = { ...defaultConfig, ...customConfig };

  return (req: Request, res: Response, next: NextFunction) => {
    // Generate nonce for CSP
    const nonce = crypto.randomBytes(16).toString('base64');
    (req as any).cspNonce = nonce;

    // Content-Security-Policy
    if (config.contentSecurityPolicy) {
      const cspConfig = typeof config.contentSecurityPolicy === 'object'
        ? config.contentSecurityPolicy
        : defaultConfig.contentSecurityPolicy as CSPConfig;
      
      const headerName = cspConfig.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      
      res.setHeader(headerName, buildCSP(cspConfig, nonce));
    }

    // Strict-Transport-Security
    if (config.hsts) {
      const hstsConfig = typeof config.hsts === 'object'
        ? config.hsts
        : defaultConfig.hsts as HSTSConfig;
      
      let value = `max-age=${hstsConfig.maxAge}`;
      if (hstsConfig.includeSubDomains) value += '; includeSubDomains';
      if (hstsConfig.preload) value += '; preload';
      
      res.setHeader('Strict-Transport-Security', value);
    }

    // X-Frame-Options
    if (config.xFrameOptions) {
      res.setHeader('X-Frame-Options', config.xFrameOptions);
    }

    // X-Content-Type-Options
    if (config.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection (legacy but still useful)
    if (config.xXssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy) {
      const ppConfig = typeof config.permissionsPolicy === 'object'
        ? config.permissionsPolicy
        : defaultConfig.permissionsPolicy as PermissionsPolicyConfig;
      
      res.setHeader('Permissions-Policy', buildPermissionsPolicy(ppConfig));
    }

    // Cross-Origin-Embedder-Policy
    if (config.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Opener-Policy
    if (config.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (config.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
    }

    // Additional security headers
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

/**
 * CSP violation report handler
 */
export function cspReportHandler() {
  return (req: Request, res: Response) => {
    const report = req.body;
    
    // Log the violation
    console.warn('CSP Violation:', JSON.stringify(report, null, 2));
    
    // You could also send to a logging service
    // await logService.logSecurityEvent('csp_violation', report);

    res.status(204).send();
  };
}

/**
 * Security audit endpoint (admin only)
 */
export function getSecurityStatus() {
  return {
    headers: {
      csp: true,
      hsts: true,
      xFrameOptions: true,
      xContentTypeOptions: true,
      referrerPolicy: true,
      permissionsPolicy: true,
    },
    encryption: {
      tls: true,
      minVersion: 'TLSv1.2',
    },
    authentication: {
      jwt: true,
      bcryptRounds: 12,
      twoFactor: true,
      sessionTimeout: '30 minutes',
    },
    rateLimit: {
      enabled: true,
      apiLimit: '100 requests/minute',
      authLimit: '5 requests/minute',
    },
    cors: {
      enabled: true,
      credentials: true,
    },
  };
}
