'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Star, Quote, ChevronLeft, ChevronRight, User, Loader2, X, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_BASE_URL, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import Link from 'next/link';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  rating: number;
  text: string;
  date: string;
}

interface ReviewsResponse {
  success?: boolean;
  data?: {
    reviews: Array<{
      id: string;
      rating: number;
      text: string;
      service_type: string;
      created_at: string;
      users: {
        full_name: string;
        profile_image_url?: string;
      };
    }>;
    stats: {
      totalReviews: number;
      averageRating: number;
    };
  };
  reviews?: Array<{
    id: string;
    rating: number;
    text: string;
    service_type: string;
    created_at: string;
    user: {
      first_name: string;
      last_name: string;
    };
  }>;
  stats?: {
    average_rating: number;
    total_reviews: number;
  };
}

// Empty placeholder - no fake testimonials
const emptyTestimonials: Testimonial[] = [];

const serviceTypeLabels: Record<string, string> = {
  general: 'Resort Guest',
  restaurant: 'Restaurant Guest',
  pool: 'Pool Guest',
  chalets: 'Chalet Guest',
  snack_bar: 'Snack Bar Guest',
};

export default function TestimonialsCarousel() {
  const t = useTranslations('testimonials');
  const { isAuthenticated, user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(emptyTestimonials);
  const [stats, setStats] = useState({ average_rating: 0, total_reviews: 0 });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, text: '', service_type: 'general' });
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch reviews from API
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/reviews`);
        if (response.ok) {
          const data: ReviewsResponse = await response.json();
          
          // Handle new API format (success/data wrapper)
          const reviewsData = data.data?.reviews || data.reviews || [];
          const statsData = data.data?.stats || data.stats;
          
          if (reviewsData.length > 0) {
            const mappedTestimonials: Testimonial[] = reviewsData.map((review: any) => {
              // Handle both formats: users.full_name or user.first_name/last_name
              const name = review.users?.full_name || 
                (review.user ? `${review.user.first_name} ${review.user.last_name}` : 'Guest');
              
              return {
                id: review.id,
                name,
                avatar: review.users?.profile_image_url,
                role: serviceTypeLabels[review.service_type] || 'Guest',
                rating: review.rating,
                text: review.text,
                date: review.created_at?.split('T')[0] || '',
              };
            });
            setTestimonials(mappedTestimonials);
          }
          
          if (statsData) {
            // Use type-safe access with fallback
            const avgRating = 'averageRating' in statsData ? statsData.averageRating : 
                              'average_rating' in statsData ? statsData.average_rating : 4.9;
            const totalRevs = 'totalReviews' in statsData ? statsData.totalReviews :
                              'total_reviews' in statsData ? statsData.total_reviews : 0;
            setStats({
              average_rating: avgRating,
              total_reviews: totalRevs,
            });
          }
        }
      } catch (error) {
        console.log('Using fallback testimonials');
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviews();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || testimonials.length === 0) return;
    
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonials.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      },
    }),
  };

  const goTo = (index: number) => {
    if (testimonials.length === 0) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goNext = () => {
    if (testimonials.length === 0) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goPrev = () => {
    if (testimonials.length === 0) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const handleSubmitReview = async () => {
    if (!reviewData.text.trim()) {
      toast.error('Please write a review');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await api.post('/reviews', {
        rating: reviewData.rating,
        text: reviewData.text,
        service_type: reviewData.service_type
      });
      
      if (response.data?.success || response.status === 200 || response.status === 201) {
        toast.success('Thank you for your review!');
        setShowReviewForm(false);
        setReviewData({ rating: 5, text: '', service_type: 'general' });
        // Refresh reviews
        const fetchResponse = await fetch(`${API_BASE_URL}/reviews`);
        if (fetchResponse.ok) {
          const data: ReviewsResponse = await fetchResponse.json();
          if (data.reviews && data.reviews.length > 0) {
            const mappedTestimonials: Testimonial[] = data.reviews.map((review) => ({
              id: review.id,
              name: `${review.user.first_name} ${review.user.last_name}`,
              role: serviceTypeLabels[review.service_type] || 'Guest',
              rating: review.rating,
              text: review.text,
              date: review.created_at.split('T')[0],
            }));
            setTestimonials(mappedTestimonials);
            if (data.stats) {
              setStats(data.stats);
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const currentTestimonial = testimonials.length > 0 ? testimonials[currentIndex] : null;

  // Review form modal component (inline)
  const renderReviewModal = () => (
    <AnimatePresence>
      {showReviewForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowReviewForm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('writeReview') || 'Write a Review'}
              </h3>
              <button
                onClick={() => setShowReviewForm(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('yourRating') || 'Your Rating'}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewData({ ...reviewData, rating: star })}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewData.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('serviceType') || 'Service Type'}
              </label>
              <select
                value={reviewData.service_type}
                onChange={(e) => setReviewData({ ...reviewData, service_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="general">{t('serviceGeneral') || 'General Experience'}</option>
                <option value="chalets">{t('serviceChalets') || 'Chalets'}</option>
                <option value="restaurant">{t('serviceRestaurant') || 'Restaurant'}</option>
                <option value="pool">{t('servicePool') || 'Pool'}</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('yourReview') || 'Your Review'}
              </label>
              <textarea
                value={reviewData.text}
                onChange={(e) => setReviewData({ ...reviewData, text: e.target.value })}
                placeholder={t('reviewPlaceholder') || 'Share your experience (minimum 10 characters)...'}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={submitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('submitting') || 'Submitting...'}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {t('submitReview') || 'Submit Review'}
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // If still loading, show a loading state
  if (isLoading) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-3xl" />
        <div className="relative px-8 py-12 md:px-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-slate-500 dark:text-slate-400 mt-4">Loading reviews...</p>
        </div>
      </div>
    );
  }

  // If no testimonials, show a message encouraging reviews
  if (testimonials.length === 0 || !currentTestimonial) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-3xl" />
        <div className="relative px-8 py-12 md:px-16 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-700 dark:text-amber-400 text-sm font-medium mb-4">
            <Star className="w-4 h-4 fill-current" />
            {t('badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('title')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {t('noReviewsYet') || 'Be the first to share your experience!'}
          </p>
          {isAuthenticated ? (
            <button
              onClick={() => setShowReviewForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors shadow-lg shadow-amber-500/25"
            >
              <Star className="w-5 h-5" />
              {t('leaveReview') || 'Leave a Review'}
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-full font-medium transition-colors"
            >
              <User className="w-5 h-5" />
              {t('loginToReview') || 'Login to Leave a Review'}
            </Link>
          )}
          {renderReviewModal()}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-3xl" />
      
      {/* Quote decoration */}
      <div className="absolute top-8 left-8 opacity-10">
        <Quote className="w-24 h-24 text-amber-600" />
      </div>
      
      <div className="relative px-8 py-12 md:px-16">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-700 dark:text-amber-400 text-sm font-medium mb-4">
              <Star className="w-4 h-4 fill-current" />
              {t('badge')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              {t('title')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>

        {/* Carousel */}
        <div className="relative max-w-3xl mx-auto">
          {/* Navigation buttons */}
          <button
            onClick={goPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 z-10 w-12 h-12 rounded-full bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-600 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 z-10 w-12 h-12 rounded-full bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-600 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Testimonial Card */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 md:p-10"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-6 justify-center">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          i < currentTestimonial.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Quote text */}
                <blockquote className="text-lg md:text-xl text-slate-700 dark:text-slate-300 text-center mb-8 leading-relaxed">
                  "{currentTestimonial.text}"
                </blockquote>

                {/* Author */}
                <div className="flex items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {currentTestimonial.avatar ? (
                      <img
                        src={currentTestimonial.avatar}
                        alt={currentTestimonial.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      currentTestimonial.name.charAt(0)
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {currentTestimonial.name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {currentTestimonial.role}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots navigation */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-amber-500 w-8'
                    : 'bg-slate-300 dark:bg-slate-600 hover:bg-amber-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto"
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.average_rating.toFixed(1)}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{t('averageRating')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.total_reviews}+</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{t('happyGuests')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">98%</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{t('recommend')}</div>
          </div>
        </motion.div>

        {/* Leave a Review Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          {isAuthenticated ? (
            <button
              onClick={() => setShowReviewForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors shadow-lg shadow-amber-500/25"
            >
              <Star className="w-5 h-5" />
              {t('leaveReview') || 'Leave a Review'}
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-full font-medium transition-colors"
            >
              <User className="w-5 h-5" />
              {t('loginToReview') || 'Login to Leave a Review'}
            </Link>
          )}
        </motion.div>
      </div>

      {/* Review Form Modal */}
      {renderReviewModal()}
    </div>
  );
}
