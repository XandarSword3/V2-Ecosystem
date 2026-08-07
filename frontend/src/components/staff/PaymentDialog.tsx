'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CreditCard, DollarSign, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface PaymentDialogProps {
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    items: Array<{ name: string; quantity: number; price?: number }>;
  };
  onClose: () => void;
  onComplete: () => void;
  slug: string;
}

type PaymentMethod = 'cash' | 'card' | 'room_charge' | 'gift_card';

interface SplitShare {
  id: string;
  amount: number;
  paid: boolean;
  method?: PaymentMethod;
}

export function PaymentDialog({ order, onClose, onComplete, slug }: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitMode, setSplitMode] = useState<'none' | 'equal' | 'itemized'>('none');
  const [splitCount, setSplitCount] = useState(2);
  const [shares, setShares] = useState<SplitShare[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateSplit = () => {
    if (splitMode === 'equal') {
      const perShare = order.totalAmount / splitCount;
      return Array.from({ length: splitCount }, (_, i) => ({
        id: `share-${i}`,
        amount: perShare,
        paid: false,
      }));
    }
    if (splitMode === 'itemized') {
      // For itemized split, each item becomes a share
      return order.items.map((item, i) => ({
        id: `share-${i}`,
        amount: (item.price || 0) * item.quantity,
        paid: false,
      }));
    }
    return [];
  };

  const handleSplitChange = (mode: 'none' | 'equal' | 'itemized') => {
    setSplitMode(mode);
    if (mode !== 'none') {
      setShares(calculateSplit());
    } else {
      setShares([]);
    }
  };

  const handlePayment = async (shareId?: string) => {
    setIsProcessing(true);
    try {
      const amount = shareId 
        ? shares.find(s => s.id === shareId)?.amount 
        : order.totalAmount;

      if (!amount) return;

      if (paymentMethod === 'cash') {
        await api.post('/payments/record-cash', {
          referenceType: 'instant_transaction',
          referenceId: order.id,
          amount,
        });
      } else if (paymentMethod === 'card') {
        await api.post('/payments/create-intent', {
          amount: amount * 100, // Convert to cents
          referenceType: 'instant_transaction',
          referenceId: order.id,
        });
      } else if (paymentMethod === 'room_charge') {
        await api.post('/payments/record-manual', {
          referenceType: 'instant_transaction',
          referenceId: order.id,
          amount,
          method: 'room_charge',
        });
      }

      if (shareId) {
        setShares(prev => prev.map(s => 
          s.id === shareId ? { ...s, paid: true } : s
        ));
        toast.success('Share payment recorded');
      } else {
        toast.success('Payment recorded');
        // Mark transaction as completed to free the table
        // NOTE: this hits dynamic-module.router.ts, which is mounted at the
        // API root per-slug (apiRouter.use(getDynamicModulesRouter())) —
        // there is no /staff/modules prefix on this route, unlike the
        // module-staff.routes.ts endpoints (which ARE mounted under /staff/modules).
        await api.patch(`/${slug}/transactions/${order.id}/complete`);
        onComplete();
        onClose();
      }
    } catch (error) {
      toast.error('Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    const allPaid = shares.length === 0 || shares.every(s => s.paid);
    if (allPaid) {
      onComplete();
      onClose();
    } else {
      toast.error('All shares must be paid before completing');
    }
  };

  const totalPaid = shares.reduce((sum, s) => sum + (s.paid ? s.amount : 0), 0);
  const remaining = order.totalAmount - totalPaid;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Order #{order.orderNumber}</h2>
            <p className="text-gray-500 dark:text-gray-400">Complete payment</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Order Summary */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <span>{formatCurrency((item.price || 0) * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>

          {/* Split Bill Options */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Split Bill</h3>
            <div className="flex gap-2">
              <Button
                variant={splitMode === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSplitChange('none')}
              >
                No Split
              </Button>
              <Button
                variant={splitMode === 'equal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSplitChange('equal')}
              >
                Equal Split
              </Button>
              <Button
                variant={splitMode === 'itemized' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSplitChange('itemized')}
              >
                Itemized
              </Button>
            </div>

            {splitMode === 'equal' && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-sm">Split into:</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="w-20 border rounded-md px-2 py-1"
                />
                <span className="text-sm">parts</span>
              </div>
            )}
          </div>

          {/* Split Shares */}
          {shares.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Payment Shares</h3>
              <div className="space-y-2">
                {shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <span className="font-medium">{formatCurrency(share.amount)}</span>
                      {share.paid && (
                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">Paid</span>
                      )}
                    </div>
                    {!share.paid && (
                      <Button size="sm" onClick={() => handlePayment(share.id)} disabled={isProcessing}>
                        Pay
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method */}
          {shares.length === 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Payment Method</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="flex items-center gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Card
                </Button>
                <Button
                  variant={paymentMethod === 'room_charge' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('room_charge')}
                  className="flex items-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Room Charge
                </Button>
              </div>
            </div>
          )}

          {/* Payment Summary */}
          {shares.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>Total Paid</span>
                <span>{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Remaining</span>
                <span className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          {shares.length === 0 ? (
            <Button className="flex-1" onClick={() => handlePayment()} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Pay ' + formatCurrency(order.totalAmount)}
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleComplete} disabled={remaining > 0}>
              Complete Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
