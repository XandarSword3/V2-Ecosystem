'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { restaurantApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  ShoppingCart,
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  Loader2,
  UtensilsCrossed,
  Phone,
  User,
  MapPin,
  CreditCard,
  Banknote,
  MessageSquare,
} from 'lucide-react';

export default function ModuleCartPage() {
  const t = useTranslations('common'); 
  // We can eventually load module specific translations if needed, 
  // but 'common' covers most checkout terms.
  
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { modules } = useSiteSettings();
  
  const currentModule = modules.find((m) => m.slug === slug);
  const moduleId = currentModule?.id;

  const currency = useSettingsStore((s) => s.currency);

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Filter items for THIS module
  const items = useCartStore((s) => s.items);
  const moduleItems = items.filter(i => i.moduleId === moduleId);
  
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart); // Needs to clear only specific items ideally

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [notes, setNotes] = useState('');

  const subtotal = moduleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.11; // 11% VAT
  const total = subtotal + tax;

  const orderMutation = useMutation({
    mutationFn: (data: any) => restaurantApi.createOrder(data),
    onSuccess: (response) => {
      // Clear only items for this module
      // Since clearCart clears everything, we might want to be selective.
      // But for now, we follow the pattern. 
      // Ideally we need clearModuleCart(moduleId) in store, but we can iterate and remove.
      moduleItems.forEach(item => removeItem(item.id));
      
      toast.success(t('orderPlaced'));
      // Redirect to a generic confirmation page or reuse restaurant one if suitable
      // For now, let's reuse restaurant confirmation if it works, or a generic one.
      // Dynamic modules might not have a dedicated confirmation page yet.
      // We can use /restaurant/confirmation as a fallback or create a new one.
      // But wait, the URL check might fail.
      router.push(`/${slug}`); 
      toast.success("Order confirmed. Check your email for details.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('orderFailed'));
    },
  });

  const handlePlaceOrder = () => {
    if (!customerName.trim()) {
      toast.error(t('enterName'));
      return;
    }
    if (!customerPhone.trim()) {
      toast.error(t('enterPhone'));
      return;
    }
    if (orderType === 'dine_in' && !tableNumber.trim()) {
      toast.error(t('enterTableNumber'));
      return;
    }
    if (moduleItems.length === 0) {
      toast.error(t('cartEmpty'));
      return;
    }

    orderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      tableNumber: orderType === 'dine_in' ? tableNumber.trim() : null,
      orderType,
      paymentMethod,
      specialRequests: notes.trim(),
      items: moduleItems.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
      })),
    });
  };

  if (!isHydrated || !currentModule) {
      return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (moduleItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center p-8">
          <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('cartEmpty')}</h2>
          <Link href={`/${slug}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Return to Menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/${slug}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {currentModule.name} Checkout
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
                {moduleItems.map((item) => (
                    <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex gap-4"
                    >
                         {item.imageUrl && (
                            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
                         )}
                         <div className="flex-1">
                             <h3 className="font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                             <p className="text-slate-500">{formatCurrency(item.price, currency)}</p>
                         </div>
                         <div className="flex items-center gap-3">
                             <div className="flex items-center border rounded-lg dark:border-slate-700">
                                <button onClick={() => addItem({ ...item, quantity: -1 })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700"><Minus className="w-4 h-4"/></button>
                                <span className="w-8 text-center text-sm">{item.quantity}</span>
                                <button onClick={() => addItem({ ...item, quantity: 1 })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700"><Plus className="w-4 h-4"/></button>
                             </div>
                             <button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                         </div>
                    </motion.div>
                ))}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <input className="input w-full" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full Name" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Phone</label>
                        <input className="input w-full" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone Number" />
                     </div>
                     
                     <div className="flex gap-2">
                         <button 
                            onClick={() => setOrderType('dine_in')}
                            className={`flex-1 p-2 rounded border ${orderType === 'dine_in' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : ''}`}
                         >Dine In</button>
                         <button 
                            onClick={() => setOrderType('takeaway')}
                            className={`flex-1 p-2 rounded border ${orderType === 'takeaway' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : ''}`}
                         >Takeaway</button>
                     </div>

                     {orderType === 'dine_in' && (
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Table Number</label>
                            <input className="input w-full" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Table #" />
                         </div>
                     )}

                     <div className="space-y-2">
                        <label className="text-sm font-medium">Notes</label>
                        <textarea className="input w-full" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions..." />
                     </div>

                     <div className="border-t pt-4 mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal, currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Tax (11%)</span>
                            <span>{formatCurrency(tax, currency)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrency(total, currency)}</span>
                        </div>
                     </div>

                     <Button className="w-full" onClick={handlePlaceOrder} disabled={orderMutation.isPending}>
                        {orderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Place Order
                     </Button>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
