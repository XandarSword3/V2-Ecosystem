
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSiteSettings } from '@/lib/settings-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { 
  UtensilsCrossed, 
  List, 
  ShoppingCart, 
  LayoutGrid,
  Calendar,
  Tags,
  Settings,
  Ticket,
  Users
} from 'lucide-react';

export default function DynamicModuleDashboard() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const t = useTranslations('admin');
  const tc = useTranslations('adminCommon');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  // Decode and normalize for case-insensitive matching
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);
  // Use the actual module slug for URLs (not the decoded one) to maintain consistency
  const moduleSlug = currentModule?.slug || slug;

  if (!currentModule) return null;

  const renderMenuServiceDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${moduleSlug}/menu`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('menu.items')}</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('menu.manageMenu')}</div>
            <p className="text-xs text-muted-foreground">{tc('menu.addOrEdit')}</p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href={`/admin/${moduleSlug}/categories`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('menu.categories')}</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('menu.categories')}</div>
            <p className="text-xs text-muted-foreground">{tc('menu.organizeMenu')}</p>
          </CardContent>
        </Card>
      </Link>

      <Link href={`/admin/${moduleSlug}/orders`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('orders.title')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('orders.title')}</div>
            <p className="text-xs text-muted-foreground">{tc('orders.viewAndManage')}</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  const renderBookingDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${moduleSlug}/bookings`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('bookings.title')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('bookings.manageBookings')}</div>
            <p className="text-xs text-muted-foreground">{tc('bookings.viewCalendar')}</p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href={`/admin/${moduleSlug}/pricing`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('pricing.title')}</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('pricing.pricingRules')}</div>
            <p className="text-xs text-muted-foreground">{tc('pricing.setSeasonalRates')}</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  const renderSessionDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${moduleSlug}/sessions`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('sessions.title')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('sessions.title')}</div>
            <p className="text-xs text-muted-foreground">{tc('sessions.manageTimeSlots')}</p>
          </CardContent>
        </Card>
      </Link>

      <Link href={`/admin/${moduleSlug}/tickets`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tc('tickets.title')}</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tc('tickets.title')}</div>
            <p className="text-xs text-muted-foreground">{tc('tickets.viewSoldTickets')}</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {currentModule.template_type === 'menu_service' && renderMenuServiceDashboard()}
      {currentModule.template_type === 'multi_day_booking' && renderBookingDashboard()}
      {currentModule.template_type === 'session_access' && renderSessionDashboard()}
    </div>
  );
}
