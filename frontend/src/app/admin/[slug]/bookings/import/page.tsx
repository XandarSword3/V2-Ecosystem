'use client';

import { useParams } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { useSiteSettings } from '@/lib/settings-context';

interface AccommodationItem extends Record<string, unknown> {
  name: string;
  description?: string;
  maxGuests: number;
  bedrooms?: number;
  bathrooms?: number;
  basePrice: number;
  weekendPrice?: number;
  weeklyDiscount?: number;
  amenities?: string[];
  isActive?: boolean;
}

export default function BookingsImportPage() {
  const params = useParams();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  return (
    <ImportWizard<AccommodationItem>
      title={`Import ${currentModule.name} Accommodations`}
      parseEndpoint={`/api/modules/${slug}/import/parse`}
      commitEndpoint={`/api/modules/${slug}/import/commit`}
      llmPlaceholder={`Paste your accommodation data here. Examples:

Chalet Name: Ocean View Villa
Capacity: 6 guests
Bedrooms: 3, Bathrooms: 2
Base Price: $200/night
Weekend Price: $250/night
Amenities: Pool, WiFi, AC, Kitchen

Or paste multiple accommodations at once...`}
      renderPreviewItem={(item) => (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
            <p className="text-sm text-slate-500">
              {item.maxGuests} guests · {item.bedrooms || 0} BR · {item.bathrooms || 0} BA
            </p>
            {item.amenities && item.amenities.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {item.amenities.slice(0, 3).join(', ')}
                {item.amenities.length > 3 && ` +${item.amenities.length - 3} more`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-primary-600">${item.basePrice}/night</p>
            {item.weekendPrice && (
              <p className="text-xs text-secondary-600">Weekend: ${item.weekendPrice}</p>
            )}
          </div>
        </div>
      )}
    />
  );
}
