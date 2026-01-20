/**
 * Login Screen
 * Refactored to use V2 Design System (NativeWind + UI Primitives)
 */

import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, TouchableOpacity, ImageBackground } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Mail, Lock, LogIn } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    
    clearError();
    const success = await login(email, password);
    // Navigation is handled by RootLayout based on auth state, 
    // but we can force it if needed.
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1571896349842-6e635aa135a5?q=80&w=2000&auto=format&fit=crop' }} 
      className="flex-1"
      resizeMode="cover"
    >
      {/* Solid Overlay for Text Legibility (replacing Glassmorphism) */}
      <View className="flex-1 bg-slate-950/80 px-4 justify-center">
        <SafeAreaView className="w-full max-w-md mx-auto space-y-8">
          
          <View className="items-center space-y-2">
            <Text className="text-white text-4xl font-bold tracking-tight text-center">
              V2 Resort
            </Text>
            <Text className="text-slate-400 text-lg text-center">
              Welcome back to paradise
            </Text>
          </View>

          <Card variant="glass" className="p-6 space-y-6">
            <View className="space-y-4">
              <Input
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon={<Mail size={20} color="#94a3b8" />}
              />
              
              <Input
                label="Password"
                placeholder="........"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                leftIcon={<Lock size={20} color="#94a3b8" />}
              />
            </View>

            {error && (
              <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                <Text className="text-red-400 text-center text-sm">{error}</Text>
              </View>
            )}

            <Button
              title="Sign In"
              onPress={handleLogin}
              isLoading={isLoading}
              icon={<LogIn size={20} color="white" />}
              className="mt-2"
              size="lg"
            />
            
            <View className="flex-row justify-between pt-4">
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-primary-400 font-semibold">Create Account</Text>
                </TouchableOpacity>
              </Link>
              
              {/* <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text className="text-slate-400">Forgot Password?</Text>
                </TouchableOpacity>
              </Link> */}
            </View>
          </Card>

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
