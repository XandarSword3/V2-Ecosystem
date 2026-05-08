'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Shield, Database, Lock, Cookie, UserCheck, Users, Mail, ArrowLeft,
  Scale, Globe, Clock, AlertTriangle, Building2
} from 'lucide-react';
import Link from 'next/link';
import { useSiteSettings } from '@/lib/settings-context';
import { Container } from '@/components/layout/Container';

/**
 * /privacy — Privacy Policy page
 *
 * If the CMS has a custom privacyPolicy string, that is displayed verbatim.
 * Otherwise, a comprehensive default privacy policy is shown that satisfies
 * GDPR Article 13 & 14 requirements.
 */
export default function PrivacyPage() {
  const t = useTranslations('legal.privacy');
  const { settings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 py-16">
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
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                {t('title')}
              </h1>
            </div>
            <p className="text-xl text-white/90 max-w-2xl">
              {t('subtitle')}
            </p>
            <p className="text-sm text-white/70 mt-4">
              Last updated: May 2026
            </p>
          </motion.div>
        </Container>
      </div>

      {/* Content */}
      <Container as="div" className="py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* If CMS provides a custom privacy policy, render it */}
          {settings.privacyPolicy ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10"
            >
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300">
                {settings.privacyPolicy}
              </div>
            </motion.div>
          ) : (
            <>
              {/* ============================================================ */}
              {/* GDPR Article 13/14 compliant default privacy policy          */}
              {/* ============================================================ */}

              {/* 1. Data Controller */}
              <Section
                icon={<Building2 className="w-6 h-6 text-amber-500" />}
                title="Data Controller"
                delay={0}
              >
                <p>
                  The data controller responsible for your personal data is the
                  operator of this platform (&quot;we&quot;, &quot;us&quot;,
                  &quot;our&quot;). Our contact details are:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    <strong>Name:</strong>{' '}
                    {settings.resortName || 'The Platform Operator'}
                  </li>
                  <li>
                    <strong>Email:</strong>{' '}
                    <a
                      href={`mailto:${settings.email || 'privacy@example.com'}`}
                      className="text-amber-400 underline"
                    >
                      {settings.email || 'privacy@example.com'}
                    </a>
                  </li>
                  <li>
                    <strong>Address:</strong>{' '}
                    {settings.address || 'See footer for contact address'}
                  </li>
                </ul>
                <p className="mt-3">
                  <strong>Data Protection Officer:</strong> For data protection
                  enquiries, please contact our DPO at{' '}
                  <a
                    href={`mailto:dpo@${settings.email?.split('@')[1] || 'example.com'}`}
                    className="text-amber-400 underline"
                  >
                    dpo@{settings.email?.split('@')[1] || 'example.com'}
                  </a>
                  .
                </p>
              </Section>

              {/* 2. Data We Collect */}
              <Section
                icon={<Database className="w-6 h-6 text-amber-500" />}
                title="What Data We Collect"
                delay={0.1}
              >
                <p>We may collect and process the following categories of personal data:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    <strong>Identity data:</strong> name, email address, phone
                    number, date of birth (provided during registration or
                    booking)
                  </li>
                  <li>
                    <strong>Account data:</strong> username, password (hashed),
                    role, preferences
                  </li>
                  <li>
                    <strong>Booking &amp; transaction data:</strong>{' '}
                    reservations, orders, payment records (card numbers are never
                    stored — processed by Stripe)
                  </li>
                  <li>
                    <strong>Technical data:</strong> IP address (hashed for
                    consent records), browser type, device information, pages
                    visited
                  </li>
                  <li>
                    <strong>Communication data:</strong> support ticket content,
                    feedback, reviews
                  </li>
                  <li>
                    <strong>Consent data:</strong> records of your cookie and
                    marketing consent preferences
                  </li>
                </ul>
              </Section>

              {/* 3. Lawful Basis */}
              <Section
                icon={<Scale className="w-6 h-6 text-amber-500" />}
                title="Lawful Basis for Processing"
                delay={0.2}
              >
                <p>
                  We process your personal data on the following legal bases
                  under GDPR Article 6:
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">
                          Processing Activity
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Lawful Basis
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="px-4 py-2">Account registration &amp; management</td>
                        <td className="px-4 py-2">Contract performance (Art. 6(1)(b))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Processing bookings &amp; orders</td>
                        <td className="px-4 py-2">Contract performance (Art. 6(1)(b))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Payment processing via Stripe</td>
                        <td className="px-4 py-2">Contract performance (Art. 6(1)(b))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Sending transactional emails (confirmations, receipts)</td>
                        <td className="px-4 py-2">Contract performance (Art. 6(1)(b))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Customer support &amp; ticket resolution</td>
                        <td className="px-4 py-2">Legitimate interest (Art. 6(1)(f))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Website analytics &amp; error monitoring</td>
                        <td className="px-4 py-2">Consent (Art. 6(1)(a))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Marketing communications</td>
                        <td className="px-4 py-2">Consent (Art. 6(1)(a))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Financial record keeping</td>
                        <td className="px-4 py-2">Legal obligation (Art. 6(1)(c))</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Fraud prevention &amp; security</td>
                        <td className="px-4 py-2">Legitimate interest (Art. 6(1)(f))</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* 4. Data Retention */}
              <Section
                icon={<Clock className="w-6 h-6 text-amber-500" />}
                title="Data Retention Periods"
                delay={0.3}
              >
                <p>
                  We retain your personal data only for as long as necessary for
                  the purposes set out in this policy, or as required by law:
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Data Category</th>
                        <th className="px-4 py-2 text-left font-medium">Retention Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="px-4 py-2">Account profile data</td>
                        <td className="px-4 py-2">Until account deletion request</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Booking &amp; order history</td>
                        <td className="px-4 py-2">7 years (legal obligation — tax records)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Payment records</td>
                        <td className="px-4 py-2">7 years (legal obligation — tax records)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Support tickets</td>
                        <td className="px-4 py-2">3 years after resolution</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Consent records</td>
                        <td className="px-4 py-2">5 years (GDPR accountability requirement)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Activity / audit logs</td>
                        <td className="px-4 py-2">1 year</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Marketing preferences</td>
                        <td className="px-4 py-2">Until consent withdrawal</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* 5. Third-Party Processors */}
              <Section
                icon={<Users className="w-6 h-6 text-amber-500" />}
                title="Third-Party Data Processors"
                delay={0.4}
              >
                <p>
                  We share your personal data with the following third-party
                  processors who act on our behalf:
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Processor</th>
                        <th className="px-4 py-2 text-left font-medium">Purpose</th>
                        <th className="px-4 py-2 text-left font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <tr>
                        <td className="px-4 py-2 font-medium">Stripe</td>
                        <td className="px-4 py-2">Payment processing</td>
                        <td className="px-4 py-2">USA (EU SCCs)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium">Supabase</td>
                        <td className="px-4 py-2">Database hosting &amp; authentication</td>
                        <td className="px-4 py-2">EU / USA (EU SCCs)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium">Vercel</td>
                        <td className="px-4 py-2">Web application hosting &amp; CDN</td>
                        <td className="px-4 py-2">Global (EU SCCs)</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium">Sentry (if enabled)</td>
                        <td className="px-4 py-2">Error monitoring (requires analytics consent)</td>
                        <td className="px-4 py-2">USA (EU SCCs)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  All processors are bound by Data Processing Agreements (DPAs)
                  and EU Standard Contractual Clauses (SCCs) where data is
                  transferred outside the EEA.
                </p>
              </Section>

              {/* 6. International Transfers */}
              <Section
                icon={<Globe className="w-6 h-6 text-amber-500" />}
                title="International Data Transfers"
                delay={0.5}
              >
                <p>
                  Some of our third-party processors are based outside the
                  European Economic Area (EEA). When we transfer your data
                  outside the EEA, we ensure appropriate safeguards are in
                  place:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    EU Standard Contractual Clauses (SCCs) approved by the
                    European Commission
                  </li>
                  <li>
                    Adequacy decisions where applicable
                  </li>
                  <li>
                    Data processing agreements with each processor
                  </li>
                </ul>
              </Section>

              {/* 7. Data Security */}
              <Section
                icon={<Lock className="w-6 h-6 text-amber-500" />}
                title="Data Security"
                delay={0.55}
              >
                <p>
                  We implement appropriate technical and organisational measures
                  to protect your personal data:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Encryption in transit (TLS/HTTPS) and at rest</li>
                  <li>Row-Level Security (RLS) policies preventing cross-user data access</li>
                  <li>Hashed passwords (bcrypt) — we never store plaintext passwords</li>
                  <li>JWT-based authentication with short-lived access tokens</li>
                  <li>IP address hashing for consent records (data minimisation)</li>
                  <li>Regular security reviews and dependency updates</li>
                </ul>
              </Section>

              {/* 8. Cookies */}
              <Section
                icon={<Cookie className="w-6 h-6 text-amber-500" />}
                title="Cookies"
                delay={0.6}
              >
                <p>
                  We use cookies and similar technologies (localStorage) to
                  provide core functionality, remember your preferences, and
                  improve our services. You can control non-essential cookies
                  via the consent banner shown on your first visit.
                </p>
                <p className="mt-2">
                  For a complete list of all cookies we use, please see our{' '}
                  <Link
                    href="/cookie-policy"
                    className="text-amber-400 underline hover:no-underline"
                  >
                    Cookie Policy
                  </Link>
                  .
                </p>
              </Section>

              {/* 9. Your Rights */}
              <Section
                icon={<UserCheck className="w-6 h-6 text-amber-500" />}
                title="Your Rights Under GDPR"
                delay={0.65}
              >
                <p>
                  Under the General Data Protection Regulation, you have the
                  following rights:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>
                    <strong>Right of access (Article 15):</strong> Request a
                    copy of all personal data we hold about you. You can do
                    this from your account privacy settings or by contacting us.
                  </li>
                  <li>
                    <strong>Right to rectification (Article 16):</strong> Request
                    correction of inaccurate or incomplete personal data.
                  </li>
                  <li>
                    <strong>Right to erasure (Article 17):</strong> Request
                    deletion of your personal data, subject to legal retention
                    requirements (e.g. tax records).
                  </li>
                  <li>
                    <strong>Right to restrict processing (Article 18):</strong>{' '}
                    Request that we limit how we use your data in certain
                    circumstances.
                  </li>
                  <li>
                    <strong>Right to data portability (Article 20):</strong>{' '}
                    Receive your personal data in a structured, machine-readable
                    format (JSON/ZIP export).
                  </li>
                  <li>
                    <strong>Right to object (Article 21):</strong> Object to
                    processing based on legitimate interests or for direct
                    marketing.
                  </li>
                  <li>
                    <strong>Right to withdraw consent (Article 7(3)):</strong>{' '}
                    Withdraw any consent you have given at any time, without
                    affecting the lawfulness of processing before withdrawal.
                  </li>
                </ul>
                <p className="mt-3">
                  To exercise any of these rights, use the privacy controls in
                  your account settings or contact us at the email address
                  below.
                </p>
              </Section>

              {/* 10. Complaint to Supervisory Authority */}
              <Section
                icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
                title="Right to Complain"
                delay={0.7}
              >
                <p>
                  If you believe that our processing of your personal data
                  infringes the GDPR, you have the right to lodge a complaint
                  with a supervisory authority. You may do so in the EU/EEA
                  member state of your habitual residence, your place of work,
                  or the place of the alleged infringement.
                </p>
              </Section>

              {/* 11. Automated Decision-Making */}
              <Section
                icon={<Shield className="w-6 h-6 text-amber-500" />}
                title="Automated Decision-Making"
                delay={0.72}
              >
                <p>
                  We do not use automated decision-making or profiling that
                  produces legal effects or similarly significant effects on
                  you, as described in GDPR Article 22.
                </p>
              </Section>
            </>
          )}

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-gradient-to-r from-amber-600/20 to-amber-700/20 rounded-2xl p-8 border border-amber-500/30 text-center"
          >
            <Mail className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {t('questions')}
            </h3>
            <p className="text-gray-300 mb-4">
              {t('contactUs')}
            </p>
            <a
              href={`mailto:${settings.email || 'privacy@example.com'}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors font-medium"
            >
              <Mail className="w-5 h-5" />
              {settings.email || 'privacy@example.com'}
            </a>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper component for consistent section styling
// ---------------------------------------------------------------------------
function Section({
  icon,
  title,
  delay,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 hover:border-amber-500/30 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-500/10 rounded-xl shrink-0">{icon}</div>
        <div className="space-y-3 w-full">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
        </div>
      </div>
    </motion.div>
  );
}
