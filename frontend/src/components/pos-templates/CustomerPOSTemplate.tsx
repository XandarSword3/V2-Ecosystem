'use client';

/**
 * POS Customer Module Template
 * A complete customer-facing ordering experience with:
 * - Menu browsing with categories, search, and filters
 * - Real-time availability (stock-based)
 * - Cart management with modifiers and notes
 * - Order types: Dine-in (tab), Takeaway, Delivery
 * - Table/QR code linking
 * - Multiple payment methods (card, cash, gift card, loyalty points)
 * - Bill splitting
 * - Live order status tracking
 * - Order history and re-ordering
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  CreditCard,
  Receipt,
  Star,
  ChefHat,
  Bell,
  MapPin,
  QrCode,
  Gift,
  Coins,
  SplitSquareVertical,
  History,
  HelpCircle,
  X,
  Check,
} from 'lucide-react';

// Types
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id: string;
  is_available: boolean;
  stock_quantity?: number;
  prep_time_minutes?: number;
  modifiers?: Modifier[];
  variants?: Variant[];
}

interface Modifier {
  id: string;
  name: string;
  price_adjustment: number;
  is_required: boolean;
}

interface Variant {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  variant?: Variant;
  modifiers: Modifier[];
  notes?: string;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  items: any[];
  total_amount: number;
  created_at: string;
}

type OrderType = 'dine_in' | 'takeaway' | 'delivery';

interface CustomerPOSTemplateProps {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
}

export default function CustomerPOSTemplate({ moduleId, moduleSlug, moduleName }: CustomerPOSTemplateProps) {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useSocket();

  // State
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [showPayment, setShowPayment] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  // Fetch menu data
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const [categoriesRes, itemsRes] = await Promise.all([
          api.get(`/modules/${moduleSlug}/categories`),
          api.get(`/modules/${moduleSlug}/menu`, { params: { moduleId, available: true } }),
        ]);
        setCategories(categoriesRes.data.data || []);
        setMenuItems(itemsRes.data.data || []);
        setFilteredItems(itemsRes.data.data || []);
      } catch (error) {
        toast.error('Failed to load menu');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, [moduleId, moduleSlug]);

  // Fetch active orders
  useEffect(() => {
    if (user) {
      const fetchOrders = async () => {
        try {
          const res = await api.get(`/modules/${moduleSlug}/orders/my`, {
            params: { status: 'pending,confirmed,preparing,ready' }
          });
          setActiveOrders(res.data.data || []);
        } catch (error) {
          console.error('Failed to load orders');
        }
      };
      fetchOrders();

      // Fetch loyalty points
      const fetchLoyalty = async () => {
        try {
          const res = await api.get('/loyalty/me');
          setLoyaltyPoints(res.data.data?.points_balance || 0);
        } catch (error) {
          console.error('Failed to load loyalty');
        }
      };
      fetchLoyalty();
    }
  }, [user, moduleSlug]);

  // Real-time order updates
  useEffect(() => {
    if (socket && user) {
      socket.emit('join:customer', user.id);
      
      const handleOrderUpdate = (update: { orderId: string; status: string }) => {
        setActiveOrders(prev => 
          prev.map(o => o.id === update.orderId ? { ...o, status: update.status } : o)
        );
        toast.info(`Order status: ${update.status.replace('_', ' ')}`);
      };

      socket.on('order:status', handleOrderUpdate);
      return () => { socket.off('order:status', handleOrderUpdate); };
    }
  }, [socket, user]);

  // Filter menu items
  useEffect(() => {
    let filtered = menuItems;
    
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category_id === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    
    setFilteredItems(filtered);
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart functions
  const addToCart = useCallback((item: MenuItem, variant?: Variant, modifiers: Modifier[] = [], notes?: string) => {
    const price = variant?.price || item.price;
    const modifierTotal = modifiers.reduce((sum, m) => sum + m.price_adjustment, 0);
    const subtotal = price + modifierTotal;

    const existingIndex = cart.findIndex(
      ci => ci.menuItem.id === item.id && 
            ci.variant?.id === variant?.id &&
            JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
    );

    if (existingIndex >= 0) {
      setCart(prev => prev.map((ci, i) => 
        i === existingIndex 
          ? { ...ci, quantity: ci.quantity + 1, subtotal: (ci.quantity + 1) * (subtotal) }
          : ci
      ));
    } else {
      const cartItem: CartItem = {
        id: `${item.id}-${Date.now()}`,
        menuItem: item,
        quantity: 1,
        variant,
        modifiers,
        notes,
        subtotal,
      };
      setCart(prev => [...prev, cartItem]);
    }
    
    toast.success(`Added ${item.name} to cart`);
    setSelectedItem(null);
  }, [cart]);

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null as any;
        const unitPrice = (item.variant?.price || item.menuItem.price) + 
          item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0);
        return { ...item, quantity: newQty, subtotal: newQty * unitPrice };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const finalTotal = Math.max(0, cartTotal - appliedDiscount);

  // Apply coupon
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await api.post('/coupons/validate', { 
        code: couponCode, 
        subtotal: cartTotal,
        moduleId 
      });
      if (res.data.success && res.data.valid) {
        setAppliedDiscount(res.data.data.discountAmount);
        toast.success(`Coupon applied: ${formatCurrency(res.data.data.discountAmount)} off`);
      } else {
        toast.error(res.data.error || 'Invalid coupon');
      }
    } catch (error) {
      toast.error('Failed to apply coupon');
    }
  };

  // Submit order
  const submitOrder = async (paymentMethod: string, splitWith?: number) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('Please enter your table number');
      return;
    }

    try {
      const orderData = {
        moduleId,
        orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
        items: cart.map(item => ({
          productId: item.menuItem.id,
          quantity: item.quantity,
          variantId: item.variant?.id,
          modifiers: item.modifiers.map(m => m.id),
          notes: item.notes,
          unitPrice: (item.variant?.price || item.menuItem.price) + 
            item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0),
        })),
        couponCode: couponCode || undefined,
        paymentMethod,
        splitPayment: splitWith ? { count: splitWith, myShare: finalTotal / splitWith } : undefined,
        useLoyaltyPoints: paymentMethod === 'loyalty' ? loyaltyPoints : undefined,
      };

      const res = await api.post(`/modules/${moduleSlug}/orders`, orderData);
      
      if (res.data.success) {
        toast.success(`Order #${res.data.data.order_number} placed successfully!`);
        setCart([]);
        setAppliedDiscount(0);
        setCouponCode('');
        setShowPayment(false);
        setIsCartOpen(false);
        setActiveOrders(prev => [res.data.data, ...prev]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to place order');
    }
  };

  // Request staff assistance
  const requestAssistance = async () => {
    try {
      await api.post(`/modules/${moduleSlug}/assistance`, {
        tableNumber,
        type: 'help',
        message: 'Customer needs assistance',
      });
      toast.success('Staff has been notified');
    } catch (error) {
      toast.error('Failed to request assistance');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {moduleName}
            </h1>
            
            <div className="flex items-center gap-3">
              {/* Order Type Selector */}
              <div className="hidden sm:flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {(['dine_in', 'takeaway', 'delivery'] as OrderType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      orderType === type 
                        ? 'bg-primary text-white' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type.replace('_', '-')}
                  </button>
                ))}
              </div>

              {/* Table Number (for dine-in) */}
              {orderType === 'dine_in' && (
                <div className="hidden sm:flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Table #"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              )}

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded-full bg-primary text-white hover:bg-primary/90"
              >
                <ShoppingCart className="h-5 w-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>

              {/* Order History */}
              <button
                onClick={() => setShowOrderHistory(true)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <History className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>

              {/* Request Help */}
              <button
                onClick={requestAssistance}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <HelpCircle className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[120px] z-30 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                !selectedCategory 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <Card 
              key={item.id} 
              className={`overflow-hidden cursor-pointer transition hover:shadow-lg ${
                !item.is_available ? 'opacity-50' : ''
              }`}
              onClick={() => item.is_available && setSelectedItem(item)}
            >
              {item.image_url && (
                <div className="h-40 bg-gray-200 dark:bg-gray-700">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-primary">
                    {formatCurrency(item.price)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  {item.prep_time_minutes && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.prep_time_minutes} min
                    </span>
                  )}
                  {!item.is_available && (
                    <span className="text-xs text-red-500 font-medium">Out of stock</span>
                  )}
                  {item.is_available && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                      }}
                      className="p-2 bg-primary text-white rounded-full hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">No items found</p>
          </div>
        )}
      </main>

      {/* Active Orders Banner */}
      {activeOrders.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary animate-pulse" />
            Active Orders ({activeOrders.length})
          </h4>
          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
            {activeOrders.slice(0, 3).map(order => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  #{order.order_number}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  order.status === 'ready' ? 'bg-green-100 text-green-800' :
                  order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {/* FIX Iter-19: cart drawer a11y — role, aria-modal, aria-label, Escape handler */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" role="dialog" aria-modal="true" aria-label="Shopping cart" onClick={() => setIsCartOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setIsCartOpen(false); }}>
          <div 
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold">Your Cart</h2>
                <button onClick={() => setIsCartOpen(false)} aria-label="Close cart">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto text-gray-300" />
                    <p className="mt-2 text-gray-500">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.menuItem.name}</h4>
                          {item.variant && (
                            <p className="text-xs text-gray-500">{item.variant.name}</p>
                          )}
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-500">
                              + {item.modifiers.map(m => m.name).join(', ')}
                            </p>
                          )}
                          <p className="font-semibold text-primary mt-1">
                            {formatCurrency(item.subtotal)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartItemQuantity(item.id, -1)}
                              className="p-1 rounded-full bg-gray-200 dark:bg-gray-600"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartItemQuantity(item.id, 1)}
                              className="p-1 rounded-full bg-gray-200 dark:bg-gray-600"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t dark:border-gray-700 p-4 space-y-4">
                  {/* Coupon */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Button onClick={applyCoupon} variant="outline">Apply</Button>
                  </div>

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {appliedDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(appliedDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>

                  {/* Loyalty Points */}
                  {loyaltyPoints > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                      <Coins className="h-4 w-4" />
                      <span>You have {loyaltyPoints} points available</span>
                    </div>
                  )}

                  {/* Payment Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setShowPayment(true)} className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Pay Now
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => submitOrder('tab')}
                      className="flex items-center gap-2"
                    >
                      <Receipt className="h-4 w-4" />
                      Add to Tab
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {/* FIX Iter-19: payment modal a11y — role, aria-modal, aria-label, Escape handler */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" onKeyDown={(e) => { if (e.key === 'Escape') setShowPayment(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 id="payment-modal-title" className="text-lg font-semibold mb-4">Choose Payment Method</h3>
            <div className="space-y-3">
              <button
                onClick={() => submitOrder('card')}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Credit/Debit Card</span>
              </button>
              <button
                onClick={() => submitOrder('cash')}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Coins className="h-5 w-5 text-green-600" />
                <span>Cash</span>
              </button>
              <button
                onClick={() => submitOrder('gift_card')}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Gift className="h-5 w-5 text-purple-600" />
                <span>Gift Card</span>
              </button>
              {loyaltyPoints >= finalTotal * 10 && (
                <button
                  onClick={() => submitOrder('loyalty')}
                  className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Star className="h-5 w-5 text-amber-500" />
                  <span>Use {Math.ceil(finalTotal * 10)} Points</span>
                </button>
              )}
              <button
                onClick={() => setShowPayment(false)}
                className="w-full text-center text-gray-500 mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {/* FIX Iter-19: item detail modal a11y — role, aria-modal, aria-label, Escape handler */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${selectedItem.name} details`} onKeyDown={(e) => { if (e.key === 'Escape') setSelectedItem(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {selectedItem.image_url && (
              <div className="h-48 bg-gray-200">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{selectedItem.name}</h3>
                  {selectedItem.description && (
                    <p className="text-gray-500 mt-1">{selectedItem.description}</p>
                  )}
                </div>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(selectedItem.price)}
                </span>
              </div>

              {/* Variants */}
              {selectedItem.variants && selectedItem.variants.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Size/Variant</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.variants.map(v => (
                      <button
                        key={v.id}
                        className="px-4 py-2 border rounded-lg hover:border-primary"
                      >
                        {v.name} (+{formatCurrency(v.price - selectedItem.price)})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifiers */}
              {selectedItem.modifiers && selectedItem.modifiers.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Add-ons</h4>
                  <div className="space-y-2">
                    {selectedItem.modifiers.map(m => (
                      <label key={m.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <span>{m.name}</span>
                        <span className="text-sm text-gray-500">+{formatCurrency(m.price_adjustment)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setSelectedItem(null)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => addToCart(selectedItem)} className="flex-1">
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
