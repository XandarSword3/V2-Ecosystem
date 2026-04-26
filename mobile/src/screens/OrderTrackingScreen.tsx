import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { restaurantApi } from '../api/client';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/env';

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
};

export default function OrderTrackingScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: Socket | null = null;

    restaurantApi.getOrders()
      .then((res) => {
        const next = (res.data || []) as OrderRow[];
        setOrders(next);

        socket = io(SOCKET_URL, {
          transports: ['websocket'],
          reconnection: true,
        });
        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        for (const order of next) {
          socket.emit('join_order', { orderId: order.id });
        }

        socket.on('order_status_updated', (payload: { orderId: string; status: string }) => {
          if (!payload?.orderId || !payload?.status) return;
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status } : o))
          );
        });
      })
      .catch(() => setOrders([]));

    return () => {
      if (socket) {
        for (const order of orders) {
          socket.emit('leave_order', { orderId: order.id });
        }
        socket.disconnect();
      }
    };
  }, []);

  const statusProgress = (status: string) => {
    const steps = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const idx = steps.indexOf(status);
    if (idx < 0) return 0;
    return ((idx + 1) / steps.length) * 100;
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Order Tracking</Text>
      <Text style={{ marginBottom: 12, color: connected ? '#166534' : '#B45309' }}>
        {connected ? 'Live updates connected' : 'Connecting to live updates...'}
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontWeight: '600' }}>{item.orderNumber}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Total: {item.total}</Text>
            <View style={{ marginTop: 6, height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
              <View style={{ width: `${statusProgress(item.status)}%`, height: '100%', backgroundColor: '#2563EB' }} />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: '#64748B' }}>No orders yet</Text>}
      />
    </View>
  );
}
