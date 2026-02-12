// File: backend/src/routes/translation.routes.ts
import { Router, Request, Response } from 'express';
import { dynamicTranslationService } from "../services/dynamic-translation.service.js";

const router = Router();

/**
 * @route GET /api/v1/translations
 * @desc Get all translations for a language
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const lang = (req.query.lang as string) || 'en';
        const namespace = req.query.namespace as string | undefined;
        const translations = await dynamicTranslationService.getTranslations(lang, namespace);

        res.json({
            success: true,
            data: translations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch translations' });
    }
});

/**
 * @route GET /api/v1/translations/:namespace
 * @desc Get translations for a specific namespace
 */
router.get('/:namespace', async (req: Request, res: Response) => {
    try {
        const { namespace } = req.params;
        const lang = (req.query.lang as string) || 'en';
        const translations = await dynamicTranslationService.getTranslations(lang, namespace);

        res.json({
            success: true,
            data: translations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch namespace translations' });
    }
});

/**
 * @route POST /api/v1/translations
 * @desc Update a translation (Admin)
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { key, language, value, namespace } = req.body;
        const success = await dynamicTranslationService.setTranslation(key, language, value, namespace);

        if (success) {
            res.json({ success: true, message: 'Translation updated' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to update translation' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update translation' });
    }
});

export default router;

