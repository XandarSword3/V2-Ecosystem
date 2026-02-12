/**
 * Multi-Language Controller (i18n)
 * Phase 4.4: HTTP endpoints for internationalization
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { i18nService } from './i18n.service';

// =============================================
// LANGUAGE CONFIGURATION
// =============================================

export const enableLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, languageCode } = req.params;

    await i18nService.enableLanguage(propertyId, languageCode, req.body);

    res.status(201).json({
      success: true,
      message: 'Language enabled'
    });
});
export const disableLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, languageCode } = req.params;

    await i18nService.disableLanguage(propertyId, languageCode);

    res.json({
      success: true,
      message: 'Language disabled'
    });
});
export const getPropertyLanguages = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const languages = await i18nService.getPropertyLanguages(propertyId);

    res.json({
      success: true,
      data: languages,
      count: languages.length
    });
});
// =============================================
// TRANSLATION KEYS
// =============================================

export const createTranslationKey = asyncHandler(async (req: Request, res: Response) => {
    const key = await i18nService.createTranslationKey(req.body);

    res.status(201).json({
      success: true,
      data: key,
      message: 'Translation key created'
    });
});
export const getTranslationKeys = asyncHandler(async (req: Request, res: Response) => {
    const { context, module, needsReview } = req.query;

    const keys = await i18nService.getTranslationKeys({
      context: context as string,
      module: module as string,
      needsReview: needsReview === 'true'
    });

    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
});
// =============================================
// TRANSLATIONS
// =============================================

export const setTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { keyPath, languageCode } = req.params;
    const { value, propertyId } = req.body;
    const userId = req.user?.id;

    await i18nService.setTranslation(keyPath, languageCode, value, {
      propertyId,
      translatedBy: userId,
      status: req.body.status || 'pending'
    });

    res.json({
      success: true,
      message: 'Translation saved'
    });
});
export const bulkSetTranslations = asyncHandler(async (req: Request, res: Response) => {
    const { translations } = req.body;
    const userId = req.user?.id;

    const result = await i18nService.bulkSetTranslations(translations, {
      translatedBy: userId,
      status: req.body.status || 'pending'
    });

    res.json({
      success: true,
      data: result,
      message: `${result.success} translations saved, ${result.failed} failed`
    });
});
export const getTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { keyPath, languageCode } = req.params;
    const { propertyId } = req.query;

    const value = await i18nService.getTranslation(
      keyPath,
      languageCode,
      propertyId as string
    );

    res.json({
      success: true,
      data: { keyPath, languageCode, value }
    });
});
export const approveTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { translationId } = req.params;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await i18nService.approveTranslation(translationId, userId);

    res.json({
      success: true,
      message: 'Translation approved'
    });
});
export const rejectTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { translationId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    await i18nService.rejectTranslation(translationId, userId, reason);

    res.json({
      success: true,
      message: 'Translation rejected'
    });
});
// =============================================
// BUNDLES
// =============================================

export const getTranslationBundle = asyncHandler(async (req: Request, res: Response) => {
    const { languageCode } = req.params;
    const { context, propertyId } = req.query;

    const bundle = await i18nService.getTranslationBundle(
      languageCode,
      (context as string) || 'ui',
      propertyId as string
    );

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', bundle.checksum);

    // Check If-None-Match for 304
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === bundle.checksum) {
      return res.status(304).end();
    }

    res.json({
      success: true,
      data: bundle
    });
});
export const regenerateBundle = asyncHandler(async (req: Request, res: Response) => {
    const { languageCode } = req.params;
    const { context, propertyId } = req.body;

    const bundle = await i18nService.generateBundle(
      languageCode,
      context || 'ui',
      propertyId
    );

    res.json({
      success: true,
      data: bundle,
      message: 'Bundle regenerated'
    });
});
export const getBundleChecksum = asyncHandler(async (req: Request, res: Response) => {
    const { languageCode, context } = req.params;
    const { propertyId } = req.query;

    const checksum = await i18nService.getBundleChecksum(
      languageCode,
      context,
      propertyId as string
    );

    res.json({
      success: true,
      data: { checksum }
    });
});
// =============================================
// CONTENT TRANSLATIONS
// =============================================

export const translateContent = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId, fieldName, languageCode } = req.params;
    const { value, status } = req.body;
    const userId = req.user?.id;

    await i18nService.translateContent(
      entityType,
      entityId,
      fieldName,
      languageCode,
      value,
      { status, createdBy: userId }
    );

    res.json({
      success: true,
      message: 'Content translation saved'
    });
});
export const getContentTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId, fieldName, languageCode } = req.params;

    const value = await i18nService.getContentTranslation(
      entityType,
      entityId,
      fieldName,
      languageCode
    );

    res.json({
      success: true,
      data: { value }
    });
});
export const getEntityTranslations = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId, languageCode } = req.params;

    const translations = await i18nService.getEntityTranslations(
      entityType,
      entityId,
      languageCode
    );

    res.json({
      success: true,
      data: translations
    });
});
export const publishContentTranslation = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId, languageCode } = req.params;

    await i18nService.publishContentTranslation(entityType, entityId, languageCode);

    res.json({
      success: true,
      message: 'Translation published'
    });
});
// =============================================
// GUEST PREFERENCES
// =============================================

export const setGuestLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { guestId } = req.params;

    await i18nService.setGuestLanguage(guestId, req.body);

    res.json({
      success: true,
      message: 'Guest language preference saved'
    });
});
export const getGuestLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { guestId } = req.params;

    const language = await i18nService.getGuestLanguage(guestId);

    res.json({
      success: true,
      data: { preferredLanguage: language }
    });
});
export const detectLanguage = asyncHandler(async (req: Request, res: Response) => {
    const acceptLanguage = req.headers['accept-language'] || 'en';

    const detected = await i18nService.detectGuestLanguage(acceptLanguage);

    res.json({
      success: true,
      data: { detectedLanguage: detected }
    });
});
// =============================================
// PROGRESS & MISSING
// =============================================

export const getTranslationProgress = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, languageCode } = req.params;

    const progress = await i18nService.updateTranslationProgress(propertyId, languageCode);

    res.json({
      success: true,
      data: { progress }
    });
});
export const getMissingTranslations = asyncHandler(async (req: Request, res: Response) => {
    const { languageCode } = req.params;
    const { propertyId, context } = req.query;

    const missing = await i18nService.getMissingTranslations(
      languageCode,
      propertyId as string,
      context as string
    );

    res.json({
      success: true,
      data: missing,
      count: missing.length
    });
});
// =============================================
// UTILITIES
// =============================================

export const interpolateString = asyncHandler(async (req: Request, res: Response) => {
    const { template, values } = req.body;

    const result = i18nService.interpolate(template, values);

    res.json({
      success: true,
      data: { result }
    });
});