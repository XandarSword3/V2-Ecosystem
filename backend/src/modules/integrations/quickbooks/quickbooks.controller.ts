/**
 * QuickBooks Integration Controller
 * 
 * Handles HTTP endpoints for QuickBooks integration:
 * - OAuth flow (connect, callback, disconnect)
 * - Account mapping management
 * - Manual and scheduled sync operations
 * - Sync history and status
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import * as quickbooksService from './quickbooks.service.js';

/**
 * Get current QuickBooks connection status
 */
export const getConnectionStatus = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const propertyId = req.query.propertyId as string || req.body.propertyId;
    
    const { data: connection, error } = await supabase
      .from('quickbooks_connections')
      .select('id, realm_id, is_active, sync_enabled, last_sync_at, last_sync_status, last_sync_error, settings, created_at')
      .eq('property_id', propertyId)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }
    
    if (!connection) {
      return res.json({
        connected: false,
        message: 'QuickBooks is not connected',
      });
    }
    
    // Test if connection is still valid
    const testResult = await quickbooksService.testConnection(connection.id);
    
    res.json({
      connected: connection.is_active && testResult.success,
      connectionId: connection.id,
      companyId: connection.realm_id,
      companyName: testResult.companyName,
      syncEnabled: connection.sync_enabled,
      lastSync: connection.last_sync_at,
      lastSyncStatus: connection.last_sync_status,
      lastSyncError: connection.last_sync_error,
      settings: connection.settings,
      connectedAt: connection.created_at,
    });
});
/**
 * Initiate OAuth connection flow
 */
export const initiateConnection = asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.body.propertyId;
    const userId = req.user?.id;
    
    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }
    
    // Generate state token for security (includes property ID)
    const state = Buffer.from(JSON.stringify({
      propertyId,
      userId,
      timestamp: Date.now(),
    })).toString('base64');
    
    const authUrl = quickbooksService.getAuthorizationUrl(state);
    
    res.json({
      authorizationUrl: authUrl,
      message: 'Redirect user to this URL to connect QuickBooks',
    });
});
/**
 * Handle OAuth callback from QuickBooks
 */
export async function handleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, realmId, state } = req.query;
    
    if (!code || !realmId || !state) {
      return res.status(400).json({ error: 'Missing required OAuth parameters' });
    }
    
    // Decode state
    let stateData: { propertyId: string; userId: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Exchange code for tokens
    const tokens = await quickbooksService.exchangeCodeForTokens(
      code as string,
      realmId as string
    );
    
    const supabase = getSupabase();
    
    // Check for existing connection
    const { data: existing } = await supabase
      .from('quickbooks_connections')
      .select('id')
      .eq('property_id', stateData.propertyId)
      .single();
      
    if (existing) {
      // Update existing connection
      await supabase
        .from('quickbooks_connections')
        .update({
          realm_id: realmId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          is_active: true,
        })
        .eq('id', existing.id);
    } else {
      // Create new connection
      await supabase
        .from('quickbooks_connections')
        .insert({
          property_id: stateData.propertyId,
          realm_id: realmId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          is_active: true,
          sync_enabled: true,
          created_by: stateData.userId,
        });
    }
    
    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/admin/integrations/quickbooks?connected=true`);
    
  } catch (error) {
    console.error('QuickBooks callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/admin/integrations/quickbooks?error=connection_failed`);
  }
}

/**
 * Disconnect QuickBooks integration
 */
export const disconnect = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const supabase = getSupabase();
    
    // Soft delete - mark as inactive
    await supabase
      .from('quickbooks_connections')
      .update({
        is_active: false,
        sync_enabled: false,
        access_token: null,
        refresh_token: null,
      })
      .eq('id', connectionId);
      
    res.json({
      success: true,
      message: 'QuickBooks disconnected successfully',
    });
});
/**
 * Get QuickBooks accounts for mapping
 */
export const getAccounts = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    
    const accounts = await quickbooksService.getAccounts(connectionId);
    
    // Group by account type
    const grouped = accounts.reduce((acc, account) => {
      const type = account.classification || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    }, {} as Record<string, typeof accounts>);
    
    res.json({
      accounts,
      grouped,
      categories: Object.keys(quickbooksService.REVENUE_CATEGORIES).map(key => ({
        key,
        ...quickbooksService.REVENUE_CATEGORIES[key as keyof typeof quickbooksService.REVENUE_CATEGORIES],
      })),
    });
});
/**
 * Get current account mappings
 */
export const getAccountMappings = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const supabase = getSupabase();
    
    const { data: mappings, error } = await supabase
      .from('quickbooks_account_mappings')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('is_active', true);
      
    if (error) throw error;
    
    res.json({
      mappings: mappings || [],
      categories: Object.keys(quickbooksService.REVENUE_CATEGORIES).map(key => ({
        key,
        ...quickbooksService.REVENUE_CATEGORIES[key as keyof typeof quickbooksService.REVENUE_CATEGORIES],
        mapped: mappings?.find(m => m.v2_category === key) || null,
      })),
    });
});
/**
 * Save account mapping
 */
export const saveAccountMapping = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const { v2Category, qbAccountId, qbAccountName, qbAccountType } = req.body;
    
    if (!v2Category || !qbAccountId) {
      return res.status(400).json({ error: 'V2 category and QuickBooks account ID are required' });
    }
    
    const supabase = getSupabase();
    
    // Upsert mapping
    const { data, error } = await supabase
      .from('quickbooks_account_mappings')
      .upsert({
        connection_id: connectionId,
        v2_category: v2Category,
        qb_account_id: qbAccountId,
        qb_account_name: qbAccountName,
        qb_account_type: qbAccountType,
        is_active: true,
      }, {
        onConflict: 'connection_id,v2_category',
      })
      .select()
      .single();
      
    if (error) throw error;
    
    res.json({
      success: true,
      mapping: data,
    });
});
/**
 * Delete account mapping
 */
export const deleteAccountMapping = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId, mappingId } = req.params;
    const supabase = getSupabase();
    
    await supabase
      .from('quickbooks_account_mappings')
      .update({ is_active: false })
      .eq('id', mappingId)
      .eq('connection_id', connectionId);
      
    res.json({
      success: true,
      message: 'Mapping removed',
    });
});
/**
 * Trigger manual sync
 */
export const triggerSync = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const { syncType, date } = req.body;
    
    const syncDate = date ? new Date(date) : new Date();
    
    let result;
    switch (syncType) {
      case 'sales':
        result = await quickbooksService.syncDailySales(connectionId, syncDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid sync type. Supported: sales' });
    }
    
    res.json({
      success: result.success,
      syncType,
      date: syncDate.toISOString().split('T')[0],
      recordsSynced: result.synced,
      recordsFailed: result.failed,
      errors: result.errors,
    });
});
/**
 * Get sync history
 */
export const getSyncHistory = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await quickbooksService.getSyncHistory(connectionId, limit);
    
    res.json({
      history,
      total: history.length,
    });
});
/**
 * Get pending/failed transactions
 */
export const getPendingTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const supabase = getSupabase();
    
    const { data: transactions, error } = await supabase
      .from('quickbooks_synced_transactions')
      .select('*')
      .eq('connection_id', connectionId)
      .in('sync_status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    res.json({
      transactions: transactions || [],
      total: transactions?.length || 0,
    });
});
/**
 * Retry failed transaction
 */
export const retryTransaction = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId, transactionId } = req.params;
    const supabase = getSupabase();
    
    // Get transaction details
    const { data: transaction, error } = await supabase
      .from('quickbooks_synced_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('connection_id', connectionId)
      .single();
      
    if (error || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Get original payment data
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', transaction.v2_transaction_id)
      .single();
      
    if (!payment) {
      return res.status(404).json({ error: 'Original payment not found' });
    }
    
    try {
      // Retry sync
      const category = payment.source_type || 'service_revenue';
      
      await quickbooksService.createSalesReceipt(connectionId, {
        transactionId: payment.id,
        transactionType: 'payment',
        date: new Date(payment.created_at),
        lineItems: [{
          description: `Payment - ${payment.description || 'Service'}`,
          amount: parseFloat(payment.amount),
          category,
        }],
      });
      
      // Update transaction status
      await supabase
        .from('quickbooks_synced_transactions')
        .update({
          sync_status: 'synced',
          synced_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', transactionId);
        
      res.json({
        success: true,
        message: 'Transaction synced successfully',
      });
    } catch (syncError) {
      // Update retry count
      await supabase
        .from('quickbooks_synced_transactions')
        .update({
          retry_count: (transaction.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
        })
        .eq('id', transactionId);
        
      res.status(500).json({
        success: false,
        error: syncError instanceof Error ? syncError.message : 'Sync failed',
      });
    }
});
/**
 * Update sync settings
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const { connectionId } = req.params;
    const { syncEnabled, settings } = req.body;
    
    const supabase = getSupabase();
    
    const updates: Record<string, unknown> = {};
    if (syncEnabled !== undefined) updates.sync_enabled = syncEnabled;
    if (settings) updates.settings = settings;
    
    const { data, error } = await supabase
      .from('quickbooks_connections')
      .update(updates)
      .eq('id', connectionId)
      .select()
      .single();
      
    if (error) throw error;
    
    res.json({
      success: true,
      connection: {
        syncEnabled: data.sync_enabled,
        settings: data.settings,
      },
    });
});

