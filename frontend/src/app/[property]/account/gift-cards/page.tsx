'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { GiftCardsHub } from '@/components/customer/account/GiftCardsHub';

export default function AccountGiftCardsSubPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="gift-cards">
      <GiftCardsHub propertySlug={propertySlug} />
    </AccountShell>
  );
}
