'use client';

import { useState, type ElementType } from 'react';
import {
  Headphones,
  MessageSquare,
  Video,
  Layout,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
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
  /** Fill the parent height (the calling card's right column). */
  fill?: boolean;
}

const CONFIG: Record<AssetType, { label: string; Icon: ElementType }> = {
  resume: { label: 'Résumé', Icon: FileText },
  infographic: { label: 'Infographic', Icon: ImageIcon },
  audio: { label: 'Audio overview', Icon: Headphones },
  debate_audio: { label: 'Debate audio', Icon: MessageSquare },
  video: { label: 'Video', Icon: Video },
  deck: { label: 'Slide deck', Icon: Layout },
};

// Résumé sits below the career snapshot; the rest follow. Each is its own bar,
// collapsed by default -- the recruiter opens what they want.
const ORDER: AssetType[] = ['resume', 'infographic', 'audio', 'debate_audio', 'video', 'deck'];

export default function AssetGallery({ firstName, assets, fill = false }: Props) {
  const items = ORDER.map((type) => ({ type, asset: assets.find((a) => a.asset_type === type) })).filter(
    (x): x is { type: AssetType; asset: Asset } => !!x.asset,
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (items.length === 0) return null;

  return (
    <div
      className={
        fill
          ? 'flex h-full min-h-0 flex-col gap-2 overflow-y-auto'
          : 'mx-auto flex max-w-3xl flex-col gap-2'
      }
    >
      {items.map(({ type, asset }) => {
        const { label, Icon } = CONFIG[type];
        const isOpen = !!open[type];
        return (
          <div key={type} className="rb-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [type]: !o[type] }))}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
                <Icon className="size-4 text-[var(--rb-brand)]" />
              </span>
              <span className="flex-1 text-sm font-semibold text-[var(--rb-text)]">{label}</span>
              <ChevronDown
                className={`size-4 shrink-0 text-[var(--rb-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {/* Rendered only when open, so signed-URL assets load lazily. */}
            {isOpen && (
              <div className="border-t border-[var(--rb-border)] p-3">
                <AssetBody type={type} asset={asset} firstName={firstName} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssetBody({ type, asset, firstName }: { type: AssetType; asset: Asset; firstName: string }) {
  if (type === 'audio' || type === 'debate_audio') {
    return <AudioPlayer src={asset.signed_url} title={asset.file_name} />;
  }
  if (type === 'video') {
    return (
      <video
        src={asset.signed_url}
        controls
        className="w-full rounded-[var(--radius-md)]"
        aria-label={`${firstName}'s career video`}
      />
    );
  }
  if (type === 'infographic') {
    return (
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.signed_url}
          alt={`${firstName}'s career infographic`}
          className="w-full rounded-[var(--radius-md)]"
        />
        <a
          href={asset.signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-[var(--rb-text-brand)] hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Open full size
        </a>
      </div>
    );
  }
  // Résumé / deck: read inline as a document.
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--rb-border)]">
      <iframe src={asset.signed_url} title={asset.file_name} className="w-full" style={{ height: 'min(70vh, 520px)' }} />
    </div>
  );
}
