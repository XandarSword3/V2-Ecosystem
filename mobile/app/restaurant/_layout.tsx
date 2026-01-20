import { Stack } from 'expo-router';

export default function RestaurantLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="[itemId]" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="order/[orderId]" />
    </Stack>
  );
}
