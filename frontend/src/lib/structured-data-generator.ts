// File: frontend/src/lib/structured-data-generator.ts
import { BusinessTypeConfig } from '../../../backend/src/config/business-types'; // Assume shared or copied

export function generateLocalBusinessSchema(
    businessName: string,
    businessType: string,
    config: any, // Site configuration
    terms: any   // Current terminology
) {
    let schemaType = 'LocalBusiness';

    if (businessType === 'resort') schemaType = 'Resort';
    if (businessType === 'hotel') schemaType = 'Hotel';
    if (businessType === 'restaurant') schemaType = 'Restaurant';

    const schema: any = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        'name': businessName,
        'description': config.description || `Welcome to ${businessName}, your premium ${terms.unit_singular} provider.`,
        'url': config.url || 'https://ironparadisegym.com',
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': config.address,
            'addressLocality': config.city,
            'addressRegion': config.region,
            'addressCountry': config.country,
        },
        'telephone': config.phone,
    };

    if (businessType === 'restaurant') {
        schema.servesCuisine = config.cuisine || 'International';
        schema.menu = `${config.url}/menu`;
    }

    if (businessType === 'resort' || businessType === 'hotel') {
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
