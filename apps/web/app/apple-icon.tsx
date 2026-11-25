import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#6d28d9' }}>
        <svg width="120" height="120" viewBox="0 0 100 100">
          <path d="M18 76 V36 a5 5 0 0 1 10 0 V54 H80 a5 5 0 0 1 5 5 V76 a5 5 0 0 1 -10 0 V71 H28 V76 a5 5 0 0 1 -10 0 Z" fill="#ffffff" />
          <rect x="32" y="40" width="44" height="11" rx="5.5" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
