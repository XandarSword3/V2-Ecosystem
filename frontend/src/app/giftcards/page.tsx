'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Gift,
  CreditCard,
  ChevronRight,
  Loader2,
  Mail,
  User,
  Check,
  ArrowRight,
  Sparkles,
  Heart,
  PartyPopper,
  Search,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

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

export default function PublicGiftCardsPage() {
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<GiftCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<GiftCardTemplate | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'details' | 'payment' | 'success'>('select');
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedCard, setPurchasedCard] = useState<any>(null);
  
  // Balance check
  const [balanceCode, setBalanceCode] = useState('');
  const [balanceResult, setBalanceResult] = useState<{ balance: number; status: string } | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  
  const [giftDetails, setGiftDetails] = useState({
    recipientName: '',
    recipientEmail: '',
    message: '',
    senderName: '',
    senderEmail: '', // For guests
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
      // Use defaults if API fails
      setTemplates([
        { id: '1', name: 'Classic', amount: 25, design: { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }, isActive: true },
        { id: '2', name: 'Premium', amount: 50, design: { background: 'linear-gradient(135deg, #8b5cf6, #a855f7)' }, isActive: true },
        { id: '3', name: 'Deluxe', amount: 100, design: { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }, isActive: true },
        { id: '4', name: 'Ultimate', amount: 200, design: { background: 'linear-gradient(135deg, #10b981, #14b8a6)' }, isActive: true },
      ]);
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
    if (!giftDetails.recipientEmail || !giftDetails.senderName || (!isAuthenticated && !giftDetails.senderEmail)) {
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
        senderEmail: giftDetails.senderEmail || undefined,
        isGuestPurchase: !isAuthenticated,
      });

      if (res.data.success) {
        setPurchasedCard(res.data.data);
        setStep('success');
        toast.success('Gift card purchased successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to purchase gift card');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!balanceCode.trim()) {
      toast.error('Please enter a gift card code');
      return;
    }
    
    setCheckingBalance(true);
    setBalanceResult(null);
    try {
      const res = await api.get(`/giftcards/balance/${balanceCode.trim()}`);
      if (res.data.success) {
        setBalanceResult({
          balance: res.data.data.currentBalance,
          status: res.data.data.status,
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gift card not found');
    } finally {
      setCheckingBalance(false);
    }
  };

  const resetForm = () => {
    setStep('select');
    setSelectedTemplate(null);
    setCustomAmount('');
    setPurchasedCard(null);
    setGiftDetails({
      recipientName: '',
      recipientEmail: '',
      message: '',
      senderName: '',
      senderEmail: '',
    });
  };

  const currentAmount = selectedTemplate?.amount || parseFloat(customAmount) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-6xl mx-auto px-4 py-16 text-center"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/30"
          >
            <Gift className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Give the Gift of Experience
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            V2 Resort gift cards are the perfect present for any occasion. 
            Redeemable for pool access, chalets, dining, and more.
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Badge className="bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm">
              <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
              Instant Digital Delivery
            </Badge>
            <Badge className="bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm">
              <Heart className="w-4 h-4 mr-2 text-pink-500" />
              Personalized Message
            </Badge>
            <Badge className="bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-4 py-2 text-sm">
              <PartyPopper className="w-4 h-4 mr-2 text-orange-500" />
              Never Expires
            </Badge>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16 -mt-8">
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto mb-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <TabsTrigger value="buy">Buy Gift Card</TabsTrigger>
            <TabsTrigger value="balance">Check Balance</TabsTrigger>
          </TabsList>

          {/* Buy Gift Card Tab */}
          <TabsContent value="buy">
            <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6 md:p-8">
                <AnimatePresence mode="wait">
                  {/* Step 1: Select Amount */}
                  {step === 'select' && (
                    <motion.div
                      key="select"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          Choose Your Gift Amount
                        </h2>
                        <p className="text-slate-500 mt-1">
                          Select a preset amount or enter a custom value
                        </p>
                      </div>

                      {loading ? (
                        <div className="flex justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        </div>
                      ) : (
                        <>
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
                                    background: template.design.background,
                                    color: template.design.textColor || 'white'
                                  }}
                                >
                                  <Gift className="w-8 h-8 mb-2 opacity-80" />
                                  <p className="text-2xl font-bold">{formatCurrency(template.amount)}</p>
                                  <p className="text-sm opacity-80">{template.name}</p>
                                </div>
                              </motion.button>
                            ))}
                          </div>

                          <div className="border-t dark:border-slate-700 pt-6">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                              Or enter a custom amount ($10 - $1,000)
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
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Step 2: Recipient Details */}
                  {step === 'details' && (
                    <motion.div
                      key="details"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <Button variant="ghost" onClick={() => setStep('select')}>
                          ← Back
                        </Button>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {formatCurrency(currentAmount)} Gift Card
                        </Badge>
                      </div>

                      <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          Personalize Your Gift
                        </h2>
                        <p className="text-slate-500 mt-1">
                          Add details and a personal message
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Your Name *</label>
                            <Input
                              placeholder="John Smith"
                              value={giftDetails.senderName}
                              onChange={(e) => setGiftDetails(d => ({ ...d, senderName: e.target.value }))}
                            />
                          </div>
                          {!isAuthenticated && (
                            <div>
                              <label className="block text-sm font-medium mb-2">Your Email *</label>
                              <Input
                                type="email"
                                placeholder="your@email.com"
                                value={giftDetails.senderEmail}
                                onChange={(e) => setGiftDetails(d => ({ ...d, senderEmail: e.target.value }))}
                              />
                            </div>
                          )}
                        </div>

                        <div className="border-t dark:border-slate-700 pt-4">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Recipient Information
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Recipient Name</label>
                            <Input
                              placeholder="Jane Doe"
                              value={giftDetails.recipientName}
                              onChange={(e) => setGiftDetails(d => ({ ...d, recipientName: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Recipient Email *</label>
                            <Input
                              type="email"
                              placeholder="recipient@email.com"
                              value={giftDetails.recipientEmail}
                              onChange={(e) => setGiftDetails(d => ({ ...d, recipientEmail: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Personal Message (optional)</label>
                          <textarea
                            className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 resize-none"
                            rows={3}
                            placeholder="Happy Birthday! Hope you enjoy a relaxing day at V2 Resort..."
                            value={giftDetails.message}
                            onChange={(e) => setGiftDetails(d => ({ ...d, message: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          onClick={handlePurchase}
                          disabled={purchasing || !giftDetails.recipientEmail || !giftDetails.senderName || (!isAuthenticated && !giftDetails.senderEmail)}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          {purchasing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Purchase for {formatCurrency(currentAmount)}
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Success */}
                  {step === 'success' && purchasedCard && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6"
                      >
                        <Check className="w-10 h-10 text-green-600" />
                      </motion.div>
                      
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Gift Card Sent!
                      </h2>
                      <p className="text-slate-500 mb-6">
                        A {formatCurrency(currentAmount)} gift card has been sent to{' '}
                        <strong>{giftDetails.recipientEmail}</strong>
                      </p>

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-6 mb-6 max-w-sm mx-auto">
                        <p className="text-sm text-slate-500 mb-1">Gift Card Code</p>
                        <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                          {purchasedCard.code}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <Button onClick={resetForm} variant="outline">
                          Buy Another
                        </Button>
                        {isAuthenticated ? (
                          <Link href="/account/giftcards">
                            <Button>View My Gift Cards</Button>
                          </Link>
                        ) : (
                          <Link href="/login?redirect=/account/giftcards">
                            <Button>Sign In to Track</Button>
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check Balance Tab */}
          <TabsContent value="balance">
            <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm max-w-md mx-auto">
              <CardContent className="p-6 md:p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Check Your Balance
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Enter your gift card code to see your remaining balance
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Gift Card Code</label>
                    <Input
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={balanceCode}
                      onChange={(e) => setBalanceCode(e.target.value.toUpperCase())}
                      className="text-center font-mono text-lg"
                    />
                  </div>

                  <Button 
                    onClick={handleCheckBalance} 
                    className="w-full"
                    disabled={checkingBalance || !balanceCode.trim()}
                  >
                    {checkingBalance ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Check Balance'
                    )}
                  </Button>

                  {balanceResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl text-white text-center"
                    >
                      <p className="text-purple-100 text-sm mb-1">Available Balance</p>
                      <p className="text-4xl font-bold mb-2">
                        {formatCurrency(balanceResult.balance)}
                      </p>
                      <Badge className={
                        balanceResult.status === 'active' 
                          ? 'bg-white/20 text-white' 
                          : 'bg-red-500/80 text-white'
                      }>
                        {balanceResult.status === 'active' ? 'Active' : balanceResult.status}
                      </Badge>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* How It Works */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <h3 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Gift, title: 'Choose Amount', desc: 'Select a preset value or enter a custom amount' },
              { icon: Mail, title: 'Add Details', desc: 'Personalize with a message and recipient info' },
              { icon: Check, title: 'Instant Delivery', desc: 'Gift card is emailed immediately to recipient' },
            ].map((step, i) => (
              <Card key={i} className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0">
                <CardContent className="p-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                    <step.icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{step.title}</h4>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
