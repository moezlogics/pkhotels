import { isSegment } from '@/lib/hotels';

/**
 * A hotel page (/hotels/<city>/<hotel>) opens full-bleed on phones, photo to
 * the top edge; the header and tab bar step aside. /hotels/<city>/<segment>
 * (5-star, guest-houses…) is a results page, not a hotel.
 */
export function isPropertyDetail(pathname: string): boolean {
  const m = /^\/hotels\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  return Boolean(m && !isSegment(m[2]!));
}
