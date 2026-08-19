'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { Star, AlertCircle, MessageSquare } from 'lucide-react';

interface StaffReviewRow {
  id: string;
  rating: number;
  text?: string | null;
  created_at?: string;
}

interface MyRatingsData {
  average_rating: number;
  review_count: number;
  reviews: StaffReviewRow[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        />
      ))}
    </span>
  );
}

export default function MyRatingsPage() {
  const [data, setData] = useState<MyRatingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const res = await api.get('/staff/reviews/me');
        setData(res.data?.data ?? { average_rating: 0, review_count: 0, reviews: [] });
      } catch (err) {
        console.error('Failed to fetch ratings:', err);
        setError('Could not load your ratings. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchRatings();
  }, []);

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
          <Star className="w-7 h-7 text-amber-500" />
          My Ratings
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          How guests have rated your service
        </p>
      </div>

      {loading ? (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
              <p className="text-slate-500 mt-4">Loading ratings…</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : error ? (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Couldn&apos;t load your ratings
              </h3>
              <p className="text-slate-500">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : data ? (
        <>
          {/* Summary */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardContent className="p-6 flex items-center gap-6">
                <div className="text-center">
                  <p className="text-5xl font-bold text-slate-900 dark:text-white">
                    {data.average_rating.toFixed(1)}
                  </p>
                  <div className="mt-2">
                    <Stars rating={data.average_rating} />
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {data.review_count} review{data.review_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Your average is calculated from every individual staff rating
                  left by guests after an order.
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent reviews */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Recent Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.reviews.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No reviews yet. Keep up the good work!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <Stars rating={review.rating} />
                          {review.created_at && (
                            <span className="text-xs text-slate-500">
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                        {review.text && (
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                            &ldquo;{review.text}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}
