'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
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
  Sparkles,
  Ban,
  RefreshCcw,
  ArrowUpCircle,
} from 'lucide-react';

// ==========================================
// TYPES (mirror the shared types)
// ==========================================

export type CustomizationType = 'add' | 'remove' | 'swap' | 'upgrade' | 'replace';
export type CustomizableEntityType = 
  | 'catalog_item'
  | 'kiosk_item' 
  | 'accommodation_unit' 
  | 'capacity_window' 
  | 'spa_service' 
  | 'activity' 
  | 'rental_item' 
  | 'event_ticket' 
  | 'room' 
  | 'package';
export type SelectionMode = 'single' | 'multiple' | 'quantity';
export type PriceType = 'fixed' | 'percentage' | 'per_unit' | 'per_night' | 'per_person';

export interface CustomizationOptionDisplay {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  customizationType: CustomizationType;
  priceAdjustment: number;
  priceType: PriceType;
  maxQuantity: number;
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string;
  imageUrl?: string;
  isAvailable: boolean;
  inventoryItemId?: string;
  quantityPerSelection: number;
  sortOrder: number;
}

export interface CustomizationGroupWithOptions {
  groupId: string;
  groupName: string;
  groupNameAr?: string;
  displayName?: string;
  displayNameAr?: string;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: CustomizationOptionDisplay[];
}

export interface CustomizationSelection {
  groupId: string;
  optionId: string;
  quantity: number;
}

export interface ValidatedSelection extends CustomizationSelection {
  groupName: string;
  optionName: string;
  customizationType: CustomizationType;
  unitPrice: number;
  totalPrice: number;
  inventoryItemId?: string;
  quantityPerSelection: number;
  replacesInventoryItemId?: string;
}

export interface CustomizationValidationResult {
  isValid: boolean;
  totalPriceAdjustment: number;
  validatedSelections: ValidatedSelection[];
  validationErrors: string[];
}

// ==========================================
// CUSTOMIZATION SELECTOR COMPONENT
// ==========================================

interface CustomizationSelectorProps {
  /** Type of entity being customized */
  entityType: CustomizableEntityType;
  /** ID of the specific entity */
  entityId: string;
  /** Entity display info */
  entity: {
    name: string;
    nameAr?: string;
    description?: string;
    descriptionAr?: string;
    basePrice: number;
    imageUrl?: string;
  };
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Callback when customizations are confirmed */
  onConfirm: (data: {
    selections: ValidatedSelection[];
    totalPriceAdjustment: number;
    lineTotal: number;
    quantity: number;
  }) => void;
  /** Initial quantity (default 1) */
  initialQuantity?: number;
  /** Whether to show quantity selector (default true) */
  showQuantitySelector?: boolean;
  /** Custom title */
  title?: string;
  /** Price display context for accommodations */
  priceContext?: 'per_item' | 'per_night' | 'per_person' | 'total';
  /** Number of nights/persons for context */
  contextMultiplier?: number;
}

export function CustomizationSelector({
  entityType,
  entityId,
  entity,
  isOpen,
  onClose,
  onConfirm,
  initialQuantity = 1,
  showQuantitySelector = true,
  title,
  priceContext = 'per_item',
  contextMultiplier = 1,
}: CustomizationSelectorProps) {
  const t = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CustomizationGroupWithOptions[]>([]);
  const [selections, setSelections] = useState<Map<string, { optionId: string; quantity: number }[]>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(initialQuantity);
  const [validationResult, setValidationResult] = useState<CustomizationValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Helper for translation - converts individual fields to translatable item format
  const getText = useCallback((name: string, nameAr?: string): string => {
    return translateContent({ name, name_ar: nameAr }, 'name');
  }, [translateContent]);

  // Fetch customizations when modal opens
  useEffect(() => {
    if (isOpen && entityId) {
      fetchCustomizations();
    }
  }, [isOpen, entityType, entityId]);

  // Auto-expand required groups and set defaults
  useEffect(() => {
    if (groups.length > 0) {
      const requiredGroupIds = new Set(
        groups.filter(g => g.isRequired).map(g => g.groupId)
      );
      setExpandedGroups(requiredGroupIds);

      // Set default selections
      const defaultSelections = new Map<string, { optionId: string; quantity: number }[]>();
      groups.forEach(group => {
        const defaults = group.options
          .filter(o => o.isDefault && o.isAvailable)
          .map(o => ({ optionId: o.id, quantity: 1 }));
        if (defaults.length > 0) {
          defaultSelections.set(group.groupId, defaults);
        }
      });
      setSelections(defaultSelections);
    }
  }, [groups]);

  // Validate when selections change
  useEffect(() => {
    if (groups.length > 0 && !loading) {
      validateSelections();
    }
  }, [selections, groups, loading]);

  const fetchCustomizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/customizations/for-entity/${entityType}/${entityId}`);
      setGroups(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch customizations:', err);
      setError(err.message || 'Failed to load customization options');
    } finally {
      setLoading(false);
    }
  };

  const validateSelections = async () => {
    setValidating(true);
    try {
      const selectionsArray: CustomizationSelection[] = [];
      selections.forEach((opts, groupId) => {
        opts.forEach(opt => {
          selectionsArray.push({
            groupId,
            optionId: opt.optionId,
            quantity: opt.quantity
          });
        });
      });

      const response = await api.post('/customizations/validate', {
        entityType,
        entityId,
        selections: selectionsArray
      });

      setValidationResult(response.data);
    } catch (err: any) {
      console.error('Validation error:', err);
      setValidationResult({
        isValid: false,
        totalPriceAdjustment: 0,
        validatedSelections: [],
        validationErrors: ['Failed to validate selections']
      });
    } finally {
      setValidating(false);
    }
  };

  // Selection handlers
  const handleSingleSelect = useCallback((groupId: string, optionId: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      const current = next.get(groupId)?.[0];
      
      // Toggle off if same option
      if (current?.optionId === optionId) {
        next.delete(groupId);
      } else {
        next.set(groupId, [{ optionId, quantity: 1 }]);
      }
      return next;
    });
  }, []);

  const handleMultipleSelect = useCallback((groupId: string, optionId: string, maxSelections: number) => {
    setSelections(prev => {
      const next = new Map(prev);
      const current = next.get(groupId) || [];
      const exists = current.find(s => s.optionId === optionId);

      if (exists) {
        // Remove
        const filtered = current.filter(s => s.optionId !== optionId);
        if (filtered.length === 0) {
          next.delete(groupId);
        } else {
          next.set(groupId, filtered);
        }
      } else if (current.length < maxSelections) {
        // Add
        next.set(groupId, [...current, { optionId, quantity: 1 }]);
      }
      return next;
    });
  }, []);

  const handleQuantityChange = useCallback((groupId: string, optionId: string, delta: number, maxQuantity: number) => {
    setSelections(prev => {
      const next = new Map(prev);
      const current = next.get(groupId) || [];
      const existing = current.find(s => s.optionId === optionId);

      if (existing) {
        const newQty = Math.max(0, Math.min(maxQuantity, existing.quantity + delta));
        if (newQty === 0) {
          const filtered = current.filter(s => s.optionId !== optionId);
          if (filtered.length === 0) {
            next.delete(groupId);
          } else {
            next.set(groupId, filtered);
          }
        } else {
          next.set(groupId, current.map(s => 
            s.optionId === optionId ? { ...s, quantity: newQty } : s
          ));
        }
      } else if (delta > 0) {
        next.set(groupId, [...current, { optionId, quantity: 1 }]);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const customizationTotal = validationResult?.totalPriceAdjustment || 0;
    const baseTotal = entity.basePrice * quantity;
    
    // For accommodations, customization might be per night
    const adjustedCustomizationTotal = priceContext === 'per_night' 
      ? customizationTotal * contextMultiplier 
      : priceContext === 'per_person'
        ? customizationTotal * contextMultiplier
        : customizationTotal;
    
    return {
      base: baseTotal,
      customizations: adjustedCustomizationTotal * quantity,
      total: baseTotal + (adjustedCustomizationTotal * quantity)
    };
  }, [entity.basePrice, quantity, validationResult, priceContext, contextMultiplier]);

  // Check if all required groups have selections
  const hasRequiredSelections = useMemo(() => {
    return groups
      .filter(g => g.isRequired)
      .every(g => {
        const sel = selections.get(g.groupId);
        return sel && sel.length >= g.minSelections;
      });
  }, [groups, selections]);

  const canConfirm = validationResult?.isValid && hasRequiredSelections && !validating;

  const handleConfirm = () => {
    if (!validationResult?.isValid) return;
    
    onConfirm({
      selections: validationResult.validatedSelections,
      totalPriceAdjustment: validationResult.totalPriceAdjustment,
      lineTotal: totals.total,
      quantity
    });
  };

  // Get icon for customization type
  const getTypeIcon = (type: CustomizationType) => {
    switch (type) {
      case 'add': return <Plus className="w-3 h-3" />;
      case 'remove': return <Ban className="w-3 h-3" />;
      case 'swap': return <RefreshCcw className="w-3 h-3" />;
      case 'upgrade': return <ArrowUpCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  // Get badge color for customization type
  const getTypeBadgeColor = (type: CustomizationType) => {
    switch (type) {
      case 'add': return 'bg-green-100 text-green-700 border-green-300';
      case 'remove': return 'bg-red-100 text-red-700 border-red-300';
      case 'swap': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'upgrade': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Format price based on type
  const formatPrice = (amount: number, type: PriceType) => {
    if (amount === 0) return t('free') || 'Free';
    const prefix = amount > 0 ? '+' : '';
    
    switch (type) {
      case 'percentage':
        return `${prefix}${amount}%`;
      case 'per_night':
        return `${prefix}${formatCurrency(amount, currency)}/night`;
      case 'per_person':
        return `${prefix}${formatCurrency(amount, currency)}/person`;
      default:
        return `${prefix}${formatCurrency(amount, currency)}`;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {title || getText(entity.name, entity.nameAr)}
              </h2>
              {entity.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {getText(entity.description, entity.descriptionAr)}
                </p>
              )}
              <p className="text-lg font-semibold text-primary mt-2">
                {formatCurrency(entity.basePrice, currency)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">{error}</p>
                <Button onClick={fetchCustomizations} className="mt-4">
                  {t('retry') || 'Retry'}
                </Button>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('noCustomizationsAvailable') || 'No customization options available'}</p>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.groupId}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.groupId)}
                    className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {getText(group.displayName || group.groupName, group.displayNameAr || group.groupNameAr)}
                      </span>
                      {group.isRequired && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          {t('required') || 'Required'}
                        </span>
                      )}
                      {group.selectionMode === 'multiple' && (
                        <span className="text-xs text-gray-500">
                          ({t('selectUpTo') || 'Select up to'} {group.maxSelections})
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        expandedGroups.has(group.groupId) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Options */}
                  <AnimatePresence>
                    {expandedGroups.has(group.groupId) && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-2">
                          {group.options.map((option) => {
                            const selected = selections.get(group.groupId)?.find(s => s.optionId === option.id);
                            const isSelected = !!selected;
                            const currentQty = selected?.quantity || 0;

                            return (
                              <div
                                key={option.id}
                                className={`
                                  relative p-3 rounded-lg border-2 transition-all cursor-pointer
                                  ${!option.isAvailable 
                                    ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800 border-gray-200' 
                                    : isSelected
                                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500 shadow-md'
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-orange-300'
                                  }
                                `}
                                onClick={() => {
                                  if (!option.isAvailable) return;
                                  
                                  if (group.selectionMode === 'single') {
                                    handleSingleSelect(group.groupId, option.id);
                                  } else if (group.selectionMode === 'multiple') {
                                    handleMultipleSelect(group.groupId, option.id, group.maxSelections);
                                  }
                                  // Quantity mode handled by buttons
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {/* Selection indicator */}
                                      {group.selectionMode !== 'quantity' && (
                                        <div
                                          className={`
                                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                                            ${isSelected
                                              ? 'bg-orange-500 border-orange-500'
                                              : 'border-gray-300 dark:border-gray-600'
                                            }
                                          `}
                                        >
                                          {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                      )}

                                      {/* Name */}
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {getText(option.name, option.nameAr)}
                                      </span>

                                      {/* Type badge */}
                                      <span className={`
                                        inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border
                                        ${getTypeBadgeColor(option.customizationType)}
                                      `}>
                                        {getTypeIcon(option.customizationType)}
                                        {option.customizationType}
                                      </span>

                                      {/* Popular badge */}
                                      {option.isPopular && (
                                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
                                          <Sparkles className="w-3 h-3" />
                                          {t('popular') || 'Popular'}
                                        </span>
                                      )}

                                      {/* Custom badge */}
                                      {option.badgeText && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                          {option.badgeText}
                                        </span>
                                      )}
                                    </div>

                                    {option.description && (
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                                        {option.description}
                                      </p>
                                    )}

                                    {!option.isAvailable && (
                                      <p className="text-sm text-red-500 mt-1 ml-7">
                                        {t('outOfStock') || 'Out of stock'}
                                      </p>
                                    )}
                                  </div>

                                  {/* Price & Quantity */}
                                  <div className="flex flex-col items-end gap-2">
                                    <span className={`
                                      font-semibold
                                      ${option.priceAdjustment > 0 
                                        ? 'text-orange-600' 
                                        : option.priceAdjustment < 0 
                                          ? 'text-green-600' 
                                          : 'text-gray-500'
                                      }
                                    `}>
                                      {formatPrice(option.priceAdjustment, option.priceType)}
                                    </span>

                                    {/* Quantity controls for quantity mode */}
                                    {group.selectionMode === 'quantity' && option.isAvailable && (
                                      <div
                                        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => handleQuantityChange(group.groupId, option.id, -1, option.maxQuantity)}
                                          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                          disabled={currentQty === 0}
                                        >
                                          <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-6 text-center font-medium">
                                          {currentQty}
                                        </span>
                                        <button
                                          onClick={() => handleQuantityChange(group.groupId, option.id, 1, option.maxQuantity)}
                                          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                          disabled={currentQty >= option.maxQuantity}
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
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

            {/* Validation Errors */}
            {validationResult && validationResult.validationErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    {validationResult.validationErrors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700 dark:text-red-300">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Quantity Selector */}
            {showQuantitySelector && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('quantity') || 'Quantity'}
                </span>
                <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-full px-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Price Summary */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{t('basePrice') || 'Base price'}</span>
                <span>{formatCurrency(totals.base, currency)}</span>
              </div>
              {totals.customizations !== 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t('customizations') || 'Customizations'}</span>
                  <span className={totals.customizations > 0 ? 'text-orange-600' : 'text-green-600'}>
                    {totals.customizations > 0 ? '+' : ''}{formatCurrency(totals.customizations, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>{t('total') || 'Total'}</span>
                <span className="text-primary">{formatCurrency(totals.total, currency)}</span>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="w-full py-3 text-lg font-semibold"
            >
              {validating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  {t('confirmSelection') || 'Confirm Selection'} - {formatCurrency(totals.total, currency)}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CustomizationSelector;
