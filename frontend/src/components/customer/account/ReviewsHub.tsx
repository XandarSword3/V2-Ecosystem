'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Star,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Utensils,
  User,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export interface EligibleTarget {
  targetType: 'module' | 'item' | 'staff' | string;
  targetId: string;
  title: string;
  subtitle?: string;
  moduleId?: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  text: string;
  service_type: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  target_type?: string;
  target_id?: string;
  created_at: string;
}

export interface ReviewsHubProps {
  propertySlug?: string;
  className?: string;
}

export function ReviewsHub({ propertySlug = '', className = '' }: ReviewsHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [eligibility, setEligibility] = useState<{
    isEligible: boolean;
    completedTransactionsCount: number;
    eligibleTargets: EligibleTarget[];
  }>({
    isEligible: false,
    completedTransactionsCount: 0,
    eligibleTargets: [],
  });
  const [myReviews, setMyReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review Form State
  const [selectedTarget, setSelectedTarget] = useState<EligibleTarget | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const fetchReviewData = async (signal?: AbortSignal) => {
    try {
      const [eligRes, meRes] = await Promise.all([
        api.get('/reviews/eligibility', { signal }),
        api.get('/reviews/me', { signal }),
      ]);

      if (eligRes.data?.success) {
        setEligibility(eligRes.data.data);
      }
      if (meRes.data?.success) {
        setMyReviews(meRes.data.data || []);
      }
    } catch {
      // Graceful fallback for non-fatal review queries
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      fetchReviewData(controller.signal);
      return () => controller.abort();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const handleStartReview = (target: EligibleTarget) => {
    setSelectedTarget(target);
    setRating(5);
    setReviewText('');
    setShowReviewForm(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) return;

    if (reviewText.trim().length < 10) {
      toast.error('Review text must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        rating,
        text: reviewText.trim(),
        service_type: selectedTarget.moduleId || 'general',
        target_type: selectedTarget.targetType,
        target_id: selectedTarget.targetId,
      };

      const res = await api.post('/reviews', payload);
      if (res.data?.success) {
        toast.success('Review submitted successfully! Thank you for your feedback.');
        setShowReviewForm(false);
        setSelectedTarget(null);
        setReviewText('');
        await fetchReviewData();
      } else {
        toast.error(res.data?.error || 'Failed to submit review');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="reviews-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center p-8 border-dashed" data-testid="reviews-guest">
        <CardContent className="space-y-4">
          <Star className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sign In to Leave & View Reviews</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Reviews are verified and exclusively available to customers who have completed transactions.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
          >
            Sign In
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="reviews-hub">
      {/* Review Eligibility Banner (Backend-State Driven) */}
      <Card
        className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-slate-900 border-amber-200 dark:border-amber-800/40"
        data-testid="reviews-eligibility-card"
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Verified Customer Reviews
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {eligibility.isEligible
                    ? `You have ${eligibility.eligibleTargets.length} item(s) or visit(s) eligible for review.`
                    : eligibility.completedTransactionsCount > 0
                    ? 'All your past visits and items have been reviewed. Thank you!'
                    : 'Complete a transaction at our property to unlock verified review eligibility.'}
                </p>
              </div>
            </div>
          </div>

          {/* Eligible Targets List */}
          {eligibility.isEligible && (
            <div className="mt-4 pt-4 border-t border-amber-200/60 dark:border-amber-800/40 space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Available to Review Now:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="eligible-targets-list">
                {eligibility.eligibleTargets.map((target, idx) => (
                  <div
                    key={`${target.targetType}-${target.targetId}-${idx}`}
                    className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="truncate">
                      <p className="text-xs font-bold text-foreground truncate">{target.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{target.subtitle || target.targetType}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartReview(target)}
                      className="text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                      data-testid={`review-btn-${target.targetId}`}
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Submission Form / Modal */}
      {showReviewForm && selectedTarget && (
        <Card className="border-2 border-amber-500/50 shadow-md" data-testid="review-form-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Writing Review for: <span className="text-amber-600">{selectedTarget.title}</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReviewForm(false)}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Rating
                </label>
                <div className="flex items-center gap-1.5" data-testid="star-rating-selector">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                      aria-label={`${star} Stars`}
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= (hoverRating ?? rating)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-muted-foreground">
                    {rating} out of 5 stars
                  </span>
                </div>
              </div>

              {/* Review Text Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    Your Review & Feedback
                  </label>
                  <span
                    className={`text-[11px] ${
                      reviewText.length < 10
                        ? 'text-amber-600'
                        : reviewText.length > 1000
                        ? 'text-rose-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {reviewText.length}/1000 (min 10 chars)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details about your experience, food quality, service, or atmosphere..."
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-foreground focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  data-testid="review-textarea"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || reviewText.trim().length < 10}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
                  data-testid="review-submit-btn"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit Verified Review
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Customer's Past Reviews */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            My Submitted Reviews ({myReviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs" data-testid="no-reviews-msg">
              You haven't submitted any reviews yet. Share your experience on any completed order above!
            </div>
          ) : (
            <div className="space-y-4" data-testid="reviews-list">
              {myReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2.5"
                  data-testid={`review-card-${rev.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-slate-300 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {rev.service_type || 'General'}
                      </span>
                    </div>

                    <Badge
                      className={`text-[10px] font-semibold ${
                        rev.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : rev.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                      data-testid={`review-status-${rev.id}`}
                    >
                      {rev.status === 'approved' ? 'Approved' : rev.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                    </Badge>
                  </div>

                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{rev.text}</p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Submitted on {formatDate(rev.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReviewsHub;
