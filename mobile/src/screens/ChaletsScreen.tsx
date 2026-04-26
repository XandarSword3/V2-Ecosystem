import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { chaletsApi } from '../api/client';
import { router } from 'expo-router';

type ChaletRow = { id: string; name: string; description?: string };

export default function ChaletsScreen() {
  const [rows, setRows] = useState<ChaletRow[]>([]);

  useEffect(() => {
    chaletsApi.getChalets()
      .then((res) => setRows((res.data || []) as ChaletRow[]))
      .catch(() => setRows([]));
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Chalets</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E2E8F0' }}
            onPress={() => router.push(`/chalets/${item.id}` as any)}
          >
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
            {!!item.description && <Text style={{ color: '#64748B' }}>{item.description}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ color: '#64748B' }}>No chalets available</Text>}
      />
    </View>
  );
}
