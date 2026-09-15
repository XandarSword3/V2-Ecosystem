'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { GiftCardPurchase, GiftCardBalance } from '@/components/customer/GiftCardPurchase';
import {
  Gift,
  CreditCard,
  History,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

export interface GiftCardRecord {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency?: string;
  status: 'active' | 'redeemed' | 'expired';
  purchasedAt: string;
  expiresAt?: string;
  recipientEmail?: string;
}

export interface GiftCardsHubProps {
  propertySlug?: string;
  className?: string;
}

export function GiftCardsHub({ propertySlug = '', className = '' }: GiftCardsHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'cards' | 'purchase' | 'balance'>('cards');
  const [myCards, setMyCards] = useState<GiftCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCards = async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/giftcards/my-cards', { signal });
      if (res.data?.success) {
        setMyCards(res.data.data || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      fetchCards(controller.signal);
      return () => controller.abort();
    } else {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Gift card code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="gift-cards-hub">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-600" />
            Gift Cards & Stored Value
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your digital gift cards, check balances, or purchase gifts for friends and family.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeTab === 'cards' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('cards')}
            className="text-xs"
            data-testid="tab-cards-btn"
          >
            My Cards ({myCards.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'purchase' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('purchase')}
            className="text-xs"
            data-testid="tab-purchase-btn"
          >
            Buy Gift Card
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'balance' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('balance')}
            className="text-xs"
            data-testid="tab-balance-btn"
          >
            Check Balance
          </Button>
        </div>
      </div>

      {activeTab === 'cards' && (
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Active Stored Value Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : myCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs" data-testid="no-giftcards-msg">
                <Gift className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="font-semibold text-foreground">No active gift cards</p>
                <p className="mt-1">Purchase a digital gift card to store value or send as a gift.</p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab('purchase')}
                  className="mt-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Buy a Gift Card
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="giftcards-list">
                {myCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-4 rounded-xl border border-emerald-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-900 dark:to-slate-900/80 shadow-sm space-y-3"
                    data-testid={`giftcard-card-${card.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        Digital Gift Card
                      </span>
                      <Badge
                        className={`text-[10px] ${
                          card.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {card.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className="text-2xl font-extrabold font-mono text-foreground" data-testid={`giftcard-balance-${card.id}`}>
                        {formatCurrency(card.currentBalance, card.currency || 'USD')}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold tracking-wider text-foreground">
                        {card.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(card.code)}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        aria-label="Copy code"
                      >
                        {copiedCode === card.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'purchase' && (
        <Card className="border-slate-200 dark:border-slate-800 p-6">
          <GiftCardPurchase
            onSuccess={() => {
              fetchCards();
              setActiveTab('cards');
            }}
          />
        </Card>
      )}

      {activeTab === 'balance' && (
        <Card className="border-slate-200 dark:border-slate-800 p-6">
          <GiftCardBalance />
        </Card>
      )}
    </div>
  );
}

export default GiftCardsHub;
