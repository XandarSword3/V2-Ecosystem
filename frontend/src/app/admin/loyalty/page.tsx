'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Trophy,
  Users,
  Coins,
  TrendingUp,
  Settings,
  Search,
  Plus,
  Edit,
  Trash2,
  Gift,
  Star,
  ArrowUpDown,
  RefreshCw,
  Crown,
  Medal,
  Award,
  ChevronRight,
} from 'lucide-react';

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  points_multiplier: number;
  color: string;
  benefits: Record<string, any>;
  is_active: boolean;
}

interface LoyaltyAccount {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  current_tier: string;
  tier_name: string;
  tier_color: string;
  total_points: number;
  lifetime_points: number;
  redeemed_points: number;
  created_at: string;
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  description: string;
  order_type: string;
  created_at: string;
  user_name?: string;
}

interface LoyaltyStats {
  totalMembers: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  activeMembers30Days: number;
  tierDistribution: Array<{ tier_name: string; tier_color: string; count: number }>;
}

interface LoyaltySettings {
  points_per_dollar: number;
  redemption_value: number;
  min_redemption_points: number;
  points_expiry_days: number;
}

export default function LoyaltyAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tiersRes, statsRes, settingsRes] = await Promise.all([
        api.get('/loyalty/tiers'),
        api.get('/loyalty/stats'),
        api.get('/loyalty/settings'),
      ]);

      if (tiersRes.data.success) setTiers(tiersRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (settingsRes.data.success) setSettings(settingsRes.data.data);
    } catch (error) {
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/loyalty/accounts', { params: { search: searchQuery } });
      if (res.data.success) setAccounts(res.data.data);
    } catch (error) {
      toast.error('Failed to load accounts');
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      loadAccounts();
    }
  }, [activeTab, searchQuery]);

  const handleUpdateSettings = async () => {
    if (!settings) return;
    try {
      const res = await api.put('/loyalty/settings', settings);
      if (res.data.success) {
        toast.success('Settings updated');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedAccount || !adjustAmount) return;
    try {
      const res = await api.post(`/loyalty/accounts/${selectedAccount.id}/adjust`, {
        points: parseInt(adjustAmount),
        reason: adjustReason || 'Manual adjustment by admin',
      });
      if (res.data.success) {
        toast.success('Points adjusted');
        setShowAdjustModal(false);
        setSelectedAccount(null);
        setAdjustAmount('');
        setAdjustReason('');
        loadAccounts();
      }
    } catch (error) {
      toast.error('Failed to adjust points');
    }
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'platinum': return <Crown className="w-5 h-5" />;
      case 'gold': return <Medal className="w-5 h-5" />;
      case 'silver': return <Award className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Loyalty Program</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage rewards, tiers, and member points</p>
        </div>
        <Button onClick={loadData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Members</p>
                <p className="text-3xl font-bold">{stats?.totalMembers?.toLocaleString() || 0}</p>
              </div>
              <Users className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Points Issued</p>
                <p className="text-3xl font-bold">{stats?.totalPointsIssued?.toLocaleString() || 0}</p>
              </div>
              <Coins className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Points Redeemed</p>
                <p className="text-3xl font-bold">{stats?.totalPointsRedeemed?.toLocaleString() || 0}</p>
              </div>
              <Gift className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Active (30 days)</p>
                <p className="text-3xl font-bold">{stats?.activeMembers30Days?.toLocaleString() || 0}</p>
              </div>
              <TrendingUp className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Tier Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.tierDistribution?.map((tier) => (
                    <div key={tier.tier_name} className="flex items-center gap-4">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: tier.tier_color }}
                      />
                      <span className="flex-1 font-medium">{tier.tier_name}</span>
                      <span className="text-slate-500">{tier.count} members</span>
                      <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            backgroundColor: tier.tier_color,
                            width: `${(tier.count / (stats?.totalMembers || 1)) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tiers Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Tier Levels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tiers.filter(t => t.is_active).map((tier) => (
                    <div 
                      key={tier.id} 
                      className="p-4 rounded-lg border-2 flex items-center gap-4"
                      style={{ borderColor: tier.color }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: tier.color + '20', color: tier.color }}
                      >
                        {getTierIcon(tier.name)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{tier.name}</h3>
                        <p className="text-sm text-slate-500">
                          {tier.min_points.toLocaleString()}+ points • {tier.points_multiplier}x multiplier
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search members by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={loadAccounts}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left p-4 font-medium text-slate-500">Member</th>
                      <th className="text-left p-4 font-medium text-slate-500">Tier</th>
                      <th className="text-right p-4 font-medium text-slate-500">Current Points</th>
                      <th className="text-right p-4 font-medium text-slate-500">Lifetime Points</th>
                      <th className="text-left p-4 font-medium text-slate-500">Joined</th>
                      <th className="text-right p-4 font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{account.user_name}</p>
                            <p className="text-sm text-slate-500">{account.user_email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            style={{ backgroundColor: account.tier_color + '20', color: account.tier_color }}
                          >
                            {account.tier_name}
                          </Badge>
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {account.total_points.toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-slate-500">
                          {account.lifetime_points.toLocaleString()}
                        </td>
                        <td className="p-4 text-slate-500">
                          {formatDate(account.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedAccount(account);
                              setShowAdjustModal(true);
                            }}
                          >
                            <ArrowUpDown className="w-4 h-4 mr-1" />
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTier(null); setShowTierModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <Card 
                key={tier.id} 
                className={`relative overflow-hidden ${!tier.is_active ? 'opacity-50' : ''}`}
              >
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ backgroundColor: tier.color }}
                />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: tier.color + '20', color: tier.color }}
                    >
                      {getTierIcon(tier.name)}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setEditingTier(tier); setShowTierModal(true); }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                  <div className="space-y-2 text-sm text-slate-500">
                    <p>Min Points: {tier.min_points.toLocaleString()}</p>
                    <p>Multiplier: {tier.points_multiplier}x</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Program Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Points per Dollar Spent</label>
                  <Input
                    type="number"
                    value={settings?.points_per_dollar || 1}
                    onChange={(e) => setSettings(s => s ? { ...s, points_per_dollar: parseFloat(e.target.value) } : null)}
                  />
                  <p className="text-xs text-slate-500 mt-1">How many points customers earn per $1 spent</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Point Redemption Value ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings?.redemption_value || 0.01}
                    onChange={(e) => setSettings(s => s ? { ...s, redemption_value: parseFloat(e.target.value) } : null)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Dollar value of each point when redeemed</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Redemption Points</label>
                  <Input
                    type="number"
                    value={settings?.min_redemption_points || 100}
                    onChange={(e) => setSettings(s => s ? { ...s, min_redemption_points: parseInt(e.target.value) } : null)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimum points required to redeem</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Points Expiry (Days)</label>
                  <Input
                    type="number"
                    value={settings?.points_expiry_days || 365}
                    onChange={(e) => setSettings(s => s ? { ...s, points_expiry_days: parseInt(e.target.value) } : null)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Days until points expire (0 = never)</p>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleUpdateSettings}>
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Points Modal */}
      <AnimatePresence>
        {showAdjustModal && selectedAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAdjustModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Adjust Points</h3>
              <p className="text-slate-500 mb-4">
                Adjusting points for <strong>{selectedAccount.user_name}</strong>
                <br />
                Current balance: <strong>{selectedAccount.total_points.toLocaleString()}</strong> points
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Point Adjustment</label>
                  <Input
                    type="number"
                    placeholder="Enter positive or negative amount"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Use negative values to deduct points</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Reason</label>
                  <Input
                    placeholder="Reason for adjustment"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdjustPoints}>
                  Adjust Points
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
