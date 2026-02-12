'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSiteSettings } from '@/lib/settings-context';
import { api } from '@/lib/api';
import {
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle,
  Phone,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface Reservation {
  id: string;
  date: string;
  time: string;
  party_size: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  special_requests?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  table_id?: string;
  table_number?: string;
  created_at: string;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  location?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  seated: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
};

export default function DynamicReservationsPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const queryClient = useQueryClient();
  
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Fetch reservations for selected date
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', currentModule?.id, selectedDate],
    queryFn: async () => {
      if (!currentModule) return [];
      const res = await api.get('/restaurant/reservations', { 
        params: { date: selectedDate, moduleId: currentModule.id } 
      });
      return res.data.data || [];
    },
    enabled: !!currentModule
  });

  // Fetch available tables
  const { data: tables = [] } = useQuery({
    queryKey: ['tables', currentModule?.id],
    queryFn: async () => {
      if (!currentModule) return [];
      const res = await api.get('/restaurant/tables', { params: { moduleId: currentModule.id } });
      return res.data.data || [];
    },
    enabled: !!currentModule
  });

  // Update reservation status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/restaurant/reservations/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Reservation updated');
    },
    onError: () => {
      toast.error('Failed to update reservation');
    }
  });

  // Assign table
  const assignTableMutation = useMutation({
    mutationFn: async ({ reservationId, tableId }: { reservationId: string; tableId: string }) => {
      const res = await api.post(`/restaurant/reservations/${reservationId}/assign-table`, { table_id: tableId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setShowAssignModal(false);
      setSelectedReservation(null);
      toast.success('Table assigned');
    },
    onError: () => {
      toast.error('Failed to assign table');
    }
  });

  // Filter reservations
  const filteredReservations = reservations.filter((r: Reservation) => {
    const matchesSearch = !searchTerm || 
      r.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.guest_phone.includes(searchTerm) ||
      r.guest_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group by time
  const groupedByTime: Record<string, Reservation[]> = {};
  filteredReservations.forEach((r: Reservation) => {
    if (!groupedByTime[r.time]) groupedByTime[r.time] = [];
    groupedByTime[r.time].push(r);
  });

  const handleDateChange = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Stats
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r: Reservation) => r.status === 'pending').length,
    confirmed: reservations.filter((r: Reservation) => r.status === 'confirmed').length,
    seated: reservations.filter((r: Reservation) => r.status === 'seated').length,
    totalGuests: reservations.reduce((sum: number, r: Reservation) => sum + r.party_size, 0)
  };

  if (!currentModule) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {currentModule.name} Reservations
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Manage bookings</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Stats Cards - Responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Confirmed</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.confirmed}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Seated</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.seated}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Total Guests</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.totalGuests}</p>
        </div>
      </div>

      {/* Date Navigation & Filters - Responsive */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex-shrink-0">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white outline-none w-32"
            />
          </div>
          <button
            onClick={() => handleDateChange(1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg flex-shrink-0"
          >
            Today
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search guest..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-48 lg:w-64 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {/* Timeline View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : Object.keys(groupedByTime).length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-700">
          <Calendar className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No reservations</h3>
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm || statusFilter !== 'all' 
              ? 'No reservations match your filters'
              : 'No reservations for this date'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {Object.keys(groupedByTime).sort().map((time) => (
            <div key={time} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900 dark:text-white">{time}</span>
                <span className="text-sm text-slate-500">({groupedByTime[time].length})</span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {groupedByTime[time].map((reservation: Reservation) => (
                  <div
                    key={reservation.id}
                    className="p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {reservation.guest_name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[reservation.status]}`}>
                              {reservation.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {reservation.party_size}
                            </span>
                            <span className="flex items-center gap-1 truncate">
                              <Phone className="w-3 h-3" />
                              {reservation.guest_phone}
                            </span>
                            {reservation.table_number && (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                                Table {reservation.table_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap ml-12 sm:ml-0">
                        {reservation.status === 'pending' && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'confirmed' })}
                            className="px-3 py-1.5 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200"
                          >
                            Confirm
                          </button>
                        )}
                        {(reservation.status === 'confirmed' || reservation.status === 'pending') && (
                          <button
                            onClick={() => {
                              setSelectedReservation(reservation);
                              setShowAssignModal(true);
                            }}
                            className="px-3 py-1.5 text-xs sm:text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 flex items-center gap-1"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">Seat</span>
                          </button>
                        )}
                        {reservation.status === 'seated' && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'completed' })}
                            className="px-3 py-1.5 text-xs sm:text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Complete</span>
                          </button>
                        )}
                        {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                          <>
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'no_show' })}
                              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                            >
                              No Show
                            </button>
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: 'cancelled' })}
                              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {reservation.special_requests && (
                      <div className="mt-2 ml-12 sm:ml-14 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        {reservation.special_requests}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Table Modal */}
      {showAssignModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Assign Table
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Select a table for <strong>{selectedReservation.guest_name}</strong> ({selectedReservation.party_size} guests)
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tables
                .filter((t: Table) => t.status === 'available' && t.capacity >= selectedReservation.party_size)
                .map((table: Table) => (
                  <button
                    key={table.id}
                    onClick={() => assignTableMutation.mutate({ 
                      reservationId: selectedReservation.id, 
                      tableId: table.id 
                    })}
                    disabled={assignTableMutation.isPending}
                    className="w-full p-3 flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Table {table.table_number}
                      </span>
                      <span className="text-sm text-slate-500 ml-2">
                        ({table.capacity} seats)
                      </span>
                    </div>
                    {table.location && (
                      <span className="text-xs text-slate-500">{table.location}</span>
                    )}
                  </button>
                ))}
              {tables.filter((t: Table) => t.status === 'available' && t.capacity >= selectedReservation.party_size).length === 0 && (
                <p className="text-center text-slate-500 py-4">No suitable tables available</p>
              )}
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedReservation(null);
                }}
                className="w-full py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
