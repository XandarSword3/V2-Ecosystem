/**
 * Restaurant Cart Screen
 * Review cart items, apply coupons, and place order
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Plus,
  Minus,
  Trash2,
  Tag,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';
import { restaurantApi, couponApi } from '../../src/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

interface AppliedCoupon {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
}

export default function CartScreen() {
  const router = useRouter();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<'room' | 'pickup'>('room');
  const [roomNumber, setRoomNumber] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load cart from local storage or context
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await restaurantApi.getCart();
      if (response.success && response.data) {
        setCartItems(response.data);
      }
    } catch (err) {
      // Cart might not exist yet, that's okay
    }
  };

  const updateQuantity = async (itemId: string, delta: number) => {
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;

    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartItems(prev => 
      prev.map(i => i.id === itemId ? { ...i, quantity: newQuantity } : i)
    );

    try {
      await restaurantApi.updateCartItem(itemId, { quantity: newQuantity });
    } catch (err) {
      // Revert on error
      setCartItems(prev => 
        prev.map(i => i.id === itemId ? { ...i, quantity: item.quantity } : i)
      );
    }
  };

  const removeItem = async (itemId: string) => {
    const item = cartItems.find(i => i.id === itemId);
    setCartItems(prev => prev.filter(i => i.id !== itemId));

    try {
      await restaurantApi.removeFromCart(itemId);
    } catch (err) {
      // Revert on error
      if (item) {
        setCartItems(prev => [...prev, item]);
      }
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setIsApplyingCoupon(true);
    setError(null);

    try {
      const response = await couponApi.validate(couponCode.trim());
      if (response.success && response.data) {
        setAppliedCoupon({
          code: couponCode.trim(),
          discount: response.data.discount,
          type: response.data.type
        });
        setCouponCode('');
      } else {
        setError(response.error || 'Invalid coupon code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = calculateSubtotal();
    return appliedCoupon.type === 'percentage' 
      ? subtotal * (appliedCoupon.discount / 100)
      : appliedCoupon.discount;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const placeOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    if (deliveryOption === 'room' && !roomNumber.trim()) {
      Alert.alert('Error', 'Please enter your room number');
      return;
    }

    setIsPlacingOrder(true);
    setError(null);

    try {
      const response = await restaurantApi.placeOrder({
        items: cartItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions
        })),
        deliveryOption,
        roomNumber: deliveryOption === 'room' ? roomNumber : undefined,
        specialInstructions: specialInstructions || undefined,
        couponCode: appliedCoupon?.code
      });

      if (response.success && response.data) {
        const orderData = response.data;
        Alert.alert(
          'Order Placed!',
          `Your order #${orderData.orderNumber} has been placed successfully.`,
          [
            { 
              text: 'View Order', 
              onPress: () => router.replace(`/restaurant/order/${orderData.orderId}`)
            }
          ]
        );
      } else {
        setError(response.error || 'Failed to place order');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = calculateTotal();

  if (cartItems.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-foreground ml-2">Cart</Text>
          </View>

          <View className="flex-1 items-center justify-center px-4">
            <View className="w-24 h-24 bg-muted rounded-full items-center justify-center mb-4">
              <CreditCard size={40} color="#9CA3AF" />
            </View>
            <Text className="text-foreground font-semibold text-lg mb-2">Your cart is empty</Text>
            <Text className="text-muted-foreground text-center mb-6">
              Browse our menu and add some delicious items!
            </Text>
            <Button
              title="Browse Menu"
              onPress={() => router.replace('/restaurant')}
            />
          </View>
        </SafeAreaView>
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
          <Text className="text-xl font-bold text-foreground ml-2">Cart</Text>
          <Text className="text-muted-foreground ml-2">({cartItems.length} items)</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-4">
          {/* Cart Items */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {cartItems.map((item, index) => (
                <View 
                  key={item.id} 
                  className={`flex-row items-center py-3 ${index < cartItems.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <View className="flex-1">
                    <Text className="text-foreground font-medium">{item.name}</Text>
                    <Text className="text-muted-foreground text-sm">${item.price.toFixed(2)} each</Text>
                    {item.specialInstructions && (
                      <Text className="text-muted-foreground text-xs mt-1 italic">
                        "{item.specialInstructions}"
                      </Text>
                    )}
                  </View>
                  
                  <View className="flex-row items-center">
                    <View className="flex-row items-center bg-muted rounded-lg mr-3">
                      <TouchableOpacity 
                        onPress={() => updateQuantity(item.id, -1)}
                        className="p-2"
                      >
                        <Minus size={16} color="#4F46E5" />
                      </TouchableOpacity>
                      <Text className="text-foreground font-bold px-2">{item.quantity}</Text>
                      <TouchableOpacity 
                        onPress={() => updateQuantity(item.id, 1)}
                        className="p-2"
                      >
                        <Plus size={16} color="#4F46E5" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text className="text-foreground font-bold w-16 text-right">
                      ${(item.price * item.quantity).toFixed(2)}
                    </Text>
                    
                    <TouchableOpacity 
                      onPress={() => removeItem(item.id)}
                      className="ml-2 p-2"
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>

          {/* Coupon */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex-row items-center">
                <Tag size={18} color="#4F46E5" />
                <Text className="ml-2">Coupon Code</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {appliedCoupon ? (
                <View className="flex-row items-center justify-between bg-green-50 p-3 rounded-lg">
                  <View className="flex-row items-center">
                    <CheckCircle size={20} color="#10B981" />
                    <View className="ml-2">
                      <Text className="text-green-700 font-medium">{appliedCoupon.code}</Text>
                      <Text className="text-green-600 text-sm">
                        {appliedCoupon.type === 'percentage' 
                          ? `${appliedCoupon.discount}% off`
                          : `$${appliedCoupon.discount} off`
                        }
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={removeCoupon}>
                    <Text className="text-red-500 font-medium">Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="flex-row items-center space-x-2">
                  <View className="flex-1">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChangeText={setCouponCode}
                      autoCapitalize="characters"
                    />
                  </View>
                  <Button
                    title="Apply"
                    size="sm"
                    onPress={applyCoupon}
                    isLoading={isApplyingCoupon}
                  />
                </View>
              )}
            </CardContent>
          </Card>

          {/* Delivery Options */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex-row items-center">
                <MapPin size={18} color="#4F46E5" />
                <Text className="ml-2">Delivery Option</Text>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <View className="flex-row space-x-3 mb-4">
                <TouchableOpacity
                  onPress={() => setDeliveryOption('room')}
                  className={`flex-1 p-4 rounded-lg border ${
                    deliveryOption === 'room' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                >
                  <Text className={`font-medium text-center ${
                    deliveryOption === 'room' ? 'text-primary' : 'text-foreground'
                  }`}>Room Service</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setDeliveryOption('pickup')}
                  className={`flex-1 p-4 rounded-lg border ${
                    deliveryOption === 'pickup' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                >
                  <Text className={`font-medium text-center ${
                    deliveryOption === 'pickup' ? 'text-primary' : 'text-foreground'
                  }`}>Pickup</Text>
                </TouchableOpacity>
              </View>

              {deliveryOption === 'room' && (
                <Input
                  label="Room Number"
                  placeholder="e.g., 101"
                  value={roomNumber}
                  onChangeText={setRoomNumber}
                  keyboardType="number-pad"
                />
              )}
            </CardContent>
          </Card>

          {/* Special Instructions */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Special Instructions (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <TextInput
                className="bg-muted border border-border rounded-lg p-3 text-foreground min-h-[80px]"
                placeholder="Any special requests or allergies..."
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <View className="flex-row justify-between py-2">
                <Text className="text-muted-foreground">Subtotal</Text>
                <Text className="text-foreground">${subtotal.toFixed(2)}</Text>
              </View>
              
              {discount > 0 && (
                <View className="flex-row justify-between py-2">
                  <Text className="text-green-600">Discount</Text>
                  <Text className="text-green-600">-${discount.toFixed(2)}</Text>
                </View>
              )}
              
              <View className="flex-row justify-between py-2">
                <Text className="text-muted-foreground">Delivery Fee</Text>
                <Text className="text-foreground">$0.00</Text>
              </View>
              
              <View className="flex-row justify-between py-3 mt-2 border-t border-border">
                <Text className="text-foreground font-bold text-lg">Total</Text>
                <Text className="text-foreground font-bold text-lg">${total.toFixed(2)}</Text>
              </View>
            </CardContent>
          </Card>

          {error && (
            <View className="mb-4 bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex-row items-center">
              <AlertCircle size={18} color="#EF4444" />
              <Text className="text-destructive ml-2 flex-1">{error}</Text>
            </View>
          )}

          <Button
            title={`Place Order • $${total.toFixed(2)}`}
            onPress={placeOrder}
            isLoading={isPlacingOrder}
            className="mb-8"
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
