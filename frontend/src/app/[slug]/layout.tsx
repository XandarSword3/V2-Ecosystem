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
      
      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </>
  );
}
