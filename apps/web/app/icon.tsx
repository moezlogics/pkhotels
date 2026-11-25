import { ImageResponse } from 'next/og';

/* The PakHotels mark as the favicon: a wine tile with a white bed. */
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#6d28d9', borderRadius: 16 }}>
        <svg width="44" height="44" viewBox="0 0 100 100">
          <path d="M18 76 V36 a5 5 0 0 1 10 0 V54 H80 a5 5 0 0 1 5 5 V76 a5 5 0 0 1 -10 0 V71 H28 V76 a5 5 0 0 1 -10 0 Z" fill="#ffffff" />
          <rect x="32" y="40" width="44" height="11" rx="5.5" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
