/**
 * Gift Cards Screen
 * View gift card balance, purchase new cards, and view transaction history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Gift, 
  CreditCard, 
  Plus, 
  Clock,
  DollarSign,
  Copy,
  CheckCircle
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { giftCardApi } from '../../src/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

interface GiftCard {
  id: string;
  code: string;
  balance: number;
  initialValue: number;
  status: 'active' | 'depleted' | 'expired';
  expiresAt: string | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: 'purchase' | 'redeem' | 'refund';
  amount: number;
  description: string;
  date: string;
  cardCode: string;
}

const GIFT_CARD_AMOUNTS = [25, 50, 100, 250, 500];

export default function GiftCardsScreen() {
  const router = useRouter();
  
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'purchase' | 'history'>('cards');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Purchase form state
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Redeem form state
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchGiftCardData = useCallback(async () => {
    try {
      setError(null);
      const [cardsRes, historyRes] = await Promise.all([
        giftCardApi.getMyCards(),
        giftCardApi.getHistory()
      ]);
      
      if (cardsRes.success && cardsRes.data) {
        setCards(cardsRes.data);
      }
      
      if (historyRes.success && historyRes.data) {
        setTransactions(historyRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load gift cards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGiftCardData();
  }, [fetchGiftCardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGiftCardData();
    setRefreshing(false);
  };

  const copyToClipboard = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePurchase = async () => {
    if (!recipientEmail) {
      Alert.alert('Error', 'Please enter recipient email');
      return;
    }

    setIsPurchasing(true);
    try {
      const response = await giftCardApi.purchase({
        amount: selectedAmount,
        recipientEmail,
        recipientName: recipientName || undefined,
        message: personalMessage || undefined
      });

      if (response.success) {
        Alert.alert('Success', 'Gift card purchased successfully!');
        setRecipientEmail('');
        setRecipientName('');
        setPersonalMessage('');
        setActiveTab('cards');
        await fetchGiftCardData();
      } else {
        Alert.alert('Error', response.error || 'Failed to purchase gift card');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode) {
      Alert.alert('Error', 'Please enter a gift card code');
      return;
    }

    setIsRedeeming(true);
    try {
      const response = await giftCardApi.redeem(redeemCode);

      if (response.success) {
        Alert.alert('Success', `Gift card added! Balance: $${response.data?.balance || 0}`);
        setRedeemCode('');
        await fetchGiftCardData();
      } else {
        Alert.alert('Error', response.error || 'Invalid or expired gift card');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsRedeeming(false);
    }
  };

  const totalBalance = cards.reduce((sum, card) => card.status === 'active' ? sum + card.balance : sum, 0);

  const renderCards = () => (
    <View className="space-y-4">
      {/* Total Balance Card */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-600">
        <CardContent className="p-6">
          <View className="flex-row items-center mb-4">
            <CreditCard size={28} color="#fff" />
            <Text className="text-white text-lg font-semibold ml-2">Total Balance</Text>
          </View>
          <Text className="text-white text-4xl font-bold">
            ${totalBalance.toFixed(2)}
          </Text>
          <Text className="text-white/80 text-sm mt-2">
            {cards.filter(c => c.status === 'active').length} active card(s)
          </Text>
        </CardContent>
      </Card>

      {/* Redeem Card */}
      <Card>
        <CardHeader>
          <CardTitle>Redeem a Gift Card</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <View className="flex-row items-center space-x-2">
            <View className="flex-1">
              <Input
                placeholder="Enter gift card code"
                value={redeemCode}
                onChangeText={setRedeemCode}
                autoCapitalize="characters"
              />
            </View>
            <Button
              title="Redeem"
              size="sm"
              onPress={handleRedeem}
              isLoading={isRedeeming}
            />
          </View>
        </CardContent>
      </Card>

      {/* Card List */}
      <Text className="text-foreground font-semibold text-lg px-1">Your Gift Cards</Text>
      
      {cards.length === 0 ? (
        <Card>
          <CardContent className="p-8 items-center">
            <Gift size={48} color="#9CA3AF" />
            <Text className="text-muted-foreground mt-4 text-center">
              You don't have any gift cards yet
            </Text>
            <Button
              title="Purchase a Gift Card"
              variant="outline"
              className="mt-4"
              onPress={() => setActiveTab('purchase')}
            />
          </CardContent>
        </Card>
      ) : (
        cards.map((card) => (
          <Card key={card.id} className={card.status !== 'active' ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-foreground font-mono text-lg">{card.code}</Text>
                    <TouchableOpacity 
                      onPress={() => copyToClipboard(card.code)}
                      className="ml-2 p-1"
                    >
                      {copiedCode === card.code ? (
                        <CheckCircle size={18} color="#10B981" />
                      ) : (
                        <Copy size={18} color="#6B7280" />
                      )}
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center mt-2">
                    <View className={`px-2 py-0.5 rounded-full ${
                      card.status === 'active' ? 'bg-green-100' : 
                      card.status === 'depleted' ? 'bg-gray-100' : 'bg-red-100'
                    }`}>
                      <Text className={`text-xs font-medium capitalize ${
                        card.status === 'active' ? 'text-green-700' : 
                        card.status === 'depleted' ? 'text-gray-700' : 'text-red-700'
                      }`}>{card.status}</Text>
                    </View>
                    {card.expiresAt && (
                      <Text className="text-muted-foreground text-xs ml-2">
                        Expires: {new Date(card.expiresAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-foreground font-bold text-xl">
                    ${card.balance.toFixed(2)}
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    of ${card.initialValue.toFixed(2)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        ))
      )}
    </View>
  );

  const renderPurchase = () => (
    <View className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Amount</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <View className="flex-row flex-wrap gap-2">
            {GIFT_CARD_AMOUNTS.map((amount) => (
              <TouchableOpacity
                key={amount}
                onPress={() => setSelectedAmount(amount)}
                className={`px-6 py-3 rounded-lg border ${
                  selectedAmount === amount 
                    ? 'bg-primary border-primary' 
                    : 'bg-background border-border'
                }`}
              >
                <Text className={`font-bold ${
                  selectedAmount === amount ? 'text-white' : 'text-foreground'
                }`}>
                  ${amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipient Details</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <Input
            label="Recipient Email *"
            placeholder="recipient@email.com"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Recipient Name (Optional)"
            placeholder="John Doe"
            value={recipientName}
            onChangeText={setRecipientName}
          />
          
          <View>
            <Text className="text-foreground font-medium mb-2">Personal Message (Optional)</Text>
            <TextInput
              className="bg-muted border border-border rounded-lg p-3 text-foreground min-h-[100px]"
              placeholder="Write a personal message..."
              value={personalMessage}
              onChangeText={setPersonalMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-muted-foreground">Gift Card Amount</Text>
            <Text className="text-foreground font-bold">${selectedAmount}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border">
            <Text className="text-muted-foreground">Processing Fee</Text>
            <Text className="text-foreground font-bold">$0.00</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-foreground font-semibold text-lg">Total</Text>
            <Text className="text-foreground font-bold text-xl">${selectedAmount}.00</Text>
          </View>
        </CardContent>
      </Card>

      <Button
        title="Purchase Gift Card"
        onPress={handlePurchase}
        isLoading={isPurchasing}
        className="mt-2"
      />
    </View>
  );

  const renderHistory = () => (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      ListEmptyComponent={
        <Card>
          <CardContent className="p-8 items-center">
            <Clock size={48} color="#9CA3AF" />
            <Text className="text-muted-foreground mt-4">No transactions yet</Text>
          </CardContent>
        </Card>
      }
      renderItem={({ item }) => (
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.type === 'purchase' ? 'bg-blue-100' : 
                  item.type === 'redeem' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <DollarSign size={20} color={
                    item.type === 'purchase' ? '#3B82F6' : 
                    item.type === 'redeem' ? '#10B981' : '#F59E0B'
                  } />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">{item.description}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {item.cardCode} • {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text className={`font-bold ${
                item.type === 'refund' ? 'text-green-600' : 
                item.type === 'purchase' ? 'text-blue-600' : 'text-foreground'
              }`}>
                {item.type === 'refund' ? '+' : ''}${item.amount.toFixed(2)}
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
        <Text className="text-muted-foreground">Loading gift cards...</Text>
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
          <Text className="text-xl font-bold text-foreground ml-2">Gift Cards</Text>
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-muted/30 mx-4 mt-4 rounded-lg p-1">
          {(['cards', 'purchase', 'history'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-md ${activeTab === tab ? 'bg-card shadow-sm' : ''}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-center font-medium capitalize ${activeTab === tab ? 'text-foreground' : 'text-muted-foreground'}`}>
                {tab === 'cards' ? 'My Cards' : tab}
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
          {activeTab === 'cards' && renderCards()}
          {activeTab === 'purchase' && renderPurchase()}
          {activeTab === 'history' && renderHistory()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
