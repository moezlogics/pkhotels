import type { MetadataRoute } from 'next';

/* "Add to home screen" on Android opens PakHotels like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PakHotels — Hotels in Pakistan',
    short_name: 'PakHotels',
    description: 'Compare hotel room prices across Pakistan and book online.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'en-PK',
    icons: [
      { src: '/icon', sizes: '64x64', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
