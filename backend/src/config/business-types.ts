// File: backend/src/config/business-types.ts

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

export const BUSINESS_TYPES: Record<string, BusinessTypeConfig> = {
    resort: {
        id: 'resort',
        name: 'Mountain or Beach Resort',
        description: 'Full-service resort with chalets, pool, and multiple dining areas.',
        terminologyOverrides: {
            unit_singular: 'Chalet',
            unit_plural: 'Chalets',
            facility_singular: 'Pool',
            facility_plural: 'Pools',
            dining_singular: 'Restaurant',
            dining_plural: 'Restaurants'
        },
        activeModules: ['chalets', 'pool', 'restaurant', 'snack-bar', 'housekeeping'],
        themeDefaults: {
            primaryColor: '#0c4a6e', // Oceanic Blue
            borderRadius: '0.75rem'
        }
    },
    hotel: {
        id: 'hotel',
        name: 'Boutique Hotel',
        description: 'City or boutique hotel focusing on rooms and dining.',
        terminologyOverrides: {
            unit_singular: 'Room',
            unit_plural: 'Rooms',
            facility_singular: 'Gym',
            facility_plural: 'Gyms',
            dining_singular: 'Dining Room',
            dining_plural: 'Dining Rooms'
        },
        activeModules: ['chalets', 'restaurant', 'housekeeping'], // Uses chalet backend as 'rooms'
        themeDefaults: {
            primaryColor: '#4c1d95', // Purple
            borderRadius: '0.5rem'
        }
    },
    restaurant: {
        id: 'restaurant',
        name: 'Standalone Restaurant',
        description: 'Restaurant or bar with table management and guest lists.',
        terminologyOverrides: {
            unit_singular: 'Table',
            unit_plural: 'Tables',
            facility_singular: 'Bar',
            facility_plural: 'Bars',
            dining_singular: 'Area',
            dining_plural: 'Areas'
        },
        activeModules: ['restaurant', 'waitlist'],
        themeDefaults: {
            primaryColor: '#991b1b', // Red
            borderRadius: '0.25rem'
        }
    },
    villa: {
        id: 'villa',
        name: 'Vacation Rental / Villa',
        description: 'Private villa or vacation home rental.',
        terminologyOverrides: {
            unit_singular: 'Villa',
            unit_plural: 'Villas',
            facility_singular: 'Private Pool',
            facility_plural: 'Private Pools',
            dining_singular: 'Kitchen',
            dining_plural: 'Kitchens'
        },
        activeModules: ['chalets', 'housekeeping'],
        themeDefaults: {
            primaryColor: '#166534', // Green
            borderRadius: '1rem'
        }
    }
};
