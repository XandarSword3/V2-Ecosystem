'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { useDebounce } from '@/utils/performance';
import { useSiteSettings, Module } from '@/lib/settings-context';
import {
  Plus,
  Edit2,
  Trash2,
  Link2,
  RefreshCw,
  Settings2,
  ChevronDown,
  ChevronRight,
  Package,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Layers,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';

// Types
type CustomizationType = 'add' | 'remove' | 'swap' | 'upgrade' | 'replace';
type SelectionMode = 'single' | 'multiple' | 'quantity';
type PriceType = 'fixed' | 'percentage' | 'per_unit' | 'per_night' | 'per_person';

// Map module template types to entity type keys
const MODULE_TO_ENTITY_TYPE: Record<string, string> = {
  'menu_service': 'menu_item',
  'multi_day_booking': 'chalet',
  'session_access': 'pool_session',
};

interface CustomizationGroup {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  applicableEntityTypes: string[];
  isGlobal: boolean;
  isAvailable: boolean;
  sortOrder: number;
  options?: CustomizationOption[];
}

interface CustomizationOption {
  id: string;
  groupId: string;
  name: string;
  nameAr?: string;
  customizationType: CustomizationType;
  priceAdjustment: number;
  priceType: PriceType;
  inventoryItemId?: string;
  quantityPerSelection: number;
  maxQuantity: number;
  isDefault: boolean;
  isPopular: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

interface MetricSummary {
  metricName: string;
  sampleCount: number;
  avgValue: number;
  minValue: number;
  maxValue: number;
  p50: number;
  p95: number;
  p99: number;
  hour: string;
}

interface DualWriteStats {
  total: number;
  matches: number;
  mismatches: number;
  matchRate: number;
}

// Entity type labels - static list, but will be filtered by active modules
const ALL_ENTITY_TYPE_LABELS: Record<string, string> = {
  menu_item: 'Menu Items',
  snack_bar_item: 'Snack Bar Items',
  chalet: 'Chalets',
  pool_session: 'Pool Sessions',
  spa_service: 'Spa Services',
  activity: 'Activities',
  rental_item: 'Rentals',
  event_ticket: 'Event Tickets',
  room: 'Rooms',
  package: 'Packages',
};

// Map module slugs to entity types
const MODULE_SLUG_TO_ENTITY: Record<string, string[]> = {
  'restaurant': ['menu_item'],
  'snack-bar': ['snack_bar_item'],
  'chalets': ['chalet'],
  'pool': ['pool_session'],
  'spa': ['spa_service'],
  'activities': ['activity'],
  'rentals': ['rental_item'],
  'events': ['event_ticket'],
  'rooms': ['room'],
};

const SELECTION_MODE_LABELS: Record<SelectionMode, string> = {
  single: 'Single Selection',
  multiple: 'Multiple Selection',
  quantity: 'Quantity Selector',
};

const CUSTOMIZATION_TYPE_LABELS: Record<CustomizationType, string> = {
  add: 'Add',
  remove: 'Remove',
  swap: 'Swap',
  upgrade: 'Upgrade',
  replace: 'Replace',
};

export default function AdminCustomizationsPage() {
  const queryClient = useQueryClient();
  const { modules } = useSiteSettings();
  const [activeTab, setActiveTab] = useState<'groups' | 'metrics' | 'migration'>('groups');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedGroup, setSelectedGroup] = useState<CustomizationGroup | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<CustomizationOption | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Compute available entity types based on active modules
  const availableEntityTypes = useMemo(() => {
    if (!modules || modules.length === 0) {
      // Fallback: show all entity types if no modules data
      return Object.keys(ALL_ENTITY_TYPE_LABELS);
    }
    
    const activeEntityTypes = new Set<string>();
    
    modules.forEach((mod: Module) => {
      if (mod.is_active) {
        // Check by slug mapping
        const entityTypes = MODULE_SLUG_TO_ENTITY[mod.slug];
        if (entityTypes) {
          entityTypes.forEach(et => activeEntityTypes.add(et));
        }
        // Check by template type mapping
        const entityFromTemplate = MODULE_TO_ENTITY_TYPE[mod.template_type];
        if (entityFromTemplate) {
          activeEntityTypes.add(entityFromTemplate);
        }
      }
    });
    
    // Always include package as it's a cross-module concept
    activeEntityTypes.add('package');
    
    return Array.from(activeEntityTypes);
  }, [modules]);

  // Create filtered entity type labels based on active modules
  const ENTITY_TYPE_LABELS = useMemo(() => {
    const filtered: Record<string, string> = {};
    availableEntityTypes.forEach(key => {
      if (ALL_ENTITY_TYPE_LABELS[key]) {
        filtered[key] = ALL_ENTITY_TYPE_LABELS[key];
      }
    });
    return filtered;
  }, [availableEntityTypes]);

  // Fetch groups with options
  const { data: groups, isLoading: groupsLoading, refetch: refetchGroups } = useQuery({
    queryKey: ['customization-groups'],
    queryFn: async () => {
      const response = await api.get('/customizations/groups', {
        params: { includeOptions: true }
      });
      return response.data as CustomizationGroup[];
    },
  });

  // Client-side search filtering
  const filteredGroups = useMemo(() => {
    if (!groups || !debouncedSearch) return groups;
    const q = debouncedSearch.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q) ||
      g.options?.some(o => o.name.toLowerCase().includes(q))
    );
  }, [groups, debouncedSearch]);

  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['customization-metrics'],
    queryFn: async () => {
      const response = await api.get('/customizations/metrics');
      return response.data as MetricSummary[];
    },
    enabled: activeTab === 'metrics',
  });

  // Fetch dual-write stats
  const { data: dualWriteStats } = useQuery({
    queryKey: ['dual-write-stats'],
    queryFn: async () => {
      const response = await api.get('/customizations/dual-write/stats');
      return response.data as DualWriteStats;
    },
    enabled: activeTab === 'migration',
  });

  // Mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: Partial<CustomizationGroup>) =>
      api.post('/customizations/groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Group created successfully');
      setIsGroupDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create group');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomizationGroup> }) => 
      api.put(`/customizations/groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Group updated successfully');
      setIsGroupDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update group');
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customizations/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Group deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete group');
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: (data: Partial<CustomizationOption>) => 
      api.post('/customizations/options', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Option created successfully');
      setIsOptionDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create option');
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomizationOption> }) => 
      api.put(`/customizations/options/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Option updated successfully');
      setIsOptionDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update option');
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customizations/options/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
      toast.success('Option deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete option');
    },
  });

  const migrateMutation = useMutation({
    mutationFn: () => api.post('/customizations/migrate'),
    onSuccess: (response) => {
      toast.success(`Migration completed: ${response.data.groups} groups, ${response.data.options} options, ${response.data.links} links`);
      queryClient.invalidateQueries({ queryKey: ['customization-groups'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Migration failed');
    },
  });

  // Toggle group expansion
  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Group stats
  const groupStats = useMemo(() => {
    if (!groups) return { total: 0, active: 0, inactive: 0, totalOptions: 0 };
    return {
      total: groups.length,
      active: groups.filter(g => g.isAvailable).length,
      inactive: groups.filter(g => !g.isAvailable).length,
      totalOptions: groups.reduce((sum, g) => sum + (g.options?.length || 0), 0),
    };
  }, [groups]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customization Manager</h1>
          <p className="text-muted-foreground">
            Manage customization groups, options, and monitor system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchGroups()}
            disabled={groupsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${groupsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setSelectedGroup(null);
              setIsGroupDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Groups</p>
                <p className="text-2xl font-bold">{groupStats.total}</p>
              </div>
              <Layers className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Groups</p>
                <p className="text-2xl font-bold text-green-600">{groupStats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Options</p>
                <p className="text-2xl font-bold">{groupStats.totalOptions}</p>
              </div>
              <Settings2 className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-muted-foreground">{groupStats.inactive}</p>
              </div>
              <EyeOff className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeInUp} className="border-b">
        <div className="flex space-x-8">
          {[
            { id: 'groups', label: 'Groups & Options', icon: Layers },
            { id: 'metrics', label: 'Performance Metrics', icon: BarChart3 },
            { id: 'migration', label: 'Migration & Dual-Write', icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'groups' && (
          <motion.div
            key="groups"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups and options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Groups List */}
            <div className="space-y-3">
              {groupsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredGroups?.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No customization groups found</p>
                    <Button
                      className="mt-4"
                      onClick={() => {
                        setSelectedGroup(null);
                        setIsGroupDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Group
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredGroups?.map((group) => (
                  <Card key={group.id} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGroupExpansion(group.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{group.name}</h3>
                            {!group.isAvailable && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                                Inactive
                              </span>
                            )}
                            {group.isRequired && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Required
                              </span>
                            )}
                            {group.isGlobal && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Global
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {SELECTION_MODE_LABELS[group.selectionMode]} • 
                            {group.options?.length || 0} options • 
                            {group.applicableEntityTypes.map(t => ALL_ENTITY_TYPE_LABELS[t] || t).slice(0, 2).join(', ')}
                            {group.applicableEntityTypes.length > 2 && ` +${group.applicableEntityTypes.length - 2}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedGroup(group);
                            setEditingOption(null);
                            setIsOptionDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Option
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedGroup(group);
                            setIsGroupDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this group?')) {
                              deleteGroupMutation.mutate(group.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Options */}
                    <AnimatePresence>
                      {expandedGroups.has(group.id) && group.options && group.options.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t bg-muted/30"
                        >
                          <div className="p-4 space-y-2">
                            {group.options.map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center justify-between p-3 bg-background rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                    option.isAvailable ? 'bg-green-500' : 'bg-muted'
                                  }`} />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{option.name}</span>
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                                        {CUSTOMIZATION_TYPE_LABELS[option.customizationType]}
                                      </span>
                                      {option.isDefault && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          Default
                                        </span>
                                      )}
                                      {option.isPopular && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                          Popular
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {option.priceAdjustment > 0 ? '+' : ''}
                                      {option.priceAdjustment.toFixed(2)} ({option.priceType})
                                      {option.inventoryItemId && ' • Inventory linked'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedGroup(group);
                                      setEditingOption(option);
                                      setIsOptionDialogOpen(true);
                                    }}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm('Delete this option?')) {
                                        deleteOptionMutation.mutate(option.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'metrics' && (
          <motion.div
            key="metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics (Last 24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
                ) : !metrics || metrics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No metrics data available yet</p>
                    <p className="text-sm">Metrics will appear after customization operations</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Group by metric name */}
                    {['validation_latency_ms', 'inventory_processing_ms'].map((metricName) => {
                      const metricData = metrics.filter(m => m.metricName === metricName);
                      if (metricData.length === 0) return null;
                      
                      const latest = metricData[0];
                      const isHealthy = latest.p95 < 50; // Under 50ms target
                      
                      return (
                        <div key={metricName} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                              <h4 className="font-semibold">
                                {metricName === 'validation_latency_ms' ? 'Validation Latency' : 'Inventory Processing'}
                              </h4>
                            </div>
                            <span className={`text-sm ${isHealthy ? 'text-green-600' : 'text-yellow-600'}`}>
                              {isHealthy ? 'Healthy' : 'Above Target'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-4 text-center">
                            <div>
                              <p className="text-sm text-muted-foreground">Samples</p>
                              <p className="text-lg font-semibold">{latest.sampleCount}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Average</p>
                              <p className="text-lg font-semibold">{latest.avgValue.toFixed(1)}ms</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">P50</p>
                              <p className="text-lg font-semibold">{latest.p50.toFixed(1)}ms</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">P95</p>
                              <p className={`text-lg font-semibold ${latest.p95 > 50 ? 'text-yellow-600' : ''}`}>
                                {latest.p95.toFixed(1)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">P99</p>
                              <p className="text-lg font-semibold">{latest.p99.toFixed(1)}ms</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'migration' && (
          <motion.div
            key="migration"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Migration Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Menu Modifiers Migration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Migrate existing menu modifier groups and options to the unified customization system.
                  This is a one-time operation that copies data without deleting the original.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => {
                      if (confirm('This will migrate all menu modifiers to the unified system. Continue?')) {
                        migrateMutation.mutate();
                      }
                    }}
                    disabled={migrateMutation.isPending}
                  >
                    {migrateMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Migrating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Migration
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dual-Write Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Dual-Write Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!dualWriteStats ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No dual-write data available</p>
                    <p className="text-sm">Data will appear when dual-write is enabled</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Total Operations</p>
                        <p className="text-2xl font-bold">{dualWriteStats.total}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Matches</p>
                        <p className="text-2xl font-bold text-green-600">{dualWriteStats.matches}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Mismatches</p>
                        <p className="text-2xl font-bold text-red-600">{dualWriteStats.mismatches}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Match Rate</p>
                        <p className={`text-2xl font-bold ${
                          dualWriteStats.matchRate >= 99 ? 'text-green-600' : 
                          dualWriteStats.matchRate >= 95 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {dualWriteStats.matchRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    
                    {dualWriteStats.matchRate < 100 && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          <p className="font-medium text-yellow-800 dark:text-yellow-200">
                            Discrepancies detected
                          </p>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Review the discrepancies before proceeding with migration cutover.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Dialog */}
      <GroupDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        group={selectedGroup}
        availableEntityTypes={ENTITY_TYPE_LABELS}
        onSubmit={(data) => {
          if (selectedGroup) {
            updateGroupMutation.mutate({ id: selectedGroup.id, data });
          } else {
            createGroupMutation.mutate(data);
          }
        }}
        isLoading={createGroupMutation.isPending || updateGroupMutation.isPending}
      />

      {/* Option Dialog */}
      <OptionDialog
        open={isOptionDialogOpen}
        onOpenChange={setIsOptionDialogOpen}
        groupId={selectedGroup?.id || ''}
        option={editingOption}
        onSubmit={(data) => {
          if (editingOption) {
            updateOptionMutation.mutate({ id: editingOption.id, data });
          } else {
            createOptionMutation.mutate({ ...data, groupId: selectedGroup?.id });
          }
        }}
        isLoading={createOptionMutation.isPending || updateOptionMutation.isPending}
      />
    </motion.div>
  );
}

// Group Dialog Component
function GroupDialog({
  open,
  onOpenChange,
  group,
  availableEntityTypes,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CustomizationGroup | null;
  availableEntityTypes: Record<string, string>;
  onSubmit: (data: Partial<CustomizationGroup>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<CustomizationGroup>>({
    name: '',
    nameAr: '',
    description: '',
    selectionMode: 'single',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    applicableEntityTypes: [],
    isGlobal: false,
    isAvailable: true,
  });

  useEffect(() => {
    if (group) {
      setFormData(group);
    } else {
      setFormData({
        name: '',
        nameAr: '',
        description: '',
        selectionMode: 'single',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        applicableEntityTypes: [],
        isGlobal: false,
        isAvailable: true,
      });
    }
  }, [group, open]);

  const toggleEntityType = (type: string) => {
    const current = formData.applicableEntityTypes || [];
    if (current.includes(type)) {
      setFormData({ ...formData, applicableEntityTypes: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, applicableEntityTypes: [...current, type] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Group' : 'Create Group'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Name (English)</label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Size"
                className="bg-card text-foreground border-border"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Name (Arabic)</label>
              <Input
                value={formData.nameAr || ''}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder="e.g., الحجم"
                dir="rtl"
                className="bg-card text-foreground border-border"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Description</label>
            <Input
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              className="bg-card text-foreground border-border"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Selection Mode</label>
            <select
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.selectionMode}
              onChange={(e) => setFormData({ ...formData, selectionMode: e.target.value as SelectionMode })}
            >
              {Object.entries(SELECTION_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-card text-foreground">{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Min Selections</label>
              <Input
                type="number"
                min={0}
                value={formData.minSelections || 0}
                onChange={(e) => setFormData({ ...formData, minSelections: parseInt(e.target.value) || 0 })}
                className="bg-card text-foreground border-border"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Max Selections</label>
              <Input
                type="number"
                min={1}
                value={formData.maxSelections || 1}
                onChange={(e) => setFormData({ ...formData, maxSelections: parseInt(e.target.value) || 1 })}
                className="bg-card text-foreground border-border"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Applicable Entity Types</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(availableEntityTypes).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleEntityType(value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                    formData.applicableEntityTypes?.includes(value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {Object.keys(availableEntityTypes).length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No active modules found. Please enable modules first.</p>
            )}
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRequired || false}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isGlobal || false}
                onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Global</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAvailable !== false}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Available</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => onSubmit(formData)} 
            disabled={isLoading || !formData.name || !formData.applicableEntityTypes?.length}
          >
            {isLoading ? 'Saving...' : group ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Option Dialog Component
function OptionDialog({
  open,
  onOpenChange,
  groupId,
  option,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  option: CustomizationOption | null;
  onSubmit: (data: Partial<CustomizationOption>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<CustomizationOption>>({
    name: '',
    nameAr: '',
    customizationType: 'add',
    priceAdjustment: 0,
    priceType: 'fixed',
    quantityPerSelection: 1,
    maxQuantity: 10,
    isDefault: false,
    isPopular: false,
    isAvailable: true,
  });

  useEffect(() => {
    if (option) {
      setFormData(option);
    } else {
      setFormData({
        name: '',
        nameAr: '',
        customizationType: 'add',
        priceAdjustment: 0,
        priceType: 'fixed',
        quantityPerSelection: 1,
        maxQuantity: 10,
        isDefault: false,
        isPopular: false,
        isAvailable: true,
      });
    }
  }, [option, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{option ? 'Edit Option' : 'Create Option'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Name (English)</label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Large"
                className="bg-card text-foreground border-border"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Name (Arabic)</label>
              <Input
                value={formData.nameAr || ''}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder="e.g., كبير"
                dir="rtl"
                className="bg-card text-foreground border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Customization Type</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.customizationType}
                onChange={(e) => setFormData({ ...formData, customizationType: e.target.value as CustomizationType })}
              >
                {Object.entries(CUSTOMIZATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-card text-foreground">{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Price Type</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.priceType}
                onChange={(e) => setFormData({ ...formData, priceType: e.target.value as PriceType })}
              >
                <option value="fixed" className="bg-card text-foreground">Fixed</option>
                <option value="percentage" className="bg-card text-foreground">Percentage</option>
                <option value="per_unit" className="bg-card text-foreground">Per Unit</option>
                <option value="per_night" className="bg-card text-foreground">Per Night</option>
                <option value="per_person" className="bg-card text-foreground">Per Person</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Price Adjustment</label>
              <Input
                type="number"
                step="0.01"
                value={formData.priceAdjustment || 0}
                onChange={(e) => setFormData({ ...formData, priceAdjustment: parseFloat(e.target.value) || 0 })}
                className="bg-card text-foreground border-border"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Qty Per Selection</label>
              <Input
                type="number"
                min={1}
                value={formData.quantityPerSelection || 1}
                onChange={(e) => setFormData({ ...formData, quantityPerSelection: parseFloat(e.target.value) || 1 })}
                className="bg-card text-foreground border-border"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Max Quantity</label>
              <Input
                type="number"
                min={1}
                value={formData.maxQuantity || 10}
                onChange={(e) => setFormData({ ...formData, maxQuantity: parseInt(e.target.value) || 10 })}
                className="bg-card text-foreground border-border"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Inventory Item ID (optional)</label>
            <Input
              value={formData.inventoryItemId || ''}
              onChange={(e) => setFormData({ ...formData, inventoryItemId: e.target.value || undefined })}
              placeholder="UUID of inventory item"
              className="bg-card text-foreground border-border"
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault || false}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Default</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPopular || false}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Popular</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAvailable !== false}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">Available</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => onSubmit(formData)} 
            disabled={isLoading || !formData.name}
          >
            {isLoading ? 'Saving...' : option ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
