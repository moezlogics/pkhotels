'use client';

import { useEffect, useState } from 'react';
import { addRecentHotel, type RecentHotel } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

/** Remembers this hotel for "Recently viewed" on the home page. */
export function RecordView({ hotel }: { hotel: RecentHotel }) {
  useEffect(() => {
    addRecentHotel(hotel);
  }, [hotel]);
  return null;
}

/** Section tabs that stay under the top of the screen and follow the scroll. */
export function SectionTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tabs]);

  return (
    <nav aria-label="Sections" className="sticky top-0 z-30 border-b border-neutral-200 bg-white md:top-16">
      <div className="no-scrollbar container mx-auto flex gap-1 overflow-x-auto px-2 md:px-4">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={cn(
              'relative shrink-0 px-3 py-3 text-[15px] font-semibold transition-colors',
              active === t.id ? 'text-ink' : 'text-neutral-500 hover:text-ink',
            )}
          >
            {t.label}
            {active === t.id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-primary" />}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Long text that opens on tap. */
export function ReadMore({ html, lines = 6 }: { html: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        className={cn('prose prose-slate max-w-none text-[16px] leading-relaxed text-neutral-700 [&_p]:mb-3', !open && 'overflow-hidden')}
        style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-[15px] font-semibold text-ink">
        {open ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

/** A list that shows a few items and opens to all. */
export function ShowAll({ count, children, initial }: { count: number; initial: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? children : initial}
      {count > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-4 h-11 w-full rounded-full border border-neutral-300 text-[15px] font-semibold text-ink hover:bg-neutral-50 md:w-auto md:px-5">
          {open ? 'Show less' : `Show all ${count}`}
        </button>
      )}
    </>
  );
}
