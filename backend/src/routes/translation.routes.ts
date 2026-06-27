// File: backend/src/routes/translation.routes.ts
import { Router, Request, Response } from 'express';
import { dynamicTranslationService } from "../services/dynamic-translation.service.js";
import { asyncHandler } from '../middleware/async-handler.js';

const router = Router();

/**
 * @route GET /api/v1/translations
 * @desc Get all translations for a language
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const lang = (req.query.lang as string) || 'en';
    const namespace = req.query.namespace as string | undefined;
    const translations = await dynamicTranslationService.getTranslations(lang, namespace);
    res.json({ success: true, data: translations });
}));

router.get('/:namespace', asyncHandler(async (req: Request, res: Response) => {
    const { namespace } = req.params;
    const lang = (req.query.lang as string) || 'en';
    const translations = await dynamicTranslationService.getTranslations(lang, namespace);
    res.json({ success: true, data: translations });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { key, language, value, namespace } = req.body;
    const success = await dynamicTranslationService.setTranslation(key, language, value, namespace);
    if (success) {
        res.json({ success: true, message: 'Translation updated' });
    } else {
        res.status(500).json({ success: false, error: 'Failed to update translation' });
    }
}));

export default router;

