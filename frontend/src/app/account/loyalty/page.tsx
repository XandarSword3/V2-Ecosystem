'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Award,
  Star,
  TrendingUp,
  Gift,
  History,
  ChevronRight,
  RefreshCw,
  Check,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LoyaltyAccount {
  id: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  lifetimeValue: number;
  tier: {
    id: string;
    name: string;
    pointsMultiplier: number;
    benefits: string[];
    color: string;
    minPoints: number;
  };
  nextTier?: {
    name: string;
    pointsRequired: number;
    pointsNeeded: number;
    color: string;
  };
}

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  referenceType?: string;
  createdAt: string;
}

interface Tier {
  id: string;
  name: string;
  minPoints: number;
  pointsMultiplier: number;
  benefits: string[];
  color: string;
}

export default function CustomerLoyaltyPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/loyalty');
      return;
    }
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isLoading]);

  const loadData = async () => {
    try {
      const [accountRes, transactionsRes, tiersRes] = await Promise.all([
        api.get('/loyalty/account'),
        api.get('/loyalty/transactions'),
        api.get('/loyalty/tiers'),
      ]);

      if (accountRes.data.success) setAccount(accountRes.data.data);
      if (transactionsRes.data.success) setTransactions(transactionsRes.data.data.slice(0, 10));
      if (tiersRes.data.success) setTiers(tiersRes.data.data);
    } catch {
      // User might not have a loyalty account yet
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="text-center p-12">
          <Award className="w-16 h-16 mx-auto text-purple-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Join Our Loyalty Program</h2>
          <p className="text-slate-500 mb-6">
            Start earning points on every purchase and unlock exclusive rewards!
          </p>
          <Button onClick={() => api.post('/loyalty/enroll').then(() => loadData())}>
            Enroll Now
          </Button>
        </Card>
      </div>
    );
  }

  const tierColor = account.tier?.color || '#7c3aed';
  const progressToNext = account.nextTier
    ? ((account.totalPointsEarned - account.tier.minPoints) / (account.nextTier.pointsRequired - account.tier.minPoints)) * 100
    : 100;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Hero Card */}
      <motion.div variants={fadeInUp}>
        <Card 
          className="overflow-hidden mb-8"
          style={{ 
            background: `linear-gradient(135deg, ${tierColor}, ${tierColor}dd)`
          }}
        >
          <CardContent className="p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                  <Award className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Welcome back,</p>
                  <h1 className="text-2xl font-bold">{user?.fullName?.split(' ')[0] || 'Member'}</h1>
                  <Badge className="bg-white/20 text-white mt-1">
                    {account.tier?.name || 'Member'}
                  </Badge>
                </div>
              </div>
              
              <div className="text-center md:text-right">
                <p className="text-white/80 text-sm">Available Points</p>
                <p className="text-5xl font-bold">{formatNumber(account.currentPoints)}</p>
                {account.tier?.pointsMultiplier > 1 && (
                  <p className="text-sm mt-1 flex items-center justify-center md:justify-end gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {account.tier.pointsMultiplier}x points on all purchases
                  </p>
                )}
              </div>
            </div>

            {/* Progress to next tier */}
            {account.nextTier && (
              <div className="mt-8">
                <div className="flex justify-between text-sm mb-2">
                  <span>{account.tier?.name}</span>
                  <span>{account.nextTier.name}</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-sm text-white/80 mt-2 text-center">
                  {formatNumber(account.nextTier.pointsNeeded)} more points to reach {account.nextTier.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{formatNumber(account.totalPointsEarned)}</p>
            <p className="text-xs text-slate-500">Total Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="w-6 h-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{formatNumber(account.totalPointsRedeemed)}</p>
            <p className="text-xs text-slate-500">Redeemed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-6 h-6 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold">{tiers.findIndex(t => t.id === account.tier?.id) + 1}/{tiers.length}</p>
            <p className="text-xs text-slate-500">Tier Level</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-6 h-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(account.lifetimeValue || 0)}</p>
            <p className="text-xs text-slate-500">Lifetime Value</p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Benefits */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Your Benefits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.tier?.benefits?.map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <span className="text-slate-700 dark:text-slate-300">{benefit}</span>
                </div>
              ))}
              {account.nextTier && (
                <div className="pt-4 border-t dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-500 mb-2">
                    Unlock with {account.nextTier.name}:
                  </p>
                  {tiers.find(t => t.name === account.nextTier?.name)?.benefits?.slice(0, 2).map((benefit, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-400">
                      <Clock className="w-5 h-5 mt-0.5" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  No transactions yet. Start shopping to earn points!
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-2 border-b dark:border-slate-700 last:border-0">
                      <div>
                        <p className="font-medium text-sm">{txn.description}</p>
                        <p className="text-xs text-slate-500">{formatDate(txn.createdAt)}</p>
                      </div>
                      <span className={`font-bold ${
                        txn.type === 'earned' || txn.type === 'bonus' || txn.type === 'adjustment' && txn.points > 0
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {txn.points > 0 ? '+' : ''}{formatNumber(txn.points)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tier Progress */}
      <motion.div variants={fadeInUp} className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Membership Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex overflow-x-auto gap-4 pb-4">
              {tiers.map((tier, index) => {
                const isCurrent = tier.id === account.tier?.id;
                const isAchieved = account.totalPointsEarned >= tier.minPoints;
                
                return (
                  <div 
                    key={tier.id}
                    className={`flex-shrink-0 w-48 p-4 rounded-xl border-2 transition-all ${
                      isCurrent 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                        : isAchieved
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: tier.color + '20' }}
                    >
                      <Award className="w-5 h-5" style={{ color: tier.color }} />
                    </div>
                    <h4 className="font-bold">{tier.name}</h4>
                    <p className="text-sm text-slate-500">
                      {formatNumber(tier.minPoints)}+ points
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {tier.pointsMultiplier}x multiplier
                    </p>
                    {isCurrent && (
                      <Badge className="mt-2 bg-purple-500">Current</Badge>
                    )}
                    {isAchieved && !isCurrent && (
                      <Badge className="mt-2 bg-green-500">Achieved</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div variants={fadeInUp} className="mt-8 text-center">
        <p className="text-slate-500 mb-4">
          Use your points at checkout or save them for bigger rewards!
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/restaurant">
            <Button variant="outline">
              Order Food
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="/chalets">
            <Button>
              Book a Chalet
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
