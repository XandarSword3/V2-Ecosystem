// File: backend/src/middleware/legacy-routes.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from "../utils/logger.js";

/**
 * Middleware to rewrite legacy paths to new generic paths.
 * Logs a depreciation warning for monitoring.
 */
export const legacyRouteHandler = (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    let newPath = path;

    // Map legacy prefixes to new generic prefixes
    if (path.startsWith('/api/v1/chalets')) {
        newPath = path.replace('/api/v1/chalets', '/api/v1/units');
    } else if (path.startsWith('/api/v1/pool')) {
        newPath = path.replace('/api/v1/pool', '/api/v1/facilities');
    } else if (path.startsWith('/api/v1/restaurant')) {
        newPath = path.replace('/api/v1/restaurant', '/api/v1/dining');
    }

    if (newPath !== path) {
        logger.warn(`Legacy route accessed: ${req.method} ${path} -> rewritten to ${newPath}`);
        // Mutate request url to forward to new route
        // Note: This works if this middleware is mounted BEFORE the router
        req.url = newPath;
    }

    next();
};
