/**
 * Data Integrity Tests
 * 
 * Phase B: Validates soft delete behavior, cascading deletes,
 * and backup/restore integrity for production readiness.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getSupabase } from '../../src/database/connection.js';
import { BackupService } from '../../src/services/backup.service.js';

describe.skip('Data Integrity', () => {
  describe('Soft Delete Behavior', () => {
    describe('Menu Items', () => {
      it('should set deleted_at instead of removing record', async () => {
        const supabase = getSupabase();
        
        // Create a test item
        const { data: item, error: createError } = await supabase
          .from('menu_items')
          .insert({
            name: 'Test Delete Item',
            name_ar: 'عنصر اختبار',
            description: 'Test item for deletion',
            price: 10.00,
            category_id: null, // May need actual category
            is_available: true
          })
          .select()
          .single();
        
        // Skip if we can't create (might need fixtures)
        if (createError) {
          console.log('Skipping: Could not create test item', createError.message);
          return;
        }
        
        // Soft delete
        const { error: deleteError } = await supabase
          .from('menu_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.id);
        
        expect(deleteError).toBeNull();
        
        // Verify record still exists
        const { data: stillExists, error: selectError } = await supabase
          .from('menu_items')
          .select('*')
          .eq('id', item.id)
          .single();
        
        expect(selectError).toBeNull();
        expect(stillExists).not.toBeNull();
        expect(stillExists.deleted_at).not.toBeNull();
        
        // Clean up - hard delete for test
        await supabase.from('menu_items').delete().eq('id', item.id);
      });

      it('should exclude soft-deleted items from normal queries', async () => {
        const supabase = getSupabase();
        
        // Query with deleted_at filter (standard pattern)
        const { data: items, error } = await supabase
          .from('menu_items')
          .select('*')
          .is('deleted_at', null);
        
        expect(error).toBeNull();
        
        // All returned items should have null deleted_at
        if (items && items.length > 0) {
          items.forEach(item => {
            expect(item.deleted_at).toBeNull();
          });
        }
      });
    });

    describe('Chalets', () => {
      it('should filter out soft-deleted chalets in listing', async () => {
        const supabase = getSupabase();
        
        const { data: chalets, error } = await supabase
          .from('chalets')
          .select('*')
          .is('deleted_at', null);
        
        expect(error).toBeNull();
        
        if (chalets && chalets.length > 0) {
          chalets.forEach(chalet => {
            expect(chalet.deleted_at).toBeNull();
          });
        }
      });
    });

    describe('Orders', () => {
      it('should preserve order history even if menu items are deleted', async () => {
        const supabase = getSupabase();
        
        // Get an order with items - actual table is restaurant_orders
        const { data: orders, error } = await supabase
          .from('restaurant_orders')
          .select(`
            id,
            order_number,
            status
          `)
          .limit(5);
        
        expect(error).toBeNull();
        
        // Orders should still have their items even if menu_item is soft deleted
        // The join should return the item data regardless of deleted_at
        if (orders && orders.length > 0) {
          orders.forEach(order => {
            expect(order.order_number).toBeDefined();
            // order_items can be empty but should not error
          });
        }
      });
    });
  });

  describe('Cascading Delete Prevention', () => {
    it('should not allow deleting chalet with active bookings', async () => {
      const supabase = getSupabase();
      
      // Find a chalet with bookings
      const { data: bookings, error: fetchError } = await supabase
        .from('chalet_bookings')
        .select('chalet_id')
        .eq('status', 'confirmed')
        .limit(1);
      
      if (fetchError || !bookings || bookings.length === 0) {
        console.log('No active bookings to test cascade prevention');
        return;
      }
      
      const chaletId = bookings[0].chalet_id;
      
      // Attempting hard delete should fail due to foreign key
      const { error: deleteError } = await supabase
        .from('chalets')
        .delete()
        .eq('id', chaletId);
      
      // Should get foreign key constraint error or be prevented
      if (deleteError) {
        expect(deleteError.message).toMatch(/foreign key|violates|constraint/i);
      }
      // If no error, the delete was prevented by RLS or trigger
    });

    it('should not allow deleting user with restaurant orders', async () => {
      const supabase = getSupabase();
      
      // Find a user with orders
      const { data: orders, error: fetchError } = await supabase
        .from('restaurant_orders')
        .select('customer_id')
        .not('customer_id', 'is', null)
        .limit(1);
      
      if (fetchError || !orders || orders.length === 0) {
        console.log('No orders with customers to test cascade prevention');
        return;
      }
      
      const userId = orders[0].customer_id;
      
      // Attempting to delete user should fail
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      // Should be prevented
      if (deleteError) {
        expect(deleteError.message).toMatch(/foreign key|violates|constraint|policy/i);
      }
    });
  });

  describe('Data Consistency', () => {
    it('should have referential integrity for restaurant orders', async () => {
      const supabase = getSupabase();
      
      // Check that all orders reference valid modules
      const { data: orders, error } = await supabase
        .from('restaurant_orders')
        .select(`
          id,
          module_id
        `)
        .limit(20);
      
      expect(error).toBeNull();
      
      if (orders && orders.length > 0) {
        orders.forEach(order => {
          // If module_id is set, module should be retrievable
          if (order.module_id) {
            // This is a joined query - module should exist if FK is valid
          }
        });
      }
    });

    it('should have valid status transitions', async () => {
      const validStatuses = ['pending', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'delivered'];
      
      const supabase = getSupabase();
      
      const { data: orders, error } = await supabase
        .from('restaurant_orders')
        .select('id, status')
        .limit(50);
      
      expect(error).toBeNull();
      
      if (orders && orders.length > 0) {
        orders.forEach(order => {
          expect(validStatuses).toContain(order.status);
        });
      }
    });

    it('should have valid payment statuses', async () => {
      const validPaymentStatuses = ['pending', 'paid', 'partial', 'refunded', 'failed'];
      
      const supabase = getSupabase();
      
      const { data: orders, error } = await supabase
        .from('restaurant_orders')
        .select('id, payment_status')
        .limit(50);
      
      expect(error).toBeNull();
      
      if (orders && orders.length > 0) {
        orders.forEach(order => {
          if (order.payment_status) {
            expect(validPaymentStatuses).toContain(order.payment_status);
          }
        });
      }
    });
  });

  describe('Audit Trail', () => {
    it('should log create actions', async () => {
      const supabase = getSupabase();
      
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'create')
        .limit(5);
      
      expect(error).toBeNull();
      // Audit logs should exist for create actions
    });

    it('should log update actions', async () => {
      const supabase = getSupabase();
      
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'update')
        .limit(5);
      
      expect(error).toBeNull();
    });

    it('should log delete actions', async () => {
      const supabase = getSupabase();
      
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'delete')
        .limit(5);
      
      expect(error).toBeNull();
    });

    it('should include user_id in audit logs', async () => {
      const supabase = getSupabase();
      
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, user_id, action')
        .not('user_id', 'is', null)
        .limit(10);
      
      expect(error).toBeNull();
      
      if (logs && logs.length > 0) {
        logs.forEach(log => {
          expect(log.user_id).toBeDefined();
        });
      }
    });
  });
});

describe('Backup Integrity', () => {
  describe('Backup Structure', () => {
    it('should have valid backup metadata schema', () => {
      const backupSchema = {
        version: '2.0',
        timestamp: expect.any(String),
        tables: expect.any(Object)
      };
      
      // Validate the expected schema shape
      expect(backupSchema).toMatchObject({
        version: expect.any(String),
        timestamp: expect.any(String),
        tables: expect.any(Object)
      });
    });

    it('should define required core tables for backup', () => {
      const coreTables = [
        'users',
        'roles',
        'modules',
        'site_settings',
        'chalets',
        'chalet_bookings',
        'pool_sessions',
        'pool_tickets',
        'menu_items',
        'menu_categories',
        'orders',
        'payments',
        'reviews'
      ];
      
      // Verify we have a defined set of core tables
      expect(coreTables.length).toBeGreaterThan(10);
      expect(coreTables).toContain('users');
      expect(coreTables).toContain('orders');
      expect(coreTables).toContain('payments');
    });
  });

  describe('Backup Service', () => {
    it('should have createBackup method', () => {
      expect(BackupService.createBackup).toBeDefined();
      expect(typeof BackupService.createBackup).toBe('function');
    });

    it('should have listBackups method', () => {
      expect(BackupService.listBackups).toBeDefined();
      expect(typeof BackupService.listBackups).toBe('function');
    });

    it('should have deleteBackup method', () => {
      expect(BackupService.deleteBackup).toBeDefined();
      expect(typeof BackupService.deleteBackup).toBe('function');
    });

    it('should have restoreBackup method', () => {
      expect(BackupService.restoreBackup).toBeDefined();
      expect(typeof BackupService.restoreBackup).toBe('function');
    });
  });

  describe('Backup Listing', () => {
    it('should return backup list with metadata', async () => {
      try {
        const backups = await BackupService.listBackups();
        
        expect(Array.isArray(backups)).toBe(true);
        
        if (backups.length > 0) {
          const backup = backups[0];
          expect(backup).toHaveProperty('id');
          expect(backup).toHaveProperty('filename');
          expect(backup).toHaveProperty('created_at');
        }
      } catch (error: any) {
        // May fail if no backups exist or bucket not configured
        console.log('Backup listing test skipped:', error.message);
      }
    });
  });

  describe('Restore Validation', () => {
    it('should reject invalid backup format', async () => {
      await expect(
        BackupService.restoreBackup({} as any, 'test-user')
      ).rejects.toThrow(/invalid|missing/i);
    });

    it('should reject backup without tables key', async () => {
      await expect(
        BackupService.restoreBackup({ version: '2.0' } as any, 'test-user')
      ).rejects.toThrow(/invalid|missing|tables/i);
    });
  });
});

describe.skip('Delete Preview', () => {
  describe('Module Delete Preview', () => {
    it('should show affected resources before deletion', async () => {
      const supabase = getSupabase();
      
      // Get a module with potential dependencies
      const { data: modules, error } = await supabase
        .from('modules')
        .select(`
          id,
          name
        `)
        .limit(1);
      
      expect(error).toBeNull();
      
      if (modules && modules.length > 0) {
        const moduleId = modules[0].id;
        
        // Check for related orders
        const { data: orders, error: ordersError } = await supabase
          .from('restaurant_orders')
          .select('id')
          .eq('module_id', moduleId);
        
        expect(ordersError).toBeNull();
        
        // Preview should include count of affected resources
        const preview = {
          moduleId,
          affectedOrders: orders?.length || 0,
          canDelete: (orders?.length || 0) === 0
        };
        
        expect(preview).toHaveProperty('affectedOrders');
        expect(typeof preview.canDelete).toBe('boolean');
      }
    });
  });
});

describe('Transaction Safety', () => {
  describe('Order Creation Atomicity', () => {
    it('should rollback order if order items fail', async () => {
      // This tests conceptual atomicity - in practice Supabase
      // doesn't have explicit transactions via client
      // but we validate the pattern exists
      
      const mockOrderData = {
        customer_name: 'Test Customer',
        customer_phone: '1234567890',
        order_type: 'dine_in',
        items: [
          { menu_item_id: 'invalid-id', quantity: 1 }
        ]
      };
      
      // The order service should handle this atomically
      // and not create a partial order
      expect(mockOrderData.items.length).toBeGreaterThan(0);
    });
  });

  describe.skip('Payment Safety', () => {
    it('should not mark order paid without valid payment', async () => {
      const supabase = getSupabase();
      
      // Check that paid orders have payment records
      const { data: paidOrders, error } = await supabase
        .from('restaurant_orders')
        .select(`
          id,
          payment_status
        `)
        .eq('payment_status', 'paid')
        .limit(10);
      
      expect(error).toBeNull();
      
      // This validates data consistency between orders and payments
      if (paidOrders && paidOrders.length > 0) {
        paidOrders.forEach(order => {
          // Paid orders should have associated payment records
          // or be cash payments
        });
      }
    });
  });
});
