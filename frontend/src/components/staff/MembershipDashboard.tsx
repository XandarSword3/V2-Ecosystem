'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BadgeCheck, Users } from 'lucide-react';

export interface MembershipDashboardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
}

export function MembershipDashboard({ slug, moduleName, moduleId }: MembershipDashboardProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <BadgeCheck className="h-8 w-8 text-emerald-600" />
            {moduleName} Memberships
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Ongoing entitlement dashboard for staff operations.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Module Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold">Slug:</span> {slug}
              </p>
              <p>
                <span className="font-semibold">Module ID:</span> {moduleId}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational Note</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 dark:text-slate-300">
              Membership actions are available through the staff API routes wired for this module.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
