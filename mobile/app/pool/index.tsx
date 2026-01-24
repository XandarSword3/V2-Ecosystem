/**
 * Pool Booking Screen
 * View pool availability and book time slots
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Calendar,
  Clock,
  Users,
  Waves,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Sun,
  Sunset
} from 'lucide-react-native';
import { poolApi } from '../../src/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
  spotsAvailable: number;
  maxCapacity: number;
  price: number;
}

interface PoolInfo {
  id: string;
  name: string;
  description: string;
  amenities: string[];
  hours: string;
  rules: string[];
}

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  guests: number;
}

export default function PoolBookingScreen() {
  const router = useRouter();
  
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [activeTab, setActiveTab] = useState<'book' | 'bookings'>('book');
  const [error, setError] = useState<string | null>(null);

  const fetchPoolData = useCallback(async () => {
    try {
      setError(null);
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const [infoRes, slotsRes, bookingsRes] = await Promise.all([
        poolApi.getInfo(),
        poolApi.getAvailability(dateStr),
        poolApi.getMyBookings()
      ]);
      
      if (infoRes.success && infoRes.data) {
        setPoolInfo(infoRes.data);
      }
      
      if (slotsRes.success && slotsRes.data) {
        setTimeSlots(slotsRes.data);
      }
      
      if (bookingsRes.success && bookingsRes.data) {
        setMyBookings(bookingsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load pool data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPoolData();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
      setSelectedDate(newDate);
      setSelectedSlot(null);
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleBook = async () => {
    if (!selectedSlot) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }

    setIsBooking(true);
    try {
      const response = await poolApi.book({
        date: selectedDate.toISOString().split('T')[0],
        slotId: selectedSlot.id,
        guests: guestCount
      });

      if (response.success) {
        Alert.alert('Success', 'Pool booking confirmed!', [
          { text: 'OK', onPress: () => {
            setSelectedSlot(null);
            setActiveTab('bookings');
            fetchPoolData();
          }}
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to book pool slot');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsBooking(false);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await poolApi.cancelBooking(bookingId);
              if (response.success) {
                fetchPoolData();
              } else {
                Alert.alert('Error', response.error || 'Failed to cancel booking');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const getTimeIcon = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return <Sun size={16} color="#F59E0B" />;
    if (hour < 17) return <Sun size={16} color="#F97316" />;
    return <Sunset size={16} color="#8B5CF6" />;
  };

  const renderBookingTab = () => (
    <View className="space-y-4">
      {/* Pool Info Card */}
      {poolInfo && (
        <Card className="bg-gradient-to-r from-blue-500 to-cyan-500">
          <CardContent className="p-6">
            <View className="flex-row items-center mb-3">
              <Waves size={28} color="#fff" />
              <Text className="text-white text-xl font-bold ml-2">{poolInfo.name}</Text>
            </View>
            <Text className="text-white/90 mb-4">{poolInfo.description}</Text>
            <View className="flex-row items-center">
              <Clock size={16} color="#fff" />
              <Text className="text-white/80 ml-2">{poolInfo.hours}</Text>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Date Selector */}
      <Card>
        <CardContent className="p-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity 
              onPress={() => changeDate(-1)}
              disabled={selectedDate.toDateString() === new Date().toDateString()}
              className="p-2"
            >
              <ChevronLeft size={24} color={selectedDate.toDateString() === new Date().toDateString() ? '#9CA3AF' : '#333'} />
            </TouchableOpacity>
            
            <View className="flex-row items-center">
              <Calendar size={20} color="#4F46E5" />
              <Text className="text-foreground font-bold text-lg ml-2">
                {formatDate(selectedDate)}
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => changeDate(1)}
              className="p-2"
            >
              <ChevronRight size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      {/* Guest Count */}
      <Card>
        <CardHeader>
          <CardTitle className="flex-row items-center">
            <Users size={18} color="#4F46E5" />
            <Text className="ml-2">Number of Guests</Text>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <View className="flex-row items-center justify-center">
            <TouchableOpacity
              onPress={() => setGuestCount(Math.max(1, guestCount - 1))}
              disabled={guestCount <= 1}
              className="w-12 h-12 rounded-full bg-muted items-center justify-center"
            >
              <Text className="text-2xl font-bold text-foreground">-</Text>
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground mx-8">{guestCount}</Text>
            <TouchableOpacity
              onPress={() => setGuestCount(Math.min(10, guestCount + 1))}
              disabled={guestCount >= 10}
              className="w-12 h-12 rounded-full bg-muted items-center justify-center"
            >
              <Text className="text-2xl font-bold text-foreground">+</Text>
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      {/* Time Slots */}
      <Text className="text-foreground font-semibold text-lg px-1">Available Time Slots</Text>
      
      {timeSlots.length === 0 ? (
        <Card>
          <CardContent className="p-8 items-center">
            <Clock size={48} color="#9CA3AF" />
            <Text className="text-muted-foreground mt-4 text-center">
              No available slots for this date
            </Text>
          </CardContent>
        </Card>
      ) : (
        <View className="flex-row flex-wrap">
          {timeSlots.map((slot) => (
            <TouchableOpacity
              key={slot.id}
              disabled={!slot.available || slot.spotsAvailable < guestCount}
              onPress={() => setSelectedSlot(slot.id === selectedSlot?.id ? null : slot)}
              className={`w-[48%] mr-[4%] mb-3 p-4 rounded-xl border ${
                selectedSlot?.id === slot.id
                  ? 'bg-primary border-primary'
                  : !slot.available || slot.spotsAvailable < guestCount
                  ? 'bg-muted/50 border-border opacity-50'
                  : 'bg-card border-border'
              }`}
              style={{ marginRight: (timeSlots.indexOf(slot) % 2 === 1) ? 0 : '4%' }}
            >
              <View className="flex-row items-center mb-2">
                {getTimeIcon(slot.startTime)}
                <Text className={`font-bold ml-2 ${
                  selectedSlot?.id === slot.id ? 'text-white' : 'text-foreground'
                }`}>
                  {slot.startTime} - {slot.endTime}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm ${
                  selectedSlot?.id === slot.id ? 'text-white/80' : 'text-muted-foreground'
                }`}>
                  {slot.spotsAvailable} spots left
                </Text>
                {slot.price > 0 && (
                  <Text className={`font-bold ${
                    selectedSlot?.id === slot.id ? 'text-white' : 'text-primary'
                  }`}>
                    ${slot.price}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pool Rules */}
      {poolInfo?.rules && poolInfo.rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pool Rules</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {poolInfo.rules.map((rule, index) => (
              <View key={index} className="flex-row items-start py-1">
                <Text className="text-muted-foreground mr-2">•</Text>
                <Text className="text-muted-foreground flex-1">{rule}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Book Button */}
      {selectedSlot && (
        <Button
          title={`Book Pool - ${selectedSlot.price > 0 ? `$${selectedSlot.price * guestCount}` : 'Free'}`}
          onPress={handleBook}
          isLoading={isBooking}
          className="mt-4"
        />
      )}
    </View>
  );

  const renderBookingsTab = () => (
    <View className="space-y-4">
      {myBookings.length === 0 ? (
        <Card>
          <CardContent className="p-8 items-center">
            <Calendar size={48} color="#9CA3AF" />
            <Text className="text-muted-foreground mt-4 text-center">
              No pool bookings yet
            </Text>
            <Button
              title="Book Now"
              variant="outline"
              className="mt-4"
              onPress={() => setActiveTab('book')}
            />
          </CardContent>
        </Card>
      ) : (
        myBookings.map((booking) => (
          <Card key={booking.id}>
            <CardContent className="p-4">
              <View className="flex-row items-start justify-between mb-3">
                <View>
                  <Text className="text-foreground font-bold text-lg">
                    {new Date(booking.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                  <Text className="text-muted-foreground">
                    {booking.startTime} - {booking.endTime}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${
                  booking.status === 'confirmed' ? 'bg-green-100' :
                  booking.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <Text className={`text-sm font-medium capitalize ${
                    booking.status === 'confirmed' ? 'text-green-700' :
                    booking.status === 'pending' ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {booking.status}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Users size={16} color="#6B7280" />
                  <Text className="text-muted-foreground ml-2">{booking.guests} guest(s)</Text>
                </View>
                
                {booking.status !== 'cancelled' && (
                  <TouchableOpacity onPress={() => cancelBooking(booking.id)}>
                    <Text className="text-red-500 font-medium">Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </CardContent>
          </Card>
        ))
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading pool info...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground ml-2">Pool Booking</Text>
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-muted/30 mx-4 mt-4 rounded-lg p-1">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md ${activeTab === 'book' ? 'bg-card shadow-sm' : ''}`}
            onPress={() => setActiveTab('book')}
          >
            <Text className={`text-center font-medium ${activeTab === 'book' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Book
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md ${activeTab === 'bookings' ? 'bg-card shadow-sm' : ''}`}
            onPress={() => setActiveTab('bookings')}
          >
            <Text className={`text-center font-medium ${activeTab === 'bookings' ? 'text-foreground' : 'text-muted-foreground'}`}>
              My Bookings ({myBookings.filter(b => b.status !== 'cancelled').length})
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View className="mx-4 mt-4 bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <Text className="text-destructive text-center text-sm">{error}</Text>
          </View>
        )}

        <ScrollView 
          className="flex-1 px-4 py-4"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'book' && renderBookingTab()}
          {activeTab === 'bookings' && renderBookingsTab()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
