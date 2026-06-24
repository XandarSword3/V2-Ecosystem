// File: frontend/src/hooks/useTerminology.ts

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface Terminology {
    unit_singular: string;
    unit_plural: string;
    facility_singular: string;
    facility_plural: string;
    dining_singular: string;
    dining_plural: string;
    [key: string]: string;
}

const DEFAULT_TERMS: Terminology = {
    unit_singular: 'Accommodation',
    unit_plural: 'Accommodations',
    facility_singular: 'Facility',
    facility_plural: 'Facilities',
    dining_singular: 'Dining',
    dining_plural: 'Dining Venues',
};

export function useTerminology() {
    const [terms, setTerms] = useState<Terminology>(DEFAULT_TERMS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTerminology = async () => {
            try {
                // Get business type from storage or default to 'hotel'
                const storedType = localStorage.getItem('v2-business-type');
                const businessType = storedType || 'hotel';

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
                const response = await api.get(`/terminology?business_type=${businessType}`);
                const { data } = response.data;
                setTerms({ ...DEFAULT_TERMS, ...data });
            } catch (error) {
                console.error('Failed to fetch terminology', error);
            } finally {
                setLoading(false);
            }
        };

        loadTerminology();

        // Listen for custom event to reload without page refresh
        const handleTypeChange = () => loadTerminology();
        window.addEventListener('businessTypeChange', handleTypeChange);

        return () => window.removeEventListener('businessTypeChange', handleTypeChange);
    }, []);

    /**
     * Helper to replace placeholders in strings
     * Example: t('Book a {unit_singular}') -> 'Book a Unit'
     */
    const t = (text: string): string => {
        return text.replace(/{(\w+)}/g, (match, key) => {
            return terms[key] || match;
        });
    };

    return {
        terms,
        t,
        loading
    };
}
