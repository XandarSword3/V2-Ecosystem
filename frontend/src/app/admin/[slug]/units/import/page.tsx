'use client';

import { useParams, useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { useSiteSettings } from '@/lib/settings-context';
import { Badge } from '@/components/ui/Badge';
import { Users, Bed, Bath, DollarSign, Plus, Check } from 'lucide-react';

interface ReservationUnit extends Record<string, unknown> {
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  weekendPrice?: number;
  amenities?: string[];
  addOns?: { name: string; price: number; pricingType: string }[];
}

export default function UnitImportPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  return (
    <ImportWizard<ReservationUnit>
      title="Import Units"
      parseEndpoint={`/${slug}/import/parse`}
      commitEndpoint={`/${slug}/import/commit`}
      llmPlaceholder={`Paste your unit/accommodation listings here. Examples:
• Sunset Villa: 4 guests, 2 bedrooms, 1 bathroom
  Base price $150/night, Weekend $180/night
  Amenities: WiFi, Pool, BBQ, AC
  Add-ons: Airport transfer $50 one-time, Breakfast $15 per person

• Mountain Retreat: 8 guests, 4 bedrooms, 2 bathrooms
  $300/night, Weekly discount 15%
  Amenities: Fireplace, Hot tub, Kitchen, Parking`}
      moduleId={currentModule?.id}
      onBack={() => router.push(`/admin/${slug}/bookings`)}
      renderPreviewItem={(item, onChange) => (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
              🏠
            </div>
            <div className="flex-1">
              <Input
                value={item.name}
                onChange={(e) => onChange('name', e.target.value)}
                className="h-8 font-medium mb-1"
                aria-label="Unit Name"
              />
              <p className="text-sm text-slate-500">{item.description?.slice(0, 60)}...</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <DollarSign className="w-4 h-4" />
                <Input
                  type="number"
                  value={item.basePrice}
                  onChange={(e) => onChange('basePrice', parseFloat(e.target.value))}
                  className="h-8 w-20"
                  aria-label="Base Price"
                />
                <span className="text-xs font-normal text-slate-400">/night</span>
              </div>
              {item.weekendPrice && (
                <p className="text-xs text-slate-500">Weekend: ${item.weekendPrice}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm pl-[60px]">
            <span className="flex items-center gap-1 text-slate-600">
              <Users className="w-4 h-4" />
              <Input
                type="number"
                value={item.maxGuests}
                onChange={(e) => onChange('maxGuests', parseInt(e.target.value))}
                className="h-7 w-12"
                aria-label="Max Guests"
              />
              guests
            </span>
            {item.bedrooms !== undefined && (
              <span className="flex items-center gap-1 text-slate-600">
                <Bed className="w-4 h-4" />
                {item.bedrooms} bed
              </span>
            )}
            {item.bathrooms !== undefined && (
              <span className="flex items-center gap-1 text-slate-600">
                <Bath className="w-4 h-4" />
                {item.bathrooms} bath
              </span>
            )}
          </div>
          <div className="pl-[60px] flex gap-1 flex-wrap">
            {item.amenities?.slice(0, 6).map((amenity) => (
              <Badge key={amenity} variant="secondary" className="text-[10px]">
                <Check className="w-3 h-3 mr-1" />
                {amenity}
              </Badge>
            ))}
            {item.amenities && item.amenities.length > 6 && (
              <Badge variant="outline" className="text-[10px]">+{item.amenities.length - 6}</Badge>
            )}
          </div>
          {item.addOns && item.addOns.length > 0 && (
            <div className="pl-[60px]">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add-ons:
              </p>
              <div className="flex gap-2 flex-wrap">
                {item.addOns.map((addon, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {addon.name}: ${addon.price}
                    <span className="text-slate-400">/{addon.pricingType.replace('_', ' ')}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'maxGuests', 'bedrooms', 'bathrooms', 'basePrice', 'weekendPrice', 'amenities'],
        exampleRows: [
          ['Sunset Villa', '4', '2', '1', '150', '180', 'WiFi,Pool,BBQ,AC'],
          ['Mountain Retreat', '8', '4', '2', '300', '350', 'Fireplace,Hot tub,Kitchen'],
          ['Cozy Cabin', '2', '1', '1', '80', '100', 'WiFi,Fireplace'],
        ],
      }}
    />
  );
}
