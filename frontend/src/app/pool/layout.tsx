import { Metadata } from 'next';
import { JsonLd, generatePoolSchema, generateBreadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Swimming Pool | V2 Resort',
  description: 'Refreshing swimming pool experience at V2 Resort Lebanon. Multiple daily sessions, family-friendly environment, competitive pricing for adults and children.',
  keywords: ['swimming pool', 'Lebanon resort', 'V2 Resort', 'pool sessions', 'family pool', 'pool tickets'],
  openGraph: {
    title: 'Swimming Pool | V2 Resort',
    description: 'Refreshing swimming pool experience at V2 Resort Lebanon. Book your pool session today!',
    type: 'website',
    url: 'https://v2-ecosystem.vercel.app/pool',
  },
};

export default function PoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const poolSchema = generatePoolSchema({
    name: 'V2 Resort Swimming Pool',
    description: 'Refreshing swimming pool experience at V2 Resort. Multiple daily sessions available with family-friendly options.',
    url: 'https://v2-ecosystem.vercel.app/pool',
    priceRange: '$$',
    openingHours: 'Mo-Su 09:00-20:00',
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app/' },
    { name: 'Pool', url: 'https://v2-ecosystem.vercel.app/pool' },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data for SEO - rendered server-side */}
      <JsonLd data={[poolSchema, breadcrumbSchema]} />
      
      {/* Static content for bots/LLMs - hidden when JS runs, visible in raw HTML */}
      <div id="static-pool-content" className="sr-only">
        <h1>V2 Resort Swimming Pool</h1>
        <p>Experience our refreshing swimming pool at V2 Resort in Lebanon. We offer multiple daily pool sessions suitable for all ages.</p>
        
        <h2>Pool Features</h2>
        <ul>
          <li>Clean, refreshing water maintained daily</li>
          <li>Multiple sessions throughout the day</li>
          <li>Family-friendly environment</li>
          <li>Poolside amenities available</li>
          <li>Separate adult and child pricing</li>
          <li>Lifeguard on duty</li>
        </ul>
        
        <h2>How to Book</h2>
        <ol>
          <li>Select your preferred date</li>
          <li>Choose an available session time</li>
          <li>Enter number of adults and children</li>
          <li>Provide contact information</li>
          <li>Complete your booking</li>
        </ol>
        
        <h2>Session Information</h2>
        <p>We offer multiple pool sessions daily. Each session has a maximum capacity to ensure a comfortable experience for all guests. Sessions typically run in the morning, afternoon, and evening.</p>
        
        <h2>Pricing</h2>
        <p>Pool entry includes access for the full session duration. Special rates for children available. Weekend sessions may have different pricing. Contact us for current rates.</p>
        
        <h2>Amenities</h2>
        <ul>
          <li>Changing rooms and showers</li>
          <li>Poolside seating and umbrellas</li>
          <li>Snack bar nearby</li>
          <li>Towel service available</li>
        </ul>
        
        <h2>Contact</h2>
        <p>For pool reservations or inquiries:</p>
        <p>Email: info@v2resort.com</p>
        <p>Phone: +961 XX XXX XXX</p>
        <p>Address: 123 Lane, Lebanon</p>
        
        <nav>
          <a href="/">Home</a> | 
          <a href="/restaurant">Restaurant</a> | 
          <a href="/chalets">Chalets</a> | 
          <a href="/snack-bar">Snack Bar</a>
        </nav>
      </div>
      
      {/* Interactive client component renders here */}
      {children}
    </>
  );
}
