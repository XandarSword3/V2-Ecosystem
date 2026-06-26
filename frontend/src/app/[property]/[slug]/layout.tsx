import type { Metadata } from 'next';
import { JsonLd, generateBreadcrumbSchema } from '@/lib/structured-data';
import { ThemeInjector } from '@/components/ThemeInjector';

// Dynamic metadata generation based on slug
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    title: `${title} | V2 Ecosystem`,
    description: `Explore ${title} at V2 Ecosystem. Browse offerings, make reservations, and enjoy a premium experience.`,
    keywords: [slug, 'V2 Ecosystem', title, 'booking', 'booking experience'],
    openGraph: {
      title: `${title} | V2 Ecosystem`,
      description: `Explore ${title} at V2 Ecosystem. Book now for an unforgettable experience.`,
      type: 'website',
      url: `https://v2-ecosystem.vercel.app/${slug}`,
    },
  };
}

export default async function SlugModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app' },
    { name: title, url: `https://v2-ecosystem.vercel.app/${slug}` },
  ]);

  return (
    <>
      <JsonLd data={[breadcrumbSchema]} />
      {/* Inject brand CSS variables for this property's guest-facing pages.
          ThemeInjector is a 'use client' component — Next.js handles the
          server/client boundary automatically. Without this, the operator's
          colors and fonts configured on the brand settings page are silently
          ignored on all [slug] routes. */}
      <ThemeInjector />

      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    </>
  );
}
