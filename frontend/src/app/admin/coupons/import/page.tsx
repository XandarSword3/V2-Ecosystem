'use client';

import { useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Percent, DollarSign } from 'lucide-react';

interface Coupon extends Record<string, unknown> {
  code?: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  expiresAt?: string;
  appliesTo?: 'all' | 'restaurant' | 'pool' | 'chalets' | 'snack';
}

const appliesToOptions = [
  { value: 'all', label: 'All Services' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'pool', label: 'Pool' },
  { value: 'chalets', label: 'Chalets' },
  { value: 'snack', label: 'Snack Bar' },
];

export default function CouponImportPage() {
  const router = useRouter();

  return (
    <ImportWizard<Coupon>
      title="Batch Import Coupons"
      parseEndpoint="/coupons/import/parse"
      commitEndpoint="/coupons/import/commit"
      llmPlaceholder={`Paste your coupon definitions here. Examples:
• Summer Sale 2024: 15% off, min order $50, expires 2024-08-31
• Welcome Discount: $10 off first purchase, applies to all
• Weekend Special: 20% off restaurant orders, valid weekends only`}
      onBack={() => router.push('/admin/coupons')}
      renderPreviewItem={(item, onChange) => (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
          <div>
            <Input
              value={item.code || ''}
              onChange={(e) => onChange('code', e.target.value)}
              className="h-8 font-mono text-xs"
              placeholder="Auto"
              aria-label="Coupon Code"
            />
          </div>
          <div className="col-span-2">
            <Input
              value={item.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="h-8"
              aria-label="Coupon Name"
            />
          </div>
          <div className="flex items-center gap-1">
            {item.discountType === 'percentage' ? (
              <Percent className="w-4 h-4 text-blue-500" />
            ) : (
              <DollarSign className="w-4 h-4 text-emerald-500" />
            )}
            <Input
              type="number"
              value={item.discountValue}
              onChange={(e) => onChange('discountValue', parseFloat(e.target.value))}
              className="h-8 w-20"
              aria-label="Discount Value"
            />
            {item.discountType === 'percentage' && <span>%</span>}
          </div>
          <div>
            <Select
              value={item.appliesTo || 'all'}
              onValueChange={(v) => onChange('appliesTo', v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {appliesToOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            {item.minOrderAmount && <Badge variant="outline">min ${item.minOrderAmount}</Badge>}
            {item.maxDiscountAmount && <Badge variant="outline">max ${item.maxDiscountAmount}</Badge>}
            {item.usageLimit && <Badge variant="outline">{item.usageLimit} uses</Badge>}
          </div>
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'discountType', 'discountValue', 'minOrderAmount', 'maxDiscountAmount', 'usageLimit', 'appliesTo'],
        exampleRows: [
          ['Summer Sale', 'percentage', '15', '50', '', '100', 'all'],
          ['Welcome Discount', 'fixed', '10', '0', '', '', 'all'],
          ['Restaurant Special', 'percentage', '20', '30', '50', '50', 'restaurant'],
        ],
      }}
    />
  );
}
