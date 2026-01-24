import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { User, CreditCard, Gift, FileText, Calendar, Bell, Settings, LogOut, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';

export default function AccountScreen() {
  const { user, logout, logoutAll, isLoading } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => logout()
        },
      ]
    );
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Logout All Devices',
      'This will log you out from all devices. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout All', 
          style: 'destructive',
          onPress: () => logoutAll()
        },
      ]
    );
  };

  const menuGroups = [
    {
      title: 'Profile & Payment',
      items: [
        { icon: User, label: 'Edit Profile', action: () => Alert.alert('Coming Soon') },
        { icon: CreditCard, label: 'Payment Methods', action: () => Alert.alert('Coming Soon') },
        { icon: Gift, label: 'Loyalty Points', action: () => Alert.alert('Coming Soon') },
      ]
    },
    {
      title: 'Activity',
      items: [
        { icon: FileText, label: 'Order History', action: () => Alert.alert('Coming Soon') },
        { icon: Calendar, label: 'My Bookings', action: () => Alert.alert('Coming Soon') },
      ]
    },
    {
      title: 'App Settings',
      items: [
        { icon: Bell, label: 'Notifications', action: () => Alert.alert('Coming Soon') },
        { icon: Settings, label: 'General Settings', action: () => Alert.alert('Coming Soon') },
      ]
    }
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        
        {/* Profile Card */}
        <View className="px-6 pt-8 pb-6 bg-primary/10 rounded-b-3xl mb-6">
          <View className="items-center mb-4">
            <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center mb-4 border-2 border-primary">
              <User size={48} className="text-primary" color="#4F46E5" />
            </View>
            <Text className="text-2xl font-bold text-foreground mb-1">
              {user?.firstName} {user?.lastName}
            </Text>
            <Text className="text-muted-foreground mb-2">{user?.email}</Text>
            {user?.loyaltyPoints !== undefined && (
              <View className="px-3 py-1 bg-primary rounded-full">
                <Text className="text-white text-xs font-bold">
                  {user.loyaltyPoints} PTS
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-4">
          {menuGroups.map((group, groupIndex) => (
            <View key={groupIndex} className="mb-6">
              <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-2">
                {group.title}
              </Text>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {group.items.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={item.action}
                      className={`flex-row items-center p-4 active:bg-muted/50 ${
                        index !== group.items.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <View className="w-10 h-10 rounded-full bg-muted items-center justify-center mr-4">
                        <item.icon size={20} className="text-foreground" color="#333" />
                      </View>
                      <Text className="flex-1 text-base font-medium text-foreground">
                        {item.label}
                      </Text>
                      <ChevronRight size={20} className="text-muted-foreground" color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </CardContent>
              </Card>
            </View>
          ))}
        </View>

        {/* Logout Actions */}
        <View className="px-4 mt-2">
           <Button 
            variant="ghost" 
            className="flex-row items-center justify-center mb-4 bg-red-50 dark:bg-red-900/20"
            onPress={handleLogout}
            disabled={isLoading}
           >
              <LogOut size={20} color="#EF4444" className="mr-2" />
              <Text className="text-red-500 font-semibold">Log Out</Text>
           </Button>

           <TouchableOpacity onPress={handleLogoutAll} disabled={isLoading} className="items-center">
              <Text className="text-muted-foreground text-xs underline">Log out from all devices</Text>
           </TouchableOpacity>
        </View>

        <Text className="text-center text-muted-foreground text-xs mt-8">
          V2 Resort v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
