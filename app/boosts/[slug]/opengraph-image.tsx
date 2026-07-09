import { ImageResponse } from 'next/og';
import { FEATURED_PERSONAS, getPersona } from '@/lib/boosts/personas';

// A per-persona social card, so a shared /boosts/[slug] link previews the actual
// candidate (monogram, name, role, career stage) instead of the generic site
// card. Generated with next/og; prerendered for the known personas below.
export const alt = 'A RoleBoost candidate example, shown through three Boosts.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return FEATURED_PERSONAS.map((persona) => ({ slug: persona.slug }));
}

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const persona = getPersona(slug);

  const name = persona?.name ?? 'RoleBoost';
  const role = persona?.role ?? 'AI candidate profiles, finally heard';
  const stage = persona?.careerStage ?? 'Every kind of career';
  const initials = persona?.initials ?? 'RB';
  const avatarColor = persona?.avatarColor ?? '#1E3A5F';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 26, height: 26, borderRadius: 9999, backgroundColor: '#D97706' }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: '#1E3A5F', letterSpacing: -0.5 }}>
            RoleBoost
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 34, marginTop: 64 }}>
          <div
            style={{
              display: 'flex',
              width: 132,
              height: 132,
              borderRadius: 9999,
              backgroundColor: avatarColor,
              color: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 66, fontWeight: 800, color: '#1E3A5F', letterSpacing: -1 }}>
              {name}
            </div>
            <div style={{ fontSize: 34, color: '#4B5563', marginTop: 6 }}>{role}</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            alignItems: 'center',
            marginTop: 40,
            padding: '12px 26px',
            borderRadius: 9999,
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {stage}
        </div>

        <div style={{ fontSize: 30, color: '#4B5563', marginTop: 40 }}>
          Three Boosts, built from a real career: see them, hear them, and hear them discussed.
        </div>
      </div>
    ),
    { ...size },
  );
}
