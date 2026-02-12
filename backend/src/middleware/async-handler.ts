import { Request, Response, NextFunction } from 'express';

// Import types to ensure Express.Request augmentation is loaded
import '../types/index.js';

/**
 * Wraps an async route handler to automatically catch errors and forward to Express error middleware.
 * Eliminates the need for try/catch in every controller function.
 * 
 * Usage:
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await service.getItems();
 *     res.json({ success: true, data: items });
 *   }));
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next)).catch(next) as Promise<void>;
  };
