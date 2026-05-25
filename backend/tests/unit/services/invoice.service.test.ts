import { createInvoiceService } from '../../../src/services/invoice.service';
import type { InvoiceService } from '../../../src/services/invoice.service';
import { InMemoryInvoiceRepository } from '../../utils/invoice.repository.memory';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let repository: InMemoryInvoiceRepository;
  let mockLogger: any;

  const createContainer = () => {
    repository = new InMemoryInvoiceRepository();
    mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    return { invoiceRepository: repository, logger: mockLogger };
  };

  const validInvoiceInput = {
    guestId: 'guest-123', guestName: 'John Doe', guestEmail: 'john@example.com',
    reservationId: 'res-123', dueDate: '2026-02-15T00:00:00Z',
    notes: 'Room charges', currency: 'USD', createdBy: 'staff-1',
  };

  const validLineItem = {
    description: 'Room Night - Deluxe Suite', quantity: 3, unitPrice: 200, discount: 10, taxRate: 12,
  };

  beforeEach(() => { service = createInvoiceService(createContainer()); });

  describe('createInvoice', () => {
    it('should create an invoice with valid input', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      expect(invoice.id).toBeDefined();
      expect(invoice.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}-\d{5}$/);
      expect(invoice.guestId).toBe('guest-123');
      expect(invoice.guestName).toBe('John Doe');
      expect(invoice.status).toBe('draft');
      expect(invoice.lineItems).toEqual([]);
      expect(invoice.totalAmount).toBe(0);
      expect(invoice.currency).toBe('USD');
      expect(invoice.createdAt).toBeDefined();
    });

    it('should generate unique invoice numbers', async () => {
      const inv1 = await service.createInvoice(validInvoiceInput);
      const inv2 = await service.createInvoice(validInvoiceInput);
      expect(inv1.invoiceNumber).not.toBe(inv2.invoiceNumber);
    });

    it('should default currency to USD', async () => {
      const { currency, ...inputWithoutCurrency } = validInvoiceInput;
      const invoice = await service.createInvoice(inputWithoutCurrency);
      expect(invoice.currency).toBe('USD');
    });

    it('should log invoice creation', async () => {
      await service.createInvoice(validInvoiceInput);
      expect(mockLogger.info).toHaveBeenCalledWith('Invoice created', expect.objectContaining({
        invoiceId: expect.any(String), invoiceNumber: expect.any(String),
      }));
    });
  });

  describe('getInvoice', () => {
    it('should return invoice by id', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      const retrieved = await service.getInvoice(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });
    it('should return null for non-existent invoice', async () => {
      expect(await service.getInvoice('non-existent-id')).toBeNull();
    });
  });

  describe('getInvoiceByNumber', () => {
    it('should return invoice by invoice number', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      const retrieved = await service.getInvoiceByNumber(created.invoiceNumber);
      expect(retrieved?.id).toBe(created.id);
    });
    it('should return null for invalid invoice number', async () => {
      expect(await service.getInvoiceByNumber('INV-INVALID')).toBeNull();
    });
  });

  describe('getInvoices', () => {
    it('should return all invoices', async () => {
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice({ ...validInvoiceInput, guestId: 'guest-456' });
      expect(await service.getInvoices()).toHaveLength(2);
    });
  });

  describe('getInvoicesByGuest', () => {
    it('should return invoices for a guest', async () => {
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice({ ...validInvoiceInput, guestId: 'other-guest' });
      expect(await service.getInvoicesByGuest('guest-123')).toHaveLength(2);
    });
  });

  describe('getInvoicesByStatus', () => {
    it('should return invoices by status', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);
      expect(await service.getInvoicesByStatus('draft')).toHaveLength(0);
      expect(await service.getInvoicesByStatus('sent')).toHaveLength(1);
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice notes and due date', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      const updated = await service.updateInvoice(created.id, { notes: 'Updated notes', dueDate: '2026-03-01T00:00:00Z' });
      expect(updated.notes).toBe('Updated notes');
      expect(updated.dueDate).toBe('2026-03-01T00:00:00Z');
    });
    it('should reject update for non-existent invoice', async () => {
      await expect(service.updateInvoice('non-existent', { notes: 'Test' })).rejects.toThrow('Invoice not found');
    });
    it('should reject update for sent invoice', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);
      await expect(service.updateInvoice(inv.id, { notes: 'Test' })).rejects.toThrow('Cannot edit invoice in current status');
    });
  });

  describe('deleteInvoice', () => {
    it('should delete draft invoice', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      await service.deleteInvoice(created.id);
      expect(await service.getInvoice(created.id)).toBeNull();
    });
    it('should reject delete for non-existent invoice', async () => {
      await expect(service.deleteInvoice('non-existent')).rejects.toThrow('Invoice not found');
    });
    it('should reject delete for non-draft invoice', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);
      await expect(service.deleteInvoice(inv.id)).rejects.toThrow('Only draft invoices can be deleted');
    });
  });

  describe('addLineItem', () => {
    it('should add line item to invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const updated = await service.addLineItem(invoice.id, validLineItem);
      expect(updated.lineItems).toHaveLength(1);
      expect(updated.lineItems[0].description).toBe('Room Night - Deluxe Suite');
      expect(updated.subtotal).toBeGreaterThan(0);
    });
    it('should calculate totals correctly', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const updated = await service.addLineItem(invoice.id, { description: 'Test item', quantity: 2, unitPrice: 100, discount: 0, taxRate: 10 });
      expect(updated.subtotal).toBe(200);
      expect(updated.taxAmount).toBe(20);
      expect(updated.totalAmount).toBe(220);
      expect(updated.balanceDue).toBe(220);
    });
    it('should reject adding item to non-existent invoice', async () => {
      await expect(service.addLineItem('non-existent', validLineItem)).rejects.toThrow('Invoice not found');
    });
    it('should reject quantity less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.addLineItem(invoice.id, { ...validLineItem, quantity: 0 })).rejects.toThrow('Quantity must be greater than 0');
    });
    it('should reject negative unit price', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.addLineItem(invoice.id, { ...validLineItem, unitPrice: -10 })).rejects.toThrow('Unit price cannot be negative');
    });
  });

  describe('removeLineItem', () => {
    it('should remove line item from invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const withItem = await service.addLineItem(invoice.id, validLineItem);
      const lineItemId = withItem.lineItems[0].id;
      const updated = await service.removeLineItem(invoice.id, lineItemId);
      expect(updated.lineItems).toHaveLength(0);
      expect(updated.totalAmount).toBe(0);
    });
    it('should reject removing non-existent line item', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.removeLineItem(invoice.id, 'non-existent')).rejects.toThrow('Line item not found');
    });
  });

  describe('updateLineItem', () => {
    it('should update line item', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const withItem = await service.addLineItem(invoice.id, validLineItem);
      const lineItemId = withItem.lineItems[0].id;
      const updated = await service.updateLineItem(invoice.id, lineItemId, { quantity: 5, description: 'Updated description' });
      expect(updated.lineItems[0].quantity).toBe(5);
      expect(updated.lineItems[0].description).toBe('Updated description');
    });
    it('should reject updating non-existent line item', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.updateLineItem(invoice.id, 'non-existent', { quantity: 5 })).rejects.toThrow('Line item not found');
    });
    it('should reject quantity less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const withItem = await service.addLineItem(invoice.id, validLineItem);
      const lineItemId = withItem.lineItems[0].id;
      await expect(service.updateLineItem(invoice.id, lineItemId, { quantity: 0 })).rejects.toThrow('Quantity must be greater than 0');
    });
  });

  describe('sendInvoice', () => {
    it('should send draft invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      const sent = await service.sendInvoice(invoice.id);
      expect(sent.status).toBe('sent');
    });
    it('should reject sending invoice with no line items', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.sendInvoice(invoice.id)).rejects.toThrow('Cannot send invoice with no line items');
    });
    it('should reject sending already sent invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.sendInvoice(invoice.id);
      await service.markAsPaid(invoice.id);
      await expect(service.sendInvoice(invoice.id)).rejects.toThrow('Can only send draft or pending invoices');
    });
  });

  describe('markAsPaid', () => {
    it('should mark invoice as paid', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      const paid = await service.markAsPaid(invoice.id);
      expect(paid.status).toBe('paid');
      expect(paid.paidAmount).toBe(paid.totalAmount);
      expect(paid.balanceDue).toBe(0);
      expect(paid.paidDate).toBeDefined();
    });
    it('should reject marking cancelled invoice as paid', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.cancelInvoice(invoice.id);
      await expect(service.markAsPaid(invoice.id)).rejects.toThrow('Cannot mark cancelled or refunded invoice as paid');
    });
  });

  describe('cancelInvoice', () => {
    it('should cancel draft invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      expect((await service.cancelInvoice(invoice.id)).status).toBe('cancelled');
    });
    it('should cancel sent invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.sendInvoice(invoice.id);
      expect((await service.cancelInvoice(invoice.id)).status).toBe('cancelled');
    });
    it('should reject cancelling paid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.markAsPaid(invoice.id);
      await expect(service.cancelInvoice(invoice.id)).rejects.toThrow('Cannot cancel invoice in current status');
    });
  });

  describe('refundInvoice', () => {
    it('should refund paid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.markAsPaid(invoice.id);
      expect((await service.refundInvoice(invoice.id)).status).toBe('refunded');
    });
    it('should reject refunding unpaid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await expect(service.refundInvoice(invoice.id)).rejects.toThrow('Can only refund paid invoices');
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update totals', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      const updated = await service.recordPayment({ invoiceId: invoice.id, amount: 50, paymentMethod: 'credit_card', processedBy: 'staff-1' });
      expect(updated.paidAmount).toBe(50);
      expect(updated.balanceDue).toBe(50);
      expect(updated.status).toBe('partial');
    });
    it('should mark as paid when fully paid', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      const updated = await service.recordPayment({ invoiceId: invoice.id, amount: 100, paymentMethod: 'cash', processedBy: 'staff-1' });
      expect(updated.status).toBe('paid');
      expect(updated.balanceDue).toBe(0);
    });
    it('should reject payment on cancelled invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.cancelInvoice(invoice.id);
      await expect(service.recordPayment({ invoiceId: invoice.id, amount: 50, paymentMethod: 'cash', processedBy: 'staff-1' }))
        .rejects.toThrow('Cannot record payment on invoice in current status');
    });
    it('should reject payment amount less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await expect(service.recordPayment({ invoiceId: invoice.id, amount: 0, paymentMethod: 'cash', processedBy: 'staff-1' }))
        .rejects.toThrow('Payment amount must be greater than 0');
    });
    it('should reject overpayment', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      await expect(service.recordPayment({ invoiceId: invoice.id, amount: 150, paymentMethod: 'cash', processedBy: 'staff-1' }))
        .rejects.toThrow('Payment amount exceeds balance due');
    });
  });

  describe('getPayments', () => {
    it('should return all payments for invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      await service.recordPayment({ invoiceId: invoice.id, amount: 30, paymentMethod: 'cash', processedBy: 'staff-1' });
      await service.recordPayment({ invoiceId: invoice.id, amount: 30, paymentMethod: 'credit_card', processedBy: 'staff-1' });
      expect(await service.getPayments(invoice.id)).toHaveLength(2);
    });
  });

  describe('getTotalPaid', () => {
    it('should return total paid amount', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      await service.recordPayment({ invoiceId: invoice.id, amount: 30, paymentMethod: 'cash', processedBy: 'staff-1' });
      await service.recordPayment({ invoiceId: invoice.id, amount: 20, paymentMethod: 'cash', processedBy: 'staff-1' });
      expect(await service.getTotalPaid(invoice.id)).toBe(50);
    });
  });

  describe('getUnpaidTotal', () => {
    it('should return total unpaid amount for guest', async () => {
      const inv1 = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv1.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
      const inv2 = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv2.id, { description: 'Test 2', quantity: 1, unitPrice: 50, discount: 0, taxRate: 0 });
      expect(await service.getUnpaidTotal('guest-123')).toBe(150);
    });
  });

  describe('utility methods', () => {
    it('generateInvoiceNumber should produce correct format', () => {
      expect(service.generateInvoiceNumber()).toMatch(/^INV-\d{6}-\d{5}$/);
    });
    it('generateInvoiceNumber should produce unique numbers', () => {
      expect(service.generateInvoiceNumber()).not.toBe(service.generateInvoiceNumber());
    });
    it('calculateTotals should work correctly', () => {
      const lineItems = [
        { id: '1', description: 'Item 1', quantity: 2, unitPrice: 100, discount: 10, taxRate: 8, total: 0 },
        { id: '2', description: 'Item 2', quantity: 1, unitPrice: 50, discount: 0, taxRate: 8, total: 0 },
      ];
      const totals = service.calculateTotals(lineItems);
      expect(totals.subtotal).toBe(250);
      expect(totals.discountAmount).toBe(20);
      expect(totals.taxAmount).toBe(18.4);
      expect(totals.totalAmount).toBe(248.4);
    });
    it('calculateTotals should return zero for empty items', () => {
      const totals = service.calculateTotals([]);
      expect(totals.subtotal).toBe(0); expect(totals.taxAmount).toBe(0);
      expect(totals.discountAmount).toBe(0); expect(totals.totalAmount).toBe(0);
    });
    it('isOverdue should return true for overdue invoice', async () => {
      const invoice = await service.createInvoice({ ...validInvoiceInput, dueDate: '2020-01-01T00:00:00Z' });
      await service.addLineItem(invoice.id, validLineItem);
      await service.sendInvoice(invoice.id);
      expect(service.isOverdue((await service.getInvoice(invoice.id))!)).toBe(true);
    });
    it('isOverdue should return false for paid invoice', async () => {
      const invoice = await service.createInvoice({ ...validInvoiceInput, dueDate: '2020-01-01T00:00:00Z' });
      await service.addLineItem(invoice.id, validLineItem);
      await service.markAsPaid(invoice.id);
      expect(service.isOverdue((await service.getInvoice(invoice.id))!)).toBe(false);
    });
    it('canEdit should return true for draft, false for sent', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      expect(service.canEdit(invoice)).toBe(true);
      await service.addLineItem(invoice.id, validLineItem);
      expect(service.canEdit(await service.sendInvoice(invoice.id))).toBe(false);
    });
    it('canCancel should return true for draft, false for paid', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      expect(service.canCancel(invoice)).toBe(true);
      await service.addLineItem(invoice.id, validLineItem);
      expect(service.canCancel(await service.markAsPaid(invoice.id))).toBe(false);
    });
    it('canRefund should return true for paid, false for draft', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      expect(service.canRefund(invoice)).toBe(false);
      await service.addLineItem(invoice.id, validLineItem);
      expect(service.canRefund(await service.markAsPaid(invoice.id))).toBe(true);
    });
    it('formatCurrency should format USD correctly', () => {
      expect(service.formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple line items with different tax rates', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, { description: 'Room', quantity: 1, unitPrice: 100, discount: 0, taxRate: 10 });
      const updated = await service.addLineItem(invoice.id, { description: 'Food', quantity: 1, unitPrice: 50, discount: 0, taxRate: 5 });
      expect(updated.lineItems).toHaveLength(2);
      expect(updated.subtotal).toBe(150);
      expect(updated.taxAmount).toBe(12.5);
    });
    it('should handle all payment methods', async () => {
      const methods = ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'room_charge', 'gift_card', 'other'] as const;
      for (const method of methods) {
        const inv = await service.createInvoice(validInvoiceInput);
        await service.addLineItem(inv.id, { description: 'Test', quantity: 1, unitPrice: 100, discount: 0, taxRate: 0 });
        const updated = await service.recordPayment({ invoiceId: inv.id, amount: 50, paymentMethod: method, processedBy: 'staff-1' });
        expect(updated.paidAmount).toBe(50);
      }
    });
  });
});
