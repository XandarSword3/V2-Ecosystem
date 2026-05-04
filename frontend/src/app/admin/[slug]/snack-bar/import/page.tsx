'use client';

import { useParams, useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { useSiteSettings } from '@/lib/settings-context';

interface SnackItem extends Record<string, unknown> {
  name: string;
  price: number;
  category: 'drinks' | 'snacks' | 'ice_cream' | 'sandwiches' | 'other';
  description?: string;
  is_available?: boolean;
  discount_price?: number;
  calories?: number;
  allergens?: string[];
}

const categoryLabels: Record<string, string> = {
  drinks: 'Drinks',
  snacks: 'Snacks',
  ice_cream: 'Ice Cream',
  sandwiches: 'Sandwiches',
  other: 'Other',
};

const categoryColors: Record<string, string> = {
  drinks: 'bg-blue-100 text-blue-700',
  snacks: 'bg-amber-100 text-amber-700',
  ice_cream: 'bg-pink-100 text-pink-700',
  sandwiches: 'bg-emerald-100 text-emerald-700',
  other: 'bg-slate-100 text-slate-700',
};

export default function SnackImportPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  return (
    <ImportWizard<SnackItem>
      title="Import Snack Items"
      parseEndpoint="/snack/import/parse"
      commitEndpoint="/snack/import/commit"
      llmPlaceholder={`Paste your snack menu here. Examples:
• Coca-Cola $2.50 (drinks)
• Cheese Burger $8.99 - sandwiches
• Vanilla Ice Cream $4.00 (ice_cream)
• Mixed Nuts $3.50 snacks`}
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
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${categoryColors[item.category] || 'bg-slate-100'}`}>
              {categoryLabels[item.category] || item.category}
            </div>
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
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'price', 'category', 'description', 'calories'],
        exampleRows: [
          ['Cola', '2.50', 'drinks', 'Classic soft drink', '140'],
          ['Cheese Burger', '8.99', 'sandwiches', 'Beef patty with cheese', '650'],
          ['Vanilla Ice Cream', '4.00', 'ice_cream', 'Creamy vanilla flavor', '200'],
        ],
      }}
    />
  );
}
