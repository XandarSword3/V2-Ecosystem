import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { chaletsApi } from '../api/client';
import { router } from 'expo-router';

type ChaletRow = {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  images?: string[];
  isAvailable?: boolean;
};

export default function ChaletsScreen() {
  const [rows, setRows] = useState<ChaletRow[]>([]);
  const [sortBy, setSortBy] = useState<'price' | 'capacity'>('price');

  useEffect(() => {
    chaletsApi.getChalets()
      .then((res) => setRows((res.data || []) as ChaletRow[]))
      .catch(() => setRows([]));
  }, []);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sortBy === 'price') {
      return copy.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
    }
    return copy.sort((a, b) => (b.maxGuests || 0) - (a.maxGuests || 0));
  }, [rows, sortBy]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Chalets</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <TouchableOpacity onPress={() => setSortBy('price')} style={{ backgroundColor: sortBy === 'price' ? '#1D4ED8' : '#E2E8F0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: sortBy === 'price' ? '#FFFFFF' : '#0F172A', fontWeight: '600' }}>Sort by price</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSortBy('capacity')} style={{ backgroundColor: sortBy === 'capacity' ? '#1D4ED8' : '#E2E8F0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: sortBy === 'capacity' ? '#FFFFFF' : '#0F172A', fontWeight: '600' }}>Sort by guests</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={sortedRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E2E8F0', gap: 8 }}
            onPress={() => router.push(`/chalets/${item.id}` as any)}
          >
            {!!item.images?.[0] && (
              <Image
                source={{ uri: item.images[0] }}
                style={{ width: '100%', height: 150, borderRadius: 10, backgroundColor: '#E2E8F0' }}
                resizeMode="cover"
              />
            )}
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
            {!!item.description && <Text style={{ color: '#64748B' }}>{item.description}</Text>}
            <Text style={{ color: '#0F172A', fontWeight: '600' }}>
              {typeof item.basePrice === 'number' ? `From $${item.basePrice}/night` : 'Price unavailable'}
            </Text>
            <Text style={{ color: '#334155' }}>
              {(item.bedrooms || 0)} bed • {(item.bathrooms || 0)} bath • up to {(item.maxGuests || 0)} guests
            </Text>
            {!!item.amenities?.length && (
              <Text style={{ color: '#475569' }}>
                Amenities: {item.amenities.slice(0, 4).join(', ')}
                {item.amenities.length > 4 ? '...' : ''}
              </Text>
            )}
            <Text style={{ color: item.isAvailable ? '#166534' : '#B91C1C', fontWeight: '600' }}>
              {item.isAvailable ? 'Available now' : 'Currently unavailable'}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: '#64748B' }}>No chalets available</Text>}
      />
    </View>
  );
}
