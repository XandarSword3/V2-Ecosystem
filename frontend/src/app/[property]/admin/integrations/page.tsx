'use client';

import { useParams } from 'next/navigation';

import React from 'react';
import Link from 'next/link';

const integrations = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync financial data, invoices, and payments with QuickBooks accounting software.',
    icon: '📊',
    status: 'available',
    href: '/admin/integrations/quickbooks'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept online payments via credit cards, Apple Pay, and Google Pay.',
    icon: '💳',
    status: 'coming_soon'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync customer data for email marketing campaigns and newsletters.',
    icon: '📧',
    status: 'coming_soon'
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Track website traffic, user behavior, and conversion metrics.',
    icon: '📈',
    status: 'coming_soon'
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5,000+ apps through automated workflows.',
    icon: '⚡',
    status: 'coming_soon'
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS notifications and booking confirmations to customers.',
    icon: '📱',
    status: 'coming_soon'
  }
];

export default function IntegrationsPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🔌 Integrations
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Connect your business with third-party services and platforms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-3xl">{integration.icon}</div>
              {integration.status === 'available' ? (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                  Available
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded-full">
                  Coming Soon
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">{integration.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {integration.description}
            </p>
            {integration.status === 'available' && integration.href ? (
              <Link
                href={`/${propertySlug}${integration.href}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
              >
                Configure →
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                Coming Soon
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-2">
          💡 Need a custom integration?
        </h3>
        <p className="text-sm text-blue-600 dark:text-blue-300">
          Our API supports custom integrations. Check the API documentation or contact our development team for assistance with connecting additional services.
        </p>
      </div>
    </div>
  );
}
