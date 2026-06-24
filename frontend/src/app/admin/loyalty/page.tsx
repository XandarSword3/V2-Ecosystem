'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProperty } from '@/context/PropertyContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { api, API_BASE_URL } from '@/lib/api';
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
  Upload,
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
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
  tier?: {
    id: string;
    name: string;
    color: string;
  };
  // Legacy direct fields for compatibility
  user_name?: string;
  user_email?: string;
  current_tier?: string;
  tier_name?: string;
  tier_color?: string;
  available_points?: number;
  total_points: number;
  lifetime_points: number;
  redeemed_points?: number;
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

// Map backend response structure to frontend LoyaltyStats interface
function mapBackendStats(raw: any): LoyaltyStats {
  const summary = raw?.summary || raw || {};
  return {
    totalMembers: summary.total_members ?? summary.totalMembers ?? 0,
    totalPointsIssued: summary.total_lifetime_points ?? summary.totalPointsIssued ?? 0,
    totalPointsRedeemed: summary.total_outstanding_points
      ? (summary.total_lifetime_points || 0) - (summary.total_outstanding_points || 0)
      : summary.totalPointsRedeemed ?? 0,
    activeMembers30Days: summary.active_members_30_days ?? summary.activeMembers30Days ?? 0,
    tierDistribution: (raw?.tierDistribution || []).map((t: any) => ({
      tier_name: t.tier_name || t.name || 'Unknown',
      tier_color: t.tier_color || t.color || '#6b7280',
      count: t.count || 0,
    })),
  };
}

interface LoyaltySettings {
  points_per_dollar: number;
  redemption_value: number;
  min_redemption_points: number;
  points_expiry_days: number;
}

export default function LoyaltyAdminPage() {
  const router = useRouter();
  const { activePropertyId } = useProperty();
  const propertyHeader = activePropertyId ? { 'x-property-id': activePropertyId } : undefined;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePropertyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tiersRes, statsRes, settingsRes] = await Promise.all([
        api.get('/loyalty/tiers', { headers: propertyHeader }),
        api.get('/loyalty/stats', { headers: propertyHeader }),
        api.get('/loyalty/settings', { headers: propertyHeader }),
      ]);

      if (tiersRes.data.success) setTiers(tiersRes.data.data);
      if (statsRes.data.success) setStats(mapBackendStats(statsRes.data.data));
      if (settingsRes.data.success) setSettings(settingsRes.data.data);
    } catch (error) {
      toast.error('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/loyalty/accounts', { params: { search: searchQuery }, headers: propertyHeader });
      if (res.data.success) setAccounts(res.data.data);
    } catch (error) {
      toast.error('Failed to load accounts');
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      loadAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery, activePropertyId]);

  const handleUpdateSettings = async () => {
    if (!settings) return;
    try {
      const res = await api.put('/loyalty/settings', settings, { headers: propertyHeader });
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
      }, { headers: propertyHeader });
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

  if (!activePropertyId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-slate-500 dark:text-slate-400">Select a property to view the loyalty program</p>
        </div>
      </div>
    );
  }

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
        <Button onClick={() => loadData()} variant="outline" className="gap-2">
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
                    {accounts.map((account) => {
                      // Handle both nested and flat structures
                      const userName = account.user?.full_name || account.user_name || 'Unknown';
                      const userEmail = account.user?.email || account.user_email || '';
                      const tierName = account.tier?.name || account.tier_name || 'Bronze';
                      const tierColor = account.tier?.color || account.tier_color || '#CD7F32';
                      const currentPoints = account.available_points ?? account.total_points ?? 0;
                      const lifetimePoints = account.lifetime_points ?? 0;
                      
                      return (
                        <tr key={account.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{userName}</p>
                              <p className="text-sm text-slate-500">{userEmail}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge 
                              style={{ backgroundColor: tierColor + '20', color: tierColor }}
                            >
                              {tierName}
                            </Badge>
                          </td>
                          <td className="p-4 text-right font-semibold">
                            {currentPoints.toLocaleString()}
                          </td>
                          <td className="p-4 text-right text-slate-500">
                            {lifetimePoints.toLocaleString()}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/loyalty/import')}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
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
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete the "${tier.name}" tier? Members will be migrated to another tier.`)) return;
                          try {
                            // Ensure CSRF token is present
                            const csrfCookie = document.cookie.match(/(^| )csrf-token=([^;]+)/);
                            let csrfToken = csrfCookie ? csrfCookie[2] : undefined;
                            if (!csrfToken) {
                              // Fetch new CSRF token
                              const res = await axios.get(
                                `${API_BASE_URL.replace('/api/v1', '')}/api/csrf-token`,
                                { withCredentials: true }
                              );
                              csrfToken = res.data?.csrfToken;
                            }
                            await api.delete(`/loyalty/tiers/${tier.id}`, {
                              headers: { 'X-CSRF-Token': csrfToken, ...(activePropertyId ? { 'x-property-id': activePropertyId } : {}) },
                              withCredentials: true,
                            });
                            toast.success('Tier deleted successfully');
                            loadData();
                          } catch (error: any) {
                            toast.error(error.response?.data?.error || 'Failed to delete tier');
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
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

      {/* Tier Create/Edit Modal */}
      <AnimatePresence>
        {showTierModal && (
          <TierModal
            tier={editingTier}
            onClose={() => { setShowTierModal(false); setEditingTier(null); }}
            onSave={async (tierData) => {
              try {
                if (editingTier) {
                  const res = await api.put(`/loyalty/tiers/${editingTier.id}`, tierData, { headers: propertyHeader });
                  if (res.data.success) {
                    toast.success('Tier updated');
                  }
                } else {
                  const res = await api.post('/loyalty/tiers', tierData, { headers: propertyHeader });
                  if (res.data.success) {
                    toast.success('Tier created');
                  }
                }
                setShowTierModal(false);
                setEditingTier(null);
                loadData();
              } catch (error) {
                toast.error('Failed to save tier');
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Tier Modal Component
interface TierModalProps {
  tier: LoyaltyTier | null;
  onClose: () => void;
  onSave: (data: Partial<LoyaltyTier>) => Promise<void>;
}

function TierModal({ tier, onClose, onSave }: TierModalProps) {
  const [form, setForm] = useState({
    name: tier?.name || '',
    min_points: tier?.min_points?.toString() || '0',
    points_multiplier: tier?.points_multiplier?.toString() || '1',
    color: tier?.color || '#3b82f6',
    benefits: tier?.benefits || {},
    is_active: tier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [benefitKey, setBenefitKey] = useState('');
  const [benefitValue, setBenefitValue] = useState('');

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    await onSave({
      name: form.name,
      min_points: parseInt(form.min_points) || 0,
      points_multiplier: parseFloat(form.points_multiplier) || 1,
      color: form.color,
      benefits: form.benefits,
      is_active: form.is_active,
    });
    setSaving(false);
  };

  const addBenefit = () => {
    if (benefitKey && benefitValue) {
      setForm(f => ({
        ...f,
        benefits: { ...f.benefits, [benefitKey]: benefitValue }
      }));
      setBenefitKey('');
      setBenefitValue('');
    }
  };

  const removeBenefit = (key: string) => {
    setForm(f => {
      const newBenefits = { ...f.benefits };
      delete newBenefits[key];
      return { ...f, benefits: newBenefits };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold mb-6">{tier ? 'Edit Tier' : 'Create Tier'}</h3>
        
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Tier Name *</label>
            <Input
              placeholder="e.g., Gold, Platinum, Diamond"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Min Points & Multiplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Points</label>
              <Input
                type="number"
                min="0"
                value={form.min_points}
                onChange={(e) => setForm(f => ({ ...f, min_points: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">Points needed to reach this tier</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Points Multiplier</label>
              <Input
                type="number"
                min="1"
                step="0.1"
                value={form.points_multiplier}
                onChange={(e) => setForm(f => ({ ...f, points_multiplier: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">Earning multiplier (e.g., 1.5x)</p>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Tier Color</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="#3b82f6"
                className="flex-1"
              />
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: form.color + '20', color: form.color }}
              >
                <Star className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-medium mb-2">Benefits</label>
            <div className="space-y-2 mb-3">
              {Object.entries(form.benefits).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-2 rounded">
                  <span className="font-medium">{key}:</span>
                  <span className="flex-1">{String(value)}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeBenefit(key)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Benefit name"
                value={benefitKey}
                onChange={(e) => setBenefitKey(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={benefitValue}
                onChange={(e) => setBenefitValue(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={addBenefit}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              e.g., "Free Pool Entry" → "2 per month", "Discount" → "10%"
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="tier-active"
              checked={form.is_active}
              onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="tier-active" className="text-sm font-medium">
              Active (visible to customers)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {tier ? 'Update Tier' : 'Create Tier'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
