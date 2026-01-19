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
  Ticket,
  Percent,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Tag,
  Users,
  ShoppingCart,
} from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed' | 'free_item';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  applies_to: string;
  usage_limit?: number;
  usage_count: number;
  per_user_limit: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

interface CouponStats {
  total_coupons: number;
  active_coupons: number;
  total_uses: number;
  totalDiscountGiven: number;
}

export default function CouponsAdminPage() {
  const [activeTab, setActiveTab] = useState('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'free_item',
    discountValue: '',
    minOrderAmount: '0',
    maxDiscountAmount: '',
    appliesTo: 'all',
    usageLimit: '',
    perUserLimit: '1',
    validFrom: '',
    validUntil: '',
    firstOrderOnly: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [couponsRes, statsRes] = await Promise.all([
        api.get('/coupons', { params: { status: statusFilter === 'all' ? undefined : statusFilter } }),
        api.get('/coupons/stats'),
      ]);

      if (couponsRes.data.success) setCoupons(couponsRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data.summary);
    } catch (error) {
      toast.error('Failed to load coupon data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const generateCode = async () => {
    try {
      const res = await api.get('/coupons/generate-code');
      if (res.data.success) {
        setFormData(f => ({ ...f, code: res.data.data.code }));
      }
    } catch (error) {
      toast.error('Failed to generate code');
    }
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.discountValue) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        minOrderAmount: parseFloat(formData.minOrderAmount) || 0,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : undefined,
        appliesTo: formData.appliesTo,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        perUserLimit: parseInt(formData.perUserLimit) || 1,
        validFrom: formData.validFrom || undefined,
        validUntil: formData.validUntil || undefined,
        firstOrderOnly: formData.firstOrderOnly,
      };
      
      let res;
      if (editingCoupon) {
        res = await api.put(`/coupons/${editingCoupon.id}`, payload);
      } else {
        res = await api.post('/coupons', payload);
      }
      
      if (res.data.success) {
        toast.success(editingCoupon ? 'Coupon updated' : 'Coupon created');
        setShowCreateModal(false);
        setEditingCoupon(null);
        resetForm();
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save coupon');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderAmount: '0',
      maxDiscountAmount: '',
      appliesTo: 'all',
      usageLimit: '',
      perUserLimit: '1',
      validFrom: '',
      validUntil: '',
      firstOrderOnly: false,
    });
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value.toString(),
      minOrderAmount: coupon.min_order_amount.toString(),
      maxDiscountAmount: coupon.max_discount_amount?.toString() || '',
      appliesTo: coupon.applies_to,
      usageLimit: coupon.usage_limit?.toString() || '',
      perUserLimit: coupon.per_user_limit.toString(),
      validFrom: coupon.valid_from?.split('T')[0] || '',
      validUntil: coupon.valid_until?.split('T')[0] || '',
      firstOrderOnly: false,
    });
    setShowCreateModal(true);
  };

  const handleDelete = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    
    try {
      const res = await api.delete(`/coupons/${couponId}`);
      if (res.data.success) {
        toast.success('Coupon deleted');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const res = await api.put(`/coupons/${coupon.id}`, { isActive: !coupon.is_active });
      if (res.data.success) {
        toast.success(coupon.is_active ? 'Coupon deactivated' : 'Coupon activated');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to update coupon');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}% off`;
    } else if (coupon.discount_type === 'fixed') {
      return `${formatCurrency(coupon.discount_value)} off`;
    } else {
      return 'Free item';
    }
  };

  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;
    
    if (!coupon.is_active) {
      return <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>;
    }
    if (validUntil && validUntil < now) {
      return <Badge className="bg-amber-100 text-amber-700">Expired</Badge>;
    }
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return <Badge className="bg-red-100 text-red-700">Limit Reached</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  };

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = searchQuery === '' || 
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Coupons</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage discount codes and promotions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setEditingCoupon(null); setShowCreateModal(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Coupons</p>
                <p className="text-3xl font-bold">{stats?.total_coupons || 0}</p>
              </div>
              <Ticket className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Active Coupons</p>
                <p className="text-3xl font-bold">{stats?.active_coupons || 0}</p>
              </div>
              <CheckCircle className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Total Uses</p>
                <p className="text-3xl font-bold">{stats?.total_uses || 0}</p>
              </div>
              <Users className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Discount Given</p>
                <p className="text-3xl font-bold">{formatCurrency(stats?.totalDiscountGiven || 0)}</p>
              </div>
              <DollarSign className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search by code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left p-4 font-medium text-slate-500">Code</th>
                  <th className="text-left p-4 font-medium text-slate-500">Name</th>
                  <th className="text-left p-4 font-medium text-slate-500">Discount</th>
                  <th className="text-left p-4 font-medium text-slate-500">Applies To</th>
                  <th className="text-center p-4 font-medium text-slate-500">Usage</th>
                  <th className="text-left p-4 font-medium text-slate-500">Valid Until</th>
                  <th className="text-left p-4 font-medium text-slate-500">Status</th>
                  <th className="text-right p-4 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                          {coupon.code}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyCode(coupon.code)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{coupon.name}</p>
                      {coupon.description && (
                        <p className="text-sm text-slate-500 truncate max-w-xs">{coupon.description}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge className="bg-blue-100 text-blue-700">
                        {coupon.discount_type === 'percentage' && <Percent className="w-3 h-3 mr-1" />}
                        {getDiscountDisplay(coupon)}
                      </Badge>
                      {coupon.min_order_amount > 0 && (
                        <p className="text-xs text-slate-500 mt-1">Min: {formatCurrency(coupon.min_order_amount)}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize">
                        {coupon.applies_to}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium">{coupon.usage_count}</span>
                      {coupon.usage_limit && (
                        <span className="text-slate-400">/{coupon.usage_limit}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500">
                      {coupon.valid_until ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(coupon.valid_until)}
                        </div>
                      ) : (
                        <span className="text-slate-400">No expiry</span>
                      )}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(coupon)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleToggleActive(coupon)}
                          title={coupon.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {coupon.is_active ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(coupon)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(coupon.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowCreateModal(false); setEditingCoupon(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold mb-4">
                {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-2">Code *</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="SUMMER20"
                      value={formData.code}
                      onChange={(e) => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    />
                    <Button variant="outline" onClick={generateCode} type="button">
                      Generate
                    </Button>
                  </div>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <Input
                    placeholder="Summer Sale 20% Off"
                    value={formData.name}
                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Discount Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData(f => ({ ...f, discountType: e.target.value as any }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_item">Free Item</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {formData.discountType === 'percentage' ? 'Percentage *' : 'Amount *'}
                  </label>
                  <Input
                    type="number"
                    placeholder={formData.discountType === 'percentage' ? '20' : '10.00'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData(f => ({ ...f, discountValue: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Order ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData(f => ({ ...f, minOrderAmount: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Max Discount ($)</label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData(f => ({ ...f, maxDiscountAmount: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Applies To</label>
                  <select
                    value={formData.appliesTo}
                    onChange={(e) => setFormData(f => ({ ...f, appliesTo: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="all">All Orders</option>
                    <option value="restaurant">Restaurant Only</option>
                    <option value="chalets">Chalets Only</option>
                    <option value="pool">Pool Only</option>
                    <option value="snack">Snack Bar Only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Usage Limit</label>
                  <Input
                    type="number"
                    placeholder="Unlimited"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData(f => ({ ...f, usageLimit: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Per User Limit</label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData(f => ({ ...f, perUserLimit: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Valid From</label>
                  <Input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData(f => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Valid Until</label>
                  <Input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(f => ({ ...f, validUntil: e.target.value }))}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.firstOrderOnly}
                      onChange={(e) => setFormData(f => ({ ...f, firstOrderOnly: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm">First order only</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingCoupon(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
