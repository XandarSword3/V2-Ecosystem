// File: frontend/src/lib/structured-data-generator.ts

/**
 * Business type configuration for Schema.org structured data
 * Duplicated from backend to avoid cross-package imports in Vercel builds
 */
export interface BusinessTypeConfig {
    id: string;
    name: string;
    description: string;
    terminologyOverrides: Record<string, string>;
    activeModules: string[];
    themeDefaults: {
        primaryColor: string;
        borderRadius: string;
    };
}

export function generateLocalBusinessSchema(
    businessName: string,
    businessType: string,
    config: any, // Site configuration
    terms: any   // Current terminology
) {
    // Schema.org type is config-driven; no hardcoded business type assumptions
    const schemaType = config.schemaType || 'LocalBusiness';

    const schema: any = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        'name': businessName,
        'description': config.description || `Welcome to ${businessName}, your premium ${terms.unit_singular} provider.`,
        'url': config.url || 'https://example.com',
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': config.address,
            'addressLocality': config.city,
            'addressRegion': config.region,
            'addressCountry': config.country,
        },
        'telephone': config.phone,
    };

    // Cuisine info is config-driven — applies to any module that serves food
    if (config.cuisine) {
        schema.servesCuisine = config.cuisine;
        if (config.url) schema.menu = `${config.url}/menu`;
    }

    if (config.amenityFeature !== false && terms.facility_plural) {
        schema.amenityFeature = [
            {
                '@type': 'LocationFeatureSpecification',
                'name': terms.facility_plural,
                'value': true,
            },
        ];
    }

    return schema;
}

export function generateProductSchema(item: any, terms: any) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': item.name,
        'description': item.description,
        'offers': {
            '@type': 'Offer',
            'price': item.base_price,
            'priceCurrency': 'USD',
            'availability': 'https://schema.org/InStock',
        },
    };
}
