'use client';

import { motion } from 'framer-motion';
import { Cookie, ArrowLeft, Shield, BarChart, Target } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { COOKIE_CATEGORIES, type CookieCategoryMeta } from '@/components/CookieConsentBanner';

/**
 * /cookie-policy — GDPR-required cookie policy page
 *
 * Lists every cookie the platform sets, categorised by type, with
 * name, purpose, and expiry for each. Linked from the CookieConsentBanner
 * and the site footer.
 */
export default function CookiePolicyPage() {
  const categoryIcons: Record<string, React.ReactNode> = {
    necessary: <Shield className="w-6 h-6 text-green-500" />,
    functional: <Cookie className="w-6 h-6 text-blue-500" />,
    analytics: <BarChart className="w-6 h-6 text-purple-500" />,
    marketing: <Target className="w-6 h-6 text-orange-500" />,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 py-16">
        <Container as="div">
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
                <Cookie className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Cookie Policy
              </h1>
            </div>
            <p className="text-xl text-white/90 max-w-2xl">
              This policy explains what cookies we use, why we use them, and how
              you can control them.
            </p>
            <p className="text-sm text-white/70 mt-4">
              Last updated: May 2026
            </p>
          </motion.div>
        </Container>
      </div>

      {/* Content */}
      <Container as="div" className="py-12">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Introduction */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="prose prose-invert max-w-none"
          >
            <h2 className="text-2xl font-semibold mb-4">What are cookies?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files that are stored on your device when
              you visit a website. They are widely used to make websites work
              more efficiently and to provide information to the owners of the
              site. We also use <strong>localStorage</strong> for some
              preferences; these are treated identically to cookies under the
              ePrivacy Directive and GDPR.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8">
              How can you control cookies?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              When you first visit our website, you are presented with a cookie
              consent banner where you can choose to <strong>Accept All</strong>,{' '}
              <strong>Reject All</strong> non-essential cookies, or{' '}
              <strong>Customise</strong> your preferences by category. You can
              change your preferences at any time by visiting your account
              privacy settings or clearing your browser data.
            </p>
          </motion.section>

          {/* Cookie tables by category */}
          {COOKIE_CATEGORIES.map((category: CookieCategoryMeta, index: number) => (
            <motion.section
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-white/10">
                  {categoryIcons[category.id] || category.icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  {category.required && (
                    <span className="text-xs text-green-400 font-medium">
                      Always active — cannot be disabled
                    </span>
                  )}
                  {!category.required && (
                    <span className="text-xs text-muted-foreground">
                      Optional — requires your consent
                    </span>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                {category.description}
              </p>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Purpose
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Expiry
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.cookies.map(cookie => (
                      <tr
                        key={cookie.name}
                        className="border-t border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {cookie.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cookie.purpose}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cookie.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          ))}

          {/* Contact */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center text-muted-foreground text-sm"
          >
            <p>
              For questions about our cookie practices, see our{' '}
              <Link
                href="/privacy"
                className="text-primary underline hover:no-underline"
              >
                Privacy Policy
              </Link>{' '}
              or contact our Data Protection Officer at the email address
              listed on our privacy page.
            </p>
          </motion.section>
        </div>
      </Container>
    </div>
  );
}
