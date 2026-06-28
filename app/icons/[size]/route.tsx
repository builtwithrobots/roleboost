import { ImageResponse } from 'next/og';

// Code-generated app icons (no binary assets in the repo). Serves the RoleBoost
// mark, a white "R" on brand amber, at the sizes the manifest + metadata ask
// for. Full-bleed so it reads correctly when a platform applies a maskable crop.
export const dynamic = 'force-static';

const ALLOWED = new Set([32, 48, 180, 192, 256, 512]);

export function generateStaticParams() {
  return [{ size: '32' }, { size: '180' }, { size: '192' }, { size: '512' }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const n = Number(raw);
  const size = ALLOWED.has(n) ? n : 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#D97706',
          color: '#FFFFFF',
          fontSize: Math.round(size * 0.6),
          fontWeight: 800,
          fontFamily: 'sans-serif',
          lineHeight: 1,
        }}
      >
        R
      </div>
    ),
    { width: size, height: size },
  );
}
