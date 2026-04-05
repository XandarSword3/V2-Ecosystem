'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Settings,
  Users,
  Calendar,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  Globe,
  ChevronRight,
  MoreHorizontal,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Bed,
  DollarSign,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Property {
  id: string;
  name: string;
  code: string;
  type: 'hotel' | 'resort' | 'villa' | 'apartment' | 'hostel';
  status: 'active' | 'inactive' | 'maintenance';
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  currency: string;
  total_rooms: number;
  available_rooms: number;
  occupancy_rate: number;
  revenue_today: number;
  revenue_mtd: number;
  reservations_today: number;
  staff_count: number;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
};

const typeIcons: Record<string, string> = {
  hotel: '🏨',
  resort: '🏝️',
  villa: '🏡',
  apartment: '🏢',
  hostel: '🛏️'
};

// Demo data
const demoProperties: Property[] = [
  {
    id: '1',
    name: 'Iron Paradise Gym Main',
    code: 'V2-MAIN',
    type: 'resort',
    status: 'active',
    address: '123 Paradise Beach Road',
    city: 'Miami Beach',
    country: 'USA',
    phone: '+1 (555) 123-4567',
    email: 'main@ironparadisegym.com',
    website: 'https://ironparadisegym.com',
    timezone: 'America/New_York',
    currency: 'USD',
    total_rooms: 150,
    available_rooms: 42,
    occupancy_rate: 72,
    revenue_today: 28500,
    revenue_mtd: 485000,
    reservations_today: 18,
    staff_count: 85,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'V2 Mountain Lodge',
    code: 'V2-MTN',
    type: 'hotel',
    status: 'active',
    address: '456 Alpine Way',
    city: 'Aspen',
    country: 'USA',
    phone: '+1 (555) 234-5678',
    email: 'mountain@ironparadisegym.com',
    timezone: 'America/Denver',
    currency: 'USD',
    total_rooms: 80,
    available_rooms: 15,
    occupancy_rate: 81,
    revenue_today: 18200,
    revenue_mtd: 312000,
    reservations_today: 12,
    staff_count: 45,
    created_at: '2024-03-15T00:00:00Z'
  },
  {
    id: '3',
    name: 'V2 Beachfront Villas',
    code: 'V2-VILLA',
    type: 'villa',
    status: 'maintenance',
    address: '789 Ocean Drive',
    city: 'Malibu',
    country: 'USA',
    phone: '+1 (555) 345-6789',
    email: 'villas@ironparadisegym.com',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    total_rooms: 25,
    available_rooms: 0,
    occupancy_rate: 0,
    revenue_today: 0,
    revenue_mtd: 125000,
    reservations_today: 0,
    staff_count: 15,
    created_at: '2024-06-01T00:00:00Z'
  }
];

export default function MultiPropertyPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [newProperty, setNewProperty] = useState({
    name: '',
    code: '',
    type: 'hotel',
    address: '',
    city: '',
    country: '',
    timezone: 'America/New_York',
    currency: 'USD',
    total_rooms: '',
    phone: '',
    email: '',
  });

  // Fetch properties
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      try {
        // Use my-properties endpoint which returns properties accessible to current user
        const res = await api.get('/multi-property/my-properties');
        setFetchError(null);
        const rawProperties = res.data?.properties || [];
        return rawProperties.map((p: any) => ({
          ...p,
          code: p.code ?? p.property_code ?? '',
          type: p.type ?? p.property_type ?? 'hotel',
          status: p.status ?? (p.is_active ? 'active' : 'inactive'),
          address: p.address ?? p.address_line1 ?? '',
          total_rooms: Number(p.total_rooms ?? 0),
          available_rooms: Number(p.available_rooms ?? 0),
          occupancy_rate: Number(p.occupancy_rate ?? 0),
          revenue_today: Number(p.revenue_today ?? 0),
          revenue_mtd: Number(p.revenue_mtd ?? 0),
          reservations_today: Number(p.reservations_today ?? 0),
          staff_count: Number(p.staff_count ?? 0),
        }));
      } catch (error) {
        setFetchError('Could not connect to server');
        return [];
      }
    }
  });

  // Switch property context
  const switchPropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const res = await api.post('/multi-property/switch-property', { property_id: propertyId });
      return res.data;
    },
    onSuccess: (_, propertyId) => {
      const property = properties.find((p: Property) => p.id === propertyId);
      toast.success(`Switched to ${property?.name}`);
    },
    onError: () => {
      toast.error('Failed to switch property');
    }
  });

  // Create property
  const createPropertyMutation = useMutation({
    mutationFn: async (data: typeof newProperty) => {
      const res = await api.post('/multi-property/properties', {
        name: data.name,
        property_code: data.code,
        property_type: data.type,
        address: data.address,
        city: data.city,
        country: data.country,
        timezone: data.timezone,
        currency: data.currency,
        total_rooms: data.total_rooms ? parseInt(data.total_rooms) : undefined,
        phone: data.phone,
        email: data.email,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setShowAddModal(false);
      setNewProperty({ name: '', code: '', type: 'hotel', address: '', city: '', country: '', timezone: 'America/New_York', currency: 'USD', total_rooms: '', phone: '', email: '' });
      toast.success('Property created');
    },
    onError: () => {
      toast.error('Failed to create property');
    }
  });

  // Filter properties
  const filteredProperties = properties.filter((p: Property) =>
    !searchTerm ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aggregate stats
  const stats = {
    totalProperties: properties.length,
    activeProperties: properties.filter((p: Property) => p.status === 'active').length,
    totalRooms: properties.reduce((sum: number, p: Property) => sum + p.total_rooms, 0),
    avgOccupancy: Math.round(
      properties.reduce((sum: number, p: Property) => sum + p.occupancy_rate, 0) /
      Math.max(properties.length, 1)
    ),
    totalRevenueToday: properties.reduce((sum: number, p: Property) => sum + p.revenue_today, 0),
    totalRevenueMTD: properties.reduce((sum: number, p: Property) => sum + p.revenue_mtd, 0)
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Multi-Property Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage all your properties from one place</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Property
        </button>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalProperties}</p>
              <p className="text-sm text-slate-500">Properties</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeProperties}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Bed className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalRooms}</p>
              <p className="text-sm text-slate-500">Total Rooms</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.avgOccupancy}%</p>
              <p className="text-sm text-slate-500">Avg Occupancy</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalRevenueToday)}</p>
              <p className="text-sm text-slate-500">Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalRevenueMTD)}</p>
              <p className="text-sm text-slate-500">MTD Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search properties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        />
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProperties.map((property: Property) => (
            <div
              key={property.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{typeIcons[property.type]}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{property.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 font-mono">{property.code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[property.status]}`}>
                          {property.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Occupancy</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          property.occupancy_rate >= 80 ? 'bg-green-500' :
                          property.occupancy_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${property.occupancy_rate}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {property.occupancy_rate}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rooms</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {property.available_rooms} <span className="text-sm font-normal text-slate-500">/ {property.total_rooms}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Today's Revenue</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(property.revenue_today)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reservations</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {property.reservations_today} <span className="text-sm font-normal text-slate-500">today</span>
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span>{property.city}, {property.country}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <button
                  onClick={() => switchPropertyMutation.mutate(property.id)}
                  disabled={switchPropertyMutation.isPending || property.status !== 'active'}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {switchPropertyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Switch to Property
                </button>
                <button
                  onClick={() => setSelectedProperty(property)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add New Property
            </h2>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              if (!newProperty.name) {
                toast.error('Property name is required');
                return;
              }
              createPropertyMutation.mutate(newProperty);
            }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Property Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Iron Paradise Gym Downtown"
                    value={newProperty.name}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Property Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., V2-DTN"
                    value={newProperty.code}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Property Type
                  </label>
                  <select
                    value={newProperty.type}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="hotel">Hotel</option>
                    <option value="resort">Resort</option>
                    <option value="villa">Villa</option>
                    <option value="apartment">Apartment</option>
                    <option value="hostel">Hostel</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street address"
                    value={newProperty.address}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newProperty.city}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={newProperty.country}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={newProperty.timezone}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="America/Chicago">Central (CT)</option>
                    <option value="America/Denver">Mountain (MT)</option>
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={newProperty.currency}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD (C$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Total Rooms
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newProperty.total_rooms}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, total_rooms: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newProperty.phone}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newProperty.email}
                    onChange={(e) => setNewProperty(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPropertyMutation.isPending}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createPropertyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Property Details Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Property Settings
              </h2>
              <button
                onClick={() => setSelectedProperty(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{typeIcons[selectedProperty.type]}</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedProperty.name}
                  </h3>
                  <p className="text-slate-500">{selectedProperty.code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4" />
                  {selectedProperty.city}, {selectedProperty.country}
                </div>
                {selectedProperty.phone && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4" />
                    {selectedProperty.phone}
                  </div>
                )}
                {selectedProperty.email && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4" />
                    {selectedProperty.email}
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Users className="w-4 h-4" />
                  {selectedProperty.staff_count} staff members
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-white mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                    Edit Details
                  </button>
                  <button className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                    Manage Staff
                  </button>
                  <button className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                    Room Types
                  </button>
                  <button className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
                    View Reports
                  </button>
                </div>
              </div>
              {selectedProperty.status === 'active' && (
                <button
                  onClick={() => {
                    switchPropertyMutation.mutate(selectedProperty.id);
                    setSelectedProperty(null);
                  }}
                  className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  Switch to This Property
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
