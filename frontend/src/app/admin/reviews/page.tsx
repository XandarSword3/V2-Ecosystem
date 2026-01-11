'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Star,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  MessageSquare,
  UtensilsCrossed,
  Home,
  Waves,
  Cookie,
  HelpCircle,
  Filter,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  text: string;
  service_type: 'general' | 'restaurant' | 'chalets' | 'pool' | 'snack_bar';
  is_approved: boolean;
  created_at: string;
  users?: {
    id: string;
    full_name: string;
    email: string;
    profile_image_url?: string;
  };
}

const serviceConfig: Record<string, { icon: React.ElementType; color: string }> = {
  general: { icon: HelpCircle, color: 'text-slate-500' },
  restaurant: { icon: UtensilsCrossed, color: 'text-blue-500' },
  chalets: { icon: Home, color: 'text-green-500' },
  pool: { icon: Waves, color: 'text-primary-500' },
  snack_bar: { icon: Cookie, color: 'text-orange-500' },
};

export default function AdminReviewsPage() {
  const t = useTranslations('admin');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/reviews/admin');
      setReviews(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const approveReview = async (id: string) => {
    try {
      setActionLoading(id);
      await api.put(`/reviews/${id}/approve`);
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_approved: true } : r))
      );
      toast.success('Review approved');
    } catch (error) {
      toast.error('Failed to approve review');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectReview = async (id: string) => {
    try {
      setActionLoading(id);
      await api.put(`/reviews/${id}/reject`);
      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_approved: false } : r))
      );
      toast.success('Review rejected');
    } catch (error) {
      toast.error('Failed to reject review');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    
    try {
      setActionLoading(id);
      await api.delete(`/reviews/${id}`);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success('Review deleted');
    } catch (error) {
      toast.error('Failed to delete review');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (statusFilter === 'pending' && r.is_approved) return false;
    if (statusFilter === 'approved' && !r.is_approved) return false;
    if (serviceFilter !== 'all' && r.service_type !== serviceFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        r.text.toLowerCase().includes(query) ||
        r.users?.full_name?.toLowerCase().includes(query) ||
        r.users?.email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const pendingCount = reviews.filter((r) => !r.is_approved).length;
  const approvedCount = reviews.filter((r) => r.is_approved).length;
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reviews
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage customer reviews and feedback
          </p>
        </div>
        <Button variant="outline" onClick={fetchReviews}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Average Rating</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-3xl font-bold">{averageRating}</p>
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(parseFloat(averageRating))
                          ? 'fill-white text-white'
                          : 'text-yellow-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Pending Reviews</p>
                  <p className="text-3xl font-bold mt-1">{pendingCount}</p>
                </div>
                <MessageSquare className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Approved Reviews</p>
                  <p className="text-3xl font-bold mt-1">{approvedCount}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>

            {/* Service Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Services</option>
              <option value="general">General</option>
              <option value="restaurant">Restaurant</option>
              <option value="chalets">Chalets</option>
              <option value="pool">Pool</option>
              <option value="snack_bar">Snack Bar</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredReviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No reviews found</p>
            </motion.div>
          ) : (
            filteredReviews.map((review, index) => {
              const ServiceIcon = serviceConfig[review.service_type]?.icon || HelpCircle;
              const serviceColor = serviceConfig[review.service_type]?.color || 'text-slate-500';

              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className={`${!review.is_approved ? 'border-l-4 border-l-orange-500' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                          {review.users?.profile_image_url ? (
                            <img
                              src={review.users.profile_image_url}
                              alt={review.users.full_name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                              <span className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                                {review.users?.full_name?.charAt(0) || 'G'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Review Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {review.users?.full_name || 'Anonymous'}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {review.users?.email}
                            </span>
                            <span className={`flex items-center gap-1 text-sm ${serviceColor}`}>
                              <ServiceIcon className="w-4 h-4" />
                              {review.service_type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Rating */}
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-slate-300 dark:text-slate-600'
                                }`}
                              />
                            ))}
                            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                              {formatDate(review.created_at)}
                            </span>
                          </div>

                          {/* Review Text */}
                          <p className="text-slate-700 dark:text-slate-300">
                            {review.text}
                          </p>

                          {/* Status Badge */}
                          <div className="mt-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                review.is_approved
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}
                            >
                              {review.is_approved ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Approved
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3" />
                                  Pending Approval
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!review.is_approved && (
                            <Button
                              size="sm"
                              onClick={() => approveReview(review.id)}
                              disabled={actionLoading === review.id}
                            >
                              <ThumbsUp className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {review.is_approved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rejectReview(review.id)}
                              disabled={actionLoading === review.id}
                            >
                              <ThumbsDown className="w-4 h-4 mr-1" />
                              Revoke
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => deleteReview(review.id)}
                            disabled={actionLoading === review.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
