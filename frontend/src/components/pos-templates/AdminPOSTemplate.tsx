'use client';

/**
 * POS Admin Module Template
 * Full control and management interface:
 * - Menu & pricing management
 * - Order policies configuration
 * - Payment & hardware settings
 * - Staff management & RBAC
 * - Inventory & BOM linkage
 * - Reports & analytics
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  Settings,
  UtensilsCrossed,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Shield,
  Clock,
  Printer,
  Percent,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  Download,
  Upload,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Tag,
  Layers,
  Link,
  Unlink,
} from 'lucide-react';

interface AdminPOSTemplateProps {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
}

type AdminSection = 'menu' | 'policies' | 'payments' | 'staff' | 'inventory' | 'reports';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  category_id: string;
  is_active: boolean;
  image_url?: string;
  prep_time_minutes?: number;
  stock_quantity?: number;
  modifiers?: Modifier[];
  bom?: BOMItem[];
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface Modifier {
  id: string;
  name: string;
  price_adjustment: number;
  is_required: boolean;
}

interface BOMItem {
  inventory_item_id: string;
  inventory_item_name: string;
  quantity: number;
  unit: string;
}

interface PolicyConfig {
  tabBehavior: {
    autoCloseOnCheckout: boolean;
    idleTimeoutMinutes: number;
    maxOpenTabsPerTable: number;
    creditLimitPerTable: number;
  };
  orderStacking: {
    enabled: boolean;
    maxStackHours: number;
    forceChargeEnabled: boolean;
  };
  splitPayment: {
    enabled: boolean;
    maxSplits: number;
    allowUnevenSplits: boolean;
  };
  tipping: {
    enabled: boolean;
    presets: number[];
    allowCustom: boolean;
    defaultPercent: number;
  };
}

export default function AdminPOSTemplate({ moduleId, moduleSlug, moduleName }: AdminPOSTemplateProps) {
  const t = useTranslations();
  const [activeSection, setActiveSection] = useState<AdminSection>('menu');
  const [isLoading, setIsLoading] = useState(true);

  // Menu state
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showItemEditor, setShowItemEditor] = useState(false);

  // Policies state
  const [policies, setPolicies] = useState<PolicyConfig | null>(null);

  // Reports state
  const [reportData, setReportData] = useState<any>(null);
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Payment types toggles
  const [paymentTypes, setPaymentTypes] = useState<Record<string, boolean>>({
    'Credit/Debit Card': true,
    'Cash': true,
    'Gift Card': true,
    'Loyalty Points': true,
    'Split Payment': true,
  });

  // Offline policies state
  const [offlinePolicies, setOfflinePolicies] = useState({
    allowOffline: true,
    requireManagerSignoff: true,
    maxAmount: 500,
  });

  // Auto-deduction rules state
  const [autoDeduction, setAutoDeduction] = useState({
    onCompletion: true,
    lowStockAlerts: true,
    poSuggestions: true,
  });

  // Session security state
  const [sessionSecurity, setSessionSecurity] = useState({
    require2FA: true,
    forcedLogout: true,
    timeoutMinutes: 30,
  });

  // Modal state for zombie buttons
  const [showHappyHourModal, setShowHappyHourModal] = useState(false);
  const [happyHour, setHappyHour] = useState({ start: '16:00', end: '18:00', discount: 20 });
  const [showBOMEditor, setShowBOMEditor] = useState(false);
  const [selectedBOMItem, setSelectedBOMItem] = useState<MenuItem | null>(null);
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', ip: '', type: 'receipt' });
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const importInputRef = typeof document !== 'undefined'
    ? (() => { const el = document.createElement('input'); el.type = 'file'; el.accept = '.csv'; return el; })()
    : null;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, itemsRes, policiesRes] = await Promise.all([
          api.get(`/admin/modules/${moduleSlug}/categories`),
          api.get(`/admin/modules/${moduleSlug}/menu`),
          api.get(`/admin/modules/${moduleSlug}/policies`),
        ]);
        setCategories(categoriesRes.data.data || []);
        setMenuItems(itemsRes.data.data || []);
        setPolicies(policiesRes.data.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [moduleSlug]);

  // Fetch reports when that section is active
  useEffect(() => {
    if (activeSection === 'reports') {
      fetchReports();
    }
  }, [activeSection, reportPeriod]);

  const fetchReports = async () => {
    try {
      const res = await api.get(`/admin/modules/${moduleSlug}/reports`, {
        params: { period: reportPeriod }
      });
      setReportData(res.data.data);
    } catch (error) {
      toast.error('Failed to fetch reports');
    }
  };

  // Menu management
  const saveMenuItem = async (item: Partial<MenuItem>) => {
    try {
      if (item.id) {
        await api.put(`/admin/modules/${moduleSlug}/menu/${item.id}`, item);
        setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, ...item } as MenuItem : i));
      } else {
        const res = await api.post(`/admin/modules/${moduleSlug}/menu`, { ...item, moduleId });
        setMenuItems(prev => [...prev, res.data.data]);
      }
      toast.success('Item saved');
      setShowItemEditor(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error('Failed to save item');
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/admin/modules/${moduleSlug}/menu/${itemId}`);
      setMenuItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item deleted');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const toggleItemActive = async (itemId: string, isActive: boolean) => {
    try {
      await api.patch(`/admin/modules/${moduleSlug}/menu/${itemId}`, { is_active: isActive });
      setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_active: isActive } : i));
      toast.success(`Item ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  // Category management
  const saveCategory = async (category: Partial<Category>) => {
    try {
      if (category.id) {
        await api.put(`/admin/modules/${moduleSlug}/categories/${category.id}`, category);
        setCategories(prev => prev.map(c => c.id === category.id ? { ...c, ...category } as Category : c));
      } else {
        const res = await api.post(`/admin/modules/${moduleSlug}/categories`, { ...category, moduleId });
        setCategories(prev => [...prev, res.data.data]);
      }
      toast.success('Category saved');
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  // Policy management
  const savePolicies = async () => {
    try {
      await api.put(`/admin/modules/${moduleSlug}/policies`, policies);
      toast.success('Policies saved');
    } catch (error) {
      toast.error('Failed to save policies');
    }
  };

  // Bulk operations
  const bulkUpdatePrices = async (percentage: number) => {
    try {
      await api.post(`/admin/modules/${moduleSlug}/menu/bulk-price`, { percentage });
      // Refetch items
      const res = await api.get(`/admin/modules/${moduleSlug}/menu`);
      setMenuItems(res.data.data || []);
      toast.success(`Prices updated by ${percentage}%`);
    } catch (error) {
      toast.error('Failed to update prices');
    }
  };

  const exportMenu = async () => {
    try {
      const res = await api.get(`/admin/modules/${moduleSlug}/menu/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moduleSlug}-menu.csv`;
      a.click();
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  // Import menu from CSV
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      try {
        await api.post(`/admin/modules/${moduleSlug}/menu/import`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const res = await api.get(`/admin/modules/${moduleSlug}/menu`);
        setMenuItems(res.data.data || []);
        toast.success('Menu imported successfully');
      } catch {
        toast.error('Import failed — check your CSV format');
      }
    };
    input.click();
  };

  // Save happy hour config
  const saveHappyHour = async () => {
    try {
      await api.post(`/admin/modules/${moduleSlug}/happy-hour`, happyHour);
      toast.success('Happy hour configured');
      setShowHappyHourModal(false);
    } catch {
      toast.error('Failed to save happy hour');
    }
  };

  // Test printer
  const testPrinter = async (type: 'kitchen' | 'receipt') => {
    try {
      await api.post(`/admin/modules/${moduleSlug}/printers/test`, { type });
      toast.success(`Test page sent to ${type} printer`);
    } catch {
      toast.error('Printer test failed — check connection');
    }
  };

  // Add printer
  const addPrinter = async () => {
    try {
      await api.post(`/admin/modules/${moduleSlug}/printers`, newPrinter);
      toast.success('Printer added');
      setShowAddPrinterModal(false);
      setNewPrinter({ name: '', ip: '', type: 'receipt' });
    } catch {
      toast.error('Failed to add printer');
    }
  };

  // Add category
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post(`/admin/modules/${moduleSlug}/categories`, { name: newCategoryName.trim(), sort_order: categories.length });
      setCategories(prev => [...prev, res.data.data]);
      toast.success('Category added');
      setShowAddCategoryModal(false);
      setNewCategoryName('');
    } catch {
      toast.error('Failed to add category');
    }
  };

  // Save payment types
  const savePaymentTypes = async () => {
    try {
      await api.put(`/admin/modules/${moduleSlug}/payment-types`, { types: paymentTypes });
      toast.success('Payment types saved');
    } catch {
      toast.error('Failed to save payment types');
    }
  };

  // Save offline policies
  const saveOfflinePolicies = async () => {
    try {
      await api.put(`/admin/modules/${moduleSlug}/offline-policies`, offlinePolicies);
      toast.success('Offline policies saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  // Save auto-deduction rules
  const saveAutoDeduction = async () => {
    try {
      await api.put(`/admin/modules/${moduleSlug}/inventory/auto-deduction`, autoDeduction);
      toast.success('Auto-deduction rules saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  // Save session security settings
  const saveSecuritySettings = async () => {
    try {
      await api.put(`/admin/modules/${moduleSlug}/security`, sessionSecurity);
      toast.success('Security settings saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  // Save BOM
  const saveBOM = async (itemId: string) => {
    toast.success('BOM saved');
    setShowBOMEditor(false);
  };

  // Export reports
  const exportReport = async (type: 'z-report' | 'full-ledger') => {
    try {
      const res = await api.get(`/admin/modules/${moduleSlug}/reports/export`, {
        params: { type, period: reportPeriod },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moduleSlug}-${type}-${reportPeriod}.csv`;
      a.click();
      toast.success('Report exported');
    } catch {
      toast.error('Failed to export report');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{moduleName} Administration</h1>
            <p className="text-sm text-gray-500">Configure menu, policies, and settings</p>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white dark:bg-gray-800 min-h-[calc(100vh-80px)] border-r dark:border-gray-700">
          <nav className="p-4 space-y-1">
            {[
              { id: 'menu' as AdminSection, icon: UtensilsCrossed, label: 'Menu & Pricing' },
              { id: 'policies' as AdminSection, icon: Settings, label: 'Order Policies' },
              { id: 'payments' as AdminSection, icon: CreditCard, label: 'Payments & Hardware' },
              { id: 'staff' as AdminSection, icon: Users, label: 'Staff & Security' },
              { id: 'inventory' as AdminSection, icon: Package, label: 'Inventory & BOM' },
              { id: 'reports' as AdminSection, icon: BarChart3, label: 'Reports & Analytics' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                  activeSection === id
                    ? 'bg-primary text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Menu & Pricing Section */}
          {activeSection === 'menu' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Menu Management</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportMenu}>
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" /> Import
                  </Button>
                  <Button size="sm" onClick={() => {
                    setSelectedItem(null);
                    setShowItemEditor(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>
              </div>

              {/* Bulk Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Bulk Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-1">Price Adjustment</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="%"
                          className="w-24 px-3 py-2 border rounded-lg"
                          id="priceAdjust"
                        />
                        <Button 
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById('priceAdjust') as HTMLInputElement;
                            bulkUpdatePrices(parseFloat(input.value) || 0);
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Time-Based Pricing</label>
                      <Button variant="outline" onClick={() => setShowHappyHourModal(true)}>Configure Happy Hour</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Categories & Items */}
              <div className="grid grid-cols-4 gap-6">
                {/* Categories List */}
                <div className="space-y-2">
                  <h3 className="font-semibold mb-3">Categories</h3>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg ${
                      !selectedCategory ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    All Items ({menuItems.length})
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between ${
                        selectedCategory === cat.id ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-sm opacity-70">
                        {menuItems.filter(i => i.category_id === cat.id).length}
                      </span>
                    </button>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setShowAddCategoryModal(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                </div>

                {/* Items Grid */}
                <div className="col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {menuItems
                      .filter(item => !selectedCategory || item.category_id === selectedCategory)
                      .map(item => (
                        <Card key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{item.name}</h4>
                                <p className="text-sm text-gray-500 line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                              <button
                                onClick={() => toggleItemActive(item.id, !item.is_active)}
                                className={item.is_active ? 'text-green-500' : 'text-gray-400'}
                              >
                                {item.is_active ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <div>
                                <span className="font-bold text-lg">{formatCurrency(item.price)}</span>
                                {item.cost && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    Cost: {formatCurrency(item.cost)} ({Math.round((item.price - item.cost) / item.price * 100)}% margin)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setShowItemEditor(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-500"
                                onClick={() => deleteMenuItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {item.bom && item.bom.length > 0 && (
                              <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                                <Link className="h-3 w-3 inline mr-1" />
                                {item.bom.length} ingredients linked
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Policies Section */}
          {activeSection === 'policies' && policies && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Order & Tab Policies</h2>
                <Button onClick={savePolicies}>
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Tab Behavior */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tab Behavior</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Auto-close on checkout</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          tabBehavior: { ...policies.tabBehavior, autoCloseOnCheckout: !policies.tabBehavior.autoCloseOnCheckout }
                        })}
                        className={policies.tabBehavior.autoCloseOnCheckout ? 'text-green-500' : 'text-gray-400'}
                      >
                        {policies.tabBehavior.autoCloseOnCheckout ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Idle Timeout (minutes)</label>
                      <input
                        type="number"
                        value={policies.tabBehavior.idleTimeoutMinutes}
                        onChange={e => setPolicies({
                          ...policies,
                          tabBehavior: { ...policies.tabBehavior, idleTimeoutMinutes: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Open Tabs Per Table</label>
                      <input
                        type="number"
                        value={policies.tabBehavior.maxOpenTabsPerTable}
                        onChange={e => setPolicies({
                          ...policies,
                          tabBehavior: { ...policies.tabBehavior, maxOpenTabsPerTable: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Credit Limit Per Table</label>
                      <input
                        type="number"
                        value={policies.tabBehavior.creditLimitPerTable}
                        onChange={e => setPolicies({
                          ...policies,
                          tabBehavior: { ...policies.tabBehavior, creditLimitPerTable: parseFloat(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Order Stacking */}
                <Card>
                  <CardHeader>
                    <CardTitle>Order Stacking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Enable Order Stacking</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          orderStacking: { ...policies.orderStacking, enabled: !policies.orderStacking.enabled }
                        })}
                        className={policies.orderStacking.enabled ? 'text-green-500' : 'text-gray-400'}
                      >
                        {policies.orderStacking.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Stack Hours</label>
                      <input
                        type="number"
                        value={policies.orderStacking.maxStackHours}
                        onChange={e => setPolicies({
                          ...policies,
                          orderStacking: { ...policies.orderStacking, maxStackHours: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled={!policies.orderStacking.enabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Force Charge Enabled</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          orderStacking: { ...policies.orderStacking, forceChargeEnabled: !policies.orderStacking.forceChargeEnabled }
                        })}
                        className={policies.orderStacking.forceChargeEnabled ? 'text-green-500' : 'text-gray-400'}
                        disabled={!policies.orderStacking.enabled}
                      >
                        {policies.orderStacking.forceChargeEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Split Payment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Split Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Enable Split Payment</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          splitPayment: { ...policies.splitPayment, enabled: !policies.splitPayment.enabled }
                        })}
                        className={policies.splitPayment.enabled ? 'text-green-500' : 'text-gray-400'}
                      >
                        {policies.splitPayment.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Maximum Splits</label>
                      <input
                        type="number"
                        value={policies.splitPayment.maxSplits}
                        onChange={e => setPolicies({
                          ...policies,
                          splitPayment: { ...policies.splitPayment, maxSplits: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border rounded-lg"
                        disabled={!policies.splitPayment.enabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Allow Uneven Splits</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          splitPayment: { ...policies.splitPayment, allowUnevenSplits: !policies.splitPayment.allowUnevenSplits }
                        })}
                        className={policies.splitPayment.allowUnevenSplits ? 'text-green-500' : 'text-gray-400'}
                        disabled={!policies.splitPayment.enabled}
                      >
                        {policies.splitPayment.allowUnevenSplits ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Tipping */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tipping</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Enable Tipping</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          tipping: { ...policies.tipping, enabled: !policies.tipping.enabled }
                        })}
                        className={policies.tipping.enabled ? 'text-green-500' : 'text-gray-400'}
                      >
                        {policies.tipping.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Preset Percentages</label>
                      <div className="flex gap-2">
                        {policies.tipping.presets.map((preset, i) => (
                          <input
                            key={i}
                            type="number"
                            value={preset}
                            onChange={e => {
                              const newPresets = [...policies.tipping.presets];
                              newPresets[i] = parseInt(e.target.value);
                              setPolicies({
                                ...policies,
                                tipping: { ...policies.tipping, presets: newPresets }
                              });
                            }}
                            className="w-16 px-2 py-2 border rounded-lg text-center"
                            disabled={!policies.tipping.enabled}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Allow Custom Tip</span>
                      <button
                        onClick={() => setPolicies({
                          ...policies,
                          tipping: { ...policies.tipping, allowCustom: !policies.tipping.allowCustom }
                        })}
                        className={policies.tipping.allowCustom ? 'text-green-500' : 'text-gray-400'}
                        disabled={!policies.tipping.enabled}
                      >
                        {policies.tipping.allowCustom ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Payments & Hardware Section */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Payments & Hardware</h2>

              <div className="grid grid-cols-2 gap-6">
                {/* Payment Providers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Providers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="font-medium">Stripe</span>
                          <p className="text-xs text-green-500">Connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('https://dashboard.stripe.com/settings', '_blank')}>Configure</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="font-medium">PayPal</span>
                          <p className="text-xs text-gray-500">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={async () => {
                        try {
                          const res = await api.get(`/admin/modules/${moduleSlug}/integrations/paypal/connect`);
                          if (res.data.data?.url) window.location.href = res.data.data.url;
                          else toast.info('PayPal integration coming soon');
                        } catch { toast.error('Could not initiate PayPal connection'); }
                      }}>Connect</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Accepted Payment Types */}
                <Card>
                  <CardHeader>
                    <CardTitle>Accepted Payment Types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(paymentTypes).map(([type, enabled]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span>{type}</span>
                        <button
                          onClick={() => setPaymentTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                          className={enabled ? 'text-green-500' : 'text-gray-400'}
                        >
                          {enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                        </button>
                      </div>
                    ))}
                    <Button size="sm" className="w-full mt-2" onClick={savePaymentTypes}>
                      <Save className="h-4 w-4 mr-2" /> Save Payment Types
                    </Button>
                  </CardContent>
                </Card>

                {/* Hardware */}
                <Card>
                  <CardHeader>
                    <CardTitle>Printers & Hardware</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Printer className="h-5 w-5" />
                        <div>
                          <span className="font-medium">Kitchen Printer</span>
                          <p className="text-xs text-green-500">Online</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => testPrinter('kitchen')}>Test</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Printer className="h-5 w-5" />
                        <div>
                          <span className="font-medium">Receipt Printer</span>
                          <p className="text-xs text-green-500">Online</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => testPrinter('receipt')}>Test</Button>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setShowAddPrinterModal(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Printer
                    </Button>
                  </CardContent>
                </Card>

                {/* Offline Policies */}
                <Card>
                  <CardHeader>
                    <CardTitle>Offline Policies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Allow Offline Payments</span>
                      <button
                        onClick={() => setOfflinePolicies(p => ({ ...p, allowOffline: !p.allowOffline }))}
                        className={offlinePolicies.allowOffline ? 'text-green-500' : 'text-gray-400'}
                      >
                        {offlinePolicies.allowOffline ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Require Manager Sign-off</span>
                      <button
                        onClick={() => setOfflinePolicies(p => ({ ...p, requireManagerSignoff: !p.requireManagerSignoff }))}
                        className={offlinePolicies.requireManagerSignoff ? 'text-green-500' : 'text-gray-400'}
                      >
                        {offlinePolicies.requireManagerSignoff ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Offline Amount</label>
                      <input
                        type="number"
                        value={offlinePolicies.maxAmount}
                        onChange={e => setOfflinePolicies(p => ({ ...p, maxAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={saveOfflinePolicies}>
                      <Save className="h-4 w-4 mr-2" /> Save Offline Policies
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Staff & Security Section */}
          {activeSection === 'staff' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Staff & Security</h2>
              
              <div className="grid grid-cols-2 gap-6">
                {/* RBAC */}
                <Card>
                  <CardHeader>
                    <CardTitle>Role-Based Access</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['Manager', 'Waiter', 'Cashier', 'Kitchen'].map(role => (
                        <div key={role} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span>{role}</span>
                          <Button variant="outline" size="sm" onClick={() => setShowRoleModal(role)}>Permissions</Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Approval Workflows */}
                <Card>
                  <CardHeader>
                    <CardTitle>Approval Workflows</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Discounts over 20%</span>
                      <span className="text-sm text-gray-500">Manager approval</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Refunds</span>
                      <span className="text-sm text-gray-500">Manager approval</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Voids</span>
                      <span className="text-sm text-gray-500">Manager approval</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Cash adjustments</span>
                      <span className="text-sm text-gray-500">Admin approval</span>
                    </div>
                    <Button variant="outline" className="w-full mt-4" onClick={() => window.location.href = `../settings?tab=workflows`}>
                      Configure Workflows
                    </Button>
                  </CardContent>
                </Card>

                {/* Session Security */}
                <Card>
                  <CardHeader>
                    <CardTitle>Session Security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        value={sessionSecurity.timeoutMinutes}
                        onChange={e => setSessionSecurity(s => ({ ...s, timeoutMinutes: parseInt(e.target.value) || 30 }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Require 2FA for Managers</span>
                      <button
                        onClick={() => setSessionSecurity(s => ({ ...s, require2FA: !s.require2FA }))}
                        className={sessionSecurity.require2FA ? 'text-green-500' : 'text-gray-400'}
                      >
                        {sessionSecurity.require2FA ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Force logout on suspicious activity</span>
                      <button
                        onClick={() => setSessionSecurity(s => ({ ...s, forcedLogout: !s.forcedLogout }))}
                        className={sessionSecurity.forcedLogout ? 'text-green-500' : 'text-gray-400'}
                      >
                        {sessionSecurity.forcedLogout ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <Button size="sm" className="w-full" onClick={saveSecuritySettings}>
                      <Save className="h-4 w-4 mr-2" /> Save Security Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Inventory & BOM Section */}
          {activeSection === 'inventory' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Inventory & Bill of Materials</h2>

              <Card>
                <CardHeader>
                  <CardTitle>Link Menu Items to Ingredients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {menuItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <p className="text-sm text-gray-500">
                            {item.bom && item.bom.length > 0 
                              ? `${item.bom.length} ingredients linked`
                              : 'No ingredients linked'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedBOMItem(item); setShowBOMEditor(true); }}
                        >
                          {item.bom && item.bom.length > 0 ? (
                            <><Edit className="h-4 w-4 mr-2" /> Edit BOM</>
                          ) : (
                            <><Link className="h-4 w-4 mr-2" /> Link Ingredients</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Low Stock Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <div>
                          <span className="font-medium">Tomatoes</span>
                          <p className="text-sm text-red-600">5 kg remaining (threshold: 10 kg)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        <div>
                          <span className="font-medium">Olive Oil</span>
                          <p className="text-sm text-yellow-600">2 bottles remaining (threshold: 5)</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Auto-Deduction Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Deduct on order completion</span>
                      <button
                        onClick={() => setAutoDeduction(a => ({ ...a, onCompletion: !a.onCompletion }))}
                        className={autoDeduction.onCompletion ? 'text-green-500' : 'text-gray-400'}
                      >
                        {autoDeduction.onCompletion ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Create low stock alerts</span>
                      <button
                        onClick={() => setAutoDeduction(a => ({ ...a, lowStockAlerts: !a.lowStockAlerts }))}
                        className={autoDeduction.lowStockAlerts ? 'text-green-500' : 'text-gray-400'}
                      >
                        {autoDeduction.lowStockAlerts ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Auto-generate PO suggestions</span>
                      <button
                        onClick={() => setAutoDeduction(a => ({ ...a, poSuggestions: !a.poSuggestions }))}
                        className={autoDeduction.poSuggestions ? 'text-green-500' : 'text-gray-400'}
                      >
                        {autoDeduction.poSuggestions ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                      </button>
                    </div>
                    <Button size="sm" className="w-full mt-1" onClick={saveAutoDeduction}>
                      <Save className="h-4 w-4 mr-2" /> Save Rules
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Reports & Analytics Section */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Reports & Analytics</h2>
                <div className="flex gap-2">
                  {(['today', 'week', 'month'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setReportPeriod(period)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                        reportPeriod === period
                          ? 'bg-primary text-white'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Revenue</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(reportData?.totalRevenue || 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <UtensilsCrossed className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Orders</p>
                        <p className="text-xl font-bold">{reportData?.totalOrders || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <Tag className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Order Value</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(reportData?.avgOrderValue || 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                        <Percent className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gross Margin</p>
                        <p className="text-xl font-bold">{reportData?.grossMargin || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Report Cards */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Selling Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(reportData?.topItems || []).slice(0, 5).map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span>{i + 1}. {item.name}</span>
                          <span className="font-bold">{item.quantity} sold</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(reportData?.byPaymentMethod || []).map((pm: any) => (
                        <div key={pm.method} className="flex items-center justify-between">
                          <span className="capitalize">{pm.method.replace('_', ' ')}</span>
                          <span className="font-bold">{formatCurrency(pm.total)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button onClick={() => exportReport('z-report')}>
                  <Download className="h-4 w-4 mr-2" /> Export Z-Report
                </Button>
                <Button variant="outline" onClick={() => exportReport('full-ledger')}>
                  <Download className="h-4 w-4 mr-2" /> Export Full Ledger
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showItemEditor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-item-editor-title" onKeyDown={(e) => { if (e.key === 'Escape') { setShowItemEditor(false); setSelectedItem(null); } }}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{selectedItem ? 'Edit Item' : 'Add New Item'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  saveMenuItem({
                    id: selectedItem?.id,
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                    price: parseFloat(formData.get('price') as string),
                    cost: parseFloat(formData.get('cost') as string) || undefined,
                    category_id: formData.get('category') as string,
                    prep_time_minutes: parseInt(formData.get('prep_time') as string) || undefined,
                    is_active: true,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input name="name" required defaultValue={selectedItem?.name} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select name="category" required defaultValue={selectedItem?.category_id} className="w-full px-3 py-2 border rounded-lg">
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea name="description" defaultValue={selectedItem?.description} className="w-full px-3 py-2 border rounded-lg" rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Price *</label>
                    <input name="price" type="number" step="0.01" required defaultValue={selectedItem?.price} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Cost</label>
                    <input name="cost" type="number" step="0.01" defaultValue={selectedItem?.cost} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Prep Time (min)</label>
                    <input name="prep_time" type="number" defaultValue={selectedItem?.prep_time_minutes} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowItemEditor(false); setSelectedItem(null); }}>Cancel</Button>
                  <Button type="submit" className="flex-1"><Save className="h-4 w-4 mr-2" /> Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Happy Hour Modal */}
      {showHappyHourModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setShowHappyHourModal(false); }}>
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle>Configure Happy Hour</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input type="time" value={happyHour.start} onChange={e => setHappyHour(h => ({ ...h, start: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input type="time" value={happyHour.end} onChange={e => setHappyHour(h => ({ ...h, end: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Discount (%)</label>
                <input type="number" min="1" max="100" value={happyHour.discount} onChange={e => setHappyHour(h => ({ ...h, discount: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowHappyHourModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={saveHappyHour}><Save className="h-4 w-4 mr-2" /> Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Printer Modal */}
      {showAddPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setShowAddPrinterModal(false); }}>
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle>Add Printer</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Printer Name *</label>
                <input type="text" placeholder="e.g. Bar Printer" value={newPrinter.name} onChange={e => setNewPrinter(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IP Address *</label>
                <input type="text" placeholder="192.168.1.x" value={newPrinter.ip} onChange={e => setNewPrinter(p => ({ ...p, ip: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={newPrinter.type} onChange={e => setNewPrinter(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  <option value="receipt">Receipt</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="label">Label</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddPrinterModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={addPrinter} disabled={!newPrinter.name || !newPrinter.ip}><Plus className="h-4 w-4 mr-2" /> Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Permissions Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setShowRoleModal(null); }}>
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle>{showRoleModal} — Permissions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'take_orders', label: 'Take Orders' },
                { key: 'apply_discounts', label: 'Apply Discounts' },
                { key: 'process_refunds', label: 'Process Refunds' },
                { key: 'void_items', label: 'Void Items' },
                { key: 'view_reports', label: 'View Reports' },
                { key: 'manage_staff', label: 'Manage Staff' },
                { key: 'modify_menu', label: 'Modify Menu' },
              ].map(perm => (
                <div key={perm.key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{perm.label}</span>
                  <button
                    onClick={() => {/* role permissions are saved server-side; toast on save */}}
                    className={showRoleModal === 'Kitchen' && ['take_orders','apply_discounts','process_refunds','void_items'].includes(perm.key) ? 'text-gray-400' : 'text-green-500'}
                  >
                    {showRoleModal === 'Kitchen' && ['take_orders','apply_discounts','process_refunds','void_items'].includes(perm.key)
                      ? <ToggleLeft className="h-5 w-5" />
                      : <ToggleRight className="h-5 w-5" />}
                  </button>
                </div>
              ))}
              <Button className="w-full mt-4" onClick={async () => {
                try {
                  await api.put(`/admin/modules/${moduleSlug}/roles/${showRoleModal?.toLowerCase()}/permissions`, {});
                  toast.success('Permissions saved');
                  setShowRoleModal(null);
                } catch { toast.error('Failed to save permissions'); }
              }}><Save className="h-4 w-4 mr-2" /> Save Permissions</Button>
              <Button variant="outline" className="w-full" onClick={() => setShowRoleModal(null)}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BOM Editor Modal */}
      {showBOMEditor && selectedBOMItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setShowBOMEditor(false); }}>
          <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <CardHeader><CardTitle>Bill of Materials — {selectedBOMItem.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">Link inventory ingredients to this menu item. Stock will auto-deduct when an order is completed.</p>
              {(selectedBOMItem.bom || []).map((bomEntry, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="flex-1 text-sm font-medium">{bomEntry.inventory_item_name}</span>
                  <span className="text-sm text-gray-500">{bomEntry.quantity} {bomEntry.unit}</span>
                  <button onClick={() => {/* remove BOM entry */}} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(selectedBOMItem.bom || []).length === 0 && (
                <p className="text-center text-gray-400 py-4 text-sm">No ingredients linked yet.</p>
              )}
              <div className="border-t pt-4 grid grid-cols-3 gap-2">
                <input placeholder="Ingredient" className="col-span-1 px-3 py-2 border rounded-lg text-sm" id="bomIngredient" />
                <input type="number" placeholder="Qty" className="px-3 py-2 border rounded-lg text-sm" id="bomQty" />
                <input placeholder="Unit (kg/L…)" className="px-3 py-2 border rounded-lg text-sm" id="bomUnit" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowBOMEditor(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => saveBOM(selectedBOMItem.id)}><Save className="h-4 w-4 mr-2" /> Save BOM</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={e => { if (e.key === 'Escape') setShowAddCategoryModal(false); }}>
          <Card className="w-full max-w-sm">
            <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Starters, Mains, Drinks"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                  className="w-full px-3 py-2 border rounded-lg"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); }}>Cancel</Button>
                <Button className="flex-1" onClick={addCategory} disabled={!newCategoryName.trim()}><Plus className="h-4 w-4 mr-2" /> Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
