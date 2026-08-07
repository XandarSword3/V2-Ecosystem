'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { MapPin, Clock, RefreshCw, UserPlus, CheckCircle, XCircle, Users } from 'lucide-react';
import { FloorPlan } from '@/components/FloorPlan';

interface ServiceLocation {
  id: string;
  name: string;
  qr_code: string | null;
  is_active: boolean;
  sort_order: number;
  assigned_staff_id: string | null;
  is_occupied: boolean;
}

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  reserved_for: string;
  status: 'booked' | 'seated' | 'completed' | 'no_show' | 'cancelled';
  service_location_id: string | null;
  assigned_staff_id: string | null;
  notes: string | null;
}

export default function FloorMapPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ServiceLocation | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const { socket } = useSocket();

  const loadFloorData = async () => {
    try {
      const response = await api.get(`/staff/modules/${slug}/service-locations`);
      setLocations(response.data.data || []);
      setReservations(response.data.reservations || []);
    } catch (error) {
      console.error('Failed to load floor data:', error);
      toast.error('Failed to load floor map');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFloorData();
  }, [slug]);

  useEffect(() => {
    if (socket && slug) {
      socket.emit('join:unit', slug);

      const handleTableAssigned = (data: { serviceLocationId: string }) => {
        loadFloorData();
        toast.info('Table assigned', { description: `Table ${data.serviceLocationId} assigned` });
      };

      const handleOrderConfirmed = (data: { serviceLocationId: string }) => {
        loadFloorData();
      };

      socket.on('table:assigned', handleTableAssigned);
      socket.on('order:confirmed', handleOrderConfirmed);

      return () => {
        socket.off('table:assigned', handleTableAssigned);
        socket.off('order:confirmed', handleOrderConfirmed);
      };
    }
  }, [socket, slug]);

  const handleCheckIn = async (reservationId: string) => {
    try {
      await api.patch(`/staff/modules/${slug}/reservations/${reservationId}/check-in`);
      toast.success('Reservation checked in');
      loadFloorData();
      setShowCheckInDialog(false);
    } catch (error) {
      toast.error('Failed to check in reservation');
    }
  };

  const handleWalkIn = async (locationId: string, partySize: number, guestName: string) => {
    try {
      await api.post(`/staff/modules/${slug}/reservations`, {
        serviceLocationId: locationId,
        partySize,
        guestName,
        reservedFor: new Date().toISOString(),
      });
      toast.success('Walk-in seated');
      loadFloorData();
      setShowWalkInDialog(false);
    } catch (error) {
      toast.error('Failed to seat walk-in');
    }
  };

  const handleReassignStaff = async (locationId: string, staffId: string | null) => {
    try {
      await api.patch(`/staff/modules/${slug}/service-locations/${locationId}/reassign`, { staffId });
      toast.success('Staff reassigned');
      loadFloorData();
    } catch (error) {
      toast.error('Failed to reassign staff');
    }
  };

  const getLocationStatus = (location: ServiceLocation): string => {
    if (!location.is_active) return 'inactive';
    if (location.is_occupied) return 'occupied';
    const reservation = reservations.find(r => r.service_location_id === location.id && r.status === 'booked');
    if (reservation) return 'reserved';
    return 'free';
  };

  const enhancedLocations = locations.map(loc => ({
    ...loc,
    status: getLocationStatus(loc),
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <MapPin className="h-8 w-8 text-primary" />
            Floor Map
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage seating, reservations, and staff assignments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowWalkInDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Walk-in
          </Button>
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-mono font-medium">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={() => loadFloorData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Floor Plan */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <FloorPlan
              items={enhancedLocations}
              onSelect={setSelectedLocation}
              selectedItem={selectedLocation}
              engineType="instant_transaction"
            />
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          {selectedLocation ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4">{selectedLocation.name}</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    getLocationStatus(selectedLocation) === 'free' ? 'bg-green-100 text-green-700' :
                    getLocationStatus(selectedLocation) === 'occupied' ? 'bg-red-100 text-red-700' :
                    getLocationStatus(selectedLocation) === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {getLocationStatus(selectedLocation)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Assigned Staff</span>
                  <span className="text-sm font-medium">
                    {selectedLocation.assigned_staff_id ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Reservation for this location */}
              {(() => {
                const reservation = reservations.find(r => r.service_location_id === selectedLocation.id);
                if (reservation && reservation.status === 'booked') {
                  return (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-yellow-600" />
                        <span className="font-semibold text-sm">{reservation.guest_name}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <p>Party: {reservation.party_size}</p>
                        <p>Time: {new Date(reservation.reserved_for).toLocaleTimeString()}</p>
                      </div>
                      <Button
                        className="w-full mt-3 bg-green-600 hover:bg-green-700"
                        size="sm"
                        onClick={() => handleCheckIn(reservation.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Check In
                      </Button>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  Reassign Staff
                </Button>
                {selectedLocation.is_occupied && (
                  <Button variant="outline" className="w-full" size="sm">
                    <XCircle className="h-4 w-4 mr-2" />
                    Free Table
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-gray-500 text-sm">Select a location to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Walk-in Dialog */}
      {showWalkInDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Seat Walk-in</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Table</label>
                <select className="w-full border rounded-md px-3 py-2">
                  {locations.filter(l => getLocationStatus(l) === 'free').map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Party Size</label>
                <input type="number" min="1" defaultValue="2" className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Guest Name</label>
                <input type="text" className="w-full border rounded-md px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowWalkInDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => setShowWalkInDialog(false)}>
                Seat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
