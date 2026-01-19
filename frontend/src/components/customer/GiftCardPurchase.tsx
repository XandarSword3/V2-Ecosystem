'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Gift, CreditCard, Check, Loader2, Mail, User, ChevronRight } from 'lucide-react';

interface GiftCardTemplate {
  id: string;
  name: string;
  amount: number;
  design: {
    background: string;
    pattern?: string;
    textColor?: string;
  };
  isActive: boolean;
}

interface GiftCardPurchaseProps {
  onSuccess?: (giftCard: any) => void;
  className?: string;
}

export function GiftCardPurchase({ onSuccess, className = '' }: GiftCardPurchaseProps) {
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<GiftCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<GiftCardTemplate | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'details' | 'confirm'>('select');
  const [purchasing, setPurchasing] = useState(false);
  
  const [giftDetails, setGiftDetails] = useState({
    recipientName: '',
    recipientEmail: '',
    message: '',
    senderName: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/giftcards/templates');
      if (res.data.success) {
        setTemplates(res.data.data.filter((t: GiftCardTemplate) => t.isActive));
      }
    } catch {
      toast.error('Failed to load gift card options');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAmount = (template: GiftCardTemplate | null, amount?: number) => {
    if (template) {
      setSelectedTemplate(template);
      setCustomAmount('');
    } else if (amount) {
      setSelectedTemplate(null);
      setCustomAmount(amount.toString());
    }
    setStep('details');
  };

  const handlePurchase = async () => {
    if (!giftDetails.recipientEmail || !giftDetails.senderName) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amount = selectedTemplate?.amount || parseFloat(customAmount);
    if (!amount || amount < 10) {
      toast.error('Minimum gift card amount is $10');
      return;
    }

    setPurchasing(true);
    try {
      const res = await api.post('/giftcards/purchase', {
        templateId: selectedTemplate?.id,
        customAmount: selectedTemplate ? undefined : amount,
        recipientName: giftDetails.recipientName || undefined,
        recipientEmail: giftDetails.recipientEmail,
        personalMessage: giftDetails.message || undefined,
        senderName: giftDetails.senderName,
      });

      if (res.data.success) {
        toast.success('Gift card purchased successfully!');
        onSuccess?.(res.data.data);
        // Reset form
        setStep('select');
        setSelectedTemplate(null);
        setCustomAmount('');
        setGiftDetails({
          recipientName: '',
          recipientEmail: '',
          message: '',
          senderName: '',
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to purchase gift card');
    } finally {
      setPurchasing(false);
    }
  };

  const currentAmount = selectedTemplate?.amount || parseFloat(customAmount) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Send a Gift Card
              </h2>
              <p className="text-slate-500 mt-1">
                Choose an amount or create a custom gift
              </p>
            </div>

            {/* Template Options */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {templates.map((template) => (
                <motion.button
                  key={template.id}
                  onClick={() => handleSelectAmount(template)}
                  className="relative rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all group"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div 
                    className="aspect-[3/2] p-4 flex flex-col items-center justify-center"
                    style={{ 
                      background: template.design.background || 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: template.design.textColor || 'white'
                    }}
                  >
                    <Gift className="w-8 h-8 mb-2 opacity-80" />
                    <p className="text-2xl font-bold">{formatCurrency(template.amount)}</p>
                    <p className="text-sm opacity-80">{template.name}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </motion.button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="border-t dark:border-slate-700 pt-6">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Or enter a custom amount
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    type="number"
                    placeholder="50"
                    min="10"
                    max="1000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  onClick={() => handleSelectAmount(null, parseFloat(customAmount))}
                  disabled={!customAmount || parseFloat(customAmount) < 10}
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Minimum $10, Maximum $1,000</p>
            </div>
          </motion.div>
        )}

        {step === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Selected Amount Preview */}
            <div 
              className="rounded-xl p-6 text-center text-white"
              style={{ 
                background: selectedTemplate?.design.background || 'linear-gradient(135deg, #7c3aed, #a855f7)'
              }}
            >
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-80" />
              <p className="text-3xl font-bold">{formatCurrency(currentAmount)}</p>
              <p className="text-sm opacity-80">Gift Card</p>
            </div>

            {/* Gift Details Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Your name (will appear on card)"
                    value={giftDetails.senderName}
                    onChange={(e) => setGiftDetails(d => ({ ...d, senderName: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient's Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Who is this gift for?"
                    value={giftDetails.recipientName}
                    onChange={(e) => setGiftDetails(d => ({ ...d, recipientName: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient's Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Where should we send the gift card?"
                    value={giftDetails.recipientEmail}
                    onChange={(e) => setGiftDetails(d => ({ ...d, recipientEmail: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Personal Message (optional)
                </label>
                <textarea
                  placeholder="Add a personal message..."
                  value={giftDetails.message}
                  onChange={(e) => setGiftDetails(d => ({ ...d, message: e.target.value }))}
                  className="w-full p-3 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 text-right">{giftDetails.message.length}/500</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handlePurchase} 
                disabled={purchasing || !giftDetails.recipientEmail || !giftDetails.senderName}
                className="flex-1"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Purchase {formatCurrency(currentAmount)}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Balance Check Component
interface GiftCardBalanceProps {
  className?: string;
}

export function GiftCardBalance({ className = '' }: GiftCardBalanceProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [balance, setBalance] = useState<{ balance: number; expiresAt?: string } | null>(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!code.trim()) return;
    
    setChecking(true);
    setError('');
    setBalance(null);
    
    try {
      const res = await api.get(`/giftcards/check/${code.trim()}`);
      if (res.data.success) {
        setBalance(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gift card not found');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Check Gift Card Balance</h3>
        
        <div className="flex gap-3">
          <Input
            placeholder="Enter gift card code"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setBalance(null); setError(''); }}
            className="font-mono uppercase"
          />
          <Button onClick={handleCheck} disabled={checking || !code.trim()}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
          </Button>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-3">{error}</p>
        )}

        {balance && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Available Balance</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(balance.balance)}
                </p>
              </div>
            </div>
            {balance.expiresAt && (
              <p className="text-xs text-slate-500 mt-2">
                Expires: {new Date(balance.expiresAt).toLocaleDateString()}
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
