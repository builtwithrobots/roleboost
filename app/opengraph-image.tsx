import { ImageResponse } from 'next/og';

// Site-wide social share image (Open Graph). Generated at build time, so there
// is no static asset to maintain; child routes inherit it unless they define
// their own. Uses only inline styles and a system font, so it needs no network.
export const alt = 'RoleBoost: Your career. Your AI. Finally heard.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#FFFBF5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: '#D97706' }} />
          <div style={{ fontSize: 34, fontWeight: 700, color: '#1E3A5F', letterSpacing: -0.5 }}>
            RoleBoost
          </div>
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            color: '#1E3A5F',
            lineHeight: 1.08,
            letterSpacing: -1.5,
          }}
        >
          Your career. Your AI. Finally heard.
        </div>
        <div style={{ fontSize: 33, color: '#4B5563', marginTop: 34, lineHeight: 1.4 }}>
          A shareable AI candidate profile recruiters can interrogate 24/7, plus audio, video, and
          infographic Boosts.
        </div>
      </div>
    ),
    { ...size },
  );
}
