import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { restaurantApi } from '../api/client';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
};

export default function OrderTrackingScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    restaurantApi.getOrders()
      .then((res) => setOrders((res.data || []) as OrderRow[]))
      .catch(() => setOrders([]));
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Order Tracking</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontWeight: '600' }}>{item.orderNumber}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Total: {item.total}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: '#64748B' }}>No orders yet</Text>}
      />
    </View>
  );
}
