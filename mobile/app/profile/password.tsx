/**
 * Change Password Screen
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react-native';
import { profileApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

export default function ChangePasswordScreen() {
  const router = useRouter();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await profileApi.changePassword({
        currentPassword,
        newPassword,
      });

      if (response.success) {
        Alert.alert('Success', 'Password changed successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        setError(response.error || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
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
          <Text className="text-xl font-bold text-foreground ml-2">Change Password</Text>
        </View>

        <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center">
              <Lock size={40} color="#4F46E5" />
            </View>
          </View>

          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              <Input
                label="Current Password"
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                  </TouchableOpacity>
                }
              />
              
              <Input
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
                  </TouchableOpacity>
                }
              />
              
              <Input
                label="Confirm New Password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showNew}
              />
            </CardContent>
          </Card>

          <Text className="text-muted-foreground text-sm mb-6 text-center">
            Password must be at least 8 characters long
          </Text>

          {error && (
            <View className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg mb-4">
              <Text className="text-destructive text-center text-sm">{error}</Text>
            </View>
          )}

          <Button
            title="Update Password"
            onPress={handleChangePassword}
            isLoading={isLoading}
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
