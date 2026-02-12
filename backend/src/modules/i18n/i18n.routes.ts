/**
 * Multi-Language Routes (i18n)
 * Phase 4.4: Route definitions for internationalization
 */

import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.middleware.js';
import * as controller from './i18n.controller';

const router = Router();

// =============================================
// LANGUAGE CONFIGURATION
// =============================================

// Enable language for property
router.post(
  '/languages/:propertyId/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.enableLanguage
);

// Disable language for property
router.delete(
  '/languages/:propertyId/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.disableLanguage
);

// Get property languages
router.get(
  '/languages/:propertyId',
  optionalAuth,
  controller.getPropertyLanguages
);

// =============================================
// TRANSLATION KEYS (Admin Only)
// =============================================

// Create translation key
router.post(
  '/keys',
  authenticate,
  authorize('admin'),
  controller.createTranslationKey
);

// Get translation keys
router.get(
  '/keys',
  authenticate,
  authorize('admin', 'manager'),
  controller.getTranslationKeys
);

// =============================================
// TRANSLATIONS
// =============================================

// Set translation
router.put(
  '/translations/:keyPath/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.setTranslation
);

// Bulk set translations
router.post(
  '/translations/bulk',
  authenticate,
  authorize('admin', 'manager'),
  controller.bulkSetTranslations
);

// Get translation
router.get(
  '/translations/:keyPath/:languageCode',
  optionalAuth,
  controller.getTranslation
);

// Approve translation
router.post(
  '/translations/:translationId/approve',
  authenticate,
  authorize('admin', 'manager'),
  controller.approveTranslation
);

// Reject translation
router.post(
  '/translations/:translationId/reject',
  authenticate,
  authorize('admin', 'manager'),
  controller.rejectTranslation
);

// =============================================
// BUNDLES (Public - for frontend)
// =============================================

// Get translation bundle
router.get(
  '/bundles/:languageCode',
  controller.getTranslationBundle
);

// Regenerate bundle
router.post(
  '/bundles/:languageCode/regenerate',
  authenticate,
  authorize('admin', 'manager'),
  controller.regenerateBundle
);

// Get bundle checksum (for cache validation)
router.get(
  '/bundles/:languageCode/:context/checksum',
  controller.getBundleChecksum
);

// =============================================
// CONTENT TRANSLATIONS
// =============================================

// Translate content field
router.put(
  '/content/:entityType/:entityId/:fieldName/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.translateContent
);

// Get content translation
router.get(
  '/content/:entityType/:entityId/:fieldName/:languageCode',
  optionalAuth,
  controller.getContentTranslation
);

// Get all translations for entity
router.get(
  '/content/:entityType/:entityId/:languageCode',
  optionalAuth,
  controller.getEntityTranslations
);

// Publish content translation
router.post(
  '/content/:entityType/:entityId/:languageCode/publish',
  authenticate,
  authorize('admin', 'manager'),
  controller.publishContentTranslation
);

// =============================================
// GUEST PREFERENCES
// =============================================

// Set guest language
router.put(
  '/guests/:guestId/language',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.setGuestLanguage
);

// Get guest language
router.get(
  '/guests/:guestId/language',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getGuestLanguage
);

// Auto-detect language from headers
router.get(
  '/detect',
  controller.detectLanguage
);

// =============================================
// PROGRESS & REPORTS
// =============================================

// Get translation progress
router.get(
  '/progress/:propertyId/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.getTranslationProgress
);

// Get missing translations
router.get(
  '/missing/:languageCode',
  authenticate,
  authorize('admin', 'manager'),
  controller.getMissingTranslations
);

// =============================================
// UTILITIES
// =============================================

// Interpolate string with values
router.post(
  '/interpolate',
  controller.interpolateString
);

export default router;
