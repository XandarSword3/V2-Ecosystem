import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { chaletsApi } from '../api/client';

interface ChaletBookingScreenProps {
  chaletId: string;
}

export default function ChaletBookingScreen({ chaletId }: ChaletBookingScreenProps) {
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const submit = async () => {
    try {
      await chaletsApi.createBooking({
        chaletId,
        checkInDate,
        checkOutDate,
        numberOfGuests: 1,
        customerName,
        customerEmail,
      });
      Alert.alert('Booking created');
    } catch {
      Alert.alert('Booking failed');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Chalet Booking</Text>
      <TextInput placeholder="Check-in (YYYY-MM-DD)" value={checkInDate} onChangeText={setCheckInDate} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Check-out (YYYY-MM-DD)" value={checkOutDate} onChangeText={setCheckOutDate} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Your name" value={customerName} onChangeText={setCustomerName} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Your email" value={customerEmail} onChangeText={setCustomerEmail} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TouchableOpacity onPress={submit} style={{ backgroundColor: '#4F46E5', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Book Chalet</Text>
      </TouchableOpacity>
    </View>
  );
}
