'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Search,
  User,
  Mail,
  Phone,
  Calendar,
  Gift,
  CreditCard,
  Clock,
  ShoppingBag,
  Home,
  Waves,
  Star,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  loyaltyTier?: string;
  loyaltyPoints?: number;
  giftCardBalance?: number;
  recentOrders: {
    id: string;
    type: string;
    total: number;
    status: string;
    date: string;
  }[];
  recentBookings: {
    id: string;
    type: string;
    date: string;
    status: string;
  }[];
}

export default function CustomerLookupPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'phone' | 'email' | 'name'>('phone');
  const [searching, setSearching] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setSearching(true);
    setCustomer(null);
    setNotFound(false);

    try {
      const res = await api.get('/admin/users/search', {
        params: {
          [searchType]: searchQuery.trim(),
        },
      });

      if (res.data.success && res.data.data) {
        const userData = res.data.data;
        
        // Fetch additional data
        const [loyaltyRes, ordersRes] = await Promise.all([
          api.get(`/loyalty/accounts/${userData.id}`).catch(() => ({ data: { data: null } })),
          api.get('/restaurant/orders', { params: { userId: userData.id, limit: 5 } }).catch(() => ({ data: { data: [] } })),
        ]);

        setCustomer({
          id: userData.id,
          name: userData.name || userData.email?.split('@')[0] || 'Customer',
          email: userData.email,
          phone: userData.phone,
          createdAt: userData.created_at,
          loyaltyTier: loyaltyRes.data.data?.tier_name,
          loyaltyPoints: loyaltyRes.data.data?.total_points,
          giftCardBalance: 0, // Would need separate API call
          recentOrders: (ordersRes.data.data || []).map((o: any) => ({
            id: o.id,
            type: 'Restaurant',
            total: o.total || 0,
            status: o.status,
            date: o.created_at,
          })),
          recentBookings: [], // Would need separate API call
        });
      } else {
        setNotFound(true);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error('Search failed');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Search className="w-7 h-7 text-blue-500" />
          Customer Lookup
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Find customer information by phone, email, or name
        </p>
      </div>

      {/* Search Box */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Type */}
              <div className="flex rounded-lg border dark:border-slate-700 overflow-hidden">
                {(['phone', 'email', 'name'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSearchType(type)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      searchType === type
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder={
                      searchType === 'phone' ? '+1234567890 or partial number...'
                      : searchType === 'email' ? 'customer@email.com...'
                      : 'Customer name...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Search'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Not Found */}
      {notFound && (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Customer Not Found
              </h3>
              <p className="text-slate-500">
                No customer matches your search. Try a different {searchType}.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Customer Details */}
      {customer && (
        <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center pb-4 border-b dark:border-slate-700">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{customer.name}</h3>
                {customer.loyaltyTier && (
                  <Badge className="mt-2 bg-amber-100 text-amber-700">
                    <Star className="w-3 h-3 mr-1" />
                    {customer.loyaltyTier}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Member since {formatDate(customer.createdAt)}</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t dark:border-slate-700">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Gift className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-lg font-bold text-blue-600">{customer.loyaltyPoints || 0}</p>
                  <p className="text-xs text-slate-500">Points</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CreditCard className="w-5 h-5 mx-auto text-green-500 mb-1" />
                  <p className="text-lg font-bold text-green-600">{formatCurrency(customer.giftCardBalance || 0)}</p>
                  <p className="text-xs text-slate-500">Gift Card</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.recentOrders.length === 0 && customer.recentBookings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activity found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.recentOrders.map((order) => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">{order.type} Order</p>
                          <p className="text-sm text-slate-500">{formatDate(order.date)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(order.total)}</p>
                        <Badge className={
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {customer.recentBookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          {booking.type === 'chalet' ? <Home className="w-5 h-5 text-blue-500" /> : <Waves className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div>
                          <p className="font-medium">{booking.type} Booking</p>
                          <p className="text-sm text-slate-500">{formatDate(booking.date)}</p>
                        </div>
                      </div>
                      <Badge className={
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Instructions when no search */}
      {!customer && !notFound && !searching && (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-12 text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Search for a Customer
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Enter a phone number, email address, or name to find customer information, 
                loyalty status, and recent activity.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
