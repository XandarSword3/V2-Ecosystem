'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { LoyaltyHub } from '@/components/customer/account/LoyaltyHub';

export default function CustomerLoyaltyPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="loyalty">
      <LoyaltyHub propertySlug={propertySlug} />
    </AccountShell>
  );
}
