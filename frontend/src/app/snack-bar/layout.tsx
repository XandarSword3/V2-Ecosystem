import { Metadata } from 'next';
import { JsonLd, generateSnackBarSchema, generateBreadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Snack Bar | V2 Resort',
  description: 'Quick bites and refreshing beverages at V2 Resort. Sandwiches, drinks, snacks, and ice cream available poolside.',
  keywords: ['snack bar', 'resort', 'V2 Resort', 'poolside snacks', 'drinks', 'ice cream', 'sandwiches'],
  openGraph: {
    title: 'Snack Bar | V2 Resort',
    description: 'Quick bites and refreshing beverages at V2 Resort. Perfect for a poolside snack!',
    type: 'website',
    url: 'https://v2-ecosystem.vercel.app/snack-bar',
  },
};

export default function SnackBarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const snackBarSchema = generateSnackBarSchema({
    name: 'V2 Resort Snack Bar',
    description: 'Quick bites and refreshing beverages at V2 Resort. Sandwiches, drinks, snacks, and ice cream available poolside.',
    url: 'https://v2-ecosystem.vercel.app/snack-bar',
    priceRange: '$',
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app/' },
    { name: 'Snack Bar', url: 'https://v2-ecosystem.vercel.app/snack-bar' },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data for SEO - rendered server-side */}
      <JsonLd data={[snackBarSchema, breadcrumbSchema]} />
      
      {/* Static content for bots/LLMs - hidden when JS runs, visible in raw HTML */}
      <div id="static-snackbar-content" className="sr-only">
        <h1>V2 Resort Snack Bar</h1>
        <p>Quick bites and refreshing beverages at V2 Resort. Perfect for a poolside snack or light meal.</p>
        
        <h2>Menu Categories</h2>
        
        <h3>Sandwiches</h3>
        <p>Fresh, delicious sandwiches made to order. Choose from a variety of fillings including chicken, beef, vegetables, and cheese.</p>
        
        <h3>Drinks</h3>
        <p>Cold beverages and refreshments including fresh juices, soft drinks, water, and specialty drinks to keep you cool.</p>
        
        <h3>Snacks</h3>
        <p>Light bites and appetizers perfect for sharing. Chips, fries, and other quick snacks available.</p>
        
        <h3>Ice Cream</h3>
        <p>Cool treats for hot days. Various flavors of ice cream and frozen desserts to satisfy your sweet tooth.</p>
        
        <h2>About Our Snack Bar</h2>
        <p>Located poolside at V2 Resort for your convenience. Our snack bar offers quick service so you can get back to enjoying the pool. All items are prepared fresh and available for immediate pickup or poolside delivery.</p>
        
        <h2>Hours</h2>
        <p>Open during pool hours for your convenience.</p>
        
        <h2>Ordering</h2>
        <p>Browse our menu online, add items to your cart, and place your order. Payment accepted in cash or card upon pickup.</p>
        
        <h2>Contact</h2>
        <p>For snack bar inquiries:</p>
        <p>Email: bookings@v2resort.com</p>
        <p>Phone: +1 234 567 8900</p>
        <p>Address: 123 Resort Boulevard, Global City</p>
        
        <nav>
          <a href="/">Home</a> | 
          <a href="/restaurant">Restaurant</a> | 
          <a href="/chalets">Chalets</a> | 
          <a href="/pool">Pool</a>
        </nav>
      </div>
      
      {/* Interactive client component renders here */}
      {children}
    </>
  );
}
