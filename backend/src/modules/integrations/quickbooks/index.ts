/**
 * QuickBooks Integration Module
 * 
 * Provides OAuth2 integration with QuickBooks Online for:
 * - Sales journal sync
 * - Customer sync  
 * - Invoice creation
 * - Account mapping
 */

export { default as quickbooksRoutes } from './quickbooks.routes.js';
export * as quickbooksService from './quickbooks.service.js';
export * as quickbooksController from './quickbooks.controller.js';
