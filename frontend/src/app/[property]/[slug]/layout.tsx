import type { Metadata } from 'next';
import { JsonLd, generateBreadcrumbSchema } from '@/lib/structured-data';
import { CustomerShell } from '@/components/shells/CustomerShell';

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

interface SlugLayoutProps {
  children: React.ReactNode;
  params: Promise<{ property: string; slug: string }>;
}

// Dynamic metadata generation based on request params
export async function generateMetadata({ params }: { params: Promise<{ property: string; slug: string }> }): Promise<Metadata> {
  const { property, slug } = await params;
  const decodedSlug = decodeURIComponent(slug || '');
  const title = decodedSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const baseUrl = getAppBaseUrl();
  const canonicalUrl = `${baseUrl}/${property}/${slug}`;

  return {
    title: `${title} | V2 Ecosystem`,
    description: `Explore ${title} at V2 Ecosystem. Browse offerings, make reservations, and enjoy a premium experience.`,
    keywords: [decodedSlug, property, 'V2 Ecosystem', title, 'commerce', 'experience'],
    openGraph: {
      title: `${title} | V2 Ecosystem`,
      description: `Explore ${title} at V2 Ecosystem.`,
      type: 'website',
      url: canonicalUrl,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function SlugModuleLayout({
  children,
  params,
}: SlugLayoutProps) {
  const { property, slug } = await params;
  const decodedSlug = decodeURIComponent(slug || '');
  const title = decodedSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const baseUrl = getAppBaseUrl();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: `${baseUrl}/${property}` },
    { name: title, url: `${baseUrl}/${property}/${slug}` },
  ]);

  return (
    <>
      <JsonLd data={[breadcrumbSchema]} />
      <CustomerShell>
        {children}
      </CustomerShell>
    </>
  );
}
