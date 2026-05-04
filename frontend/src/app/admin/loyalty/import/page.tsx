'use client';

import { useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { Palette } from 'lucide-react';

interface LoyaltyTier extends Record<string, unknown> {
  name: string;
  minPoints: number;
  pointsMultiplier: number;
  color?: string;
  benefits?: string[];
  description?: string;
}

const tierColors: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
};

export default function LoyaltyImportPage() {
  const router = useRouter();

  return (
    <ImportWizard<LoyaltyTier>
      title="Import Loyalty Tiers"
      parseEndpoint="/loyalty/import/parse"
      commitEndpoint="/loyalty/import/commit"
      llmPlaceholder={`Paste your loyalty tier definitions here. Examples:
• Bronze: 0-499 points, 1x multiplier
• Silver: 500-999 points, 1.2x multiplier, benefits: free drink
• Gold: 1000+ points, 1.5x multiplier, benefits: free breakfast, late checkout
• Color codes: Bronze #CD7F32, Silver #C0C0C0, Gold #FFD700`}
      onBack={() => router.push('/admin/loyalty')}
      renderPreviewItem={(item, onChange) => (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: item.color || '#6B7280' }} />
            <Input
              value={item.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="h-9"
              aria-label="Tier Name"
            />
          </div>
          <div>
            <Input
              type="number"
              value={item.minPoints}
              onChange={(e) => onChange('minPoints', parseInt(e.target.value))}
              className="h-9"
              aria-label="Minimum Points"
            />
          </div>
          <div>
            <Input
              type="number"
              step="0.1"
              value={item.pointsMultiplier}
              onChange={(e) => onChange('pointsMultiplier', parseFloat(e.target.value))}
              className="h-9"
              aria-label="Points Multiplier"
            />
          </div>
          <div>
            <Input
              type="color"
              value={item.color || '#6B7280'}
              onChange={(e) => onChange('color', e.target.value)}
              className="h-9 w-20"
              aria-label="Tier Color"
            />
          </div>
          <div className="text-sm text-slate-600">
            {item.benefits?.slice(0, 2).join(', ')}
            {item.benefits && item.benefits.length > 2 && ` +${item.benefits.length - 2} more`}
          </div>
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'minPoints', 'pointsMultiplier', 'color', 'benefits'],
        exampleRows: [
          ['Bronze', '0', '1.0', '#CD7F32', 'Welcome gift'],
          ['Silver', '500', '1.2', '#C0C0C0', 'Free drink, Early check-in'],
          ['Gold', '1000', '1.5', '#FFD700', 'Free breakfast, Late checkout'],
        ],
      }}
    />
  );
}
