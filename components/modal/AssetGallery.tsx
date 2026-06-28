'use client';

import { useState, type ElementType } from 'react';
import { Headphones, MessageSquare, Video, Layout, Image as ImageIcon, FileText } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';

interface Asset {
  asset_type: AssetType;
  file_name: string;
  signed_url: string;
}

interface Props {
  firstName: string;
  assets: Asset[];
  /** Fill the parent height (right-column panel) instead of the standalone, max-width layout. */
  fill?: boolean;
}

const TAB_CONFIG: Record<AssetType, { label: string; Icon: ElementType }> = {
  audio: { label: 'Audio', Icon: Headphones },
  debate_audio: { label: 'Debate', Icon: MessageSquare },
  video: { label: 'Video', Icon: Video },
  deck: { label: 'Deck', Icon: Layout },
  infographic: { label: 'Infographic', Icon: ImageIcon },
  resume: { label: 'Résumé', Icon: FileText },
};

const TAB_ORDER: AssetType[] = ['audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume'];

/**
 * The asset suite viewer. One asset renders at a time (lazy) so we never preload
 * every embed. In `fill` mode it stretches to its parent (the calling card's
 * right column); otherwise it lays out standalone with its own max width.
 */
export default function AssetGallery({ firstName, assets, fill = false }: Props) {
  const available = TAB_ORDER.filter((t) => assets.some((a) => a.asset_type === t));
  const [active, setActive] = useState<AssetType | null>(available[0] ?? null);

  if (available.length === 0) return null;
  const asset = assets.find((a) => a.asset_type === active);
  const isMedia = active === 'audio' || active === 'debate_audio';

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-col' : 'mx-auto max-w-3xl px-6'}>
      {!fill && <p className="rb-section-label mb-3">More from {firstName}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {available.map((t) => {
          const { label, Icon } = TAB_CONFIG[t];
          const isActive = active === t;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--rb-brand)] text-white'
                  : 'border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] hover:border-[var(--rb-border-strong)]'
              }`}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Viewer. In fill mode it takes the remaining height; otherwise fixed heights. */}
      <div className={fill ? 'flex min-h-0 flex-1 flex-col' : ''}>
        {asset && isMedia && (
          <div className={`rb-card p-6 ${fill ? 'flex flex-1 items-center justify-center' : 'mx-auto max-w-md'}`}>
            <div className="w-full">
              <AudioPlayer src={asset.signed_url} title={asset.file_name} />
            </div>
          </div>
        )}

        {asset && active === 'video' && (
          <div className={`rb-card overflow-hidden ${fill ? 'flex flex-1 items-center justify-center bg-black' : ''}`}>
            <video
              src={asset.signed_url}
              controls
              className={fill ? 'max-h-full w-full' : 'aspect-video w-full bg-black'}
              aria-label={`${firstName}'s career video`}
            />
          </div>
        )}

        {asset && (active === 'deck' || active === 'resume') && (
          <div className={`rb-card overflow-hidden ${fill ? 'flex-1' : ''}`}>
            <iframe
              src={asset.signed_url}
              title={asset.file_name}
              className="w-full"
              style={fill ? { height: '100%' } : { height: '70vh' }}
            />
          </div>
        )}

        {asset && active === 'infographic' && (
          <div className={`rb-card flex justify-center p-4 ${fill ? 'min-h-0 flex-1 items-center' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.signed_url}
              alt={`${firstName}'s career infographic`}
              className="max-h-full max-w-full rounded-[var(--radius-lg)] object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
