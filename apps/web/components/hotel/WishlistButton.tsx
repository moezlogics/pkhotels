'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getWishlist, toggleWishlist } from '@/lib/hotels-api';

/** Save a hotel on this device (shown on /tf-wishlist/). */
export default function WishlistButton({ slug, className, label = false }: { slug: string; className?: string; label?: boolean }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(getWishlist().includes(slug));
    sync();
    window.addEventListener('ph-wishlist', sync);
    return () => window.removeEventListener('ph-wishlist', sync);
  }, [slug]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove from saved hotels' : 'Save this hotel'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggleWishlist(slug);
        setOn(now);
        toast(now ? 'Saved to your list' : 'Removed from your list', {
          action: now ? { label: 'View', onClick: () => (window.location.href = '/saved') } : undefined,
        });
      }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full bg-white/95 text-neutral-700 shadow-sm ring-1 ring-black/5 transition hover:scale-105 active:scale-95',
        label ? 'h-9 px-3 text-sm font-medium' : 'h-9 w-9',
        className,
      )}
    >
      <Heart className={cn('h-[18px] w-[18px]', on && 'fill-ink text-ink')} />
      {label && <span>{on ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
