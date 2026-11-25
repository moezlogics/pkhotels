import { Metadata, ResolvingMetadata } from 'next';
import BlogGrid from '@/components/BlogGrid';
import blogCategoryApi from '@/lib/api/blog-category/blog-category.api';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

/* Rendered on first visit, then cached; refreshed every 10 minutes and when posts change. */
export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata(
  props: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await props.params;

  try {
    const category = await blogCategoryApi.getCategoryBySlug(slug);

    if (!category) return {};

    const title = category.metaTitle?.trim() || `${category.name}: Renting Guides & Tips | PakHotels`;
    const description =
      category.metaDescription?.trim() ||
      category.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 160) ||
      `${category.name} articles on PakHotels: guides and tips for renting houses, portions, flats and rooms in Pakistan.`;
    const canonical = category.canonicalUrl || `/blog/category/${slug}`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, type: 'website', siteName: 'PakHotels' },
    };
  } catch (error) {
    return {
      title: { absolute: 'Travel Guides & Hotel Tips | PakHotels' },
    };
  }
}

export default async function BlogCategoryPage(props: PageProps) {
  const { slug } = await props.params;
  let category = null;

  try {
    category = await blogCategoryApi.getCategoryBySlug(slug);
  } catch (error: any) {
    // A category that does not exist is a 404, not an empty page; an API that is down keeps the cached page.
    if (Number(error?.response?.status) === 404) notFound();
    throw error;
  }
  if (!category) notFound();

  return (
    <div className="min-h-screen">
      {/* Blog Page Header */}
      <div className="pt-8 pb-8 bg-neutral-50 border-b border-border">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-4">
            {category?.name || 'Blog Category'}
          </h1>
          {category?.description && (
            <div
              className="mt-6 prose prose-sm max-w-4xl text-muted-foreground prose-headings:text-foreground prose-a:text-ink"
              dangerouslySetInnerHTML={{ __html: category.description }}
            />
          )}
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink"></div>
        </div>
      }>
        <BlogGrid initialCategory={category?.name} />
      </Suspense>
    </div>
  );
}
