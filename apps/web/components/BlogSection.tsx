'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { blogApi } from '@/lib/api';
import { transformBlogsToPosts, BlogPost } from '@/lib/utils/blog-utils';
import { Blog } from '@/lib/types/blog';
import { SectionHeading } from '@/components/SectionHeading';

/*
 * The four newest articles, as a plain grid.
 *
 * Before: a carousel of tall cards with 24px corners, photos that zoomed to
 * 110% on hover, a shadow that bloomed to 50px, a black pill eyebrow, a 48px
 * headline and 56px arrow buttons floating outside the page margin. An
 * article list does not need to move — a reader scans four headlines and
 * picks one. This is how news and portal sites lay it out.
 */

interface BlogSectionProps {
  initialPosts?: BlogPost[];
}

const SHOWN = 4;

export default function BlogSection({ initialPosts }: BlogSectionProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts ?? []);
  const [loading, setLoading] = useState(!initialPosts);

  useEffect(() => {
    if (initialPosts) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await blogApi.getPublishedBlogs();
        if (!cancelled) setPosts(transformBlogsToPosts(response as Blog[]).slice(0, SHOWN));
      } catch (error) {
        console.error('Error fetching blogs:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPosts]);

  if (!loading && posts.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <SectionHeading
          eyebrow="Travel guides"
          title={<>Plan your <span className="mark">trip</span></>}
          description="Where to stay, what to see and what to pack — across Pakistan."
          href="/blog"
          hrefLabel="All guides"
        />

        <div className="-mx-[var(--gutter)] flex snap-x scroll-px-4 snap-mandatory gap-3 overflow-x-auto px-[var(--gutter)] pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 hide-scrollbar">
          {(loading ? [] : posts.slice(0, SHOWN)).map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block w-[78%] shrink-0 snap-start sm:w-auto"
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-neutral-200">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              {post.category && (
                <p className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink ring-1 ring-[color:var(--border)]">
                  {post.category}
                </p>
              )}
              <h3 className="mt-1 font-display line-clamp-2 text-[18px] font-semibold leading-snug text-ink group-hover:underline">
                {post.title}
              </h3>
              <p className="mt-1.5 text-[13.5px] text-neutral-500">
                {post.date}
                {post.readTime ? ` · ${post.readTime}` : ''}
              </p>
            </Link>
          ))}

          {loading &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[78%] shrink-0 sm:w-auto">
                <div className="aspect-[16/10] animate-pulse rounded-[20px] bg-neutral-200" />
                <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
