import type { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

function getPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || (req.headers?.['x-property-id'] as string) || undefined;
}

export async function createExpense(req: Request, res: Response) {
  try {
    const propertyId = getPropertyId(req);
    const tenantId = req.user?.tenantId;

    if (!propertyId || !tenantId) {
      return res.status(400).json({ success: false, error: 'Property ID and Tenant ID context are required' });
    }

    const { category, amount, description, isRecurring, expenseDate, moduleId } = req.body ?? {};

    if (!category || amount == null || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Category and positive amount are required' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        module_id: moduleId ?? null,
        category: String(category).toLowerCase(),
        amount: Number(amount),
        description: description ? String(description) : null,
        is_recurring: Boolean(isRecurring),
        expense_date: expenseDate ? String(expenseDate) : new Date().toISOString().slice(0, 10),
        created_by: req.user?.userId ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    logger.error('[Finance] Create expense failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create expense' });
  }
}

export async function getExpenses(req: Request, res: Response) {
  try {
    const propertyId = getPropertyId(req);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const { startDate, endDate, category } = req.query;
    const supabase = getSupabase();

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('property_id', propertyId)
      .order('expense_date', { ascending: false });

    if (startDate) query = query.gte('expense_date', String(startDate));
    if (endDate) query = query.lte('expense_date', String(endDate));
    if (category) query = query.eq('category', String(category).toLowerCase());

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    logger.error('[Finance] Get expenses failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch expenses' });
  }
}

export async function deleteExpense(req: Request, res: Response) {
  try {
    const propertyId = getPropertyId(req);
    const { id } = req.params;

    const supabase = getSupabase();
    let query = supabase.from('expenses').delete().eq('id', id);
    if (propertyId) query = query.eq('property_id', propertyId);

    const { error } = await query;
    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Finance] Delete expense failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete expense' });
  }
}

export async function getDirectionalProfit(req: Request, res: Response) {
  try {
    const propertyId = getPropertyId(req);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const startDate = (req.query.startDate as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

    const supabase = getSupabase();

    const [transactionsResult, expensesResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, status, created_at')
        .eq('property_id', propertyId)
        .neq('status', 'cancelled')
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`),

      supabase
        .from('expenses')
        .select('amount, category, expense_date')
        .eq('property_id', propertyId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate),
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (expensesResult.error) throw expensesResult.error;

    const transactions = transactionsResult.data ?? [];
    const expenses = expensesResult.data ?? [];

    const totalRevenue = Number(transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2));
    const totalExpenses = Number(expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2));
    const directionalProfit = Number((totalRevenue - totalExpenses).toFixed(2));

    const expensesByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      const cat = exp.category || 'other';
      expensesByCategory[cat] = Number(((expensesByCategory[cat] ?? 0) + Number(exp.amount || 0)).toFixed(2));
    }

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        totalRevenue,
        totalExpenses,
        directionalProfit,
        expensesByCategory,
      },
    });
  } catch (error: any) {
    logger.error('[Finance] Get directional profit failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to calculate directional profit' });
  }
}
