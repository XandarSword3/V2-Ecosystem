import { getSupabase } from '../../database/connection.js';

// Lazy-initialized Supabase client - use proxy to defer getSupabase() call
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) { return getSupabase()[prop as keyof ReturnType<typeof getSupabase>]; }
});

// Types
export interface CashDrawer {
  id: string;
  device_id: string;
  opened_by_user_id: string;
  opened_at: string;
  closed_at?: string;
  starting_balance: number;
  current_balance: number;
  ending_balance?: number;
  discrepancy?: number;
  status: 'open' | 'closed';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CashTransaction {
  id: string;
  drawer_id: string;
  user_id: string;
  type: 'sale' | 'refund' | 'pay_in' | 'pay_out';
  amount: number;
  reason_code?: string;
  order_id?: string;
  created_at?: string;
}

export interface OpenDrawerInput {
  deviceId: string;
  userId: string;
  amount: number;
  notes?: string;
}

export interface CloseDrawerInput {
  drawerId: string;
  actualBalance: number;
  notes?: string;
}

export interface RecordTransactionInput {
  drawerId: string;
  userId: string;
  type: 'sale' | 'refund' | 'pay_in' | 'pay_out';
  amount: number;
  reason?: string;
  orderId?: string;
}

export interface GetDrawersOptions {
  status?: 'open' | 'closed';
  deviceId?: string;
  userId?: string;
  limit?: number;
}

export interface GetTransactionsOptions {
  type?: 'sale' | 'refund' | 'pay_in' | 'pay_out';
  limit?: number;
}

// ==================== DRAWER MANAGEMENT ====================

/**
 * Open a new cash drawer
 */
export async function openDrawer(input: OpenDrawerInput): Promise<CashDrawer> {
  const { deviceId, userId, amount, notes } = input;

  // Check if there's already an open drawer for this device
  const { data: existingDrawer } = await supabase
    .from('cash_drawers')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'open')
    .maybeSingle();

  if (existingDrawer) {
    throw new Error('An open drawer already exists for this device');
  }

  const { data: drawer, error } = await supabase
    .from('cash_drawers')
    .insert({
      device_id: deviceId,
      opened_by_user_id: userId,
      opened_at: new Date().toISOString(),
      starting_balance: amount,
      current_balance: amount,
      status: 'open',
      notes
    })
    .select()
    .single();

  if (error) throw error;
  return drawer;
}

/**
 * Close a cash drawer with Z-report
 */
export async function closeDrawer(input: CloseDrawerInput): Promise<CashDrawer> {
  const { drawerId, actualBalance, notes } = input;

  // Get current drawer
  const { data: drawer, error: fetchError } = await supabase
    .from('cash_drawers')
    .select('*')
    .eq('id', drawerId)
    .single();

  if (fetchError || !drawer) {
    throw new Error('Drawer not found');
  }

  if (drawer.status === 'closed') {
    throw new Error('Drawer is already closed');
  }

  // Calculate discrepancy
  const expected = drawer.current_balance;
  const discrepancy = Number(actualBalance) - Number(expected);

  const updatedNotes = notes 
    ? `${drawer.notes || ''}\nClosing Note: ${notes}`.trim()
    : drawer.notes;

  const { data: updated, error } = await supabase
    .from('cash_drawers')
    .update({
      closed_at: new Date().toISOString(),
      ending_balance: actualBalance,
      discrepancy: discrepancy,
      status: 'closed',
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', drawerId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Get a single drawer by ID
 */
export async function getDrawer(drawerId: string): Promise<CashDrawer | null> {
  const { data, error } = await supabase
    .from('cash_drawers')
    .select('*')
    .eq('id', drawerId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get all drawers with optional filters
 */
export async function getDrawers(options: GetDrawersOptions = {}): Promise<CashDrawer[]> {
  const { status, deviceId, userId, limit } = options;

  let query = supabase
    .from('cash_drawers')
    .select('*')
    .order('opened_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  if (userId) {
    query = query.eq('opened_by_user_id', userId);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get open drawer for a device
 */
export async function getOpenDrawerForDevice(deviceId: string): Promise<CashDrawer | null> {
  const { data, error } = await supabase
    .from('cash_drawers')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'open')
    .maybeSingle();

  if (error) return null;
  return data;
}

// ==================== TRANSACTION MANAGEMENT ====================

/**
 * Record a cash transaction
 */
export async function recordTransaction(input: RecordTransactionInput): Promise<CashTransaction> {
  const { drawerId, userId, type, amount, reason, orderId } = input;

  // Verify drawer exists and is open
  const drawer = await getDrawer(drawerId);
  if (!drawer) {
    throw new Error('Drawer not found');
  }
  if (drawer.status !== 'open') {
    throw new Error('Drawer is not open');
  }

  // Insert transaction
  const { data: transaction, error: txError } = await supabase
    .from('cash_transactions')
    .insert({
      drawer_id: drawerId,
      user_id: userId,
      type,
      amount,
      reason_code: reason,
      order_id: orderId
    })
    .select()
    .single();

  if (txError) throw txError;

  // Update drawer balance
  // Sale/PayIn adds, Refund/PayOut subtracts
  const signedAmount = (['refund', 'pay_out'].includes(type)) 
    ? -Math.abs(amount) 
    : Math.abs(amount);

  const newBalance = Number(drawer.current_balance) + signedAmount;

  const { error: updateError } = await supabase
    .from('cash_drawers')
    .update({
      current_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', drawerId);

  if (updateError) throw updateError;

  return transaction;
}

/**
 * Get transactions for a drawer
 */
export async function getTransactions(
  drawerId: string, 
  options: GetTransactionsOptions = {}
): Promise<CashTransaction[]> {
  const { type, limit } = options;

  let query = supabase
    .from('cash_transactions')
    .select('*')
    .eq('drawer_id', drawerId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get transaction by ID
 */
export async function getTransaction(transactionId: string): Promise<CashTransaction | null> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (error) return null;
  return data;
}

// ==================== REPORTING ====================

/**
 * Get drawer summary (Z-Report data)
 */
export async function getDrawerSummary(drawerId: string): Promise<{
  drawer: CashDrawer;
  transactions: CashTransaction[];
  summary: {
    totalSales: number;
    totalRefunds: number;
    totalPayIns: number;
    totalPayOuts: number;
    netCashFlow: number;
    transactionCount: number;
  };
} | null> {
  const drawer = await getDrawer(drawerId);
  if (!drawer) return null;

  const transactions = await getTransactions(drawerId);

  const summary = {
    totalSales: 0,
    totalRefunds: 0,
    totalPayIns: 0,
    totalPayOuts: 0,
    netCashFlow: 0,
    transactionCount: transactions.length
  };

  for (const tx of transactions) {
    switch (tx.type) {
      case 'sale':
        summary.totalSales += Number(tx.amount);
        break;
      case 'refund':
        summary.totalRefunds += Number(tx.amount);
        break;
      case 'pay_in':
        summary.totalPayIns += Number(tx.amount);
        break;
      case 'pay_out':
        summary.totalPayOuts += Number(tx.amount);
        break;
    }
  }

  summary.netCashFlow = summary.totalSales + summary.totalPayIns - summary.totalRefunds - summary.totalPayOuts;

  return { drawer, transactions, summary };
}

/**
 * Get daily drawer report
 */
export async function getDailyReport(date: string): Promise<{
  date: string;
  drawers: CashDrawer[];
  totalStartingBalance: number;
  totalEndingBalance: number;
  totalDiscrepancy: number;
  drawerCount: number;
}> {
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const { data: drawers, error } = await supabase
    .from('cash_drawers')
    .select('*')
    .gte('opened_at', startOfDay)
    .lte('opened_at', endOfDay)
    .order('opened_at', { ascending: true });

  if (error) throw error;

  const result = {
    date,
    drawers: drawers || [],
    totalStartingBalance: 0,
    totalEndingBalance: 0,
    totalDiscrepancy: 0,
    drawerCount: drawers?.length || 0
  };

  for (const drawer of (drawers || [])) {
    result.totalStartingBalance += Number(drawer.starting_balance || 0);
    result.totalEndingBalance += Number(drawer.ending_balance || drawer.current_balance || 0);
    result.totalDiscrepancy += Number(drawer.discrepancy || 0);
  }

  return result;
}

/**
 * Void a transaction (only for open drawers)
 */
export async function voidTransaction(
  transactionId: string
): Promise<{ success: boolean; message: string }> {
  const transaction = await getTransaction(transactionId);
  if (!transaction) {
    return { success: false, message: 'Transaction not found' };
  }

  const drawer = await getDrawer(transaction.drawer_id);
  if (!drawer || drawer.status !== 'open') {
    return { success: false, message: 'Cannot void transaction on a closed drawer' };
  }

  // Calculate reversal amount
  const reversalAmount = (['refund', 'pay_out'].includes(transaction.type))
    ? Math.abs(transaction.amount)
    : -Math.abs(transaction.amount);

  // Delete transaction
  const { error: deleteError } = await supabase
    .from('cash_transactions')
    .delete()
    .eq('id', transactionId);

  if (deleteError) throw deleteError;

  // Update drawer balance
  const newBalance = Number(drawer.current_balance) + reversalAmount;
  
  const { error: updateError } = await supabase
    .from('cash_drawers')
    .update({
      current_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', transaction.drawer_id);

  if (updateError) throw updateError;

  return { success: true, message: 'Transaction voided successfully' };
}
