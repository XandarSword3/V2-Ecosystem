'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Settings2,
  Search,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Check,
  Tag,
  Link2,
} from 'lucide-react';

interface ModifierOption {
  id: string;
  name: string;
  name_ar?: string;
  price_adjustment: number;
  is_available: boolean;
  display_order: number;
  modifier_type: 'add' | 'remove' | 'swap';
  max_quantity?: number;
  is_default?: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  selection_mode: 'single' | 'multiple' | 'quantity';
  options: ModifierOption[];
  module_id?: string;
}

interface CatalogItemOption {
  id: string;
  name: string;
}

interface EntityLink {
  linkId: string;
  itemId: string;
  itemName: string;
}

export default function DynamicModifiersPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // "Applies to" — which catalog items each group is linked to
  const [catalogItems, setCatalogItems] = useState<CatalogItemOption[]>([]);
  const [linksByGroup, setLinksByGroup] = useState<Map<string, EntityLink[]>>(new Map());
  const [attachingGroupId, setAttachingGroupId] = useState<string | null>(null);
  const [itemToAttach, setItemToAttach] = useState('');
  const [attaching, setAttaching] = useState(false);
  
  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form data
  const [groupForm, setGroupForm] = useState({
    name: '',
    nameAr: '',
    description: '',
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    selectionMode: 'single' as 'single' | 'multiple' | 'quantity',
  });

  const [optionForm, setOptionForm] = useState({
    name: '',
    nameAr: '',
    priceAdjustment: 0,
    modifierType: 'add' as 'add' | 'remove' | 'swap',
    maxQuantity: 5,
    isDefault: false,
    isAvailable: true,
  });

  useEffect(() => {
    if (currentModule) {
      fetchData();
    }
  }, [currentModule]);

  const fetchData = async () => {
    if (!currentModule) return;
    try {
      setLoading(true);
      // Use unified customization API with module filter
      const groupsRes = await api.get('/customizations/groups', { 
        params: { moduleId: currentModule.id } 
      });
      // Transform customization groups to modifier format
      const customizationGroups = groupsRes.data.data || [];
      const modifierGroups: ModifierGroup[] = customizationGroups.map((g: any) => ({
        id: g.id,
        name: g.name,
        name_ar: g.name_localized?.ar,
        description: g.description,
        min_selections: g.min_selections || 0,
        max_selections: g.max_selections || 1,
        is_required: g.is_required || false,
        selection_mode: g.selectionMode || 'single',
        options: (g.options || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          name_ar: o.name_localized?.ar,
          price_adjustment: o.price_adjustment || 0,
          is_available: o.is_available !== false,
          display_order: o.display_order || 0,
          modifier_type: o.modifier_type || 'add',
          max_quantity: o.max_quantity,
          is_default: o.is_default,
        })),
        module_id: g.module_id,
      }));
      setGroups(modifierGroups);

      // Load this module's catalog items, then look up which groups each
      // item already links to (GET /customizations/entity-links already
      // existed and worked — nothing in the admin UI ever called it).
      const itemsRes = await api.get(`/${currentModule.slug}/items`);
      const items: CatalogItemOption[] = (itemsRes.data?.data || itemsRes.data || [])
        .map((i: any) => ({ id: i.id, name: i.name }));
      setCatalogItems(items);

      const linkResults = await Promise.all(
        items.map((item) =>
          api.get('/customizations/entity-links', {
            params: { entityType: 'catalog_item', entityId: item.id },
          }).then((res) => ({ item, links: res.data || [] }))
           .catch(() => ({ item, links: [] as any[] }))
        )
      );

      const nextLinksByGroup = new Map<string, EntityLink[]>();
      for (const { item, links } of linkResults) {
        for (const link of links) {
          const groupId = link.customization_group_id || link.customizationGroupId;
          if (!groupId) continue;
          const existing = nextLinksByGroup.get(groupId) || [];
          existing.push({ linkId: link.id, itemId: item.id, itemName: item.name });
          nextLinksByGroup.set(groupId, existing);
        }
      }
      setLinksByGroup(nextLinksByGroup);
    } catch (error) {
      toast.error('Failed to fetch modifier data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
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

  // Group CRUD
  const openGroupModal = (group?: ModifierGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        nameAr: group.name_ar || '',
        description: group.description || '',
        minSelections: group.min_selections,
        maxSelections: group.max_selections,
        isRequired: group.is_required,
        selectionMode: group.selection_mode || 'single',
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: '',
        nameAr: '',
        description: '',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        selectionMode: 'single',
      });
    }
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name) {
      toast.error('Group name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: groupForm.name,
        nameAr: groupForm.nameAr,
        description: groupForm.description,
        minSelections: groupForm.minSelections,
        maxSelections: groupForm.maxSelections,
        isRequired: groupForm.isRequired,
        selectionMode: groupForm.selectionMode,
        moduleId: currentModule?.id,
      };

      const customizationPayload = {
        ...payload,
        name_localized: payload.nameAr ? { ar: payload.nameAr } : undefined,
      };
      if (editingGroup) {
        await api.put(`/customizations/groups/${editingGroup.id}`, customizationPayload);
        toast.success('Modifier group updated');
      } else {
        await api.post('/customizations/groups', customizationPayload);
        toast.success('Modifier group created');
      }
      setShowGroupModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save modifier group');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this modifier group and all its options?')) return;
    try {
      await api.delete(`/customizations/groups/${groupId}`);
      toast.success('Modifier group deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete modifier group');
    }
  };

  // "Applies to" — link/unlink this group to specific catalog items
  const attachItemToGroup = async (groupId: string) => {
    if (!itemToAttach) return;
    try {
      setAttaching(true);
      await api.post('/customizations/entity-links', {
        entityType: 'catalog_item',
        entityId: itemToAttach,
        customizationGroupId: groupId,
      });
      toast.success('Item linked');
      setItemToAttach('');
      setAttachingGroupId(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to link item — it may already be linked');
    } finally {
      setAttaching(false);
    }
  };

  const detachItem = async (linkId: string) => {
    try {
      await api.delete(`/customizations/entity-links/${linkId}`);
      toast.success('Item unlinked');
      fetchData();
    } catch (error) {
      toast.error('Failed to unlink item');
    }
  };

  // Option CRUD
  const openOptionModal = (groupId: string, option?: ModifierOption) => {
    setSelectedGroupId(groupId);
    if (option) {
      setEditingOption(option);
      setOptionForm({
        name: option.name,
        nameAr: option.name_ar || '',
        priceAdjustment: option.price_adjustment,
        modifierType: option.modifier_type,
        maxQuantity: option.max_quantity || 5,
        isDefault: option.is_default || false,
        isAvailable: option.is_available,
      });
    } else {
      setEditingOption(null);
      setOptionForm({
        name: '',
        nameAr: '',
        priceAdjustment: 0,
        modifierType: 'add',
        maxQuantity: 5,
        isDefault: false,
        isAvailable: true,
      });
    }
    setShowOptionModal(true);
  };

  const saveOption = async () => {
    if (!optionForm.name || !selectedGroupId) {
      toast.error('Option name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: optionForm.name,
        nameAr: optionForm.nameAr,
        price: optionForm.priceAdjustment,
        modifierType: optionForm.modifierType,
        maxQuantity: optionForm.maxQuantity,
        isDefault: optionForm.isDefault,
        isAvailable: optionForm.isAvailable,
      };

      const optionPayload = {
        ...payload,
        name_localized: payload.nameAr ? { ar: payload.nameAr } : undefined,
        group_id: selectedGroupId,
      };
      if (editingOption) {
        await api.put(`/customizations/options/${editingOption.id}`, optionPayload);
        toast.success('Modifier option updated');
      } else {
        await api.post('/customizations/options', optionPayload);
        toast.success('Modifier option created');
      }
      setShowOptionModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save modifier option');
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm('Delete this modifier option?')) return;
    try {
      await api.delete(`/customizations/options/${optionId}`);
      toast.success('Modifier option deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete modifier option');
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.name_ar && g.name_ar.includes(searchQuery))
  );

  const getModifierTypeColor = (type: string) => {
    switch (type) {
      case 'add': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'remove': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'swap': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!currentModule) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Settings2 className="w-6 sm:w-7 h-6 sm:h-7" />
            {currentModule.name} Modifiers
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Configure add-ons and customizations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchData()} disabled={loading} className="flex-1 sm:flex-initial">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={() => openGroupModal()} className="flex-1 sm:flex-initial">
            <Plus className="w-4 h-4 mr-2" />
            New Group
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search modifier groups..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-4"
      >
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              Loading modifier groups...
            </CardContent>
          </Card>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No modifier groups found</p>
              <p className="text-sm mt-1">Create your first modifier group to get started</p>
              <Button className="mt-4" onClick={() => openGroupModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Modifier Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredGroups.map(group => (
            <motion.div key={group.id} variants={fadeInUp}>
              <Card>
                <div 
                  className="cursor-pointer p-4 sm:p-6" 
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {expandedGroups.has(group.id) ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                          {group.name}
                        </h3>
                        {group.name_ar && (
                          <p className="text-sm text-slate-500 truncate">{group.name_ar}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-8 sm:ml-0 flex-wrap">
                      {group.is_required && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                          Required
                        </span>
                      )}
                      <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400">
                        {group.min_selections}-{group.max_selections} selections
                      </span>
                      <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                        {group.options.length} options
                      </span>
                      <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {(linksByGroup.get(group.id) || []).length} items
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openGroupModal(group); }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <AnimatePresence>
                  {expandedGroups.has(group.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" />
                          Applies to
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(linksByGroup.get(group.id) || []).length === 0 && attachingGroupId !== group.id && (
                            <p className="text-sm text-slate-500">Not attached to any item yet — customers won't see this group.</p>
                          )}
                          {(linksByGroup.get(group.id) || []).map((link) => (
                            <span
                              key={link.linkId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-full text-slate-700 dark:text-slate-300"
                            >
                              {link.itemName}
                              <button
                                onClick={() => detachItem(link.linkId)}
                                className="hover:text-red-500"
                                aria-label={`Unlink ${link.itemName}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        {attachingGroupId === group.id ? (
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <select
                              value={itemToAttach}
                              onChange={(e) => setItemToAttach(e.target.value)}
                              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                            >
                              <option value="">Select an item…</option>
                              {catalogItems
                                .filter((item) => !(linksByGroup.get(group.id) || []).some((l) => l.itemId === item.id))
                                .map((item) => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => attachItemToGroup(group.id)}
                                disabled={!itemToAttach || attaching}
                                className="flex-1 sm:flex-initial"
                              >
                                {attaching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Attach'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => { setAttachingGroupId(null); setItemToAttach(''); }}
                                className="flex-1 sm:flex-initial"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => setAttachingGroupId(group.id)}
                            className="mt-1"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Attach to item
                          </Button>
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        {group.options.length === 0 ? (
                          <p className="text-center text-slate-500 py-4">No options yet</p>
                        ) : (
                          group.options.map(option => (
                            <div
                              key={option.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`px-2 py-0.5 text-xs rounded ${getModifierTypeColor(option.modifier_type)}`}>
                                  {option.modifier_type}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white truncate">
                                  {option.name}
                                </span>
                                {option.price_adjustment !== 0 && (
                                  <span className={`text-sm ${option.price_adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {option.price_adjustment > 0 ? '+' : ''}{formatCurrency(option.price_adjustment)}
                                  </span>
                                )}
                                {option.is_default && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                    Default
                                  </span>
                                )}
                                {!option.is_available && (
                                  <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400 rounded">
                                    Unavailable
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-auto">
                                <button
                                  onClick={() => openOptionModal(group.id, option)}
                                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-500" />
                                </button>
                                <button
                                  onClick={() => deleteOption(option.id)}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        <Button
                          variant="outline"
                          onClick={() => openOptionModal(group.id)}
                          className="w-full mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Option
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Group Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingGroup ? 'Edit Group' : 'New Modifier Group'}
                </h3>
                <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="e.g., Toppings"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (Arabic)</label>
                    <Input
                      value={groupForm.nameAr}
                      onChange={(e) => setGroupForm({ ...groupForm, nameAr: e.target.value })}
                      placeholder="الاسم بالعربية"
                      dir="rtl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <Input
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Min Selections</label>
                    <Input
                      type="number"
                      min="0"
                      value={groupForm.minSelections}
                      onChange={(e) => setGroupForm({ ...groupForm, minSelections: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Selections</label>
                    <Input
                      type="number"
                      min="1"
                      value={groupForm.maxSelections}
                      onChange={(e) => setGroupForm({ ...groupForm, maxSelections: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupForm.isRequired}
                      onChange={(e) => setGroupForm({ ...groupForm, isRequired: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Required</span>
                  </label>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Selection mode</label>
                    <select
                      value={groupForm.selectionMode}
                      onChange={(e) => setGroupForm({ ...groupForm, selectionMode: e.target.value as 'single' | 'multiple' | 'quantity' })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="single">Single — pick one option</option>
                      <option value="multiple">Multiple — pick several distinct options</option>
                      <option value="quantity">Quantity — pick an option more than once (e.g. 2x extra cheese)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowGroupModal(false)}>
                  Cancel
                </Button>
                <Button onClick={saveGroup} disabled={saving} className="flex-1">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />{editingGroup ? 'Update' : 'Create'}</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Option Modal */}
      <AnimatePresence>
        {showOptionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOptionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingOption ? 'Edit Option' : 'New Modifier Option'}
                </h3>
                <button onClick={() => setShowOptionModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                    <Input
                      value={optionForm.name}
                      onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                      placeholder="e.g., Extra Cheese"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (Arabic)</label>
                    <Input
                      value={optionForm.nameAr}
                      onChange={(e) => setOptionForm({ ...optionForm, nameAr: e.target.value })}
                      placeholder="الاسم بالعربية"
                      dir="rtl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price Adjustment</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={optionForm.priceAdjustment}
                        onChange={(e) => setOptionForm({ ...optionForm, priceAdjustment: parseFloat(e.target.value) || 0 })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select
                      value={optionForm.modifierType}
                      onChange={(e) => setOptionForm({ ...optionForm, modifierType: e.target.value as 'add' | 'remove' | 'swap' })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="add">Add (+price)</option>
                      <option value="remove">Remove (no price)</option>
                      <option value="swap">Swap (±price)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={optionForm.maxQuantity}
                    onChange={(e) => setOptionForm({ ...optionForm, maxQuantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optionForm.isDefault}
                      onChange={(e) => setOptionForm({ ...optionForm, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Default selected</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optionForm.isAvailable}
                      onChange={(e) => setOptionForm({ ...optionForm, isAvailable: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Available</span>
                  </label>
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowOptionModal(false)}>
                  Cancel
                </Button>
                <Button onClick={saveOption} disabled={saving} className="flex-1">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />{editingOption ? 'Update' : 'Create'}</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
