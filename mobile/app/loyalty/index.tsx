/**
 * Loyalty Dashboard Screen
 * Displays points balance, tier status, rewards, and earning history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Star, 
  Gift, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  Award,
  Zap
} from 'lucide-react-native';
import { loyaltyApi } from '../../src/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';

interface LoyaltyStatus {
  points: number;
  tier: string;
  tierBenefits: string[];
  nextTier: string | null;
  pointsToNextTier: number | null;
  lifetimePoints: number;
}

interface PointsHistory {
  id: string;
  type: 'earn' | 'redeem';
  points: number;
  description: string;
  date: string;
  category: string;
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
  available: boolean;
  category: string;
}

export default function LoyaltyScreen() {
  const router = useRouter();
  
  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoyaltyData = useCallback(async () => {
    try {
      setError(null);
      const [statusRes, historyRes, rewardsRes] = await Promise.all([
        loyaltyApi.getStatus(),
        loyaltyApi.getHistory(1, 20),
        loyaltyApi.getAvailableRewards()
      ]);
      
      if (statusRes.success && statusRes.data) {
        setStatus(statusRes.data);
      }
      
      if (historyRes.success && historyRes.data) {
        setHistory(historyRes.data);
      }
      
      if (rewardsRes.success && rewardsRes.data) {
        setRewards(rewardsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load loyalty data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoyaltyData();
  }, [fetchLoyaltyData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoyaltyData();
    setRefreshing(false);
  };

  const handleRedeemReward = async (rewardId: string) => {
    try {
      const response = await loyaltyApi.redeemReward(rewardId);
      if (response.success) {
        await fetchLoyaltyData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to redeem reward');
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum': return '#E5E4E2';
      case 'gold': return '#FFD700';
      case 'silver': return '#C0C0C0';
      default: return '#CD7F32'; // bronze
    }
  };

  const renderOverview = () => (
    <View className="space-y-4">
      {/* Points Balance Card */}
      <Card className="bg-primary">
        <CardContent className="p-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <Star size={28} color="#fff" fill="#fff" />
              <Text className="text-white text-lg font-semibold ml-2">Points Balance</Text>
            </View>
            <View 
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: getTierColor(status?.tier || 'bronze') }}
            >
              <Text className="font-bold text-xs uppercase">{status?.tier}</Text>
            </View>
          </View>
          
          <Text className="text-white text-4xl font-bold mb-2">
            {status?.points?.toLocaleString() || 0}
          </Text>
          <Text className="text-white/80 text-sm">
            Lifetime earned: {status?.lifetimePoints?.toLocaleString() || 0} points
          </Text>

          {status?.nextTier && (
            <View className="mt-4 pt-4 border-t border-white/20">
              <Text className="text-white/80 text-sm mb-2">
                {status.pointsToNextTier?.toLocaleString()} points to {status.nextTier}
              </Text>
              <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-white rounded-full" 
                  style={{ 
                    width: `${Math.min(100, ((status.points || 0) / ((status.points || 0) + (status.pointsToNextTier || 1))) * 100)}%` 
                  }} 
                />
              </View>
            </View>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <View className="flex-row space-x-3">
        <TouchableOpacity 
          className="flex-1 bg-card p-4 rounded-xl border border-border items-center"
          onPress={() => setActiveTab('rewards')}
        >
          <Gift size={24} color="#4F46E5" />
          <Text className="text-foreground font-medium mt-2">Redeem</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="flex-1 bg-card p-4 rounded-xl border border-border items-center"
          onPress={() => setActiveTab('history')}
        >
          <Clock size={24} color="#4F46E5" />
          <Text className="text-foreground font-medium mt-2">History</Text>
        </TouchableOpacity>
      </View>

      {/* Tier Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex-row items-center">
            <Award size={20} color="#4F46E5" />
            <Text className="ml-2">Your {status?.tier} Benefits</Text>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {status?.tierBenefits?.map((benefit, index) => (
            <View key={index} className="flex-row items-center py-2">
              <Zap size={16} color="#10B981" />
              <Text className="text-foreground ml-3">{benefit}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <TouchableOpacity onPress={() => setActiveTab('history')}>
              <Text className="text-primary text-sm">View All</Text>
            </TouchableOpacity>
          </View>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {history.slice(0, 3).map((item) => (
            <View key={item.id} className="flex-row items-center justify-between py-3 border-b border-border last:border-b-0">
              <View className="flex-row items-center flex-1">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${item.type === 'earn' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <TrendingUp size={20} color={item.type === 'earn' ? '#10B981' : '#EF4444'} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium" numberOfLines={1}>{item.description}</Text>
                  <Text className="text-muted-foreground text-xs">{new Date(item.date).toLocaleDateString()}</Text>
                </View>
              </View>
              <Text className={`font-bold ${item.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                {item.type === 'earn' ? '+' : '-'}{item.points}
              </Text>
            </View>
          ))}
        </CardContent>
      </Card>
    </View>
  );

  const renderRewards = () => (
    <FlatList
      data={rewards}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 20 }}
      ListEmptyComponent={
        <View className="items-center py-12">
          <Gift size={48} color="#9CA3AF" />
          <Text className="text-muted-foreground mt-4">No rewards available</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">{item.name}</Text>
                <Text className="text-muted-foreground text-sm mt-1">{item.description}</Text>
                <View className="flex-row items-center mt-2">
                  <Star size={16} color="#F59E0B" fill="#F59E0B" />
                  <Text className="text-foreground font-bold ml-1">{item.pointsCost.toLocaleString()} points</Text>
                </View>
              </View>
              <Button
                title="Redeem"
                size="sm"
                disabled={!item.available || (status?.points || 0) < item.pointsCost}
                onPress={() => handleRedeemReward(item.id)}
              />
            </View>
          </CardContent>
        </Card>
      )}
    />
  );

  const renderHistory = () => (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 20 }}
      ListEmptyComponent={
        <View className="items-center py-12">
          <Clock size={48} color="#9CA3AF" />
          <Text className="text-muted-foreground mt-4">No history yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-12 h-12 rounded-full items-center justify-center ${item.type === 'earn' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <TrendingUp size={24} color={item.type === 'earn' ? '#10B981' : '#EF4444'} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">{item.description}</Text>
                  <Text className="text-muted-foreground text-xs">{item.category}</Text>
                  <Text className="text-muted-foreground text-xs mt-1">
                    {new Date(item.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>
              <Text className={`font-bold text-lg ${item.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                {item.type === 'earn' ? '+' : '-'}{item.points}
              </Text>
            </View>
          </CardContent>
        </Card>
      )}
    />
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading loyalty data...</Text>
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
          <Text className="text-xl font-bold text-foreground ml-2">Loyalty Program</Text>
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-muted/30 mx-4 mt-4 rounded-lg p-1">
          {(['overview', 'rewards', 'history'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-md ${activeTab === tab ? 'bg-card shadow-sm' : ''}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-center font-medium capitalize ${activeTab === tab ? 'text-foreground' : 'text-muted-foreground'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
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
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'rewards' && renderRewards()}
          {activeTab === 'history' && renderHistory()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
