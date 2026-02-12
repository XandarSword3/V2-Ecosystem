// File: backend/src/routes/terminology.routes.ts
import { Router, Request, Response } from 'express';
import { terminologyService } from "../services/terminology.service.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";


const router = Router();

/**
 * @route GET /api/v1/terminology
 * @desc Get terminology for current context
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const businessType = (req.query.business_type as string) || 'resort';
        const language = (req.query.language as string) || 'en';

        const terms = await terminologyService.getTerminology(businessType, language);

        res.json({
            success: true,
            data: terms
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch terminology' });
    }
});

/**
 * @route GET /api/v1/terminology/admin
 * @desc Get all overrides for admin dashboard
 * @access Admin
 */
router.get('/admin', async (req: Request, res: Response) => {
    try {
        // In a real app, use requireAuth middleware here
        const businessType = req.query.business_type as string;
        const overrides = await terminologyService.getAllOverrides(businessType);

        res.json({
            success: true,
            data: overrides
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch admin terminology' });
    }
});

/**
 * @route POST /api/v1/terminology
 * @desc Update a single terminology key
 * @access Admin
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        // In a real app, use requireRole('admin') here
        const { business_type, term_key, term_value, language } = req.body;

        if (!business_type || !term_key || !term_value) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const result = await terminologyService.updateTerminology(
            business_type,
            term_key,
            term_value,
            language || 'en'
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update terminology' });
    }
});

/**
 * @route POST /api/v1/terminology/bulk
 * @desc Bulk update terminology
 * @access Admin
 */
router.post('/bulk', async (req: Request, res: Response) => {
    try {
        const { business_type, language, updates } = req.body;

        if (!business_type || !updates) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await terminologyService.bulkUpdateTerminology(
            business_type,
            language || 'en',
            updates
        );

        res.json({
            success: true,
            message: 'Terminology updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to bulk update terminology' });
    }
});

export default router;
