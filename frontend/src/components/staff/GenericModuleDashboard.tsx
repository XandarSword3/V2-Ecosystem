'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Puzzle, Settings2 } from 'lucide-react';

export interface GenericModuleDashboardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
  templateType: string;
  description?: string;
}

export function GenericModuleDashboard({
  slug,
  moduleName,
  moduleId,
  templateType,
  description,
}: GenericModuleDashboardProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <Puzzle className="h-8 w-8 text-indigo-600" />
            {moduleName}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Generic staff dashboard fallback.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Module Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-semibold">Slug:</span> {slug}
            </p>
            <p>
              <span className="font-semibold">Module ID:</span> {moduleId}
            </p>
            <p>
              <span className="font-semibold">Template Type:</span> {templateType}
            </p>
            {description ? (
              <p>
                <span className="font-semibold">Description:</span> {description}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
