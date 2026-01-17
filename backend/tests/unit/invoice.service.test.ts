import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInvoiceService, InvoiceService } from '../../src/lib/services/invoice.service';
import { InMemoryInvoiceRepository } from '../../src/lib/repositories/invoice.repository.memory';
import { Container, Invoice, InvoiceStatus } from '../../src/lib/container/types';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let repository: InMemoryInvoiceRepository;
  let mockLogger: any;

  const createMockContainer = (): Container => {
    repository = new InMemoryInvoiceRepository();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    return {
      invoiceRepository: repository,
      logger: mockLogger
    } as unknown as Container;
  };

  const validInvoiceInput = {
    guestId: 'guest-123',
    guestName: 'John Doe',
    guestEmail: 'john@example.com',
    reservationId: 'res-123',
    dueDate: '2026-02-15T00:00:00Z',
    notes: 'Room charges',
    currency: 'USD',
    createdBy: 'staff-1'
  };

  const validLineItem = {
    description: 'Room Night - Deluxe Suite',
    quantity: 3,
    unitPrice: 200,
    discount: 10,
    taxRate: 12
  };

  beforeEach(() => {
    service = createInvoiceService(createMockContainer());
  });

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
        invoiceId: expect.any(String),
        invoiceNumber: expect.any(String)
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
      const result = await service.getInvoice('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getInvoiceByNumber', () => {
    it('should return invoice by invoice number', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      const retrieved = await service.getInvoiceByNumber(created.invoiceNumber);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for invalid invoice number', async () => {
      const result = await service.getInvoiceByNumber('INV-INVALID');
      expect(result).toBeNull();
    });
  });

  describe('getInvoices', () => {
    it('should return all invoices', async () => {
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice({ ...validInvoiceInput, guestId: 'guest-456' });

      const invoices = await service.getInvoices();
      expect(invoices).toHaveLength(2);
    });
  });

  describe('getInvoicesByGuest', () => {
    it('should return invoices for a guest', async () => {
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice(validInvoiceInput);
      await service.createInvoice({ ...validInvoiceInput, guestId: 'other-guest' });

      const invoices = await service.getInvoicesByGuest('guest-123');
      expect(invoices).toHaveLength(2);
    });
  });

  describe('getInvoicesByStatus', () => {
    it('should return invoices by status', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);

      const drafts = await service.getInvoicesByStatus('draft');
      const sent = await service.getInvoicesByStatus('sent');

      expect(drafts).toHaveLength(0);
      expect(sent).toHaveLength(1);
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice notes and due date', async () => {
      const created = await service.createInvoice(validInvoiceInput);

      const updated = await service.updateInvoice(created.id, {
        notes: 'Updated notes',
        dueDate: '2026-03-01T00:00:00Z'
      });

      expect(updated.notes).toBe('Updated notes');
      expect(updated.dueDate).toBe('2026-03-01T00:00:00Z');
    });

    it('should reject update for non-existent invoice', async () => {
      await expect(service.updateInvoice('non-existent', { notes: 'Test' }))
        .rejects.toThrow('Invoice not found');
    });

    it('should reject update for sent invoice', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);

      await expect(service.updateInvoice(inv.id, { notes: 'Test' }))
        .rejects.toThrow('Cannot edit invoice in current status');
    });
  });

  describe('deleteInvoice', () => {
    it('should delete draft invoice', async () => {
      const created = await service.createInvoice(validInvoiceInput);
      await service.deleteInvoice(created.id);

      const retrieved = await service.getInvoice(created.id);
      expect(retrieved).toBeNull();
    });

    it('should reject delete for non-existent invoice', async () => {
      await expect(service.deleteInvoice('non-existent'))
        .rejects.toThrow('Invoice not found');
    });

    it('should reject delete for non-draft invoice', async () => {
      const inv = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv.id, validLineItem);
      await service.sendInvoice(inv.id);

      await expect(service.deleteInvoice(inv.id))
        .rejects.toThrow('Only draft invoices can be deleted');
    });
  });

  describe('addLineItem', () => {
    it('should add line item to invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const updated = await service.addLineItem(invoice.id, validLineItem);

      expect(updated.lineItems).toHaveLength(1);
      expect(updated.lineItems[0].description).toBe('Room Night - Deluxe Suite');
      expect(updated.lineItems[0].quantity).toBe(3);
      expect(updated.lineItems[0].unitPrice).toBe(200);
      expect(updated.subtotal).toBeGreaterThan(0);
      expect(updated.totalAmount).toBeGreaterThan(0);
    });

    it('should calculate totals correctly', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const updated = await service.addLineItem(invoice.id, {
        description: 'Test item',
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        taxRate: 10
      });

      // 2 * 100 = 200 subtotal, no discount, 10% tax = 20
      // Total = 220
      expect(updated.subtotal).toBe(200);
      expect(updated.taxAmount).toBe(20);
      expect(updated.totalAmount).toBe(220);
      expect(updated.balanceDue).toBe(220);
    });

    it('should reject adding item to non-existent invoice', async () => {
      await expect(service.addLineItem('non-existent', validLineItem))
        .rejects.toThrow('Invoice not found');
    });

    it('should reject quantity less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);

      await expect(service.addLineItem(invoice.id, { ...validLineItem, quantity: 0 }))
        .rejects.toThrow('Quantity must be greater than 0');
    });

    it('should reject negative unit price', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);

      await expect(service.addLineItem(invoice.id, { ...validLineItem, unitPrice: -10 }))
        .rejects.toThrow('Unit price cannot be negative');
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

      await expect(service.removeLineItem(invoice.id, 'non-existent'))
        .rejects.toThrow('Line item not found');
    });
  });

  describe('updateLineItem', () => {
    it('should update line item', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const withItem = await service.addLineItem(invoice.id, validLineItem);
      const lineItemId = withItem.lineItems[0].id;

      const updated = await service.updateLineItem(invoice.id, lineItemId, {
        quantity: 5,
        description: 'Updated description'
      });

      expect(updated.lineItems[0].quantity).toBe(5);
      expect(updated.lineItems[0].description).toBe('Updated description');
    });

    it('should reject updating non-existent line item', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);

      await expect(service.updateLineItem(invoice.id, 'non-existent', { quantity: 5 }))
        .rejects.toThrow('Line item not found');
    });

    it('should reject quantity less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const withItem = await service.addLineItem(invoice.id, validLineItem);
      const lineItemId = withItem.lineItems[0].id;

      await expect(service.updateLineItem(invoice.id, lineItemId, { quantity: 0 }))
        .rejects.toThrow('Quantity must be greater than 0');
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

      await expect(service.sendInvoice(invoice.id))
        .rejects.toThrow('Cannot send invoice with no line items');
    });

    it('should reject sending already sent invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.sendInvoice(invoice.id);
      await service.markAsPaid(invoice.id);

      await expect(service.sendInvoice(invoice.id))
        .rejects.toThrow('Can only send draft or pending invoices');
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

      await expect(service.markAsPaid(invoice.id))
        .rejects.toThrow('Cannot mark cancelled or refunded invoice as paid');
    });
  });

  describe('cancelInvoice', () => {
    it('should cancel draft invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      const cancelled = await service.cancelInvoice(invoice.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should cancel sent invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.sendInvoice(invoice.id);

      const cancelled = await service.cancelInvoice(invoice.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancelling paid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.markAsPaid(invoice.id);

      await expect(service.cancelInvoice(invoice.id))
        .rejects.toThrow('Cannot cancel invoice in current status');
    });
  });

  describe('refundInvoice', () => {
    it('should refund paid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);
      await service.markAsPaid(invoice.id);

      const refunded = await service.refundInvoice(invoice.id);
      expect(refunded.status).toBe('refunded');
    });

    it('should reject refunding unpaid invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);

      await expect(service.refundInvoice(invoice.id))
        .rejects.toThrow('Can only refund paid invoices');
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update totals', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      const updated = await service.recordPayment({
        invoiceId: invoice.id,
        amount: 50,
        paymentMethod: 'credit_card',
        processedBy: 'staff-1'
      });

      expect(updated.paidAmount).toBe(50);
      expect(updated.balanceDue).toBe(50);
      expect(updated.status).toBe('partial');
    });

    it('should mark as paid when fully paid', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      const updated = await service.recordPayment({
        invoiceId: invoice.id,
        amount: 100,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      });

      expect(updated.status).toBe('paid');
      expect(updated.balanceDue).toBe(0);
    });

    it('should reject payment on cancelled invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.cancelInvoice(invoice.id);

      await expect(service.recordPayment({
        invoiceId: invoice.id,
        amount: 50,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      })).rejects.toThrow('Cannot record payment on invoice in current status');
    });

    it('should reject payment amount less than or equal to 0', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, validLineItem);

      await expect(service.recordPayment({
        invoiceId: invoice.id,
        amount: 0,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      })).rejects.toThrow('Payment amount must be greater than 0');
    });

    it('should reject overpayment', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      await expect(service.recordPayment({
        invoiceId: invoice.id,
        amount: 150,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      })).rejects.toThrow('Payment amount exceeds balance due');
    });
  });

  describe('getPayments', () => {
    it('should return all payments for invoice', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      await service.recordPayment({
        invoiceId: invoice.id,
        amount: 30,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      });

      await service.recordPayment({
        invoiceId: invoice.id,
        amount: 30,
        paymentMethod: 'credit_card',
        processedBy: 'staff-1'
      });

      const payments = await service.getPayments(invoice.id);
      expect(payments).toHaveLength(2);
    });
  });

  describe('getTotalPaid', () => {
    it('should return total paid amount', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(invoice.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      await service.recordPayment({
        invoiceId: invoice.id,
        amount: 30,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      });

      await service.recordPayment({
        invoiceId: invoice.id,
        amount: 20,
        paymentMethod: 'cash',
        processedBy: 'staff-1'
      });

      const total = await service.getTotalPaid(invoice.id);
      expect(total).toBe(50);
    });
  });

  describe('getUnpaidTotal', () => {
    it('should return total unpaid amount for guest', async () => {
      const inv1 = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv1.id, {
        description: 'Test',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 0
      });

      const inv2 = await service.createInvoice(validInvoiceInput);
      await service.addLineItem(inv2.id, {
        description: 'Test 2',
        quantity: 1,
        unitPrice: 50,
        discount: 0,
        taxRate: 0
      });

      const total = await service.getUnpaidTotal('guest-123');
      expect(total).toBe(150);
    });
  });

  describe('utility methods', () => {
    describe('generateInvoiceNumber', () => {
      it('should generate invoice number in correct format', () => {
        const number = service.generateInvoiceNumber();
        expect(number).toMatch(/^INV-\d{6}-\d{5}$/);
      });

      it('should generate unique numbers', () => {
        const num1 = service.generateInvoiceNumber();
        const num2 = service.generateInvoiceNumber();
        expect(num1).not.toBe(num2);
      });
    });

    describe('calculateTotals', () => {
      it('should calculate totals correctly', () => {
        const lineItems = [
          { id: '1', description: 'Item 1', quantity: 2, unitPrice: 100, discount: 10, taxRate: 8, total: 0 },
          { id: '2', description: 'Item 2', quantity: 1, unitPrice: 50, discount: 0, taxRate: 8, total: 0 }
        ];

        const totals = service.calculateTotals(lineItems);

        expect(totals.subtotal).toBe(250); // 200 + 50
        expect(totals.discountAmount).toBe(20); // 10% of 200
        expect(totals.taxAmount).toBe(18.4); // 8% of (180 + 50)
        expect(totals.totalAmount).toBe(248.4); // 250 - 20 + 18.4
      });

      it('should return zero for empty line items', () => {
        const totals = service.calculateTotals([]);

        expect(totals.subtotal).toBe(0);
        expect(totals.taxAmount).toBe(0);
        expect(totals.discountAmount).toBe(0);
        expect(totals.totalAmount).toBe(0);
      });
    });

    describe('isOverdue', () => {
      it('should return true for overdue invoice', async () => {
        const invoice = await service.createInvoice({
          ...validInvoiceInput,
          dueDate: '2020-01-01T00:00:00Z'
        });
        await service.addLineItem(invoice.id, validLineItem);
        await service.sendInvoice(invoice.id);
        const sent = await service.getInvoice(invoice.id);

        expect(service.isOverdue(sent!)).toBe(true);
      });

      it('should return false for paid invoice', async () => {
        const invoice = await service.createInvoice({
          ...validInvoiceInput,
          dueDate: '2020-01-01T00:00:00Z'
        });
        await service.addLineItem(invoice.id, validLineItem);
        await service.markAsPaid(invoice.id);
        const paid = await service.getInvoice(invoice.id);

        expect(service.isOverdue(paid!)).toBe(false);
      });
    });

    describe('canEdit', () => {
      it('should return true for draft invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        expect(service.canEdit(invoice)).toBe(true);
      });

      it('should return false for sent invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        await service.addLineItem(invoice.id, validLineItem);
        const sent = await service.sendInvoice(invoice.id);
        expect(service.canEdit(sent)).toBe(false);
      });
    });

    describe('canCancel', () => {
      it('should return true for draft invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        expect(service.canCancel(invoice)).toBe(true);
      });

      it('should return false for paid invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        await service.addLineItem(invoice.id, validLineItem);
        const paid = await service.markAsPaid(invoice.id);
        expect(service.canCancel(paid)).toBe(false);
      });
    });

    describe('canRefund', () => {
      it('should return true for paid invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        await service.addLineItem(invoice.id, validLineItem);
        const paid = await service.markAsPaid(invoice.id);
        expect(service.canRefund(paid)).toBe(true);
      });

      it('should return false for draft invoice', async () => {
        const invoice = await service.createInvoice(validInvoiceInput);
        expect(service.canRefund(invoice)).toBe(false);
      });
    });

    describe('formatCurrency', () => {
      it('should format USD correctly', () => {
        const formatted = service.formatCurrency(1234.56, 'USD');
        expect(formatted).toBe('$1,234.56');
      });

      it('should format EUR correctly', () => {
        const formatted = service.formatCurrency(1234.56, 'EUR');
        expect(formatted).toContain('1,234.56');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple line items with different tax rates', async () => {
      const invoice = await service.createInvoice(validInvoiceInput);

      await service.addLineItem(invoice.id, {
        description: 'Room',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxRate: 10
      });

      const updated = await service.addLineItem(invoice.id, {
        description: 'Food',
        quantity: 1,
        unitPrice: 50,
        discount: 0,
        taxRate: 5
      });

      expect(updated.lineItems).toHaveLength(2);
      expect(updated.subtotal).toBe(150);
      expect(updated.taxAmount).toBe(12.5); // 10 + 2.5
    });

    it('should handle all payment methods', async () => {
      const methods = ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'room_charge', 'gift_card', 'other'] as const;

      for (const method of methods) {
        const inv = await service.createInvoice(validInvoiceInput);
        await service.addLineItem(inv.id, {
          description: 'Test',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 0
        });

        const updated = await service.recordPayment({
          invoiceId: inv.id,
          amount: 50,
          paymentMethod: method,
          processedBy: 'staff-1'
        });

        expect(updated.paidAmount).toBe(50);
      }
    });
  });
});
