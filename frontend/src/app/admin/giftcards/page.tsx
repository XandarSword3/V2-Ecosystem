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
  CreditCard,
  Gift,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Edit,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Ban,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface GiftCard {
  id: string;
  code: string;
  initial_value: number;
  current_balance: number;
  status: 'active' | 'redeemed' | 'expired' | 'disabled';
  purchaser_name?: string;
  purchaser_email?: string;
  recipient_name?: string;
  recipient_email?: string;
  expires_at?: string;
  created_at: string;
}

interface GiftCardTemplate {
  id: string;
  name: string;
  amount: number;
  discount_percent: number;
  image_url?: string;
  is_active: boolean;
}

interface GiftCardStats {
  totalCards: number;
  activeCards: number;
  totalValueSold: number;
  totalValueRedeemed: number;
  unredeeemedValue: number;
}

export default function GiftCardsAdminPage() {
  const [activeTab, setActiveTab] = useState('cards');
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [templates, setTemplates] = useState<GiftCardTemplate[]>([]);
  const [stats, setStats] = useState<GiftCardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<Set<string>>(new Set());
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    initialValue: '',
    recipientName: '',
    recipientEmail: '',
    message: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cardsRes, templatesRes, statsRes] = await Promise.all([
        api.get('/giftcards/admin'),
        api.get('/giftcards/templates'),
        api.get('/giftcards/admin/stats'),
      ]);

      if (cardsRes.data.success) setGiftCards(cardsRes.data.data);
      if (templatesRes.data.success) setTemplates(templatesRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
    } catch (error) {
      toast.error('Failed to load gift card data');
    } finally {
      setLoading(false);
    }
  };

  const toggleCodeVisibility = (cardId: string) => {
    const newVisible = new Set(visibleCodes);
    if (newVisible.has(cardId)) {
      newVisible.delete(cardId);
    } else {
      newVisible.add(cardId);
    }
    setVisibleCodes(newVisible);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const handleCreateCard = async () => {
    if (!createForm.initialValue) {
      toast.error('Please enter a value');
      return;
    }
    
    try {
      const res = await api.post('/giftcards/admin', {
        initialValue: parseFloat(createForm.initialValue),
        recipientName: createForm.recipientName || undefined,
        recipientEmail: createForm.recipientEmail || undefined,
        personalMessage: createForm.message || undefined,
      });
      
      if (res.data.success) {
        toast.success(`Gift card created: ${res.data.data.code}`);
        setShowCreateModal(false);
        setCreateForm({ initialValue: '', recipientName: '', recipientEmail: '', message: '' });
        loadData();
      }
    } catch (error) {
      toast.error('Failed to create gift card');
    }
  };

  const handleDisableCard = async (cardId: string) => {
    try {
      const res = await api.put(`/giftcards/admin/${cardId}/disable`);
      if (res.data.success) {
        toast.success('Gift card disabled');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to disable gift card');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'redeemed':
        return <Badge className="bg-blue-100 text-blue-700">Fully Redeemed</Badge>;
      case 'expired':
        return <Badge className="bg-amber-100 text-amber-700">Expired</Badge>;
      case 'disabled':
        return <Badge className="bg-red-100 text-red-700">Disabled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredCards = giftCards.filter(card => {
    const matchesSearch = searchQuery === '' || 
      card.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.recipient_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.purchaser_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Gift Cards</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage gift cards and templates</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Gift Card
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Cards</p>
                <p className="text-3xl font-bold">{stats?.totalCards || 0}</p>
              </div>
              <CreditCard className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Active Cards</p>
                <p className="text-3xl font-bold">{stats?.activeCards || 0}</p>
              </div>
              <CheckCircle className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Value Sold</p>
                <p className="text-3xl font-bold">{formatCurrency(stats?.totalValueSold || 0)}</p>
              </div>
              <DollarSign className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Redeemed</p>
                <p className="text-3xl font-bold">{formatCurrency(stats?.totalValueRedeemed || 0)}</p>
              </div>
              <Gift className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-100 text-sm">Outstanding</p>
                <p className="text-3xl font-bold">{formatCurrency(stats?.unredeeemedValue || 0)}</p>
              </div>
              <TrendingUp className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="cards">Gift Cards</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Gift Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by code or email..."
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
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left p-4 font-medium text-slate-500">Code</th>
                      <th className="text-left p-4 font-medium text-slate-500">Value</th>
                      <th className="text-left p-4 font-medium text-slate-500">Balance</th>
                      <th className="text-left p-4 font-medium text-slate-500">Status</th>
                      <th className="text-left p-4 font-medium text-slate-500">Recipient</th>
                      <th className="text-left p-4 font-medium text-slate-500">Created</th>
                      <th className="text-right p-4 font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCards.map((card) => (
                      <tr key={card.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                              {visibleCodes.has(card.id) ? card.code : '••••-••••-••••-••••'}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleCodeVisibility(card.id)}
                            >
                              {visibleCodes.has(card.id) ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            {visibleCodes.has(card.id) && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyCode(card.code)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-medium">
                          {formatCurrency(card.initial_value)}
                        </td>
                        <td className="p-4">
                          <span className={card.current_balance > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}>
                            {formatCurrency(card.current_balance)}
                          </span>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(card.status)}
                        </td>
                        <td className="p-4">
                          {card.recipient_email ? (
                            <div className="text-sm">
                              <p>{card.recipient_name || '-'}</p>
                              <p className="text-slate-500">{card.recipient_email}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500">
                          {formatDate(card.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { setSelectedCard(card); setShowDetailsModal(true); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {card.status === 'active' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDisableCard(card.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className={`relative overflow-hidden ${!template.is_active ? 'opacity-50' : ''}`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Gift className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <Badge className={template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{template.name}</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-2">
                    {formatCurrency(template.amount)}
                  </p>
                  {template.discount_percent > 0 && (
                    <Badge className="bg-amber-100 text-amber-700">
                      {template.discount_percent}% off
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Gift Card Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Create Gift Card</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Value ($)</label>
                  <Input
                    type="number"
                    placeholder="Enter gift card value"
                    value={createForm.initialValue}
                    onChange={(e) => setCreateForm(f => ({ ...f, initialValue: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Recipient Name (optional)</label>
                  <Input
                    placeholder="Recipient name"
                    value={createForm.recipientName}
                    onChange={(e) => setCreateForm(f => ({ ...f, recipientName: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Recipient Email (optional)</label>
                  <Input
                    type="email"
                    placeholder="Recipient email"
                    value={createForm.recipientEmail}
                    onChange={(e) => setCreateForm(f => ({ ...f, recipientEmail: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Message (optional)</label>
                  <textarea
                    className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                    rows={3}
                    placeholder="Personal message"
                    value={createForm.message}
                    onChange={(e) => setCreateForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCard}>
                  Create Gift Card
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Gift Card Details</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-500">Code</span>
                    <Button variant="ghost" size="sm" onClick={() => copyCode(selectedCard.code)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <code className="font-mono text-lg font-bold">{selectedCard.code}</code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-500">Original Value</span>
                    <p className="font-bold">{formatCurrency(selectedCard.initial_value)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Current Balance</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedCard.current_balance)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedCard.status)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Created</span>
                    <p>{formatDate(selectedCard.created_at)}</p>
                  </div>
                </div>
                
                {selectedCard.recipient_email && (
                  <div>
                    <span className="text-sm text-slate-500">Recipient</span>
                    <p>{selectedCard.recipient_name}</p>
                    <p className="text-sm text-slate-500">{selectedCard.recipient_email}</p>
                  </div>
                )}
                
                {selectedCard.purchaser_email && (
                  <div>
                    <span className="text-sm text-slate-500">Purchaser</span>
                    <p>{selectedCard.purchaser_name}</p>
                    <p className="text-sm text-slate-500">{selectedCard.purchaser_email}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
