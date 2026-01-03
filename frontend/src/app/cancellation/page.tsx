'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { XCircle, Home, UtensilsCrossed, Waves, RefreshCw, AlertTriangle, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSiteSettings } from '@/lib/settings-context';

export default function CancellationPage() {
  const t = useTranslations('legal.cancellation');
  const { settings } = useSiteSettings();

  const sections = [
    { key: 'general', icon: AlertTriangle },
    { key: 'chalets', icon: Home },
    { key: 'restaurant', icon: UtensilsCrossed },
    { key: 'pool', icon: Waves },
    { key: 'refunds', icon: RefreshCw },
    { key: 'exceptions', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 py-16">
        <div className="container mx-auto px-4">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                {t('title')}
              </h1>
            </div>
            <p className="text-xl text-white/90 max-w-2xl">
              {t('subtitle')}
            </p>
            <p className="text-sm text-white/70 mt-4">
              {t('lastUpdated')}: January 2025
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {settings.refundPolicy ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10"
            >
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300">
                {settings.refundPolicy}
              </div>
            </motion.div>
          ) : (
            sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl shrink-0">
                      <Icon className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-white">
                        {t(`${section.key}.title`)}
                      </h2>
                      <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                        {t(`${section.key}.content`)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl p-8 border border-amber-500/30 text-center"
          >
            <h3 className="text-xl font-semibold text-white mb-2">
              {t('questions')}
            </h3>
            <p className="text-gray-300 mb-6">{t('contactUs')}</p>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors"
            >
              <span>Contact Support</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
