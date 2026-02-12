import type { Metadata } from 'next';
import { JsonLd, generateBreadcrumbSchema } from '@/lib/structured-data';

// Dynamic metadata generation based on slug
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return {
    title: `${title} | V2 Resort`,
    description: `Explore ${title} at V2 Resort. Browse offerings, make reservations, and enjoy a premium experience.`,
    keywords: [slug, 'V2 Resort', title, 'booking', 'resort experience'],
    openGraph: {
      title: `${title} | V2 Resort`,
      description: `Explore ${title} at V2 Resort. Book now for an unforgettable experience.`,
      type: 'website',
      url: `https://v2-ecosystem.vercel.app/${slug}`,
    },
  };
}

export default function SlugModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const slug = params.slug;
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app' },
    { name: title, url: `https://v2-ecosystem.vercel.app/${slug}` },
  ]);

  return (
    <>
      <JsonLd data={[breadcrumbSchema]} />
      
      {/* Semantic HTML content for Bots/LLMs/Screen Readers */}
      <div className="sr-only">
        <article>
          <h1>{title} at V2 Resort</h1>
          <section>
            <h2>About {title}</h2>
            <p>
              Welcome to {title} at V2 Resort. We offer a premium experience with 
              online booking, real-time availability, and seamless service.
            </p>
          </section>
          
          <section>
            <h2>How to Book</h2>
            <ol>
              <li>Browse available offerings</li>
              <li>Select your preferred option</li>
              <li>Enter your details</li>
              <li>Complete your booking</li>
            </ol>
          </section>

          <section>
            <h2>Service Options</h2>
            <ul>
              <li>Online Booking</li>
              <li>Walk-in Service</li>
              <li>Cash and Card Payment</li>
            </ul>
          </section>

          <nav>
            <a href="/">Home</a> | 
            <a href={`/${slug}`}>{title}</a> | 
            <a href={`/${slug}/cart`}>Cart</a> | 
            <a href={`/${slug}/reserve`}>Reservations</a>
          </nav>
        </article>
      </div>

      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </>
  );
}
