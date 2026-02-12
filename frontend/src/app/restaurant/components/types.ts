export interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number | string;
  category: {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
  };
  preparation_time_minutes?: number;
  preparationTimeMinutes?: number;
  is_vegetarian?: boolean;
  isVegetarian?: boolean;
  is_vegan?: boolean;
  isVegan?: boolean;
  is_gluten_free?: boolean;
  isGlutenFree?: boolean;
  is_spicy?: boolean;
  isSpicy?: boolean;
  discount_price?: number;
  discountPrice?: number;
  allergens?: string[];
  image_url?: string;
  imageUrl?: string;
  is_available?: boolean;
  isAvailable?: boolean;
  is_featured?: boolean;
  isFeatured?: boolean;
}

export interface RawMenuItem {
  id: string;
  name: string;
  price: number | string;
  category: { id: string; name: string };
  preparationTimeMinutes?: number;
  preparation_time_minutes?: number;
  isVegetarian?: boolean;
  is_vegetarian?: boolean;
  isVegan?: boolean;
  is_vegan?: boolean;
  isGlutenFree?: boolean;
  is_gluten_free?: boolean;
  isSpicy?: boolean;
  is_spicy?: boolean;
  discountPrice?: number;
  discount_price?: number | string;
  imageUrl?: string;
  image_url?: string;
  isAvailable?: boolean;
  is_available?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
}

export function normalizeMenuItem(item: RawMenuItem): MenuItem {
  const discountPriceNum = item.discountPrice !== undefined
    ? Number(item.discountPrice)
    : (item.discount_price !== undefined ? Number(item.discount_price) : undefined);

  return {
    ...item,
    price: Number(item.price) || 0,
    discount_price: discountPriceNum,
    preparationTimeMinutes: item.preparationTimeMinutes || item.preparation_time_minutes,
    isVegetarian: item.isVegetarian ?? item.is_vegetarian ?? false,
    isVegan: item.isVegan ?? item.is_vegan ?? false,
    isGlutenFree: item.isGlutenFree ?? item.is_gluten_free ?? false,
    isSpicy: item.isSpicy ?? item.is_spicy ?? false,
    discountPrice: discountPriceNum,
    imageUrl: item.imageUrl || item.image_url,
    isAvailable: item.isAvailable ?? item.is_available ?? true,
    isFeatured: item.isFeatured ?? item.is_featured ?? false,
  };
}

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
};

export const categoryIcons: Record<string, string> = {
  appetizers: '🥗',
  mains: '🍽️',
  desserts: '🍰',
  beverages: '🍹',
  grills: '🥩',
  seafood: '🦐',
  pasta: '🍝',
  salads: '🥬',
  soups: '🍲',
  sandwiches: '🥪',
  default: '🍴',
};

export function getCategoryIcon(categoryName: string): string {
  const key = categoryName.toLowerCase().replace(/\s+/g, '');
  return categoryIcons[key] || categoryIcons.default;
}
