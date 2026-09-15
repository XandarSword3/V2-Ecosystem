'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { ReturnsHub } from '@/components/customer/account/ReturnsHub';

export default function AccountReturnsPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="returns">
      <ReturnsHub propertySlug={propertySlug} />
    </AccountShell>
  );
}
