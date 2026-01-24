/**
 * Pool Tickets Screen
 * View active pool tickets and QR codes
 */
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { poolApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';
import { ActivityIndicator } from 'react-native';

// NOTE: using a placeholder View for QR if library missing, or assuming we use `react-native-qrcode-svg`
// For this MVP file, we'll use a simple colored box with text if no lib installed
import { QrCode as QrIcon } from 'lucide-react-native';

export default function PoolTicketsScreen() {
    const { data: ticketsData, isLoading, refetch } = useQuery({
        queryKey: ['my-pool-tickets'],
        queryFn: () => poolApi.getTickets(),
    });

    const tickets = ticketsData?.data || [];

    return (
        <View className="flex-1 bg-background">
            <ScrollView
                className="flex-1 p-6"
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            >
                <Text className="text-2xl font-bold mb-6 text-foreground">My Pool Tickets</Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0ea5e9" />
                ) : tickets.length > 0 ? (
                    tickets.map((ticket) => (
                        <Card key={ticket.id} className="mb-6 bg-white dark:bg-slate-900 border-0 shadow-lg">
                            <CardContent className="items-center p-8">
                                <Text className="text-lg font-bold mb-2 text-foreground">{ticket.area || 'General Access'}</Text>
                                <Text className="text-muted-foreground mb-6">
                                    {new Date(ticket.validFrom).toLocaleDateString()} • {new Date(ticket.validFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>

                                {/* QR Code Placeholder / Component */}
                                <View className="w-48 h-48 bg-white items-center justify-center border-2 border-slate-900 rounded-xl mb-6">
                                    {/* In real app, use <QRCode value={ticket.qrCode} size={160} /> */}
                                    <QrIcon size={80} color="#0f172a" />
                                    <Text className="text-xs text-slate-900 mt-2 font-mono">{ticket.qrCode}</Text>
                                </View>

                                <View className={`px-4 py-2 rounded-full ${ticket.status === 'active' ? 'bg-green-100' : 'bg-slate-100'
                                    }`}>
                                    <Text className={`font-bold ${ticket.status === 'active' ? 'text-green-700' : 'text-slate-600'
                                        }`}>
                                        {ticket.status.toUpperCase()}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <View className="flex-1 items-center justify-center p-10">
                        <Text className="text-muted-foreground text-center">No active tickets found.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
