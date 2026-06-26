'use client';

import { useParams } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { useSiteSettings } from '@/lib/settings-context';

interface SessionItem extends Record<string, unknown> {
  name: string;
  start_time: string;
  end_time: string;
  adult_price: number;
  child_price: number;
  max_capacity: number;
  is_active?: boolean;
  day_of_week?: number[];
}

export default function SessionsImportPage() {
  const params = useParams();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  return (
    <ImportWizard<SessionItem>
      title={`Import ${currentModule.name} Sessions`}
      parseEndpoint={`/${slug}/import/parse`}
      commitEndpoint={`/${slug}/import/commit`}
      llmPlaceholder={`Paste your session schedule here. Examples:

Session Name: Morning Swim
Time: 9:00 AM - 12:00 PM
Adult: $15, Child: $10
Capacity: 50

Or paste multiple sessions at once...`}
      renderPreviewItem={(item) => (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
            <p className="text-sm text-slate-500">
              {item.start_time} - {item.end_time}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-primary-600">Adult: ${item.adult_price}</p>
            <p className="text-sm text-secondary-600">Child: ${item.child_price}</p>
            <p className="text-xs text-slate-400">Cap: {item.max_capacity}</p>
          </div>
        </div>
      )}
    />
  );
}
