'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useCartStore } from '@/stores/cartStore';
import { MenuItem } from './types';
import { type SelectedModifier } from '@/components/restaurant/ModifierSelectionModal';

export function useMenuActions(
  translateContent: (item: any, field: string) => string,
  t: (key: string, params?: Record<string, any>) => string,
) {
  const addToRestaurant = useCartStore((s) => s.addToRestaurant);
  const removeFromRestaurant = useCartStore((s) => s.removeFromRestaurant);
  const restaurantItems = useCartStore((s) => s.items.filter(i => i.moduleId === 'restaurant'));
  const getRestaurantTotal = useCartStore((s) => s.getRestaurantTotal);
  const getRestaurantCount = useCartStore((s) => s.getRestaurantCount);

  const [selectedItemForModifiers, setSelectedItemForModifiers] = useState<MenuItem | null>(null);
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState<MenuItem | null>(null);
  const [checkingCustomizations, setCheckingCustomizations] = useState(false);

  const cartTotal = getRestaurantTotal();
  const cartCount = getRestaurantCount();

  const handleItemClick = useCallback(async (item: MenuItem) => {
    setCheckingCustomizations(true);
    try {
      const response = await api.get(`/customizations/for-entity/menu_item/${item.id}`);
      const customizationGroups = response.data || [];
      if (customizationGroups.length > 0) {
        setSelectedItemForCustomization(item);
      } else {
        setSelectedItemForModifiers(item);
      }
    } catch (error) {
      console.error('Failed to check for customizations, falling back to legacy:', error);
      setSelectedItemForModifiers(item);
    } finally {
      setCheckingCustomizations(false);
    }
  }, []);

  const handleCustomizationConfirm = useCallback((data: {
    selections: any[];
    totalPriceAdjustment: number;
    lineTotal: number;
    quantity: number;
  }) => {
    if (!selectedItemForCustomization) return;
    
    const translatedName = translateContent(selectedItemForCustomization, 'name');
    const basePrice = Number(selectedItemForCustomization.discountPrice || selectedItemForCustomization.price);
    
    const mapCustomizationType = (type: string): 'add' | 'remove' | 'swap' => {
      switch (type) {
        case 'remove': return 'remove';
        case 'swap':
        case 'replace':
        case 'upgrade': return 'swap';
        default: return 'add';
      }
    };
    
    const customizationDetails = data.selections.map(s => ({
      optionId: s.optionId,
      optionName: s.optionName,
      groupId: s.groupId,
      groupName: s.groupName,
      modifierType: mapCustomizationType(s.customizationType),
      priceAdjustment: s.priceAdjustment || s.totalPrice || 0,
      quantity: s.quantity,
    }));
    
    for (let i = 0; i < data.quantity; i++) {
      addToRestaurant({
        id: selectedItemForCustomization.id,
        name: translatedName,
        price: basePrice,
        category: translateContent(selectedItemForCustomization.category, 'name'),
        imageUrl: selectedItemForCustomization.imageUrl,
        selectedModifiers: customizationDetails,
        modifierTotal: data.totalPriceAdjustment,
      });
    }
    
    toast.success(t('addedToCart', { item: translatedName }));
    setSelectedItemForCustomization(null);
  }, [selectedItemForCustomization, translateContent, addToRestaurant, t]);

  const addToCart = useCallback((item: {
    id: string;
    name: string;
    price: number;
    category?: string;
    imageUrl?: string;
    selectedModifiers?: SelectedModifier[];
    modifierTotal?: number;
    specialInstructions?: string;
  }) => {
    addToRestaurant({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl,
      selectedModifiers: item.selectedModifiers,
      modifierTotal: item.modifierTotal,
      specialInstructions: item.specialInstructions,
    });
    toast.success(t('addedToCart', { item: item.name }));
  }, [addToRestaurant, t]);

  const quickAddToCart = useCallback((item: MenuItem) => {
    const translatedName = translateContent(item, 'name');
    addToRestaurant({
      id: item.id,
      name: translatedName,
      price: Number(item.discountPrice || item.price),
      category: translateContent(item.category, 'name'),
      imageUrl: item.imageUrl,
    });
    toast.success(t('addedToCart', { item: translatedName }));
  }, [addToRestaurant, translateContent, t]);

  const getItemQuantity = useCallback((itemId: string) => {
    return restaurantItems
      .filter((i) => i.id === itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }, [restaurantItems]);

  return {
    cartTotal,
    cartCount,
    restaurantItems,
    removeFromRestaurant,
    selectedItemForModifiers,
    setSelectedItemForModifiers,
    selectedItemForCustomization,
    setSelectedItemForCustomization,
    checkingCustomizations,
    handleItemClick,
    handleCustomizationConfirm,
    addToCart,
    quickAddToCart,
    getItemQuantity,
  };
}
