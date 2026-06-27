// File: backend/src/routes/terminology.routes.ts
import { Router, Request, Response } from 'express';
import { terminologyService } from "../services/terminology.service.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { asyncHandler } from '../middleware/async-handler.js';


const router = Router();

/**
 * @route GET /api/v1/terminology
 * @desc Get terminology for current context
 * @access Public
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const businessType = (req.query.business_type as string) || 'hotel';
    const language = (req.query.language as string) || 'en';
    const terms = await terminologyService.getTerminology(businessType, language);
    res.json({ success: true, data: terms });
}));

router.get('/admin', asyncHandler(async (req: Request, res: Response) => {
    const businessType = req.query.business_type as string;
    const overrides = await terminologyService.getAllOverrides(businessType);
    res.json({ success: true, data: overrides });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { business_type, term_key, term_value, language } = req.body;
    if (!business_type || !term_key || !term_value) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const result = await terminologyService.updateTerminology(business_type, term_key, term_value, language || 'en');
    res.json({ success: true, data: result });
}));

router.post('/bulk', asyncHandler(async (req: Request, res: Response) => {
    const { business_type, language, updates } = req.body;
    if (!business_type || !updates) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    await terminologyService.bulkUpdateTerminology(business_type, language || 'en', updates);
    res.json({ success: true, message: 'Terminology updated successfully' });
}));

export default router;
