'use client';

import { useParams, useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useSiteSettings } from '@/lib/settings-context';

interface ModifierOption {
  name: string;
  price: number;
  modifierType?: 'add' | 'remove' | 'swap';
}

interface ModifierGroup {
  name: string;
  is_required: boolean;
  options: ModifierOption[];
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  inventoryItemName?: string;
}

interface MenuItem extends Record<string, unknown> {
  name: string;
  price: number;
  category: string;
  description?: string;
  is_available: boolean;
  discount_price?: number;
  preparation_time?: number;
  calories?: number;
  allergens?: string[];
  modifiers?: ModifierGroup[];
  ingredients?: Ingredient[];
}

export default function MenuImportPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  return (
    <ImportWizard<MenuItem>
      title="Import Menu"
      parseEndpoint="/restaurant/import/parse"
      commitEndpoint="/restaurant/import/commit"
      llmPlaceholder={`Paste your menu here in any format. Examples:
• Margherita Pizza $12.99 - Classic tomato and mozzarella
• Greek Salad $8.50 (Salads) - Fresh cucumber and feta
• Burger with cheese +$2, bacon +$3
• Ingredients: Tomato, Mozzarella, Basil for Margherita`}
      moduleId={currentModule?.id}
      onBack={() => router.push(`/admin/${slug}/menu`)}
      renderPreviewItem={(item, onChange) => (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Name</span>
            <Input
              value={item.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="h-9"
              aria-label="Name"
            />
          </div>
          <div className="col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Price</span>
            <Input
              type="number"
              step="0.01"
              value={item.price}
              onChange={(e) => onChange('price', parseFloat(e.target.value))}
              className={`h-9 ${item.price === 0 ? 'border-red-500' : ''}`}
              aria-label="Price"
            />
          </div>
          <div className="col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Category</span>
            <Input
              value={item.category}
              onChange={(e) => onChange('category', e.target.value)}
              className="h-9"
              aria-label="Category"
            />
          </div>
          <div className="col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Description</span>
            <Input
              value={item.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
              className="h-9"
              placeholder="Optional..."
              aria-label="Description"
            />
          </div>
          {/* Modifiers Preview */}
          {item.modifiers && item.modifiers.length > 0 && (
            <div className="col-span-full">
              <span className="text-[10px] uppercase font-bold text-slate-400">Modifiers</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {item.modifiers.map((m: ModifierGroup, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-[10px]">
                    {m.name}: {m.options.length} options
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {/* Ingredients Preview */}
          {item.ingredients && item.ingredients.length > 0 && (
            <div className="col-span-full">
              <span className="text-[10px] uppercase font-bold text-slate-400">Ingredients (Inventory Link)</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {item.ingredients.map((ing: Ingredient, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-[10px]">
                    {ing.name} {ing.quantity > 0 && `(${ing.quantity} ${ing.unit})`}
                    {ing.inventoryItemName && ' → 📦'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'price', 'category', 'description', 'is_available', 'discount_price', 'preparation_time', 'calories', 'allergens'],
        exampleRows: [
          ['Margherita Pizza', '12.99', 'Pizza', 'Classic tomato and mozzarella', 'true', '', '15', '800', 'gluten,dairy'],
          ['Greek Salad', '8.50', 'Salads', 'Fresh cucumber and feta', 'true', '', '10', '350', 'dairy'],
          ['Beef Burger', '15.99', 'Burgers', 'Premium beef patty with toppings', 'true', '13.99', '20', '650', ''],
        ],
      }}
    />
  );
}
