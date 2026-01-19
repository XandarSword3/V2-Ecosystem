'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { GiftCardPurchase, GiftCardBalance } from '@/components/customer/GiftCardPurchase';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Gift,
  CreditCard,
  History,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface GiftCard {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: 'active' | 'redeemed' | 'expired';
  purchasedAt: string;
  expiresAt?: string;
  recipientEmail?: string;
  recipientName?: string;
}

interface Transaction {
  id: string;
  giftCardCode: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export default function CustomerGiftCardsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('purchase');
  const [myCards, setMyCards] = useState<GiftCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/giftcards');
      return;
    }
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isLoading]);

  const loadData = async () => {
    try {
      const [cardsRes, transactionsRes] = await Promise.all([
        api.get('/giftcards/my-cards'),
        api.get('/giftcards/transactions'),
      ]);

      if (cardsRes.data.success) setMyCards(cardsRes.data.data);
      if (transactionsRes.data.success) setTransactions(transactionsRes.data.data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePurchaseSuccess = () => {
    loadData();
    setActiveTab('cards');
    toast.success('Gift card purchased! Check your email for details.');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'redeemed':
        return <Badge className="bg-slate-100 text-slate-700">Fully Redeemed</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="text-center mb-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mb-4">
          <Gift className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Gift Cards</h1>
        <p className="text-slate-500 mt-2">
          Send the perfect gift or check your balance
        </p>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-8">
          <TabsTrigger value="purchase">Buy Gift Card</TabsTrigger>
          <TabsTrigger value="cards">My Cards</TabsTrigger>
          <TabsTrigger value="balance">Check Balance</TabsTrigger>
        </TabsList>

        {/* Purchase Tab */}
        <TabsContent value="purchase">
          <motion.div variants={fadeInUp}>
            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-6">
                <GiftCardPurchase onSuccess={handlePurchaseSuccess} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* My Cards Tab */}
        <TabsContent value="cards">
          <motion.div variants={fadeInUp} className="space-y-6">
            {myCards.length === 0 ? (
              <Card className="text-center p-12">
                <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Gift Cards Yet</h3>
                <p className="text-slate-500 mb-4">
                  Purchase a gift card or receive one to see it here.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myCards.map((card) => (
                  <Card key={card.id} className="overflow-hidden">
                    <div 
                      className="h-2"
                      style={{ 
                        background: card.status === 'active' 
                          ? 'linear-gradient(to right, #ec4899, #8b5cf6)' 
                          : '#e2e8f0'
                      }}
                    />
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                            <Gift className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <code className="text-lg font-mono font-bold">
                                {card.code}
                              </code>
                              <button
                                onClick={() => handleCopyCode(card.code)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                {copiedCode === card.code ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(card.status)}
                              <span className="text-xs text-slate-500">
                                Purchased {formatDate(card.purchasedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Balance</p>
                          <p className={`text-2xl font-bold ${
                            card.currentBalance > 0 ? 'text-green-600' : 'text-slate-400'
                          }`}>
                            {formatCurrency(card.currentBalance)}
                          </p>
                          <p className="text-xs text-slate-400">
                            of {formatCurrency(card.initialBalance)}
                          </p>
                        </div>
                      </div>
                      
                      {card.recipientEmail && (
                        <div className="mt-4 pt-4 border-t dark:border-slate-700">
                          <p className="text-sm text-slate-500">
                            Sent to: {card.recipientName || card.recipientEmail}
                          </p>
                        </div>
                      )}
                      
                      {card.expiresAt && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                          <Clock className="w-3 h-3" />
                          Expires {formatDate(card.expiresAt)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Transaction History */}
            {transactions.length > 0 && (
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.slice(0, 10).map((txn) => (
                      <div 
                        key={txn.id} 
                        className="flex items-center justify-between py-3 border-b dark:border-slate-700 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {txn.type === 'purchase' ? (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <CreditCard className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm capitalize">{txn.type}</p>
                            <p className="text-xs text-slate-500">
                              {txn.giftCardCode} • {formatDate(txn.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold ${
                          txn.type === 'purchase' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {txn.type === 'purchase' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* Check Balance Tab */}
        <TabsContent value="balance">
          <motion.div variants={fadeInUp} className="max-w-md mx-auto">
            <GiftCardBalance />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
