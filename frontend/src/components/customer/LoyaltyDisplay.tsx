'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatNumber } from '@/lib/utils';
import { Award, Star, Gift, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface LoyaltyAccount {
  id: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  tier: {
    id: string;
    name: string;
    pointsMultiplier: number;
    benefits: string[];
    color: string;
  };
  nextTier?: {
    name: string;
    pointsRequired: number;
    pointsNeeded: number;
  };
}

interface LoyaltyDisplayProps {
  variant?: 'full' | 'compact' | 'mini';
  className?: string;
}

export function LoyaltyDisplay({ variant = 'compact', className = '' }: LoyaltyDisplayProps) {
  const { user, isAuthenticated } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadAccount();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadAccount = async () => {
    try {
      const res = await api.get('/loyalty/account');
      if (res.data.success) {
        setAccount(res.data.data);
      }
    } catch {
      // User may not have loyalty account yet
    } finally {
      setLoading(false);
    }
  };

  if (loading || !account) {
    return null;
  }

  const tierColor = account.tier?.color || '#6366f1';
  const progressPercent = account.nextTier 
    ? Math.round(((account.tier?.pointsMultiplier || 0) * 100 / (account.nextTier.pointsRequired - account.nextTier.pointsNeeded + account.currentPoints)) * 100)
    : 100;

  // Mini variant - just points badge
  if (variant === 'mini') {
    return (
      <Link href="/account/loyalty" className={`flex items-center gap-2 ${className}`}>
        <div 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium"
          style={{ backgroundColor: tierColor }}
        >
          <Award className="w-4 h-4" />
          <span>{formatNumber(account.currentPoints)}</span>
        </div>
      </Link>
    );
  }

  // Compact variant - points + tier
  if (variant === 'compact') {
    return (
      <Link href="/account/loyalty" className={`block ${className}`}>
        <motion.div 
          className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r shadow-lg hover:shadow-xl transition-shadow"
          style={{ 
            background: `linear-gradient(135deg, ${tierColor}, ${tierColor}dd)` 
          }}
          whileHover={{ scale: 1.02 }}
        >
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-white">
            <p className="text-sm opacity-80">{account.tier?.name || 'Member'}</p>
            <p className="text-2xl font-bold">{formatNumber(account.currentPoints)} pts</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/60" />
        </motion.div>
      </Link>
    );
  }

  // Full variant - complete loyalty card
  return (
    <motion.div 
      className={`rounded-2xl overflow-hidden shadow-xl ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div 
        className="p-6 text-white"
        style={{ 
          background: `linear-gradient(135deg, ${tierColor}, ${tierColor}aa)` 
        }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm opacity-80">Loyalty Program</p>
            <h3 className="text-xl font-bold">{account.tier?.name || 'Member'}</h3>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
        </div>
        
        <div className="text-center py-4">
          <p className="text-5xl font-bold">{formatNumber(account.currentPoints)}</p>
          <p className="text-sm opacity-80">Available Points</p>
        </div>
        
        {account.tier?.pointsMultiplier > 1 && (
          <div className="flex items-center justify-center gap-2 mt-2 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>{account.tier.pointsMultiplier}x points on all purchases</span>
          </div>
        )}
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6">
        {account.nextTier && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Progress to {account.nextTier.name}</span>
              <span className="font-medium">{formatNumber(account.nextTier.pointsNeeded)} pts needed</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full rounded-full"
                style={{ backgroundColor: tierColor }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(account.totalPointsEarned)}
            </p>
            <p className="text-xs text-slate-500">Total Earned</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(account.totalPointsRedeemed)}
            </p>
            <p className="text-xs text-slate-500">Total Redeemed</p>
          </div>
        </div>
        
        {account.tier?.benefits && account.tier.benefits.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">Your Benefits</p>
            <div className="space-y-2">
              {account.tier.benefits.slice(0, 3).map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <Link 
          href="/account/loyalty"
          className="mt-6 block w-full text-center py-3 rounded-lg font-medium transition-colors"
          style={{ 
            backgroundColor: `${tierColor}15`,
            color: tierColor
          }}
        >
          View Full Details
        </Link>
      </div>
    </motion.div>
  );
}

// Points calculation helper for product pages
interface PointsPreviewProps {
  amount: number;
  className?: string;
}

export function PointsPreview({ amount, className = '' }: PointsPreviewProps) {
  const { isAuthenticated } = useAuth();
  const [pointsRate, setPointsRate] = useState(1);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/loyalty/calculate', { params: { amount } })
        .then(res => {
          if (res.data.success) {
            setPointsRate(res.data.data.points / amount || 1);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, amount]);

  const pointsToEarn = Math.floor(amount * pointsRate);

  if (!isAuthenticated || pointsToEarn <= 0) return null;

  return (
    <div className={`flex items-center gap-1.5 text-sm ${className}`}>
      <Award className="w-4 h-4 text-amber-500" />
      <span className="text-slate-600 dark:text-slate-400">
        Earn <span className="font-semibold text-amber-600">{formatNumber(pointsToEarn)}</span> loyalty points
      </span>
    </div>
  );
}
