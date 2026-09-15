'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import { TrackingHub } from '@/components/customer/account/TrackingHub';

export default function AccountTrackingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const propertySlug = (params?.property as string) || '';
  const orderId = searchParams?.get('orderId') || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="tracking">
      <TrackingHub propertySlug={propertySlug} initialOrderId={orderId} />
    </AccountShell>
  );
}
