'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { ReviewsHub } from '@/components/customer/account/ReviewsHub';

export default function AccountReviewsPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="reviews">
      <ReviewsHub propertySlug={propertySlug} />
    </AccountShell>
  );
}
