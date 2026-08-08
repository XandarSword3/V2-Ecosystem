'use client';

/**
 * Reservation floor map — host-stand view for seating, check-ins, and walk-ins.
 * Extracted from the old standalone /floorMap route so it can be embedded as a
 * tab inside StaffPOSTemplate (Engine A's single staff workspace) instead of
 * living behind a separate nav link with no way back to Orders/Kitchen/Cashier.
 *
 * This is distinct from StaffPOSTemplate's "Stations" tab: this component is
 * reservation/check-in focused (service_locations + reservations), while
 * Stations is the quick table picker used when starting an order.
 */

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

export interface ReservationFloorMapProps {
  slug: string;
}

export function ReservationFloorMap({ slug }: ReservationFloorMapProps) {
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<ServiceLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [walkInTableId, setWalkInTableId] = useState<string>('');
  const [walkInPartySize, setWalkInPartySize] = useState<number>(2);
  const [walkInGuestName, setWalkInGuestName] = useState<string>('');
  const { socket } = useSocket();

  const loadFloorData = async () => {
    try {
      const response = await api.get(`/${slug}/service-locations`);
      const locs = response.data.data || [];
      setLocations(locs);
      setReservations(response.data.reservations || []);

      // Default walk-in table selection
      const firstFree = locs.find((l: ServiceLocation) => !l.is_occupied);
      if (firstFree && !walkInTableId) {
        setWalkInTableId(firstFree.id);
      }
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

      const handleOrderConfirmed = () => {
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
      await api.patch(`/${slug}/reservations/${reservationId}/check-in`);
      toast.success('Reservation checked in');
      loadFloorData();
    } catch (error) {
      console.error('Check-in failed:', error);
      toast.error('Failed to check in reservation');
    }
  };

  const handleSeatWalkIn = async () => {
    if (!walkInTableId) {
      toast.error('Please select a table');
      return;
    }
    try {
      await api.post(`/staff/modules/${slug}/walk-in`, {
        serviceLocationId: walkInTableId,
        partySize: walkInPartySize,
        guestName: walkInGuestName || 'Walk-in Guest',
      });
      toast.success('Walk-in guest seated');
      setShowWalkInDialog(false);
      setWalkInGuestName('');
      loadFloorData();
    } catch (error) {
      console.error('Walk-in seating failed:', error);
      toast.error('Failed to seat walk-in');
    }
  };

  const handleReassignStaff = async () => {
    if (!selectedLocation) return;
    const staffId = prompt('Enter Staff User ID to assign (leave empty to unassign):');
    if (staffId === null) return;
    try {
      await api.patch(`/service-locations/${selectedLocation.id}/reassign`, {
        staffId: staffId.trim() || null,
      });
      toast.success('Staff reassigned');
      loadFloorData();
    } catch (error) {
      console.error('Reassign staff failed:', error);
      toast.error('Failed to reassign staff');
    }
  };

  const handleFreeTable = async () => {
    if (!selectedLocation) return;
    try {
      await api.post(`/staff/service-locations/${selectedLocation.id}/free`);
      toast.success('Table freed');
      setSelectedLocation(null);
      loadFloorData();
    } catch (error) {
      console.error('Free table failed:', error);
      toast.error('Failed to free table');
    }
  };

  const getLocationStatus = (location: ServiceLocation): 'free' | 'occupied' | 'reserved' => {
    if (location.is_occupied) return 'occupied';
    const hasReservation = reservations.some(
      (r) => r.service_location_id === location.id && r.status === 'booked'
    );
    if (hasReservation) return 'reserved';
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
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary" />
            Floor Map
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
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
              <h3 className="text-lg font-bold mb-4">{selectedLocation.name}</h3>

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
                <Button variant="outline" className="w-full" size="sm" onClick={handleReassignStaff}>
                  Reassign Staff
                </Button>
                {selectedLocation.is_occupied && (
                  <Button variant="outline" className="w-full" size="sm" onClick={handleFreeTable}>
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
                <select
                  value={walkInTableId}
                  onChange={(e) => setWalkInTableId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                >
                  {locations.filter((l) => getLocationStatus(l) === 'free').map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Party Size</label>
                <input
                  type="number"
                  min="1"
                  value={walkInPartySize}
                  onChange={(e) => setWalkInPartySize(Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Guest Name</label>
                <input
                  type="text"
                  placeholder="Guest Name (e.g. John)"
                  value={walkInGuestName}
                  onChange={(e) => setWalkInGuestName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowWalkInDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSeatWalkIn}>
                Seat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
