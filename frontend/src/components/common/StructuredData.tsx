// File: frontend/src/components/common/StructuredData.tsx
'use client';

import React from 'react';
import Script from 'next/script';
import { generateLocalBusinessSchema } from '@/lib/structured-data-generator';
import { useTerminology } from '@/hooks/useTerminology';

interface StructuredDataProps {
    businessName: string;
    businessType: string;
    config: any;
}

export function StructuredData({ businessName, businessType, config }: StructuredDataProps) {
    const { terms } = useTerminology();

    const schema = generateLocalBusinessSchema(
        businessName,
        businessType,
        config,
        terms
    );

    return (
        <Script
            id="structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    );
}
