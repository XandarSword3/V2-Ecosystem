'use client';

import { useParams, useRouter } from 'next/navigation';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { Input } from '@/components/ui/Input';
import { useSiteSettings } from '@/lib/settings-context';
import { Badge } from '@/components/ui/Badge';
import { Clock, Users, DollarSign, Users2 } from 'lucide-react';

interface PoolSession extends Record<string, unknown> {
  name: string;
  startTime: string;
  endTime: string;
  adultPrice: number;
  childPrice?: number;
  capacity: number;
  genderRestriction: 'mixed' | 'male' | 'female';
  daysOfWeek?: number[];
  memberDiscount?: number;
}

const genderLabels: Record<string, string> = {
  mixed: 'Mixed',
  male: 'Male Only',
  female: 'Female Only',
};

const genderColors: Record<string, string> = {
  mixed: 'bg-blue-100 text-blue-700',
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-rose-100 text-rose-700',
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PoolImportPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();

  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  return (
    <ImportWizard<PoolSession>
      title="Import Pool Sessions"
      parseEndpoint="/pool/import/parse"
      commitEndpoint="/pool/import/commit"
      llmPlaceholder={`Paste your pool session schedule here. Examples:
• Morning Session: 09:00-12:00, Adult $25, Child $15, Capacity 50, Mixed
• Ladies Only: 13:00-15:00, $20, Capacity 30, Female
• Family Time: 15:00-18:00, $30, Capacity 80, Mixed, 10% member discount`}
      moduleId={currentModule?.id}
      onBack={() => router.push(`/admin/${slug}/sessions`)}
      renderPreviewItem={(item, onChange) => (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
          <div className="col-span-1">
            <Input
              value={item.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="h-8"
              aria-label="Session Name"
            />
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <Input
              value={item.startTime}
              onChange={(e) => onChange('startTime', e.target.value)}
              className="h-8 w-16 text-center"
              aria-label="Start Time"
            />
            <span className="text-slate-400">-</span>
            <Input
              value={item.endTime}
              onChange={(e) => onChange('endTime', e.target.value)}
              className="h-8 w-16 text-center"
              aria-label="End Time"
            />
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <Input
              type="number"
              value={item.adultPrice}
              onChange={(e) => onChange('adultPrice', parseFloat(e.target.value))}
              className="h-8 w-16"
              aria-label="Adult Price"
            />
            {item.childPrice !== undefined && (
              <span className="text-xs text-slate-500">/ ${item.childPrice} child</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-500" />
            <Input
              type="number"
              value={item.capacity}
              onChange={(e) => onChange('capacity', parseInt(e.target.value))}
              className="h-8 w-16"
              aria-label="Capacity"
            />
          </div>
          <div>
            <Badge className={`${genderColors[item.genderRestriction]} font-medium`}>
              {genderLabels[item.genderRestriction]}
            </Badge>
          </div>
          <div className="flex gap-1 flex-wrap">
            {item.daysOfWeek ? (
              item.daysOfWeek.map(d => (
                <Badge key={d} variant="outline" className="text-[10px]">{dayNames[d]}</Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-[10px]">Daily</Badge>
            )}
            {item.memberDiscount ? (
              <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                <Users2 className="w-3 h-3 mr-1" />
                {item.memberDiscount}% off
              </Badge>
            ) : null}
          </div>
        </div>
      )}
      csvTemplate={{
        headers: ['name', 'startTime', 'endTime', 'adultPrice', 'childPrice', 'capacity', 'genderRestriction'],
        exampleRows: [
          ['Morning Swim', '09:00', '12:00', '25', '15', '50', 'mixed'],
          ['Ladies Only', '13:00', '15:00', '20', '15', '30', 'female'],
          ['Family Time', '15:00', '18:00', '30', '20', '80', 'mixed'],
        ],
      }}
    />
  );
}
