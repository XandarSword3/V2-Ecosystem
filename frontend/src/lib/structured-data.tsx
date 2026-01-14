/**
 * JSON-LD Structured Data for SEO and AI Bot Readability
 * These schemas help search engines and LLMs understand the site content
 * See: https://schema.org/
 */

export interface ResortSchemaProps {
  name: string;
  description: string;
  url: string;
  telephone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  images?: string[];
  priceRange?: string;
  openingHours?: string[];
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

export function generateResortSchema(props: ResortSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Resort',
    name: props.name,
    description: props.description,
    url: props.url,
    telephone: props.telephone,
    email: props.email,
    address: props.address ? {
      '@type': 'PostalAddress',
      streetAddress: props.address.street,
      addressLocality: props.address.city,
      addressRegion: props.address.region,
      postalCode: props.address.postalCode,
      addressCountry: props.address.country || 'LB',
    } : undefined,
    image: props.images,
    priceRange: props.priceRange,
    openingHoursSpecification: props.openingHours?.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: hours.split('-')[0]?.trim(),
      closes: hours.split('-')[1]?.trim(),
    })),
    aggregateRating: props.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: props.aggregateRating.ratingValue,
      reviewCount: props.aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Restaurant', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Chalets', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Snack Bar', value: true },
    ],
  };
}

export interface RestaurantSchemaProps {
  name: string;
  description: string;
  url: string;
  menuUrl?: string;
  telephone?: string;
  cuisine?: string[];
  priceRange?: string;
  address?: ResortSchemaProps['address'];
  images?: string[];
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

export function generateRestaurantSchema(props: RestaurantSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: props.name,
    description: props.description,
    url: props.url,
    menu: props.menuUrl,
    telephone: props.telephone,
    servesCuisine: props.cuisine || ['Lebanese', 'Mediterranean'],
    priceRange: props.priceRange || '$$',
    address: props.address ? {
      '@type': 'PostalAddress',
      streetAddress: props.address.street,
      addressLocality: props.address.city,
      addressRegion: props.address.region,
      postalCode: props.address.postalCode,
      addressCountry: props.address.country || 'LB',
    } : undefined,
    image: props.images,
    aggregateRating: props.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: props.aggregateRating.ratingValue,
      reviewCount: props.aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    acceptsReservations: 'True',
    hasMenu: {
      '@type': 'Menu',
      url: props.menuUrl,
    },
  };
}

export interface MenuItemSchemaProps {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string;
  category?: string;
  nutrition?: {
    calories?: number;
  };
  suitableForDiet?: ('VegetarianDiet' | 'VeganDiet' | 'GlutenFreeDiet')[];
}

export function generateMenuItemSchema(props: MenuItemSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: props.name,
    description: props.description,
    offers: {
      '@type': 'Offer',
      price: props.price,
      priceCurrency: props.currency || 'USD',
    },
    image: props.image,
    menuAddOn: props.category,
    nutrition: props.nutrition ? {
      '@type': 'NutritionInformation',
      calories: `${props.nutrition.calories} calories`,
    } : undefined,
    suitableForDiet: props.suitableForDiet?.map(diet => `https://schema.org/${diet}`),
  };
}

export interface AccommodationSchemaProps {
  name: string;
  description?: string;
  url: string;
  images?: string[];
  numberOfBedrooms?: number;
  numberOfBathroomsTotal?: number;
  occupancy?: number;
  amenities?: string[];
  priceRange?: string;
  basePrice?: number;
  currency?: string;
}

export function generateChaletSchema(props: AccommodationSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: props.name,
    description: props.description,
    url: props.url,
    image: props.images,
    numberOfBedrooms: props.numberOfBedrooms,
    numberOfBathroomsTotal: props.numberOfBathroomsTotal,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: props.occupancy,
    },
    amenityFeature: props.amenities?.map(amenity => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
    priceRange: props.priceRange,
    offers: props.basePrice ? {
      '@type': 'Offer',
      price: props.basePrice,
      priceCurrency: props.currency || 'USD',
      availability: 'https://schema.org/InStock',
    } : undefined,
  };
}

export interface PoolSchemaProps {
  name: string;
  description?: string;
  url: string;
  images?: string[];
  openingHours?: string;
  priceRange?: string;
}

export function generatePoolSchema(props: PoolSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: props.name,
    description: props.description,
    url: props.url,
    image: props.images,
    openingHours: props.openingHours,
    priceRange: props.priceRange,
    sport: 'Swimming',
  };
}

export interface SnackBarSchemaProps {
  name: string;
  description?: string;
  url: string;
  images?: string[];
  priceRange?: string;
  menuItems?: Array<{
    name: string;
    description?: string;
    price: number;
    category: string;
  }>;
}

export function generateSnackBarSchema(props: SnackBarSchemaProps): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FastFoodRestaurant',
    name: props.name,
    description: props.description,
    url: props.url,
    image: props.images,
    priceRange: props.priceRange || '$',
    servesCuisine: ['Snacks', 'Fast Food', 'Beverages'],
    hasMenu: props.menuItems ? {
      '@type': 'Menu',
      hasMenuSection: [
        {
          '@type': 'MenuSection',
          name: 'Menu Items',
          hasMenuItem: props.menuItems.map(item => ({
            '@type': 'MenuItem',
            name: item.name,
            description: item.description,
            offers: {
              '@type': 'Offer',
              price: item.price,
              priceCurrency: 'USD',
            },
          })),
        },
      ],
    } : undefined,
  };
}

// Component to render JSON-LD script tag
export function JsonLd({ data }: { data: object | object[] }): JSX.Element {
  const jsonLd = Array.isArray(data) 
    ? data.map(item => JSON.stringify(item)).join('')
    : JSON.stringify(data);
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}

// Breadcrumb schema for navigation
export function generateBreadcrumbSchema(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// FAQ schema for common questions
export function generateFAQSchema(questions: { question: string; answer: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}
