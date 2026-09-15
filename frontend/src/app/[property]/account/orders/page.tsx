'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { OrdersHub } from '@/components/customer/account/OrdersHub';

export default function AccountOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="orders">
      <OrdersHub
        propertySlug={propertySlug}
        onNavigateTab={(tab) => {
          router.push(`/${propertySlug}/account/${tab === 'support' ? 'recovery' : tab}`);
        }}
      />
    </AccountShell>
  );
}
