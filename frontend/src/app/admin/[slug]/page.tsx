
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  if (!currentModule) return null;

  const renderMenuServiceDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${slug}/menu`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menu Items</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage Menu</div>
            <p className="text-xs text-muted-foreground">Add or edit items</p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href={`/admin/${slug}/categories`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Categories</div>
            <p className="text-xs text-muted-foreground">Organize your menu</p>
          </CardContent>
        </Card>
      </Link>

      <Link href={`/admin/${slug}/orders`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Orders</div>
            <p className="text-xs text-muted-foreground">View and manage orders</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  const renderBookingDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${slug}/bookings`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage Bookings</div>
            <p className="text-xs text-muted-foreground">View calendar and reservations</p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href={`/admin/${slug}/pricing`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pricing</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Pricing Rules</div>
            <p className="text-xs text-muted-foreground">Set seasonal rates</p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  const renderSessionDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href={`/admin/${slug}/sessions`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Sessions</div>
            <p className="text-xs text-muted-foreground">Manage time slots</p>
          </CardContent>
        </Card>
      </Link>

      <Link href={`/admin/${slug}/tickets`}>
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Tickets</div>
            <p className="text-xs text-muted-foreground">View sold tickets</p>
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
