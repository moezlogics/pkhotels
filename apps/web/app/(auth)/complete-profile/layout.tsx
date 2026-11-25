import type { Metadata } from 'next';

/* An account step after Google sign-in: nothing here for search. */
export const metadata: Metadata = {
  title: 'Complete your profile | PakHotels',
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
