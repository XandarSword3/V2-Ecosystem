'use client';

import { useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ClipboardList, Clock, Package } from 'lucide-react';

interface HousekeepingTemplate extends Record<string, unknown> {
  title: string;
  description?: string;
  category: 'room' | 'common_area' | 'pool' | 'kitchen' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
  checklist?: string[];
  requiredSupplies?: { name: string; quantity: number; unit: string }[];
}

const categoryLabels: Record<string, string> = {
  room: 'Room',
  common_area: 'Common Area',
  pool: 'Pool',
  kitchen: 'Kitchen',
  other: 'Other',
};

const categoryColors: Record<string, string> = {
  room: 'bg-emerald-100 text-emerald-700',
  common_area: 'bg-blue-100 text-blue-700',
  pool: 'bg-cyan-100 text-cyan-700',
  kitchen: 'bg-orange-100 text-orange-700',
  other: 'bg-slate-100 text-slate-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function HousekeepingImportPage() {
  const router = useRouter();

  return (
    <ImportWizard<HousekeepingTemplate>
      title="Import Task Templates"
      parseEndpoint="/housekeeping/import/parse"
      commitEndpoint="/housekeeping/import/commit"
      llmPlaceholder={`Paste your housekeeping task templates here. Examples:
• Room Turnover: Clean guest room after checkout
  Category: room, Priority: high, Duration: 45 min
  Checklist: Change linens, Clean bathroom, Vacuum, Restock amenities
  Supplies: Towels x4, Sheets x1, Cleaning spray x1

• Lobby Cleaning: Daily lobby maintenance
  Category: common_area, Priority: medium, Duration: 30 min
  Checklist: Dust furniture, Mop floors, Clean windows

• Pool Maintenance: Weekly deep clean
  Category: pool, Priority: urgent, Duration: 60 min`}
      onBack={() => router.push('/admin/housekeeping')}
      renderPreviewItem={(item, onChange) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-slate-400" />
            <Input
              value={item.title}
              onChange={(e) => onChange('title', e.target.value)}
              className="h-8 font-medium"
              aria-label="Template Title"
            />
            <Badge className={`${categoryColors[item.category]} text-xs`}>
              {categoryLabels[item.category]}
            </Badge>
            <Badge className={`${priorityColors[item.priority]} text-xs`}>
              {item.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 pl-7">
            {item.estimatedMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {item.estimatedMinutes} min
              </span>
            )}
            {item.checklist && item.checklist.length > 0 && (
              <span className="flex items-center gap-1">
                <ClipboardList className="w-4 h-4" />
                {item.checklist.length} steps
              </span>
            )}
            {item.requiredSupplies && item.requiredSupplies.length > 0 && (
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {item.requiredSupplies.length} supplies
              </span>
            )}
          </div>
          {item.checklist && item.checklist.length > 0 && (
            <div className="pl-7">
              <ul className="text-xs text-slate-600 space-y-1">
                {item.checklist.slice(0, 3).map((step, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-slate-400">{i + 1}.</span>
                    {step}
                  </li>
                ))}
                {item.checklist.length > 3 && (
                  <li className="text-slate-400">+{item.checklist.length - 3} more steps</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      csvTemplate={{
        headers: ['title', 'category', 'priority', 'estimatedMinutes', 'checklist'],
        exampleRows: [
          ['Room Turnover', 'room', 'high', '45', 'Change linens, Clean bathroom, Vacuum'],
          ['Lobby Cleaning', 'common_area', 'medium', '30', 'Dust furniture, Mop floors'],
          ['Pool Deep Clean', 'pool', 'urgent', '60', 'Scrub tiles, Check chemicals, Skim surface'],
        ],
      }}
    />
  );
}
