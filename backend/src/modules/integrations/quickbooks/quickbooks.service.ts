/**
 * QuickBooks Integration Module
 * 
 * This module provides OAuth2 authentication and API integration with QuickBooks Online.
 * It supports:
 * - OAuth2 connection flow
 * - Sales journal sync
 * - Customer sync
 * - Invoice creation
 * - Automatic token refresh
 */

import OAuthClient from 'intuit-oauth';
import axios from 'axios';
import { getSupabase } from '../../../database/connection.js';

// QuickBooks API Configuration
const QB_CONFIG = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
  environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3005/api/v1/integrations/quickbooks/callback',
  scopes: [
    OAuthClient.scopes.Accounting,
    OAuthClient.scopes.OpenId,
  ],
};

// QuickBooks API base URLs
const QB_API_BASE = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
};

// V2 revenue categories to QuickBooks account types
export const REVENUE_CATEGORIES = {
  room_revenue: { name: 'Room Revenue', defaultType: 'Income' },
  food_revenue: { name: 'Food & Beverage Revenue', defaultType: 'Income' },
  spa_revenue: { name: 'Spa Revenue', defaultType: 'Income' },
  pool_revenue: { name: 'Pool Revenue', defaultType: 'Income' },
  merchandise_revenue: { name: 'Merchandise Revenue', defaultType: 'Income' },
  service_revenue: { name: 'Service Revenue', defaultType: 'Income' },
  loyalty_redemption: { name: 'Loyalty Redemption', defaultType: 'Expense' },
  refunds: { name: 'Refunds', defaultType: 'Income' }, // Contra-revenue
  tips: { name: 'Tips Collected', defaultType: 'Other Current Liability' },
  taxes_collected: { name: 'Sales Tax Payable', defaultType: 'Other Current Liability' },
};

/**
 * Create a new OAuth client instance
 */
export function createOAuthClient(): OAuthClient {
  return new OAuthClient({
    clientId: QB_CONFIG.clientId,
    clientSecret: QB_CONFIG.clientSecret,
    environment: QB_CONFIG.environment,
    redirectUri: QB_CONFIG.redirectUri,
  });
}

/**
 * Generate the OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const oauthClient = createOAuthClient();
  return oauthClient.authorizeUri({
    scope: QB_CONFIG.scopes,
    state: state || 'v2-integration',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  authorizationCode: string,
  realmId: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const oauthClient = createOAuthClient();
  
  const authResponse = await oauthClient.createToken(
    `${QB_CONFIG.redirectUri}?code=${authorizationCode}&realmId=${realmId}`
  );
  
  const token = authResponse.getJson();
  
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const oauthClient = createOAuthClient();
  oauthClient.setToken({ refresh_token: refreshToken });
  
  const authResponse = await oauthClient.refresh();
  const token = authResponse.getJson();
  
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
  };
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const supabase = getSupabase();
  
  const { data: connection, error } = await supabase
    .from('quickbooks_connections')
    .select('*')
    .eq('id', connectionId)
    .single();
    
  if (error || !connection) {
    throw new Error('QuickBooks connection not found');
  }
  
  // Check if token is expired (with 5 minute buffer)
  const tokenExpiry = new Date(connection.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (tokenExpiry.getTime() - now.getTime() < fiveMinutes) {
    // Token expired or about to expire, refresh it
    const newTokens = await refreshAccessToken(connection.refresh_token);
    
    // Update tokens in database
    await supabase
      .from('quickbooks_connections')
      .update({
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        token_expires_at: newTokens.expiresAt.toISOString(),
      })
      .eq('id', connectionId);
      
    return newTokens.accessToken;
  }
  
  return connection.access_token;
}

/**
 * Make authenticated API request to QuickBooks
 */
export async function makeQBRequest<T>(
  connectionId: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: unknown
): Promise<T> {
  const supabase = getSupabase();
  
  const { data: connection } = await supabase
    .from('quickbooks_connections')
    .select('realm_id')
    .eq('id', connectionId)
    .single();
    
  if (!connection) {
    throw new Error('QuickBooks connection not found');
  }
  
  const accessToken = await getValidAccessToken(connectionId);
  const baseUrl = QB_API_BASE[QB_CONFIG.environment];
  const url = `${baseUrl}/v3/company/${connection.realm_id}${endpoint}`;
  
  const response = await axios({
    method,
    url,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    data,
  });
  
  return response.data;
}

/**
 * Get list of accounts from QuickBooks
 */
export async function getAccounts(connectionId: string): Promise<Array<{
  id: string;
  name: string;
  accountType: string;
  classification: string;
}>> {
  const response = await makeQBRequest<{
    QueryResponse: {
      Account: Array<{
        Id: string;
        Name: string;
        AccountType: string;
        Classification: string;
      }>;
    };
  }>(connectionId, 'GET', '/query?query=select * from Account');
  
  return (response.QueryResponse.Account || []).map(acc => ({
    id: acc.Id,
    name: acc.Name,
    accountType: acc.AccountType,
    classification: acc.Classification,
  }));
}

/**
 * Create or update customer in QuickBooks
 */
export async function syncCustomer(
  connectionId: string,
  customer: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }
): Promise<string> {
  const supabase = getSupabase();
  
  // Check if customer already exists in mapping
  const { data: existing } = await supabase
    .from('quickbooks_customer_mappings')
    .select('qb_customer_id')
    .eq('connection_id', connectionId)
    .eq('v2_user_id', customer.id)
    .single();
    
  if (existing) {
    return existing.qb_customer_id;
  }
  
  // Create new customer in QuickBooks
  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
  
  const response = await makeQBRequest<{
    Customer: { Id: string; DisplayName: string };
  }>(connectionId, 'POST', '/customer', {
    DisplayName: displayName,
    PrimaryEmailAddr: { Address: customer.email },
    PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
  });
  
  // Save mapping
  await supabase
    .from('quickbooks_customer_mappings')
    .insert({
      connection_id: connectionId,
      v2_user_id: customer.id,
      qb_customer_id: response.Customer.Id,
      qb_customer_name: response.Customer.DisplayName,
    });
    
  return response.Customer.Id;
}

/**
 * Create sales receipt in QuickBooks
 */
export async function createSalesReceipt(
  connectionId: string,
  sale: {
    transactionId: string;
    transactionType: string;
    customerId?: string;
    date: Date;
    lineItems: Array<{
      description: string;
      amount: number;
      category: string;
    }>;
    paymentMethod?: string;
  }
): Promise<string> {
  const supabase = getSupabase();
  
  // Get account mappings
  const { data: mappings } = await supabase
    .from('quickbooks_account_mappings')
    .select('v2_category, qb_account_id')
    .eq('connection_id', connectionId);
    
  const accountMap = new Map(mappings?.map(m => [m.v2_category, m.qb_account_id]) || []);
  
  // Build line items
  const lines = sale.lineItems.map((item, index) => ({
    Id: String(index + 1),
    LineNum: index + 1,
    Amount: item.amount,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: {
        value: accountMap.get(item.category) || '1', // Default to first account if not mapped
      },
    },
    Description: item.description,
  }));
  
  // Create sales receipt
  const response = await makeQBRequest<{
    SalesReceipt: { Id: string };
  }>(connectionId, 'POST', '/salesreceipt', {
    Line: lines,
    TxnDate: sale.date.toISOString().split('T')[0],
    CustomerRef: sale.customerId ? { value: sale.customerId } : undefined,
    PrivateNote: `V2 Transaction: ${sale.transactionType} - ${sale.transactionId}`,
  });
  
  // Record sync
  await supabase
    .from('quickbooks_synced_transactions')
    .insert({
      connection_id: connectionId,
      v2_transaction_id: sale.transactionId,
      v2_transaction_type: sale.transactionType,
      qb_transaction_id: response.SalesReceipt.Id,
      qb_transaction_type: 'SalesReceipt',
      amount: sale.lineItems.reduce((sum, item) => sum + item.amount, 0),
      sync_status: 'synced',
      synced_at: new Date().toISOString(),
    });
    
  return response.SalesReceipt.Id;
}

/**
 * Create journal entry in QuickBooks
 */
export async function createJournalEntry(
  connectionId: string,
  entry: {
    date: Date;
    memo: string;
    lines: Array<{
      accountId: string;
      amount: number;
      type: 'Debit' | 'Credit';
      description?: string;
    }>;
  }
): Promise<string> {
  const lines = entry.lines.map((line, index) => ({
    Id: String(index + 1),
    Amount: Math.abs(line.amount),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: line.type,
      AccountRef: { value: line.accountId },
    },
    Description: line.description,
  }));
  
  const response = await makeQBRequest<{
    JournalEntry: { Id: string };
  }>(connectionId, 'POST', '/journalentry', {
    Line: lines,
    TxnDate: entry.date.toISOString().split('T')[0],
    PrivateNote: entry.memo,
  });
  
  return response.JournalEntry.Id;
}

/**
 * Sync daily sales summary to QuickBooks
 */
export async function syncDailySales(
  connectionId: string,
  date: Date
): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabase();
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;
  
  // Get start and end of day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Create sync log entry
  const { data: syncLog } = await supabase
    .from('quickbooks_sync_log')
    .insert({
      connection_id: connectionId,
      sync_type: 'sales',
      status: 'in_progress',
    })
    .select()
    .single();
    
  try {
    // Get payments from V2 for this date
    const { data: payments } = await supabase
      .from('payments')
      .select('*, users(id, email, first_name, last_name)')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .eq('status', 'completed');
      
    if (!payments || payments.length === 0) {
      // Update sync log - no records to sync
      await supabase
        .from('quickbooks_sync_log')
        .update({
          status: 'completed',
          records_processed: 0,
          records_synced: 0,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog?.id);
        
      return { success: true, synced: 0, failed: 0, errors: [] };
    }
    
    // Check which payments are already synced
    const { data: alreadySynced } = await supabase
      .from('quickbooks_synced_transactions')
      .select('v2_transaction_id')
      .eq('connection_id', connectionId)
      .eq('sync_status', 'synced')
      .in('v2_transaction_id', payments.map(p => p.id));
      
    const syncedIds = new Set(alreadySynced?.map(s => s.v2_transaction_id) || []);
    const paymentsToSync = payments.filter(p => !syncedIds.has(p.id));
    
    // Sync each payment
    for (const payment of paymentsToSync) {
      try {
        // Determine category based on payment type/source
        const category = payment.source_type || 'service_revenue';
        
        await createSalesReceipt(connectionId, {
          transactionId: payment.id,
          transactionType: 'payment',
          date: new Date(payment.created_at),
          lineItems: [{
            description: `Payment - ${payment.description || 'Service'}`,
            amount: parseFloat(payment.amount),
            category,
          }],
        });
        
        synced++;
      } catch (error) {
        failed++;
        errors.push(`Payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Record failed sync
        await supabase
          .from('quickbooks_synced_transactions')
          .insert({
            connection_id: connectionId,
            v2_transaction_id: payment.id,
            v2_transaction_type: 'payment',
            amount: parseFloat(payment.amount),
            sync_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: 1,
            last_retry_at: new Date().toISOString(),
          });
      }
    }
    
    // Update sync log
    await supabase
      .from('quickbooks_sync_log')
      .update({
        status: failed > 0 ? 'completed_with_errors' : 'completed',
        records_processed: paymentsToSync.length,
        records_synced: synced,
        records_failed: failed,
        error_details: errors.length > 0 ? { errors } : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id);
      
    // Update connection last sync
    await supabase
      .from('quickbooks_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: failed > 0 ? 'completed_with_errors' : 'completed',
        last_sync_error: errors.length > 0 ? errors[0] : null,
      })
      .eq('id', connectionId);
      
    return { success: true, synced, failed, errors };
    
  } catch (error) {
    // Update sync log with failure
    await supabase
      .from('quickbooks_sync_log')
      .update({
        status: 'failed',
        error_details: { error: error instanceof Error ? error.message : 'Unknown error' },
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog?.id);
      
    throw error;
  }
}

/**
 * Get sync history
 */
export async function getSyncHistory(
  connectionId: string,
  limit = 50
): Promise<Array<{
  id: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  recordsSynced: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
}>> {
  const supabase = getSupabase();
  
  const { data } = await supabase
    .from('quickbooks_sync_log')
    .select('*')
    .eq('connection_id', connectionId)
    .order('started_at', { ascending: false })
    .limit(limit);
    
  return (data || []).map(log => ({
    id: log.id,
    syncType: log.sync_type,
    status: log.status,
    recordsProcessed: log.records_processed,
    recordsSynced: log.records_synced,
    recordsFailed: log.records_failed,
    startedAt: log.started_at,
    completedAt: log.completed_at,
  }));
}

/**
 * Test QuickBooks connection
 */
export async function testConnection(connectionId: string): Promise<{
  success: boolean;
  companyName?: string;
  error?: string;
}> {
  try {
    // FIX: Iteration 17 - Fetch realm_id from DB; was passing internal UUID connectionId
    // which always 404'd on QuickBooks API (endpoint needs realmId, not our DB UUID)
    const supabase = getSupabase();
    const { data: connection } = await supabase
      .from('quickbooks_connections')
      .select('realm_id')
      .eq('id', connectionId)
      .single();

    if (!connection?.realm_id) {
      return { success: false, error: 'Connection not found or missing realm_id' };
    }

    const response = await makeQBRequest<{
      CompanyInfo: { CompanyName: string };
    }>(connectionId, 'GET', '/companyinfo/' + connection.realm_id);
    
    return {
      success: true,
      companyName: response.CompanyInfo.CompanyName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}



