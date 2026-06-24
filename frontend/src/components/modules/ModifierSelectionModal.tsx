'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useContentTranslation } from '@/lib/translate';
import { Button } from '@/components/ui/Button';
import {
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  ChevronDown,
  Package,
  Loader2,
} from 'lucide-react';

interface ModifierOption {
  id: string;
  name: string;
  name_ar?: string;
  price_adjustment: number;
  is_available: boolean;
  display_order: number;
  modifier_type: 'add' | 'remove' | 'swap';
  inventory_item_id?: string;
  quantity_required?: number;
  unit?: string;
  description?: string;
  description_ar?: string;
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
  allow_multiple_same: boolean;
  options: ModifierOption[];
}

export interface SelectedModifier {
  optionId: string;
  optionName: string;
  groupId: string;
  groupName: string;
  modifierType: 'add' | 'remove' | 'swap';
  priceAdjustment: number;
  quantity: number;
  inventoryItemId?: string;
  inventoryQuantity?: number;
}

interface CatalogItemDetails {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  price: number;
  image_url?: string;
  category?: { name: string; name_ar?: string };
}

interface ModifierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: CatalogItemDetails;
  onAddToCart: (item: {
    id: string;
    name: string;
    price: number;
    category?: string;
    imageUrl?: string;
    selectedModifiers?: SelectedModifier[];
    modifierTotal?: number;
    specialInstructions?: string;
  }) => void;
}

export function ModifierSelectionModal({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
}: ModifierSelectionModalProps) {
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, Map<string, number>>>(new Map());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && menuItem) {
      fetchModifiers();
    }
  }, [isOpen, menuItem]);

  // Auto-expand all groups and set defaults
  useEffect(() => {
    if (modifierGroups.length > 0) {
      setExpandedGroups(new Set(modifierGroups.map(g => g.id)));
      
      // Set default options
      const defaults = new Map<string, Map<string, number>>();
      modifierGroups.forEach(group => {
        const groupDefaults = new Map<string, number>();
        group.options.forEach(option => {
          if (option.is_default && option.is_available) {
            groupDefaults.set(option.id, 1);
          }
        });
        if (groupDefaults.size > 0) {
          defaults.set(group.id, groupDefaults);
        }
      });
      setSelectedModifiers(defaults);
    }
  }, [modifierGroups]);

  const fetchModifiers = async () => {
    try {
      setLoading(true);
      // NOTE: /catalog/items/:id/modifiers endpoint — backend route needed in dynamic router
      const res = await api.get(`/catalog/items/${menuItem.id}/modifiers`);
      setModifierGroups(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch modifiers:', error);
      setModifierGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getSelectedCount = (groupId: string): number => {
    const groupSelections = selectedModifiers.get(groupId);
    if (!groupSelections) return 0;
    return Array.from(groupSelections.values()).reduce((sum, qty) => sum + qty, 0);
  };

  const isOptionSelected = (groupId: string, optionId: string): boolean => {
    const groupSelections = selectedModifiers.get(groupId);
    return groupSelections?.has(optionId) || false;
  };

  const getOptionQuantity = (groupId: string, optionId: string): number => {
    const groupSelections = selectedModifiers.get(groupId);
    return groupSelections?.get(optionId) || 0;
  };

  const selectOption = (group: ModifierGroup, option: ModifierOption, quantity: number = 1) => {
    setSelectedModifiers(prev => {
      const next = new Map(prev);
      let groupSelections = new Map(next.get(group.id) || []);
      
      const currentCount = getSelectedCount(group.id);
      const currentOptionQty = groupSelections.get(option.id) || 0;
      const newTotalCount = currentCount - currentOptionQty + quantity;
      
      if (quantity > 0 && newTotalCount > group.max_selections) {
        if (group.max_selections === 1) {
          groupSelections = new Map();
          groupSelections.set(option.id, 1);
        } else {
          return prev;
        }
      } else if (quantity <= 0) {
        groupSelections.delete(option.id);
      } else {
        const maxQty = option.max_quantity || 5;
        groupSelections.set(option.id, Math.min(quantity, maxQty));
      }
      
      if (groupSelections.size === 0) {
        next.delete(group.id);
      } else {
        next.set(group.id, groupSelections);
      }
      
      return next;
    });
    
    setValidationErrors([]);
  };

  const validate = (): boolean => {
    const errors: string[] = [];
    
    modifierGroups.forEach(group => {
      const count = getSelectedCount(group.id);
      if (group.is_required && count < group.min_selections) {
        errors.push(`${translateContent(group, 'name')}: Please select at least ${group.min_selections} option(s)`);
      }
      if (count < group.min_selections && group.min_selections > 0) {
        errors.push(`${translateContent(group, 'name')}: Please select at least ${group.min_selections} option(s)`);
      }
    });
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const calculateModifierTotal = (): number => {
    let total = 0;
    selectedModifiers.forEach((groupSelections, groupId) => {
      const group = modifierGroups.find(g => g.id === groupId);
      if (!group) return;
      
      groupSelections.forEach((quantity, optionId) => {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          total += option.price_adjustment * quantity;
        }
      });
    });
    return total;
  };

  const buildSelectedModifiers = (): SelectedModifier[] => {
    const result: SelectedModifier[] = [];
    
    selectedModifiers.forEach((groupSelections, groupId) => {
      const group = modifierGroups.find(g => g.id === groupId);
      if (!group) return;
      
      groupSelections.forEach((quantity, optionId) => {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          result.push({
            optionId: option.id,
            optionName: option.name,
            groupId: group.id,
            groupName: group.name,
            modifierType: option.modifier_type,
            priceAdjustment: option.price_adjustment,
            quantity,
            inventoryItemId: option.inventory_item_id,
            inventoryQuantity: option.quantity_required,
          });
        }
      });
    });
    
    return result;
  };

  const handleAddToCart = () => {
    if (!validate()) return;
    
    const modifierTotal = calculateModifierTotal();
    const selectedMods = buildSelectedModifiers();
    
    onAddToCart({
      id: menuItem.id,
      name: translateContent(menuItem, 'name'),
      price: menuItem.price,
      category: menuItem.category ? translateContent(menuItem.category, 'name') : undefined,
      imageUrl: menuItem.image_url,
      selectedModifiers: selectedMods.length > 0 ? selectedMods : undefined,
      modifierTotal: modifierTotal > 0 ? modifierTotal : undefined,
      specialInstructions: specialInstructions || undefined,
    });
    
    onClose();
  };

  const getModifierTypeBadge = (type: string) => {
    switch (type) {
      case 'add':
        return { label: 'Extra', bg: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: '+' };
      case 'remove':
        return { label: 'Remove', bg: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: '−' };
      case 'swap':
        return { label: 'Swap', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: '⇄' };
      default:
        return { label: type, bg: 'bg-slate-100 text-slate-600', icon: '' };
    }
  };

  const totalPrice = menuItem.price + calculateModifierTotal();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        role="dialog" aria-modal="true" aria-label={`Customize ${translateContent(menuItem, 'name')}`}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b dark:border-slate-700 flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold dark:text-white">
                {translateContent(menuItem, 'name')}
              </h2>
              {menuItem.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {translateContent(menuItem, 'description')}
                </p>
              )}
              <p className="text-lg font-semibold text-primary mt-2">
                {formatCurrency(menuItem.price, currency)}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close customization">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : modifierGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No customization options available</p>
              </div>
            ) : (
              modifierGroups.map(group => (
                <div key={group.id} className="border dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold dark:text-white">
                          {translateContent(group, 'name')}
                        </span>
                        {group.is_required && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {group.min_selections === group.max_selections 
                          ? `Select ${group.min_selections}` 
                          : `Select ${group.min_selections}-${group.max_selections}`}
                        {' '}• {getSelectedCount(group.id)} selected
                      </p>
                    </div>
                    <ChevronDown 
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedGroups.has(group.id) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {expandedGroups.has(group.id) && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          {group.options
                            .filter(o => o.is_available)
                            .sort((a, b) => a.display_order - b.display_order)
                            .map(option => {
                              const isSelected = isOptionSelected(group.id, option.id);
                              const quantity = getOptionQuantity(group.id, option.id);
                              
                              return (
                                <div
                                  key={option.id}
                                  className={`flex items-center justify-between p-3 rounded-lg transition cursor-pointer ${
                                    isSelected 
                                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 shadow-md shadow-orange-500/20' 
                                      : 'bg-gray-50 dark:bg-slate-800 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                                  }`}
                                  onClick={() => {
                                    if (!isSelected) {
                                      selectOption(group, option, 1);
                                    } else if (!group.allow_multiple_same) {
                                      selectOption(group, option, 0);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-orange-500 border-orange-500 scale-110' 
                                        : 'border-gray-300 dark:border-slate-600'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div>
                                      <div className={`font-medium ${isSelected ? 'text-orange-700 dark:text-orange-300' : 'dark:text-white'}`}>
                                        {translateContent(option, 'name')}
                                      </div>
                                      {option.description && (
                                        <p className="text-xs text-gray-500">
                                          {translateContent(option, 'description')}
                                        </p>
                                      )}
                                    </div>
                                    {(() => {
                                      const badge = getModifierTypeBadge(option.modifier_type);
                                      return (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.bg}`}>
                                          {badge.icon} {badge.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {option.modifier_type === 'remove' ? (
                                      <span className="text-xs text-slate-400 italic">no charge</span>
                                    ) : option.price_adjustment !== 0 ? (
                                      <span className={`font-medium ${option.price_adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {option.price_adjustment > 0 ? '+' : ''}{formatCurrency(option.price_adjustment, currency)}
                                      </span>
                                    ) : null}
                                    {isSelected && group.allow_multiple_same && (
                                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-slate-600"
                                          onClick={() => selectOption(group, option, quantity - 1)}
                                        >
                                          <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-6 text-center font-medium dark:text-white">
                                          {quantity}
                                        </span>
                                        <button
                                          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-slate-600"
                                          onClick={() => selectOption(group, option, quantity + 1)}
                                          disabled={quantity >= (option.max_quantity || 5)}
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}

            {/* Special Instructions */}
            <div className="border dark:border-slate-700 rounded-xl p-4">
              <label className="block text-sm font-medium dark:text-white mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                className="w-full p-3 border dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white resize-none"
                rows={2}
                placeholder="Any special requests? E.g., extra sauce, allergies..."
              />
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Please fix the following:
                </div>
                <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <Button
              onClick={handleAddToCart}
              className="w-full py-3 text-lg"
              disabled={loading}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add to Cart • {formatCurrency(totalPrice, currency)}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
