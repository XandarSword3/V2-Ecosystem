import { Request, Response, NextFunction } from 'express';

/**
 * Legacy /api/v1/chalets paths are removed. Clients must use /api/v1/units.
 */
export const legacyRouteHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/v1/chalets')) {
    res.status(410).json({
      success: false,
      error: 'Legacy chalet API removed. Use /api/v1/units instead.',
      migration: '/api/v1/units',
    });
    return;
  }

  next();
};
