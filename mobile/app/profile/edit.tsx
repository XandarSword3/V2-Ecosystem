/**
 * Profile Edit Screen
 * Allows users to update their profile information
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save, User } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { profileApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await profileApi.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      if (response.success) {
        await refreshUser();
        Alert.alert('Success', 'Profile updated successfully');
        router.back();
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground ml-2">Edit Profile</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center border-2 border-primary">
              <User size={48} color="#4F46E5" />
            </View>
            <Text className="text-muted-foreground mt-2 text-sm">
              {user?.email}
            </Text>
          </View>

          {/* Form */}
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              <Input
                label="First Name"
                placeholder="Enter your first name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              
              <Input
                label="Last Name"
                placeholder="Enter your last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
              
              <Input
                label="Phone Number"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </CardContent>
          </Card>

          {error && (
            <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
              <Text className="text-destructive text-center text-sm">{error}</Text>
            </View>
          )}

          <Button
            title="Save Changes"
            onPress={handleSave}
            isLoading={isLoading}
            icon={<Save size={20} color="white" />}
            className="mb-4"
          />

          <Button
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            disabled={isLoading}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
