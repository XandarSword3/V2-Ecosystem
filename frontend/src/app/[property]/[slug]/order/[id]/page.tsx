'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CustomerShell } from '@/components/shells/CustomerShell';
import { OrderTracking } from '@/components/customer/OrderTracking';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { CardSkeleton } from '@/components/ui/Skeleton';

function OrderTrackingContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const propertySlug = (params?.property as string) || '';
  const rawSlug = params?.slug;
  const moduleSlug = Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug as string) || '';
  const rawId = params?.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || '';
  const token = searchParams.get('token') || undefined;

  return (
    <CustomerShell>
      <Section className="py-10">
        <Container size="md">
          <OrderTracking
            orderId={orderId}
            moduleSlug={moduleSlug}
            propertySlug={propertySlug}
            token={token}
          />
        </Container>
      </Section>
    </CustomerShell>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto p-8 space-y-4">
          <CardSkeleton />
        </div>
      }
    >
      <OrderTrackingContent />
    </Suspense>
  );
}
