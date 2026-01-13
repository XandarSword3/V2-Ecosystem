import { describe, it, expect, vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ locale: 'en' }),
  usePathname: () => '/test',
}));

// Cart utility functions that would normally be in a cart store
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: { name: string; price: number }[];
}

class CartStore {
  private items: CartItem[] = [];

  addItem(item: Omit<CartItem, 'quantity'>, quantity: number = 1) {
    const existingIndex = this.items.findIndex((i) => i.id === item.id);
    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({ ...item, quantity });
    }
  }

  removeItem(itemId: string) {
    this.items = this.items.filter((i) => i.id !== itemId);
  }

  updateQuantity(itemId: string, quantity: number) {
    const item = this.items.find((i) => i.id === itemId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(itemId);
      } else {
        item.quantity = quantity;
      }
    }
  }

  clear() {
    this.items = [];
  }

  getItems() {
    return [...this.items];
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => {
      const optionsPrice = item.options?.reduce((o, opt) => o + opt.price, 0) || 0;
      return sum + (item.price + optionsPrice) * item.quantity;
    }, 0);
  }
}

describe('Cart Store', () => {
  it('should add items to cart', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItemCount()).toBe(1);
    expect(cart.getItems()[0].name).toBe('Pizza');
  });

  it('should increase quantity when adding same item', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 }, 2);
    
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItemCount()).toBe(3);
  });

  it('should remove items from cart', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.addItem({ id: '2', name: 'Burger', price: 12.99 });
    cart.removeItem('1');
    
    expect(cart.getItems()).toHaveLength(1);
    expect(cart.getItems()[0].name).toBe('Burger');
  });

  it('should update item quantity', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.updateQuantity('1', 5);
    
    expect(cart.getItems()[0].quantity).toBe(5);
    expect(cart.getItemCount()).toBe(5);
  });

  it('should remove item when quantity set to 0', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.updateQuantity('1', 0);
    
    expect(cart.getItems()).toHaveLength(0);
  });

  it('should calculate subtotal correctly', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 }, 2);
    cart.addItem({ id: '2', name: 'Burger', price: 12.99 });
    
    expect(cart.getSubtotal()).toBeCloseTo(44.97);
  });

  it('should include options in price calculation', () => {
    const cart = new CartStore();
    
    cart.addItem({
      id: '1',
      name: 'Pizza',
      price: 15.99,
      options: [
        { name: 'Extra Cheese', price: 2.00 },
        { name: 'Pepperoni', price: 1.50 },
      ],
    });
    
    expect(cart.getSubtotal()).toBeCloseTo(19.49);
  });

  it('should clear all items', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.addItem({ id: '2', name: 'Burger', price: 12.99 });
    cart.clear();
    
    expect(cart.getItems()).toHaveLength(0);
    expect(cart.getItemCount()).toBe(0);
    expect(cart.getSubtotal()).toBe(0);
  });
});

describe('Cart Quantity Limits', () => {
  it('should not allow negative quantities', () => {
    const cart = new CartStore();
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 });
    cart.updateQuantity('1', -5);
    
    // Should remove the item instead of having negative quantity
    expect(cart.getItems()).toHaveLength(0);
  });

  it('should handle multiple items with different quantities', () => {
    const cart = new CartStore();
    
    cart.addItem({ id: '1', name: 'Pizza', price: 15.99 }, 2);
    cart.addItem({ id: '2', name: 'Burger', price: 12.99 }, 3);
    cart.addItem({ id: '3', name: 'Salad', price: 8.99 }, 1);
    
    expect(cart.getItemCount()).toBe(6);
    expect(cart.getItems()).toHaveLength(3);
  });
});
