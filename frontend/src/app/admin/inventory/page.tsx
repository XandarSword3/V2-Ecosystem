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
import { Portal } from '@/components/ui/Portal';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  Plus,
  Edit,
  RefreshCw,
  ArrowUpDown,
  Download,
  Upload,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Box,
  Calendar,
  Filter,
  Minus,
  Trash2,
} from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  description?: string;
  category_id: string;
  category_name: string;
  category_color?: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  max_stock_level?: number;
  reorder_point: number;
  cost_per_unit?: number;
  supplier?: string;
  location?: string;
  expiry_date?: string;
  stock_status: 'normal' | 'low_stock' | 'out_of_stock' | 'overstock';
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  color?: string;
  item_count: number;
  total_stock: number;
}

interface Alert {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  alert_type: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  current_stock: number;
  is_resolved: boolean;
  created_at: string;
}

interface Stats {
  total_items: number;
  out_of_stock: number;
  low_stock: number;
  overstock: number;
  total_value: number;
  unresolvedAlerts: number;
}

interface Transaction {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  type: 'in' | 'out' | 'adjustment' | 'waste' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type: string;
  notes?: string;
  performed_by_name?: string;
  created_at: string;
}

export default function InventoryAdminPage() {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    unit: 'piece',
    currentStock: '0',
    minStockLevel: '10',
    maxStockLevel: '',
    reorderPoint: '5',
    costPerUnit: '',
    supplier: '',
    location: '',
    expiryDate: '',
  });

  const [transactionForm, setTransactionForm] = useState({
    type: 'in' as 'in' | 'out' | 'adjustment' | 'waste' | 'return',
    quantity: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions();
    } else if (activeTab === 'alerts') {
      loadAlerts();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, categoriesRes, statsRes, alertsRes] = await Promise.all([
        api.get('/inventory/items', {
          params: {
            search: searchQuery || undefined,
            categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
            lowStock: stockFilter === 'low' ? 'true' : undefined,
            outOfStock: stockFilter === 'out' ? 'true' : undefined,
          }
        }),
        api.get('/inventory/categories'),
        api.get('/inventory/stats'),
        api.get('/inventory/alerts'),
      ]);

      if (itemsRes.data.success) setItems(itemsRes.data.data);
      if (categoriesRes.data.success) setCategories(categoriesRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data.summary);
      if (alertsRes.data.success) setAlerts(alertsRes.data.data);
    } catch (error) {
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await api.get('/inventory/transactions', { params: { limit: 100 } });
      if (res.data.success) setTransactions(res.data.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await api.get('/inventory/alerts');
      if (res.data.success) setAlerts(res.data.data);
    } catch (error) {
      toast.error('Failed to load alerts');
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, categoryFilter, stockFilter]);

  const handleCreateItem = async () => {
    if (!itemForm.name || !itemForm.categoryId) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      const payload = {
        name: itemForm.name,
        sku: itemForm.sku || undefined,
        description: itemForm.description || undefined,
        categoryId: itemForm.categoryId,
        unit: itemForm.unit,
        currentStock: parseFloat(itemForm.currentStock) || 0,
        minStockLevel: parseFloat(itemForm.minStockLevel) || 10,
        maxStockLevel: itemForm.maxStockLevel ? parseFloat(itemForm.maxStockLevel) : undefined,
        reorderPoint: parseFloat(itemForm.reorderPoint) || 5,
        costPerUnit: itemForm.costPerUnit ? parseFloat(itemForm.costPerUnit) : undefined,
        supplier: itemForm.supplier || undefined,
        location: itemForm.location || undefined,
        expiryDate: itemForm.expiryDate || undefined,
      };
      
      let res;
      if (editingItem) {
        res = await api.put(`/inventory/items/${editingItem.id}`, payload);
      } else {
        res = await api.post('/inventory/items', payload);
      }
      
      if (res.data.success) {
        toast.success(editingItem ? 'Item updated' : 'Item created');
        setShowCreateModal(false);
        setEditingItem(null);
        resetItemForm();
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save item');
    }
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      sku: '',
      description: '',
      categoryId: '',
      unit: 'piece',
      currentStock: '0',
      minStockLevel: '10',
      maxStockLevel: '',
      reorderPoint: '5',
      costPerUnit: '',
      supplier: '',
      location: '',
      expiryDate: '',
    });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku || '',
      description: item.description || '',
      categoryId: item.category_id,
      unit: item.unit,
      currentStock: item.current_stock.toString(),
      minStockLevel: item.min_stock_level.toString(),
      maxStockLevel: item.max_stock_level?.toString() || '',
      reorderPoint: item.reorder_point.toString(),
      costPerUnit: item.cost_per_unit?.toString() || '',
      supplier: item.supplier || '',
      location: item.location || '',
      expiryDate: item.expiry_date?.split('T')[0] || '',
    });
    setShowCreateModal(true);
  };

  const handleRecordTransaction = async () => {
    if (!selectedItem || !transactionForm.quantity) {
      toast.error('Please enter a quantity');
      return;
    }
    
    try {
      const res = await api.post('/inventory/transactions', {
        itemId: selectedItem.id,
        type: transactionForm.type,
        quantity: parseFloat(transactionForm.quantity),
        notes: transactionForm.notes || undefined,
        referenceType: 'manual',
      });
      
      if (res.data.success) {
        toast.success('Transaction recorded');
        setShowTransactionModal(false);
        setSelectedItem(null);
        setTransactionForm({ type: 'in', quantity: '', notes: '' });
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record transaction');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await api.post(`/inventory/alerts/${alertId}/resolve`);
      if (res.data.success) {
        toast.success('Alert resolved');
        loadAlerts();
        loadData();
      }
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    
    try {
      const res = await api.delete(`/inventory/items/${deletingItem.id}`);
      if (res.data.success) {
        toast.success('Item deleted successfully');
        setShowDeleteItemModal(false);
        setDeletingItem(null);
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    
    try {
      const res = await api.delete(`/inventory/categories/${deletingCategory.id}`);
      if (res.data.success) {
        toast.success('Category deleted successfully');
        setShowDeleteCategoryModal(false);
        setDeletingCategory(null);
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    }
  };
  const handleExportReport = async () => {
    try {
      window.open(`${api.defaults.baseURL}/inventory/report?format=csv`, '_blank');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getStockStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      normal: 'bg-green-100 text-green-700',
      low_stock: 'bg-amber-100 text-amber-700',
      out_of_stock: 'bg-red-100 text-red-700',
      overstock: 'bg-blue-100 text-blue-700',
    };
    return (
      <Badge className={styles[status] || styles.normal}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getTransactionTypeBadge = (type: string) => {
    const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
      in: { bg: 'bg-green-100 text-green-700', icon: <TrendingUp className="w-3 h-3" /> },
      out: { bg: 'bg-red-100 text-red-700', icon: <TrendingDown className="w-3 h-3" /> },
      adjustment: { bg: 'bg-blue-100 text-blue-700', icon: <ArrowUpDown className="w-3 h-3" /> },
      waste: { bg: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> },
      return: { bg: 'bg-purple-100 text-purple-700', icon: <Upload className="w-3 h-3" /> },
    };
    const style = styles[type] || styles.adjustment;
    return (
      <Badge className={`flex items-center gap-1 ${style.bg}`}>
        {style.icon}
        {type}
      </Badge>
    );
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory</h1>
          <p className="text-slate-500 dark:text-slate-400">Stock management and tracking</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportReport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => { resetItemForm(); setEditingItem(null); setShowCreateModal(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Total Items</p>
                <p className="text-2xl font-bold">{stats?.total_items || 0}</p>
              </div>
              <Package className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-xs">Out of Stock</p>
                <p className="text-2xl font-bold">{stats?.out_of_stock || 0}</p>
              </div>
              <XCircle className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">Low Stock</p>
                <p className="text-2xl font-bold">{stats?.low_stock || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs">Overstock</p>
                <p className="text-2xl font-bold">{stats?.overstock || 0}</p>
              </div>
              <Box className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_value || 0)}</p>
              </div>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-100 text-xs">Active Alerts</p>
                <p className="text-2xl font-bold">{stats?.unresolvedAlerts || 0}</p>
              </div>
              <Bell className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {(stats?.unresolvedAlerts || 0) > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">
                {stats?.unresolvedAlerts}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All Stock Levels</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left p-4 font-medium text-slate-500">Item</th>
                      <th className="text-left p-4 font-medium text-slate-500">SKU</th>
                      <th className="text-left p-4 font-medium text-slate-500">Category</th>
                      <th className="text-center p-4 font-medium text-slate-500">Stock</th>
                      <th className="text-left p-4 font-medium text-slate-500">Status</th>
                      <th className="text-right p-4 font-medium text-slate-500">Cost</th>
                      <th className="text-right p-4 font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.location && (
                              <p className="text-xs text-slate-500">{item.location}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <code className="text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                            {item.sku}
                          </code>
                        </td>
                        <td className="p-4">
                          <Badge 
                            style={{ 
                              backgroundColor: (item.category_color || '#6b7280') + '20',
                              color: item.category_color || '#6b7280'
                            }}
                          >
                            {item.category_name}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold">{item.current_stock}</span>
                          <span className="text-slate-400 text-sm"> {item.unit}</span>
                          <div className="text-xs text-slate-500">
                            Min: {item.min_stock_level} / Reorder: {item.reorder_point}
                          </div>
                        </td>
                        <td className="p-4">
                          {getStockStatusBadge(item.stock_status)}
                        </td>
                        <td className="p-4 text-right">
                          {item.cost_per_unit ? formatCurrency(item.cost_per_unit) : '-'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setSelectedItem(item); setShowTransactionModal(true); }}
                              title="Record Transaction"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEdit(item)}
                              title="Edit Item"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { setDeletingItem(item); setShowDeleteItemModal(true); }}
                              title="Delete Item"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Card key={cat.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (cat.color || '#6b7280') + '20' }}
                    >
                      <Package className="w-6 h-6" style={{ color: cat.color || '#6b7280' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{cat.name}</h3>
                      <p className="text-sm text-slate-500">{cat.item_count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{Math.round(cat.total_stock)}</p>
                      <p className="text-xs text-slate-500">units</p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                        title="Edit Category"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setDeletingCategory(cat); setShowDeleteCategoryModal(true); }}
                        title="Delete Category"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={cat.item_count > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="text-left p-4 font-medium text-slate-500">Date</th>
                      <th className="text-left p-4 font-medium text-slate-500">Item</th>
                      <th className="text-left p-4 font-medium text-slate-500">Type</th>
                      <th className="text-center p-4 font-medium text-slate-500">Quantity</th>
                      <th className="text-center p-4 font-medium text-slate-500">Stock Change</th>
                      <th className="text-left p-4 font-medium text-slate-500">By</th>
                      <th className="text-left p-4 font-medium text-slate-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="border-b dark:border-slate-700">
                        <td className="p-4 text-sm text-slate-500">
                          {formatDate(txn.created_at)}
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{txn.item_name}</p>
                            <p className="text-xs text-slate-500">{txn.sku}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          {getTransactionTypeBadge(txn.type)}
                        </td>
                        <td className="p-4 text-center font-bold">
                          {txn.type === 'in' || txn.type === 'return' ? '+' : txn.type === 'adjustment' ? '=' : '-'}
                          {txn.quantity}
                        </td>
                        <td className="p-4 text-center text-sm text-slate-500">
                          {txn.previous_stock} → {txn.new_stock}
                        </td>
                        <td className="p-4 text-sm">
                          {txn.performed_by_name || '-'}
                        </td>
                        <td className="p-4 text-sm text-slate-500 truncate max-w-xs">
                          {txn.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">No active alerts</p>
                <p className="text-sm">All inventory levels are within normal ranges</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.priority === 'critical' ? 'border-l-red-500' :
                  alert.priority === 'high' ? 'border-l-orange-500' :
                  alert.priority === 'medium' ? 'border-l-amber-500' :
                  'border-l-blue-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${
                          alert.priority === 'critical' ? 'bg-red-100' :
                          alert.priority === 'high' ? 'bg-orange-100' :
                          alert.priority === 'medium' ? 'bg-amber-100' :
                          'bg-blue-100'
                        }`}>
                          <AlertTriangle className={`w-5 h-5 ${
                            alert.priority === 'critical' ? 'text-red-600' :
                            alert.priority === 'high' ? 'text-orange-600' :
                            alert.priority === 'medium' ? 'text-amber-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="capitalize">{alert.priority}</Badge>
                            <Badge variant="outline">{alert.alert_type.replace('_', ' ')}</Badge>
                          </div>
                          <h3 className="font-semibold">{alert.item_name}</h3>
                          <p className="text-sm text-slate-500">{alert.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Current stock: {alert.current_stock} • {formatDate(alert.created_at)}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleResolveAlert(alert.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Item Modal */}
      <Portal>
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
              onClick={() => { setShowCreateModal(false); setEditingItem(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <h3 className="text-xl font-bold mb-4">
                  {editingItem ? 'Edit Item' : 'Add Inventory Item'}
                </h3>
              
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <Input
                    placeholder="Item name"
                    value={itemForm.name}
                    onChange={(e) => setItemForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">SKU</label>
                  <Input
                    placeholder="Auto-generated if empty"
                    value={itemForm.sku}
                    onChange={(e) => setItemForm(f => ({ ...f, sku: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Category *</label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Unit</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram</option>
                    <option value="liter">Liter</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="bottle">Bottle</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Initial Stock</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={itemForm.currentStock}
                    onChange={(e) => setItemForm(f => ({ ...f, currentStock: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Min Stock Level</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={itemForm.minStockLevel}
                    onChange={(e) => setItemForm(f => ({ ...f, minStockLevel: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Reorder Point</label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm(f => ({ ...f, reorderPoint: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Cost per Unit ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={itemForm.costPerUnit}
                    onChange={(e) => setItemForm(f => ({ ...f, costPerUnit: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Supplier</label>
                  <Input
                    placeholder="Supplier name"
                    value={itemForm.supplier}
                    onChange={(e) => setItemForm(f => ({ ...f, supplier: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <Input
                    placeholder="Storage location"
                    value={itemForm.location}
                    onChange={(e) => setItemForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date</label>
                  <Input
                    type="date"
                    value={itemForm.expiryDate}
                    onChange={(e) => setItemForm(f => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingItem(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateItem}>
                  {editingItem ? 'Update Item' : 'Add Item'}
                </Button>
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      {/* Transaction Modal */}
      <Portal>
        <AnimatePresence>
          {showTransactionModal && selectedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
              onClick={() => { setShowTransactionModal(false); setSelectedItem(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-4">Record Transaction</h3>
                <p className="text-slate-500 mb-4">
                  <strong>{selectedItem.name}</strong>
                <br />
                Current stock: <strong>{selectedItem.current_stock} {selectedItem.unit}</strong>
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Transaction Type</label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) => setTransactionForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  >
                    <option value="in">Stock In (Received)</option>
                    <option value="out">Stock Out (Used)</option>
                    <option value="adjustment">Adjustment (Set to)</option>
                    <option value="waste">Waste/Loss</option>
                    <option value="return">Return</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <Input
                    type="number"
                    placeholder="Enter quantity"
                    value={transactionForm.quantity}
                    onChange={(e) => setTransactionForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {transactionForm.type === 'adjustment' 
                      ? 'Stock will be set to this value'
                      : transactionForm.type === 'in' || transactionForm.type === 'return'
                        ? 'This will be added to current stock'
                        : 'This will be subtracted from current stock'
                    }
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                    rows={2}
                    placeholder="Optional notes..."
                    value={transactionForm.notes}
                    onChange={(e) => setTransactionForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { setShowTransactionModal(false); setSelectedItem(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleRecordTransaction}>
                  Record Transaction
                </Button>
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      {/* Category Create/Edit Modal */}
      <Portal>
        <AnimatePresence>
          {showCategoryModal && (
            <CategoryModal
              category={editingCategory}
              onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
              onSave={async (data) => {
                try {
                  if (editingCategory) {
                    const res = await api.put(`/inventory/categories/${editingCategory.id}`, data);
                    if (res.data.success) {
                      toast.success('Category updated');
                    }
                  } else {
                    const res = await api.post('/inventory/categories', data);
                    if (res.data.success) {
                      toast.success('Category created');
                    }
                  }
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  loadData();
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Failed to save category');
                }
              }}
            />
          )}
        </AnimatePresence>
      </Portal>

      {/* Delete Item Confirmation Modal */}
      <Portal>
        <AnimatePresence>
          {showDeleteItemModal && deletingItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
              onClick={() => { setShowDeleteItemModal(false); setDeletingItem(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-600">Delete Item</h3>
                    <p className="text-slate-500">This action cannot be undone</p>
                  </div>
                </div>
                
                <p className="mb-6">
                  Are you sure you want to delete <strong>{deletingItem.name}</strong>?
                  <br />
                  <span className="text-sm text-slate-500">
                    SKU: {deletingItem.sku} | Current stock: {deletingItem.current_stock} {deletingItem.unit}
                  </span>
                </p>
                
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setShowDeleteItemModal(false); setDeletingItem(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDeleteItem}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Item
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      {/* Delete Category Confirmation Modal */}
      <Portal>
        <AnimatePresence>
          {showDeleteCategoryModal && deletingCategory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
              onClick={() => { setShowDeleteCategoryModal(false); setDeletingCategory(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-600">Delete Category</h3>
                    <p className="text-slate-500">This action cannot be undone</p>
                  </div>
                </div>
                
                <p className="mb-6">
                  Are you sure you want to delete the category <strong>{deletingCategory.name}</strong>?
                  {deletingCategory.item_count > 0 && (
                    <span className="block mt-2 text-amber-600">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      This category has {deletingCategory.item_count} items. 
                      Please move or delete the items first.
                    </span>
                  )}
                </p>
                
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setShowDeleteCategoryModal(false); setDeletingCategory(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDeleteCategory}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={deletingCategory.item_count > 0}
                  >
                    Delete Category
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </motion.div>
  );
}

// Category Modal Component
interface CategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSave: (data: { name: string; color?: string; description?: string }) => Promise<void>;
}

function CategoryModal({ category, onClose, onSave }: CategoryModalProps) {
  const [form, setForm] = useState({
    name: category?.name || '',
    color: category?.color || '#6b7280',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      color: form.color,
      description: form.description.trim() || undefined,
    });
    setSaving(false);
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
        className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-xl font-bold mb-6">
          {category ? 'Edit Category' : 'Create Category'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category Name *</label>
            <Input
              placeholder="e.g., Beverages, Cleaning Supplies"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
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
                placeholder="#6b7280"
                className="flex-1"
              />
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: form.color + '20', color: form.color }}
              >
                <Package className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
              rows={2}
              placeholder="Brief description of this category..."
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {category ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
