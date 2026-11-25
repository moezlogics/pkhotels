import { ImageResponse } from 'next/og';

/* The share card for pages that have no photo of their own. */
export const alt = 'PakHotels — book hotels across Pakistan at real prices';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#ffffff', padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="50" height="50" viewBox="0 0 100 100">
              <path d="M18 76 V36 a5 5 0 0 1 10 0 V54 H80 a5 5 0 0 1 5 5 V76 a5 5 0 0 1 -10 0 V71 H28 V76 a5 5 0 0 1 -10 0 Z" fill="#ffffff" />
              <rect x="32" y="40" width="44" height="11" rx="5.5" fill="#ffffff" />
            </svg>
          </div>
          <span style={{ fontSize: 44, fontWeight: 700, color: '#1c1033' }}>PakHotels</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 76, fontWeight: 700, color: '#1c1033', lineHeight: 1.05, letterSpacing: -2 }}>Hotels across Pakistan.</span>
          <span style={{ fontSize: 76, fontWeight: 700, color: '#1c1033', lineHeight: 1.05, letterSpacing: -2 }}>Real prices. Real reviews.</span>
        </div>
        <span style={{ fontSize: 30, color: '#6b6480' }}>Lahore, Islamabad, Karachi, Multan and more  |  pakhotels.pk</span>
      </div>
    ),
    size,
  );
}
