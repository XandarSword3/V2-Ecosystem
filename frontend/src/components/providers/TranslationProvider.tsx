// File: frontend/src/components/providers/TranslationProvider.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTerminology } from '@/hooks/useTerminology';

interface TranslationContextType {
    translations: Record<string, Record<string, string>>;
    language: string;
    setLanguage: (lang: string) => void;
    translate: (namespace: string, key: string, fallback?: string) => string;
    loading: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState('en');
    const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);
    const { t: termT } = useTerminology(); // Inject terminology system

    useEffect(() => {
        const fetchTranslations = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/translations?lang=${language}`);
                if (response.ok) {
                    const { data } = await response.json();
                    setTranslations(data);
                }
            } catch (error) {
                console.error('Failed to load translations', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTranslations();
    }, [language]);

    /**
     * Main translation function
     * Handles namespace, key, and injects terminology via termT
     */
    const translate = (namespace: string, key: string, fallback?: string): string => {
        const value = translations[namespace]?.[key] || fallback || key;

        // Pass the translated string through the terminology engine
        // to replace placeholders like {unit_singular}
        return termT(value);
    };

    return (
        <TranslationContext.Provider value={{ translations, language, setLanguage, translate, loading }}>
            {children}
        </TranslationContext.Provider>
    );
}

export const useTranslation = () => {
    const context = useContext(TranslationContext);
    if (!context) throw new Error('useTranslation must be used within a TranslationProvider');
    return context;
};
