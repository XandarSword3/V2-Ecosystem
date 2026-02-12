/**
 * QuickBooks Integration Routes
 * 
 * All routes require admin/accountant authentication except the OAuth callback.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.middleware.js';
import * as quickbooksController from './quickbooks.controller.js';

const router = Router();
const financeRoles = ['admin', 'super_admin', 'accountant'];

// Connection management
router.get('/status', authenticate, authorize(...financeRoles), quickbooksController.getConnectionStatus);
router.post('/connect', authenticate, authorize(...financeRoles), quickbooksController.initiateConnection);
router.get('/callback', quickbooksController.handleCallback); // Public - OAuth callback
router.post('/:connectionId/disconnect', authenticate, authorize(...financeRoles), quickbooksController.disconnect);

// Account mapping
router.get('/:connectionId/accounts', authenticate, authorize(...financeRoles), quickbooksController.getAccounts);
router.get('/:connectionId/mappings', authenticate, authorize(...financeRoles), quickbooksController.getAccountMappings);
router.post('/:connectionId/mappings', authenticate, authorize(...financeRoles), quickbooksController.saveAccountMapping);
router.delete('/:connectionId/mappings/:mappingId', authenticate, authorize(...financeRoles), quickbooksController.deleteAccountMapping);

// Sync operations
router.post('/:connectionId/sync', authenticate, authorize(...financeRoles), quickbooksController.triggerSync);
router.get('/:connectionId/sync/history', authenticate, authorize(...financeRoles), quickbooksController.getSyncHistory);
router.get('/:connectionId/sync/pending', authenticate, authorize(...financeRoles), quickbooksController.getPendingTransactions);
router.post('/:connectionId/sync/retry/:transactionId', authenticate, authorize(...financeRoles), quickbooksController.retryTransaction);

// Settings
router.patch('/:connectionId/settings', authenticate, authorize(...financeRoles), quickbooksController.updateSettings);

export default router;
