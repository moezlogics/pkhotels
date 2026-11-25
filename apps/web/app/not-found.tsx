import Link from 'next/link';

/* 404: a way back in, not a dead end. Old WordPress links that no longer exist land here. */
const LINKS = [
  { href: '/hotels', label: 'All hotels' },
  { href: '/hotels/lahore', label: 'Hotels in Lahore' },
  { href: '/hotels/islamabad', label: 'Hotels in Islamabad' },
  { href: '/hotels/karachi', label: 'Hotels in Karachi' },
  { href: '/trips', label: 'My trips' },
  { href: '/', label: 'Home' },
];

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="max-w-lg">
        <p className="text-[15px] font-medium text-neutral-500">Error 404</p>
        <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-ink">We could not find that page</h1>
        <p className="mt-2 text-[17px] text-neutral-600">The link may be old, or the hotel may no longer be listed. These will get you going again:</p>
        <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center justify-between py-3.5 text-[17px] text-ink hover:text-ink">
                {l.label}
                <span aria-hidden className="text-neutral-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
