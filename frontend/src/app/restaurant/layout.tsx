import type { Metadata } from 'next';
import { JsonLd, generateRestaurantSchema, generateBreadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Fine Dining Restaurant | V2 Resort',
  description: 'Experience exquisite international cuisine at V2 Resort. Features fresh ingredients, stunning views, and an extensive wine list. Open for lunch and dinner.',
  keywords: ['fine dining', 'resort restaurant', 'V2 Resort dining', 'seafood', 'international cuisine'],
  openGraph: {
    title: 'Fine Dining Restaurant | V2 Resort',
    description: 'Experience exquisite international cuisine at V2 Resort. Book your table now.',
    type: 'website',
    url: 'https://v2-ecosystem.vercel.app/restaurant',
  },
};

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const restaurantSchema = generateRestaurantSchema({
    name: 'V2 Resort Restaurant',
    description: 'A premium dining destination offering authentic International cuisine with breathtaking views.',
    url: 'https://v2-ecosystem.vercel.app/restaurant',
    menuUrl: 'https://v2-ecosystem.vercel.app/restaurant/menu',
    cuisine: ['Mediterranean', 'International', 'Seafood'],
    priceRange: '$$$',
    telephone: '+1 234 567 8900', // Placeholder - should be configured in settings
    address: {
      street: 'Resort Main Building, Level 1',
      city: 'Resort Location',
      country: 'Country',
    },
    images: ['https://v2-ecosystem.vercel.app/images/restaurant-bg.jpg'],
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app' },
    { name: 'Restaurant', url: 'https://v2-ecosystem.vercel.app/restaurant' },
  ]);

  return (
    <>
      <JsonLd data={[restaurantSchema, breadcrumbSchema]} />
      
      {/* 
        Semantic HTML content for Bots/LLMs/Screen Readers
        Visually hidden but fully accessible to crawlers
      */}
      <div className="sr-only">
        <article>
          <h1>V2 Resort Fine Dining Restaurant</h1>
          <section>
            <h2>About Our Cuisine</h2>
            <p>
              Welcome to the V2 Resort Restaurant, where traditional flavors meet modern culinary techniques.
              Our chefs use only the freshest local ingredients to create memorable dining experiences.
            </p>
            <p>
              We are open for lunch and dinner, serving a wide variety of appetizers, main courses including premium steaks and fresh seafood,
              and handcrafted desserts.
            </p>
          </section>
          
          <section>
            <h2>Menu Highlights</h2>
            <ul>
              <li><strong>Signature Appetizers:</strong> Fresh salads, artisanal breads, and savory starters.</li>
              <li><strong>Premium Grills:</strong> Charcoal-grilled Steaks, Chops, and Skewers.</li>
              <li><strong>Fresh Seafood:</strong> Daily catch prepared to your liking.</li>
              <li><strong>International Specialties:</strong> Pasta, Burgers, and gourmet Salads.</li>
            </ul>
          </section>

          <section>
            <h2>Dining Experience</h2>
            <p>
              Enjoy your meal in our elegant indoor dining room or al fresco on our terrace with panoramic views of the resort and surrounding nature.
              Perfect for romantic dinners, family gatherings, and special celebrations.
            </p>
          </section>

          <address>
            <p><strong>Location:</strong> V2 Resort Main Building</p>
            <p><strong>Cuisine:</strong> International & Mediterranean</p>
            <p><strong>Service Options:</strong> Dine-in, Takeaway</p>
          </address>
        </article>
      </div>

      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </>
  );
}
