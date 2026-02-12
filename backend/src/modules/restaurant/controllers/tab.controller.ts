import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../../utils/logger.js';
import { emitToUnit } from '../../../socket/index.js';
import { taxService } from '../../../services/tax.service.js';

// Validation schemas
const openTabSchema = z.object({
  tableId: z.string().uuid(),
  customerName: z.string().optional(),
  customerId: z.string().uuid().optional(),
  guestCount: z.number().int().min(1).default(1),
  notes: z.string().optional(),
});

const addToTabSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
  })),
});

const splitBillSchema = z.object({
  splitType: z.enum(['equal', 'by_item', 'by_amount', 'by_seat']),
  splits: z.array(z.object({
    amount: z.number().optional(),
    items: z.array(z.string().uuid()).optional(),
    seats: z.array(z.number()).optional(),
    payerName: z.string().optional(),
  })),
});

const mergeBillsSchema = z.object({
  sourceTabIds: z.array(z.string().uuid()),
  targetTabId: z.string().uuid(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['cash', 'card', 'gift_card', 'loyalty', 'split']),
  tip: z.number().min(0).default(0),
  giftCardCode: z.string().optional(),
  loyaltyPoints: z.number().int().optional(),
});

export class TabController {
  /**
   * Open a new tab for a table
   */
  openTab = asyncHandler(async (req: Request, res: Response) => {
      const validation = openTabSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const data = validation.data;
      const waiterId = req.user?.userId;
      const supabase = getSupabase();

      // Check if table already has an open tab
      const { data: existingTab } = await supabase
        .from('restaurant_tabs')
        .select('id')
        .eq('table_id', data.tableId)
        .eq('status', 'open')
        .single();

      if (existingTab) {
        return res.status(400).json({ 
          success: false, 
          error: 'Table already has an open tab',
          existingTabId: existingTab.id 
        });
      }

      // Get table info for naming
      const { data: table } = await supabase
        .from('restaurant_tables')
        .select('number, name')
        .eq('id', data.tableId)
        .single();

      const tabName = data.customerName 
        ? `Table ${table?.number} - ${data.customerName}`
        : `Table ${table?.number}`;

      // Create the tab
      const { data: tab, error } = await supabase
        .from('restaurant_tabs')
        .insert({
          table_id: data.tableId,
          customer_id: data.customerId,
          waiter_id: waiterId,
          name: tabName,
          guest_count: data.guestCount,
          notes: data.notes,
          status: 'open',
          auto_close_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hour default
        })
        .select()
        .single();

      if (error) throw error;

      // Update table status
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', data.tableId);

      // Emit event
      emitToUnit('restaurant', 'tab:opened', { tabId: tab.id, tableId: data.tableId });

      res.status(201).json({ success: true, data: tab });
  });
  /**
   * Get all open tabs
   */
  getOpenTabs = asyncHandler(async (req: Request, res: Response) => {
      const supabase = getSupabase();

      const { data: tabs, error } = await supabase
        .from('restaurant_tabs')
        .select(`
          *,
          table:restaurant_tables(id, number, name),
          waiter:users!waiter_id(id, full_name),
          orders:restaurant_orders(id, order_number, total_amount, status)
        `)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (error) throw error;

      // Calculate running total for each tab
      const enrichedTabs = (tabs || []).map(tab => {
        const runningTotal = (tab.orders || [])
          .filter((o: any) => o.status !== 'cancelled')
          .reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || '0'), 0);

        return {
          ...tab,
          running_total: runningTotal,
          orders_count: (tab.orders || []).length,
        };
      });

      res.json({ success: true, data: enrichedTabs });
  });
  /**
   * Get tab details with all orders
   */
  getTabDetails = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const supabase = getSupabase();

      const { data: tab, error } = await supabase
        .from('restaurant_tabs')
        .select(`
          *,
          table:restaurant_tables(id, number, name, capacity),
          waiter:users!waiter_id(id, full_name),
          customer:users!customer_id(id, full_name, email)
        `)
        .eq('id', id)
        .single();

      if (error || !tab) {
        return res.status(404).json({ success: false, error: 'Tab not found' });
      }

      // Get all orders for this tab
      const { data: orders } = await supabase
        .from('restaurant_orders')
        .select(`
          *,
          items:restaurant_order_items(
            id, quantity, unit_price, subtotal, notes,
            menu_item:menu_items(id, name, name_ar)
          )
        `)
        .eq('tab_id', id)
        .order('created_at', { ascending: true });

      // Get payment splits
      const { data: payments } = await supabase
        .from('order_payment_splits')
        .select('*')
        .in('order_id', (orders || []).map(o => o.id));

      // Calculate totals
      const subtotal = (orders || [])
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + parseFloat(o.subtotal || '0'), 0);

      const totalTax = (orders || [])
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + parseFloat(o.tax_amount || '0'), 0);

      const totalDiscount = (orders || [])
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + parseFloat(o.discount_amount || '0'), 0);

      const totalPaid = (payments || [])
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

      res.json({
        success: true,
        data: {
          ...tab,
          orders,
          payments,
          summary: {
            subtotal,
            tax: totalTax,
            discount: totalDiscount,
            total: subtotal + totalTax - totalDiscount,
            paid: totalPaid,
            balance_due: subtotal + totalTax - totalDiscount - totalPaid,
          },
        },
      });
  });
  /**
   * Add items to tab (creates an order linked to tab)
   */
  addToTab = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const validation = addToTabSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const { items } = validation.data;
      const waiterId = req.user?.userId;
      const supabase = getSupabase();

      // Get tab
      const { data: tab, error: tabError } = await supabase
        .from('restaurant_tabs')
        .select('*, table:restaurant_tables(number)')
        .eq('id', id)
        .single();

      if (tabError || !tab) {
        return res.status(404).json({ success: false, error: 'Tab not found' });
      }

      if (tab.status !== 'open') {
        return res.status(400).json({ success: false, error: 'Tab is not open' });
      }

      // Get menu items for pricing
      const itemIds = items.map(i => i.menuItemId);
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('*')
        .in('id', itemIds);

      const itemMap = new Map((menuItems || []).map(i => [i.id, i]));

      // Calculate totals
      let subtotal = 0;
      const orderItems = items.map(item => {
        const menuItem = itemMap.get(item.menuItemId);
        if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
        
        // FIX Iter-1: Use discount_price when available
        const unitPrice = menuItem.discount_price != null && parseFloat(menuItem.discount_price) > 0
          ? parseFloat(menuItem.discount_price)
          : parseFloat(menuItem.price);
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;

        return {
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          unit_price: unitPrice,
          subtotal: itemSubtotal,
          notes: item.notes,
        };
      });

      const taxRate = await taxService.getTaxRate('restaurant');
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      // Generate order number
      const orderNumber = `T${tab.table?.number || '0'}-${Date.now().toString(36).toUpperCase()}`;

      // Create order linked to tab
      const { data: order, error: orderError } = await supabase
        .from('restaurant_orders')
        .insert({
          tab_id: id,
          table_id: tab.table_id,
          waiter_id: waiterId,
          customer_id: tab.customer_id,
          customer_name: tab.name,
          order_number: orderNumber,
          order_type: 'dine_in',
          status: 'pending',
          subtotal: subtotal.toFixed(2),
          tax_amount: taxAmount.toFixed(2),
          total_amount: totalAmount.toFixed(2),
          payment_status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      await supabase
        .from('restaurant_order_items')
        .insert(orderItems.map(item => ({
          order_id: order.id,
          ...item,
          unit_price: item.unit_price.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
        })));

      // Emit events
      emitToUnit('restaurant', 'tab:updated', { tabId: id });
      emitToUnit('restaurant', 'order:new', { orderId: order.id, orderNumber });

      res.status(201).json({ success: true, data: order });
  });
  /**
   * Split the bill
   */
  splitBill = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const validation = splitBillSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const { splitType, splits } = validation.data;
      const supabase = getSupabase();

      // Get tab with orders
      const { data: tab, error: tabError } = await supabase
        .from('restaurant_tabs')
        .select('*')
        .eq('id', id)
        .single();

      if (tabError || !tab) {
        return res.status(404).json({ success: false, error: 'Tab not found' });
      }

      // Get all orders for this tab
      const { data: orders } = await supabase
        .from('restaurant_orders')
        .select('*, items:restaurant_order_items(*)')
        .eq('tab_id', id)
        .neq('status', 'cancelled');

      const totalAmount = (orders || [])
        .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

      // FIX: Iteration 19 - Fetch actual tax rate for by_item splits (was hardcoded 1.11)
      const taxRate = await taxService.getTaxRate('restaurant');

      // Create payment splits
      const paymentSplits = splits.map((split, index) => {
        let amount = 0;

        if (splitType === 'equal') {
          amount = totalAmount / splits.length;
        } else if (splitType === 'by_amount') {
          amount = split.amount || 0;
        } else if (splitType === 'by_item' && split.items) {
          // Calculate based on selected items
          const allItems = (orders || []).flatMap(o => o.items || []);
          amount = allItems
            .filter(item => split.items!.includes(item.id))
            .reduce((sum, item) => sum + parseFloat(item.subtotal || '0'), 0);
          // FIX: Iteration 19 - Use dynamic tax rate instead of hardcoded 11%
          amount *= (1 + taxRate);
        } else if (splitType === 'by_seat') {
          // FIX: Iteration 19 - Add missing by_seat handler (was producing $0 splits)
          amount = totalAmount / splits.length;
        }

        return {
          order_id: orders?.[0]?.id, // Link to first order (could be improved)
          amount: amount.toFixed(2),
          payment_method: 'pending',
          status: 'pending',
          payer_name: split.payerName || `Split ${index + 1}`,
          payer_seat: split.seats?.[0],
        };
      });

      const { data: createdSplits, error: splitError } = await supabase
        .from('order_payment_splits')
        .insert(paymentSplits)
        .select();

      if (splitError) throw splitError;

      res.json({
        success: true,
        data: {
          splits: createdSplits,
          total_amount: totalAmount,
          split_count: splits.length,
        },
      });
  });
  /**
   * Merge multiple tabs into one
   */
  mergeTabs = asyncHandler(async (req: Request, res: Response) => {
      const validation = mergeBillsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const { sourceTabIds, targetTabId } = validation.data;
      const supabase = getSupabase();

      // Verify target tab exists and is open
      const { data: targetTab, error: targetError } = await supabase
        .from('restaurant_tabs')
        .select('*')
        .eq('id', targetTabId)
        .eq('status', 'open')
        .single();

      if (targetError || !targetTab) {
        return res.status(400).json({ success: false, error: 'Target tab not found or not open' });
      }

      // Move all orders from source tabs to target
      for (const sourceTabId of sourceTabIds) {
        await supabase
          .from('restaurant_orders')
          .update({ tab_id: targetTabId })
          .eq('tab_id', sourceTabId);

        // Mark source tab as merged
        await supabase
          .from('restaurant_tabs')
          .update({ status: 'merged', closed_at: new Date().toISOString() })
          .eq('id', sourceTabId);

        // Free up the source tables
        const { data: sourceTab } = await supabase
          .from('restaurant_tabs')
          .select('table_id')
          .eq('id', sourceTabId)
          .single();

        if (sourceTab?.table_id) {
          await supabase
            .from('restaurant_tables')
            .update({ status: 'available' })
            .eq('id', sourceTab.table_id);
        }
      }

      // Emit events
      emitToUnit('restaurant', 'tabs:merged', { targetTabId, sourceTabIds });

      res.json({ success: true, message: 'Tabs merged successfully' });
  });
  /**
   * Process payment for tab
   */
  processPayment = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const validation = paymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: validation.error.errors });
      }

      const { amount, method, tip, giftCardCode, loyaltyPoints } = validation.data;
      const processedBy = req.user?.userId;
      const supabase = getSupabase();

      // Get tab
      const { data: tab, error: tabError } = await supabase
        .from('restaurant_tabs')
        .select('*')
        .eq('id', id)
        .single();

      if (tabError || !tab) {
        return res.status(404).json({ success: false, error: 'Tab not found' });
      }

      // Get orders to link payment
      const { data: orders } = await supabase
        .from('restaurant_orders')
        .select('id, total_amount')
        .eq('tab_id', id)
        .neq('status', 'cancelled');

      if (!orders || orders.length === 0) {
        return res.status(400).json({ success: false, error: 'No orders on this tab' });
      }

      // FIX: Iteration 10 - Gift card payments must deduct the gift card balance
      let actualPaymentAmount = amount;
      if (method === 'gift_card' && giftCardCode) {
        try {
          const { data: gcResult, error: gcError } = await supabase.rpc(
            'redeem_giftcard_atomic',
            {
              p_code: giftCardCode.toUpperCase(),
              p_amount: amount,
              p_order_id: orders[0].id,
            }
          );

          if (gcError || !gcResult || !gcResult[0]?.success) {
            return res.status(400).json({
              success: false,
              error: gcError?.message || 'Gift card redemption failed — invalid code or insufficient balance',
            });
          }

          actualPaymentAmount = parseFloat(gcResult[0].amount_redeemed) || amount;
        } catch (gcErr: any) {
          return res.status(400).json({ success: false, error: 'Gift card processing error: ' + gcErr.message });
        }
      }

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('order_payment_splits')
        .insert({
          order_id: orders[0].id,
          amount: actualPaymentAmount.toFixed(2),
          payment_method: method,
          status: 'completed',
          processed_at: new Date().toISOString(),
          processed_by: processedBy,
          loyalty_points_used: loyaltyPoints || 0,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Check if tab is fully paid
      const { data: allPayments } = await supabase
        .from('order_payment_splits')
        .select('amount')
        .in('order_id', orders.map(o => o.id))
        .eq('status', 'completed');

      const totalPaid = (allPayments || [])
        .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

      const totalDue = orders
        .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

      if (totalPaid >= totalDue) {
        // Close the tab
        await supabase
          .from('restaurant_tabs')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', id);

        // Update all orders to paid
        await supabase
          .from('restaurant_orders')
          .update({ payment_status: 'paid', status: 'completed' })
          .eq('tab_id', id);

        // Free the table
        await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', tab.table_id);

        emitToUnit('restaurant', 'tab:closed', { tabId: id });
      }

      res.json({
        success: true,
        data: {
          payment,
          tab_status: totalPaid >= totalDue ? 'closed' : 'open',
          total_paid: totalPaid,
          total_due: totalDue,
          balance: totalDue - totalPaid,
        },
      });
  });
  /**
   * Transfer tab to another waiter
   */
  transferTab = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { newWaiterId } = req.body;
      const supabase = getSupabase();

      const { data: tab, error } = await supabase
        .from('restaurant_tabs')
        .update({ waiter_id: newWaiterId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'open')
        .select()
        .single();

      if (error || !tab) {
        return res.status(404).json({ success: false, error: 'Tab not found or not open' });
      }

      emitToUnit('restaurant', 'tab:transferred', { tabId: id, newWaiterId });

      res.json({ success: true, data: tab });
  });
  /**
   * Close of day reconciliation
   */
  startReconciliation = asyncHandler(async (req: Request, res: Response) => {
      const { cashOpening } = req.body;
      const userId = req.user?.userId;
      const supabase = getSupabase();
      const today = new Date().toISOString().split('T')[0];

      // Check for existing open reconciliation
      const { data: existing } = await supabase
        .from('pos_reconciliation')
        .select('id')
        .eq('shift_date', today)
        .eq('status', 'open')
        .single();

      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: 'Reconciliation already open for today',
          existingId: existing.id 
        });
      }

      const { data: reconciliation, error } = await supabase
        .from('pos_reconciliation')
        .insert({
          shift_date: today,
          opened_by: userId,
          cash_opening: cashOpening || 0,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: reconciliation });
  });
  /**
   * Complete reconciliation
   */
  completeReconciliation = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const { cashClosing, notes, varianceExplanation } = req.body;
      const userId = req.user?.userId;
      const supabase = getSupabase();

      // Get reconciliation
      const { data: recon, error: reconError } = await supabase
        .from('pos_reconciliation')
        .select('*')
        .eq('id', id)
        .single();

      if (reconError || !recon) {
        return res.status(404).json({ success: false, error: 'Reconciliation not found' });
      }

      // Calculate expected values from orders
      const { data: orders } = await supabase
        .from('restaurant_orders')
        .select('total_amount, payment_method, discount_amount, status')
        .eq('status', 'completed')
        .gte('created_at', `${recon.shift_date}T00:00:00`)
        .lte('created_at', `${recon.shift_date}T23:59:59`);

      const totalSales = (orders || [])
        .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

      const totalCash = (orders || [])
        .filter(o => o.payment_method === 'cash')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

      const totalCard = (orders || [])
        .filter(o => o.payment_method === 'card')
        .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

      const totalDiscounts = (orders || [])
        .reduce((sum, o) => sum + parseFloat(o.discount_amount || '0'), 0);

      const expectedCash = parseFloat(recon.cash_opening) + totalCash;
      const cashVariance = cashClosing - expectedCash;

      // Update reconciliation
      const { data: updated, error: updateError } = await supabase
        .from('pos_reconciliation')
        .update({
          closed_by: userId,
          cash_closing: cashClosing,
          cash_expected: expectedCash,
          cash_variance: cashVariance,
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard,
          total_discounts: totalDiscounts,
          orders_count: (orders || []).length,
          status: Math.abs(cashVariance) > 10 ? 'pending_review' : 'closed',
          notes,
          variance_explanation: varianceExplanation,
          closed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Trigger daily aggregation
      await supabase.rpc('aggregate_daily_sales', { p_date: recon.shift_date });

      res.json({ success: true, data: updated });
  });
  /**
   * Get reconciliation report
   */
  getReconciliationReport = asyncHandler(async (req: Request, res: Response) => {
      const { date } = req.query;
      const supabase = getSupabase();

      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data: recon, error } = await supabase
        .from('pos_reconciliation')
        .select('*')
        .eq('shift_date', targetDate)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Get open tabs
      const { data: openTabs } = await supabase
        .from('restaurant_tabs')
        .select('id, name, opened_at')
        .eq('status', 'open');

      // Get void/cancelled orders
      const { data: voidOrders } = await supabase
        .from('restaurant_orders')
        .select('id, order_number, total_amount, cancelled_at')
        .eq('status', 'cancelled')
        .gte('created_at', `${targetDate}T00:00:00`)
        .lte('created_at', `${targetDate}T23:59:59`);

      res.json({
        success: true,
        data: {
          reconciliation: recon,
          open_tabs_count: (openTabs || []).length,
          open_tabs: openTabs,
          void_orders_count: (voidOrders || []).length,
          void_orders: voidOrders,
        },
      });
  });
}

export const tabController = new TabController();


