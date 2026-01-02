import { Request, Response, NextFunction } from 'express';
import { normalizeRequestBody } from '../utils/fieldNormalizer.js';

/**
 * Middleware that normalizes request body field names
 * Ensures both snake_case and camelCase versions are available
 * so controllers can use either naming convention.
 */
export function normalizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = normalizeRequestBody(req.body);
  }
  next();
}
