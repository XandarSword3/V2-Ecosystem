'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AccountShell } from '@/components/shells/AccountShell';
import PrivacyCenter from '@/components/PrivacyCenter';

export default function PrivacyCenterPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || '';

  return (
    <AccountShell propertySlug={propertySlug} activeTab="profile">
      <PrivacyCenter />
    </AccountShell>
  );
}
