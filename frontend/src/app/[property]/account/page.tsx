'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AccountShell, AccountTabKey } from '@/components/shells/AccountShell';
import {
  OrdersHub,
  TrackingHub,
  LoyaltyHub,
  GiftCardsHub,
  ReviewsHub,
  RecoveryHub,
  ReturnsHub,
  ProfileHub,
} from '@/components/customer/account';

export default function AccountPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const propertySlug = (params?.property as string) || '';
  const initialTab = (searchParams?.get('tab') as AccountTabKey) || 'orders';

  const [activeTab, setActiveTab] = useState<AccountTabKey>(initialTab);

  useEffect(() => {
    const tabParam = searchParams?.get('tab') as AccountTabKey;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: AccountTabKey) => {
    setActiveTab(tab);
    // Update query param without reloading
    const newUrl = propertySlug ? `/${propertySlug}/account?tab=${tab}` : `/account?tab=${tab}`;
    router.replace(newUrl);
  };

  return (
    <AccountShell
      propertySlug={propertySlug}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      data-testid="account-page-shell"
    >
      {activeTab === 'orders' && (
        <OrdersHub propertySlug={propertySlug} onNavigateTab={handleTabChange} />
      )}
      {activeTab === 'tracking' && (
        <TrackingHub propertySlug={propertySlug} />
      )}
      {activeTab === 'loyalty' && (
        <LoyaltyHub propertySlug={propertySlug} />
      )}
      {(activeTab === 'gift-cards' || activeTab === 'giftcards') && (
        <GiftCardsHub propertySlug={propertySlug} />
      )}
      {activeTab === 'reviews' && (
        <ReviewsHub propertySlug={propertySlug} />
      )}
      {(activeTab === 'recovery' || activeTab === 'support') && (
        <RecoveryHub propertySlug={propertySlug} />
      )}
      {activeTab === 'returns' && (
        <ReturnsHub propertySlug={propertySlug} />
      )}
      {activeTab === 'profile' && (
        <ProfileHub propertySlug={propertySlug} />
      )}
    </AccountShell>
  );
}
