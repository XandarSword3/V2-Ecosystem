/**
 * Input Validation Middleware
 * Comprehensive input sanitization and validation for security hardening
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import xss from 'xss';

// XSS sanitization options
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;
  
  // Remove XSS
  let sanitized = xss(input, xssOptions);
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize unicode
  sanitized = sanitized.normalize('NFC');
  
  return sanitized;
}

/**
 * Deep sanitize object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key as well
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput() {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query params
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL params
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  };
}

/**
 * Zod validation middleware factory
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = schema.parse(data);
      
      // Replace with validated data
      if (source === 'body') req.body = validated;
      else if (source === 'query') req.query = validated;
      else req.params = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const schemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid ID format'),
  
  // Email validation
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  
  // Password validation (matches frontend requirements)
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  
  // Phone validation (international format)
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
  
  // Date validation
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
  
  // Money amount (in cents)
  amount: z.number().int().positive(),
  
  // Booking status
  bookingStatus: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
  
  // User role
  userRole: z.enum(['customer', 'staff', 'admin', 'superadmin']),
};

/**
 * Auth validation schemas
 */
export const authSchemas = {
  register: z.object({
    email: schemas.email,
    password: schemas.password,
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    phone: schemas.phone,
  }),
  
  login: z.object({
    email: schemas.email,
    password: z.string().min(1),
  }),
  
  resetPassword: z.object({
    token: z.string().min(1),
    password: schemas.password,
  }),
  
  twoFactorVerify: z.object({
    code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
  }),
};

/**
 * Booking validation schemas
 */
export const bookingSchemas = {
  createChaletBooking: z.object({
    chaletId: schemas.uuid,
    checkIn: schemas.date,
    checkOut: schemas.date,
    guests: z.number().int().positive().max(20),
    guestDetails: z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: schemas.email,
      phone: schemas.phone,
    }).optional(),
    specialRequests: z.string().max(1000).optional(),
  }).refine(
    (data) => new Date(data.checkOut) > new Date(data.checkIn),
    { message: 'Check-out must be after check-in' }
  ),
  
  modifyDates: z.object({
    newCheckIn: schemas.date,
    newCheckOut: schemas.date,
  }).refine(
    (data) => new Date(data.newCheckOut) > new Date(data.newCheckIn),
    { message: 'Check-out must be after check-in' }
  ),
  
  cancel: z.object({
    reason: z.string().max(500).optional(),
  }),
};

/**
 * Pool validation schemas
 */
export const poolSchemas = {
  purchaseTicket: z.object({
    date: schemas.date,
    slot: z.enum(['morning', 'afternoon', 'full_day']),
    adults: z.number().int().min(1).max(10),
    children: z.number().int().min(0).max(10),
    guestNames: z.array(z.string().max(100)).optional(),
  }),
  
  createMembership: z.object({
    planId: z.enum(['individual', 'family', 'corporate', 'vip']),
    billingCycle: z.enum(['monthly', 'quarterly', 'annually']),
    members: z.array(z.object({
      name: z.string().min(1).max(100),
      relationship: z.string().max(50),
    })).optional(),
  }),
};

/**
 * Restaurant validation schemas
 */
export const restaurantSchemas = {
  createReservation: z.object({
    date: schemas.date,
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    partySize: z.number().int().positive().max(20),
    guestName: z.string().min(1).max(100),
    guestPhone: schemas.phone,
    specialRequests: z.string().max(500).optional(),
  }),
  
  createOrder: z.object({
    tableId: z.union([schemas.uuid, z.number().int().positive()]),
    items: z.array(z.object({
      menuItemId: schemas.uuid,
      quantity: z.number().int().positive().max(50),
      notes: z.string().max(200).optional(),
    })).min(1, 'Order must contain at least one item'),
  }),
};

/**
 * Admin validation schemas
 */
export const adminSchemas = {
  updateBranding: z.object({
    brandName: z.string().max(100).optional(),
    tagline: z.string().max(200).optional(),
    colors: z.object({
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    }).optional(),
    fonts: z.object({
      heading: z.string().max(50).optional(),
      body: z.string().max(50).optional(),
    }).optional(),
    contact: z.object({
      email: schemas.email.optional(),
      phone: schemas.phone,
      address: z.string().max(500).optional(),
    }).optional(),
  }),
  
  createSeasonalRule: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    startDate: schemas.date,
    endDate: schemas.date,
    multiplier: z.number().min(0.1).max(10),
    applyToDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
    isActive: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(0),
  }).refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    { message: 'End date must be on or after start date' }
  ),
  
  emailSettings: z.object({
    provider: z.enum(['smtp', 'sendgrid', 'ses', 'mailgun', 'postmark']),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    fromEmail: schemas.email,
    fromName: z.string().max(100),
  }),
};

/**
 * SQL injection prevention
 */
export function preventSqlInjection(value: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b)/i,
    /(-{2}|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b).*[=<>]/i,
    /['";]/,
  ];
  
  return !sqlPatterns.some(pattern => pattern.test(value));
}

/**
 * Path traversal prevention
 */
export function preventPathTraversal(value: string): boolean {
  const dangerousPatterns = [
    /\.\./,
    /\.\//,
    /~\//,
    /%2e%2e/i,
    /%252e%252e/i,
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(value));
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');
      
      if (!contentType) {
        return res.status(415).json({ error: 'Content-Type header is required' });
      }
      
      const isAllowed = allowedTypes.some(type => 
        contentType.toLowerCase().includes(type.toLowerCase())
      );
      
      if (!isAllowed) {
        return res.status(415).json({
          error: `Unsupported Content-Type. Allowed: ${allowedTypes.join(', ')}`,
        });
      }
    }
    
    next();
  };
}

/**
 * Request size limiting middleware
 */
export function limitRequestSize(maxSizeBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSizeBytes) {
        res.status(413).json({ error: 'Request entity too large' });
        req.destroy();
      }
    });
    
    next();
  };
}
