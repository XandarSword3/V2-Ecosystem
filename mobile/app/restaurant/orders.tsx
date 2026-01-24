/**
 * My Orders Screen
 * View order history and track current orders
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle,
  XCircle,
  ChefHat,
  Truck,
  Package
} from 'lucide-react-native';
import { restaurantApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  deliveryOption: 'room' | 'pickup';
  roomNumber?: string;
  createdAt: string;
  estimatedTime?: number;
}

export default function OrdersScreen() {
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const fetchOrders = useCallback(async () => {
    try {
      const response = await restaurantApi.getOrders();
      if (response.success && response.data) {
        setOrders(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock size={20} color="#F59E0B" />;
      case 'confirmed':
        return <CheckCircle size={20} color="#3B82F6" />;
      case 'preparing':
        return <ChefHat size={20} color="#8B5CF6" />;
      case 'ready':
        return <Package size={20} color="#10B981" />;
      case 'delivered':
        return <Truck size={20} color="#10B981" />;
      case 'cancelled':
        return <XCircle size={20} color="#EF4444" />;
      default:
        return <Clock size={20} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'preparing': return 'bg-purple-100 text-purple-700';
      case 'ready': return 'bg-green-100 text-green-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity onPress={() => router.push(`/restaurant/order/${item.id}`)}>
      <Card className="mb-3">
        <CardContent className="p-4">
          <View className="flex-row items-start justify-between mb-3">
            <View>
              <Text className="text-foreground font-bold text-lg">#{item.orderNumber}</Text>
              <Text className="text-muted-foreground text-sm">
                {new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
            <View className={`flex-row items-center px-3 py-1 rounded-full ${getStatusColor(item.status).split(' ')[0]}`}>
              {getStatusIcon(item.status)}
              <Text className={`ml-1 font-medium capitalize text-sm ${getStatusColor(item.status).split(' ')[1]}`}>
                {item.status}
              </Text>
            </View>
          </View>

          <View className="border-t border-b border-border py-2 mb-3">
            {item.items.slice(0, 3).map((orderItem, index) => (
              <View key={index} className="flex-row justify-between py-1">
                <Text className="text-foreground" numberOfLines={1}>
                  {orderItem.quantity}x {orderItem.name}
                </Text>
                <Text className="text-muted-foreground">${(orderItem.price * orderItem.quantity).toFixed(2)}</Text>
              </View>
            ))}
            {item.items.length > 3 && (
              <Text className="text-muted-foreground text-sm">
                +{item.items.length - 3} more items
              </Text>
            )}
          </View>

          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted-foreground text-sm">
                {item.deliveryOption === 'room' ? `Room ${item.roomNumber}` : 'Pickup'}
              </Text>
              {item.estimatedTime && ['preparing', 'confirmed'].includes(item.status) && (
                <Text className="text-primary text-sm font-medium">
                  Est. {item.estimatedTime} min
                </Text>
              )}
            </View>
            <Text className="text-foreground font-bold text-lg">${item.total.toFixed(2)}</Text>
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading orders...</Text>
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
          <Text className="text-xl font-bold text-foreground ml-2">My Orders</Text>
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-muted/30 mx-4 mt-4 rounded-lg p-1">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md ${activeTab === 'active' ? 'bg-card shadow-sm' : ''}`}
            onPress={() => setActiveTab('active')}
          >
            <Text className={`text-center font-medium ${activeTab === 'active' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Active ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md ${activeTab === 'completed' ? 'bg-card shadow-sm' : ''}`}
            onPress={() => setActiveTab('completed')}
          >
            <Text className={`text-center font-medium ${activeTab === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={displayOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Package size={48} color="#9CA3AF" />
              <Text className="text-muted-foreground mt-4 text-center">
                {activeTab === 'active' 
                  ? 'No active orders' 
                  : 'No completed orders yet'
                }
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}
