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
 * Layer 2 of the calling card -- the asset suite, demoted from primary tabs to a
 * secondary "More from <name>" viewer. One asset renders at a time (lazy, like
 * the original modal) so we never preload every embed.
 */
export default function AssetGallery({ firstName, assets }: Props) {
  const available = TAB_ORDER.filter((t) => assets.some((a) => a.asset_type === t));
  const [active, setActive] = useState<AssetType | null>(available[0] ?? null);

  if (available.length === 0) return null;
  const asset = assets.find((a) => a.asset_type === active);

  return (
    <div className="mx-auto max-w-3xl px-6">
      <p className="rb-section-label mb-3">More from {firstName}</p>

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

      {asset && (active === 'audio' || active === 'debate_audio') && (
        <div className="rb-card mx-auto max-w-md p-6">
          <AudioPlayer src={asset.signed_url} title={asset.file_name} />
        </div>
      )}

      {asset && active === 'video' && (
        <div className="rb-card overflow-hidden">
          <video
            src={asset.signed_url}
            controls
            className="aspect-video w-full bg-black"
            aria-label={`${firstName}'s career video`}
          />
        </div>
      )}

      {asset && (active === 'deck' || active === 'resume') && (
        <div className="rb-card overflow-hidden">
          <iframe src={asset.signed_url} title={asset.file_name} className="w-full" style={{ height: '70vh' }} />
        </div>
      )}

      {asset && active === 'infographic' && (
        <div className="rb-card flex justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.signed_url}
            alt={`${firstName}'s career infographic`}
            className="max-h-[70vh] max-w-full rounded-[var(--radius-lg)] object-contain"
          />
        </div>
      )}
    </div>
  );
}
