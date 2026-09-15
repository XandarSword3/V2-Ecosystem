'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { RecoveryHub } from '@/components/customer/account/RecoveryHub';

export default function AccountSupportPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="recovery">
      <RecoveryHub propertySlug={propertySlug} />
    </AccountShell>
  );
}
