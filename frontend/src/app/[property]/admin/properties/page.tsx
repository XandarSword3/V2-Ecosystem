'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Settings,
  Users,
  TrendingUp,
  MapPin,
  Mail,
  MoreHorizontal,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  CreditCard,
  Layers,
  ArrowRight,
  Globe,
  Clock,
  Trash2,
  UserPlus,
  X,
  LayoutGrid,
  List
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { useProperty } from '@/context/PropertyContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { Separator } from '@/components/ui/Separator';

// --- TYPES ---

interface Property {
  id: string;
  name: string;
  property_type: string;
  status: string;
  city: string;
  country: string;
  created_at: string;
  access_level: 'read' | 'write' | 'manage' | 'admin';
  is_primary: boolean;
  timezone: string;
  currency: string;
  description?: string;
  is_active?: boolean;
}

interface EconomicsData {
  gross: number;
  net: number;
  transactionsCount: number;
}

interface StaffMember {
  user_id: string;
  access_level: string;
  granted_at: string;
  users: {
    id: string;
    email: string;
    full_name: string;
  };
}

interface Currency {
  code: string;
  symbol: string;
  name: string;
  is_default: boolean;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  business_unit?: string;
}

// --- HELPERS ---

const getAccessPriority = (level: string): number => {
  switch (level) {
    case 'admin': return 4;
    case 'manage': return 3;
    case 'write': return 2;
    case 'read': return 1;
    default: return 0;
  }
};

const getPropertyIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'hotel': return <Building2 className="w-5 h-5" />;
    case 'resort': return <Globe className="w-5 h-5" />;
    case 'spa': return <Globe className="w-5 h-5" />;
    case 'food_beverage': return <TrendingUp className="w-5 h-5" />;
    case 'gym': return <TrendingUp className="w-5 h-5" />;
    case 'beach_club': return <Globe className="w-5 h-5" />;
    default: return <Building2 className="w-5 h-5" />;
  }
};

// Property access tiers — structural to the multi-property schema, not from roles table.
// These control what a user can DO to the property config (not which module they manage).
const PROPERTY_ACCESS_TIERS = [
  { value: 'read', label: 'Read Only' },
  { value: 'write', label: 'Write Access' },
  { value: 'manage', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
] as const;

const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Beirut (EET)', value: 'Asia/Beirut' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'Riyadh (AST)', value: 'Asia/Riyadh' },
  { label: 'Cairo (EET)', value: 'Africa/Cairo' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'New York (EST/EDT)', value: 'America/New_York' },
  { label: 'Los Angeles (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
];

const PROPERTY_TYPES = [
  { label: 'Hotel', value: 'hotel' },
  { label: 'Resort', value: 'resort' },
  { label: 'Spa', value: 'spa' },
  { label: 'Food & Beverage', value: 'food_beverage' },
  { label: 'Gym', value: 'gym' },
  { label: 'Beach Club', value: 'beach_club' },
  { label: 'Other', value: 'other' },
];

// --- COMPONENTS ---

export default function PropertiesPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const { activePropertyId, setActiveProperty } = useProperty();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // 1. Fetch Properties
  const { data: properties = [], isLoading: isPropertiesLoading } = useQuery({
    queryKey: ['my-properties'],
    queryFn: async () => {
      const res = await api.get('/multi-property/my-properties');
      return res.data.properties as Property[];
    }
  });

  // 2. Fetch active currencies from DB (Issue 11 — replaces all hardcoded currency lists)
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['currencies'],
    queryFn: async () => {
      const res = await api.get('/admin/currencies');
      return (res.data.data ?? []) as Currency[];
    },
    staleTime: 1000 * 60 * 30, // currencies rarely change — cache 30 min
  });

  // 3. Fetch roles for the staff invite access level dropdown (Issue 11 — live role read)
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles');
      return (res.data.data ?? []) as Role[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // 4. Fetch Economics for all properties (Parallel)
  const economicsQueries = useQueries({
    queries: properties.map(p => ({
      queryKey: ['property-economics', p.id],
      queryFn: async () => {
        const to = format(new Date(), 'yyyy-MM-dd');
        const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        const res = await api.get('/economics/gross-vs-net', {
          params: { from, to, propertyId: p.id }
        });
        return res.data.data as EconomicsData;
      },
      enabled: !!p.id,
      staleTime: 1000 * 60 * 5,
    }))
  });

  // 5. Fetch Module Counts for all properties
  const modulesQueries = useQueries({
    queries: properties.map(p => ({
      queryKey: ['property-modules', p.id],
      queryFn: async () => {
        const res = await api.get('/admin/modules', { params: { propertyId: p.id } });
        return (res.data.data || []).length;
      },
      enabled: !!p.id,
    }))
  });

  // Mapping data back to properties
  const propertiesWithStats = useMemo(() => {
    return properties.map((p, idx) => ({
      ...p,
      economics: economicsQueries[idx]?.data,
      moduleCount: modulesQueries[idx]?.data ?? 0,
      isLoading: economicsQueries[idx]?.isLoading || modulesQueries[idx]?.isLoading
    }));
  }, [properties, economicsQueries, modulesQueries]);

  // Filter properties
  const filteredProperties = propertiesWithStats.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalTransactions = propertiesWithStats.reduce((sum, p) => sum + (p.economics?.transactionsCount || 0), 0);
    const totalRevenueMTD = propertiesWithStats.reduce((sum, p) => sum + (p.economics?.net || 0), 0);
    const activeCount = properties.filter(p => p.status === 'active' || p.is_active).length;

    let maxLevel = 'read';
    properties.forEach(p => {
      if (getAccessPriority(p.access_level) > getAccessPriority(maxLevel)) {
        maxLevel = p.access_level;
      }
    });

    return {
      total: properties.length,
      active: activeCount,
      transactions: totalTransactions,
      revenue: totalRevenueMTD,
      maxAccess: maxLevel
    };
  }, [properties, propertiesWithStats]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/multi-property/properties', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-properties'] });
      setIsAddModalOpen(false);
      toast.success('Property created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create property');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) => api.patch(`/multi-property/properties/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-properties'] });
      toast.success('Property updated successfully');
    }
  });

  const grantAccessMutation = useMutation({
    mutationFn: (data: any) => api.post('/multi-property/grant-access', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-staff'] });
      toast.success('Access granted successfully');
    }
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (data: { userId: string; propertyId: string }) =>
      api.delete(`/multi-property/access/${data.userId}/${data.propertyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-staff'] });
      toast.success('Access revoked successfully');
    }
  });

  if (isPropertiesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Mapping your ecosystem...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Property Management
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Manage your multi-property ecosystem and unified deployments.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300">
          <Plus className="w-4 h-4 mr-2" />
          Add Property
        </Button>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Properties" value={stats.total} icon={<Building2 className="w-5 h-5" />} color="blue" />
        <StatCard title="Active Properties" value={stats.active} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
        <StatCard title="Total Transactions" value={stats.transactions} icon={<CreditCard className="w-5 h-5" />} color="amber" />
        <StatCard title="Total Revenue MTD" value={`$${stats.revenue.toLocaleString()}`} icon={<TrendingUp className="w-5 h-5" />} color="violet" />
        <StatCard title="Your Access Level" value={stats.maxAccess.toUpperCase()} icon={<Shield className="w-5 h-5" />} color="rose" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50 backdrop-blur-sm p-4 rounded-2xl border border-border/50 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search properties by name or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl bg-background/50 border-border/40 focus:ring-primary/20"
          />
        </div>
        {/* View mode toggle — grid vs list */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            className="rounded-xl border-border/40"
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            className="rounded-xl border-border/40"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Property Cards */}
      <div className={viewMode === 'grid'
        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        : "flex flex-col gap-4"
      }>
        <AnimatePresence mode="popLayout">
          {filteredProperties.map((property) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <PropertyCard
                property={property}
                isActive={activePropertyId === property.id}
                onSetActive={() => setActiveProperty(property.id)}
                onConfigure={() => (window.location.href = `/${propertySlug}/admin/settings?property=${property.id}`)}
                onOpenDetails={() => setSelectedProperty(property)}
                compact={viewMode === 'list'}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* No Results */}
      {filteredProperties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-card/20 rounded-3xl border-2 border-dashed border-border/50">
          <div className="p-4 bg-muted/50 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">No properties found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your search or add a new property.</p>
        </div>
      )}

      {/* Add Property Modal */}
      <AddPropertyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={(data: any) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
        currencies={currencies}
      />

      {/* Property Details Panel */}
      {selectedProperty && (
        <PropertyDetailPanel
          property={selectedProperty}
          currencies={currencies}
          roles={roles}
          onClose={() => setSelectedProperty(null)}
          onUpdate={(updates: any) => updateMutation.mutate({ id: selectedProperty.id, updates })}
          onGrantAccess={(data: any) => grantAccessMutation.mutate({ ...data, property_id: selectedProperty.id })}
          onRevokeAccess={(userId: string) => revokeAccessMutation.mutate({ userId, propertyId: selectedProperty.id })}
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    violet: "bg-violet-500/10 text-violet-500",
    rose: "bg-rose-500/10 text-rose-500"
  };

  return (
    <div className="bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 hover:border-primary/20 transition-all duration-300 group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PropertyCard({ property, isActive, onSetActive, onConfigure, onOpenDetails, compact }: any) {
  const econ = property.economics;

  if (compact) {
    // List view — horizontal compact row
    return (
      <Card className={`group relative overflow-hidden border-border/50 transition-all duration-300 ${isActive ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : 'hover:shadow-md'}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
            {getPropertyIcon(property.property_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{property.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />{property.city}, {property.country}
            </p>
          </div>
          <Badge variant={property.status === 'active' || property.is_active ? 'default' : 'secondary'} className="rounded-full capitalize shrink-0">
            {property.status || 'Active'}
          </Badge>
          <Badge className="rounded-full bg-primary/10 text-primary border-transparent shrink-0">
            {property.access_level?.toUpperCase()}
          </Badge>
          <p className="text-sm font-bold w-24 text-right shrink-0">{econ ? `$${econ.net.toLocaleString()}` : '—'}</p>
          <div className="flex gap-2 shrink-0">
            <Button variant={isActive ? 'outline' : 'default'} size="sm" className="rounded-lg" onClick={onSetActive} disabled={isActive}>
              {isActive ? 'Active' : 'Set Active'}
            </Button>
            <Button variant="outline" size="icon" className="rounded-lg" onClick={onOpenDetails}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`group relative overflow-hidden h-full border-border/50 transition-all duration-500 ${isActive ? 'ring-2 ring-primary shadow-2xl shadow-primary/10' : 'hover:shadow-xl hover:shadow-foreground/5'}`}>
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <CardHeader className="relative pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              {getPropertyIcon(property.property_type)}
            </div>
            <div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors">{property.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {property.city}, {property.country}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={onOpenDetails}>
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant={property.status === 'active' || property.is_active ? 'default' : 'secondary'} className="rounded-full capitalize">
            {property.status || 'Active'}
          </Badge>
          <Badge variant="outline" className="rounded-full bg-background/50 border-border/50">
            {property.property_type?.replace('_', ' ')}
          </Badge>
          <Badge className="rounded-full bg-primary/10 text-primary border-transparent hover:bg-primary/20">
            {property.access_level?.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/30 space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">MTD Revenue</p>
            <p className="text-lg font-bold">{econ ? `$${econ.net.toLocaleString()}` : '—'}</p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/30 space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Transactions</p>
            <p className="text-lg font-bold">{econ ? econ.transactionsCount.toLocaleString() : '—'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/20 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Modules</span>
          </div>
          <span className="font-bold text-foreground">{property.moduleCount}</span>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant={isActive ? "outline" : "default"}
            className={`flex-1 rounded-xl transition-all duration-300 ${isActive ? 'bg-background/50 cursor-default' : 'shadow-lg shadow-primary/20'}`}
            onClick={onSetActive}
            disabled={isActive}
          >
            {isActive ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                Current Active
              </>
            ) : (
              'Set Active'
            )}
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl border-border/50 hover:bg-muted" onClick={onConfigure}>
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CurrencySelect({ value, onValueChange, currencies, className }: {
  value: string;
  onValueChange: (v: string) => void;
  currencies: Currency[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className ?? 'rounded-xl border-border/40'}>
        <SelectValue placeholder={currencies.length === 0 ? 'Loading…' : 'Select currency'} />
      </SelectTrigger>
      <SelectContent>
        {currencies.map(c => (
          <SelectItem key={c.code} value={c.code}>
            {c.symbol} {c.code} — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddPropertyModal({ isOpen, onClose, onAdd, isSubmitting, currencies }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: any) => void;
  isSubmitting: boolean;
  currencies: Currency[];
}) {
  const defaultCurrency = currencies.find(c => c.is_default)?.code ?? 'EUR';
  const [formData, setFormData] = useState({
    name: '',
    property_type: 'hotel',
    city: '',
    country: '',
    timezone: 'UTC',
    currency: defaultCurrency,
    description: ''
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Deploy New Property</DialogTitle>
          <DialogDescription>Initialize a new property instance in your ecosystem.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Property Name</Label>
              <Input id="name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="My Property Name" className="rounded-xl border-border/40" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Property Type</Label>
              <Select value={formData.property_type} onValueChange={(v) => setFormData({...formData, property_type: v})}>
                <SelectTrigger className="rounded-xl border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Base Currency</Label>
              <CurrencySelect
                value={formData.currency}
                onValueChange={(v) => setFormData({...formData, currency: v})}
                currencies={currencies}
                className="rounded-xl border-border/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" required value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} placeholder="City" className="rounded-xl border-border/40" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" required value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} placeholder="Country" className="rounded-xl border-border/40" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={formData.timezone} onValueChange={(v) => setFormData({...formData, timezone: v})}>
                <SelectTrigger className="rounded-xl border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} className="rounded-xl border-border/40 min-h-[80px]" placeholder="A brief description of this property…" />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl px-8 shadow-lg shadow-primary/20">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Deploy Property
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PropertyDetailPanel({ property, currencies, roles, onClose, onUpdate, onGrantAccess, onRevokeAccess }: {
  property: Property;
  currencies: Currency[];
  roles: Role[];
  onClose: () => void;
  onUpdate: (updates: any) => void;
  onGrantAccess: (data: any) => void;
  onRevokeAccess: (userId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLevel, setInviteLevel] = useState<string>('read');
  const [editData, setEditData] = useState({ ...property });
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const isInactive = property.status === 'inactive' || property.is_active === false;

  const handleDeactivate = () => {
    if (!confirmDeactivate) {
      setConfirmDeactivate(true);
      return;
    }
    onUpdate({ status: 'inactive', is_active: false });
    setConfirmDeactivate(false);
  };

  const handleReactivate = () => {
    onUpdate({ status: 'active', is_active: true });
  };

  const { data: staff = [], isLoading: isStaffLoading } = useQuery({
    queryKey: ['property-staff', property.id],
    queryFn: async () => {
      const res = await api.get(`/multi-property/staff/${property.id}`);
      return res.data.staff as StaffMember[];
    }
  });

  const handleSave = () => {
    onUpdate(editData);
  };

  const handleInvite = (e: any) => {
    e.preventDefault();
    onGrantAccess({ email: inviteEmail, access_level: inviteLevel });
    setInviteEmail('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-background/95 backdrop-blur-2xl border-l border-border/50 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            {getPropertyIcon(property.property_type)}
          </div>
          <div>
            <h2 className="text-xl font-bold">{property.name}</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Property ID: {property.id.slice(0, 8)}...</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-4">
            <TabsList className="w-full rounded-xl bg-muted/50 p-1 border border-border/30">
              <TabsTrigger value="details" className="flex-1 rounded-lg">Details</TabsTrigger>
              <TabsTrigger value="staff" className="flex-1 rounded-lg">Staff Access</TabsTrigger>
              <TabsTrigger value="settings" className="flex-1 rounded-lg">System</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 space-y-8">
            <TabsContent value="details" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="rounded-xl bg-muted/30 border-border/40" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={editData.city} onChange={(e) => setEditData({...editData, city: e.target.value})} className="rounded-xl bg-muted/30 border-border/40" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={editData.country} onChange={(e) => setEditData({...editData, country: e.target.value})} className="rounded-xl bg-muted/30 border-border/40" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={editData.timezone} onValueChange={(v) => setEditData({...editData, timezone: v})}>
                    <SelectTrigger className="rounded-xl bg-muted/30 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Currency</Label>
                  <CurrencySelect
                    value={editData.currency}
                    onValueChange={(v) => setEditData({...editData, currency: v})}
                    currencies={currencies}
                    className="rounded-xl bg-muted/30 border-border/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editData.description || ''} onChange={(e) => setEditData({...editData, description: e.target.value})} className="rounded-xl bg-muted/30 border-border/40 min-h-[100px]" />
                </div>
                <Button onClick={handleSave} className="w-full rounded-xl shadow-lg shadow-primary/20">Save Changes</Button>
              </div>
            </TabsContent>

            <TabsContent value="staff" className="space-y-6 mt-0">
              <div className="bg-card/50 p-4 rounded-2xl border border-border/50 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Invite New Staff
                </h3>
                <form onSubmit={handleInvite} className="space-y-3">
                  <Input
                    placeholder="Staff Email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    {/* Access tier for this property — structural (read/write/manage/admin),
                        separate from application roles in the roles table */}
                    <Select value={inviteLevel} onValueChange={setInviteLevel}>
                      <SelectTrigger className="rounded-xl flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_ACCESS_TIERS.map(tier => (
                          <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" className="rounded-xl px-6">Invite</Button>
                  </div>
                </form>
              </div>

              <Separator className="bg-border/40" />

              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Active Access ({staff.length})
                </h3>
                {isStaffLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staff.map((s) => (
                      <div key={s.user_id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30 group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase">
                            {s.users.full_name?.charAt(0) || s.users.email.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{s.users.full_name || 'System User'}</p>
                            <p className="text-[10px] text-muted-foreground">{s.users.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] rounded-lg bg-background/50">{s.access_level.toUpperCase()}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onRevokeAccess(s.user_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-3">
                  <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Danger Zone
                  </h3>
                  {isInactive ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        This property is currently <span className="font-bold text-amber-500">inactive</span>. Reactivating it will restore access and resume module operations.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={handleReactivate}
                      >
                        Reactivate Property
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {confirmDeactivate
                          ? 'Are you sure? This will prevent all access and suspend module operations. Click again to confirm.'
                          : 'Deactivating this property will prevent all access and suspend module operations.'}
                      </p>
                      <Button
                        variant="destructive"
                        className="w-full rounded-xl"
                        onClick={handleDeactivate}
                      >
                        {confirmDeactivate ? 'Confirm Deactivation' : 'Deactivate Property'}
                      </Button>
                      {confirmDeactivate && (
                        <Button
                          variant="ghost"
                          className="w-full rounded-xl text-muted-foreground"
                          onClick={() => setConfirmDeactivate(false)}
                        >
                          Cancel
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
