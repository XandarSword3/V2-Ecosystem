'use client';

import { ModifierSelectionModal } from '@/components/restaurant/ModifierSelectionModal';
import { CustomizationSelector } from '@/components/customization/CustomizationSelector';
import type { MenuItem } from './types';

interface SelectedModifier {
  optionId: string;
  optionName: string;
  groupId: string;
  groupName: string;
  modifierType: 'add' | 'remove' | 'swap';
  priceAdjustment: number;
  quantity: number;
}

export interface RestaurantModalsProps {
  selectedItemForModifiers: MenuItem | null;
  setSelectedItemForModifiers: (item: MenuItem | null) => void;
  selectedItemForCustomization: MenuItem | null;
  setSelectedItemForCustomization: (item: MenuItem | null) => void;
  handleCustomizationConfirm: (data: {
    selections: any[];
    totalPriceAdjustment: number;
    lineTotal: number;
    quantity: number;
  }) => void;
  addToCart: (item: {
    id: string;
    name: string;
    price: number;
    category?: string;
    imageUrl?: string;
    selectedModifiers?: SelectedModifier[];
    modifierTotal?: number;
    specialInstructions?: string;
  }) => void;
  translateContent: (item: any, field: string) => string;
}

export function RestaurantModals({
  selectedItemForModifiers,
  setSelectedItemForModifiers,
  selectedItemForCustomization,
  setSelectedItemForCustomization,
  handleCustomizationConfirm,
  addToCart,
  translateContent,
}: RestaurantModalsProps) {
  return (
    <>
      {/* Modifier Selection Modal (Legacy) */}
      {selectedItemForModifiers && (
        <ModifierSelectionModal
          isOpen={!!selectedItemForModifiers}
          onClose={() => setSelectedItemForModifiers(null)}
          menuItem={{
            id: selectedItemForModifiers.id,
            name: selectedItemForModifiers.name,
            name_ar: selectedItemForModifiers.name_ar,
            description: selectedItemForModifiers.description,
            description_ar: selectedItemForModifiers.description_ar,
            price: Number(selectedItemForModifiers.discountPrice || selectedItemForModifiers.price),
            image_url: selectedItemForModifiers.imageUrl,
            category: selectedItemForModifiers.category,
          }}
          onAddToCart={addToCart}
        />
      )}

      {/* Unified Customization Selector (New System) */}
      {selectedItemForCustomization && (
        <CustomizationSelector
          entityType="menu_item"
          entityId={selectedItemForCustomization.id}
          entity={{
            name: selectedItemForCustomization.name,
            nameAr: selectedItemForCustomization.name_ar,
            description: selectedItemForCustomization.description,
            descriptionAr: selectedItemForCustomization.description_ar,
            basePrice: Number(
              selectedItemForCustomization.discountPrice || selectedItemForCustomization.price
            ),
            imageUrl: selectedItemForCustomization.imageUrl,
          }}
          isOpen={!!selectedItemForCustomization}
          onClose={() => setSelectedItemForCustomization(null)}
          onConfirm={handleCustomizationConfirm}
          title={translateContent(selectedItemForCustomization, 'name')}
        />
      )}
    </>
  );
}
